"""Train models to predict final grade G3 (0-20) on the UCI Student Performance dataset.
Models: Linear Regression (baseline) and Random Forest (served by the website).
Run:  python train.py
"""
import io, json, zipfile, urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# ---------------- config ----------------
USE_G1_G2 = False   # False = early prediction (harder). True = uses earlier grades G1/G2 (R2 about 0.9).
SEED = 42
MODEL_NAME = "Random Forest"
DATA_DIR, MODEL_DIR, OUT_DIR = Path("data"), Path("models"), Path("outputs")
CSV_PATH = DATA_DIR / "student-mat.csv"
URL = "https://archive.ics.uci.edu/static/public/320/student+performance.zip"
for d in (DATA_DIR, MODEL_DIR, OUT_DIR):
    d.mkdir(exist_ok=True)


def get_data() -> pd.DataFrame:
    if not CSV_PATH.exists():
        print("Downloading UCI Student Performance dataset...")
        try:
            raw = urllib.request.urlopen(URL, timeout=60).read()
            z = zipfile.ZipFile(io.BytesIO(raw))
            if "student-mat.csv" not in z.namelist():
                for n in z.namelist():
                    if n.endswith(".zip"):
                        z = zipfile.ZipFile(io.BytesIO(z.read(n)))
                        break
            CSV_PATH.write_bytes(z.read("student-mat.csv"))
        except Exception as e:
            raise SystemExit(f"Auto-download failed ({e}).\nPut student-mat.csv from "
                             "https://archive.ics.uci.edu/dataset/320/student+performance in data/")
    return pd.read_csv(CSV_PATH, sep=";")


def metrics(y, p):
    p = np.clip(p, 0, 20)
    return {"MAE": float(mean_absolute_error(y, p)),
            "RMSE": float(np.sqrt(mean_squared_error(y, p))),
            "R2": float(r2_score(y, p))}


def main():
    df = get_data().drop_duplicates()
    print("Data:", df.shape, "| nulls:", int(df.isna().sum().sum()))

    plt.figure(figsize=(6, 4)); sns.histplot(df["G3"], bins=20, kde=True)
    plt.title("Final grade (G3) distribution"); plt.tight_layout(); plt.savefig(OUT_DIR / "eda_g3_dist.png", dpi=120); plt.close()
    plt.figure(figsize=(9, 7)); sns.heatmap(df.select_dtypes("number").corr(), cmap="coolwarm", center=0)
    plt.title("Correlation heatmap"); plt.tight_layout(); plt.savefig(OUT_DIR / "eda_corr.png", dpi=120); plt.close()

    y = df["G3"].values.astype("float32")
    X = df.drop(columns=["G3", "school"] + ([] if USE_G1_G2 else ["G1", "G2"]))   # school is excluded on purpose
    cat_cols = X.select_dtypes(exclude="number").columns.tolist()
    num_cols = [c for c in X.columns if c not in cat_cols]
    pre = ColumnTransformer([
        ("num", StandardScaler(), num_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols),
    ])
    X_tr, X_tmp, y_tr, y_tmp = train_test_split(X, y, test_size=0.30, random_state=SEED)
    X_va, X_te, y_va, y_te = train_test_split(X_tmp, y_tmp, test_size=0.50, random_state=SEED)
    Xtr, Xva, Xte = pre.fit_transform(X_tr), pre.transform(X_va), pre.transform(X_te)

    results = {}
    lr = LinearRegression().fit(Xtr, y_tr)
    results["Linear Regression"] = metrics(y_te, lr.predict(Xte))

    # Random Forest: pick settings on the validation set, report on the test set
    best, best_r2 = None, -9
    for leaf in (1, 3, 5, 8):
        for mf in (1.0, 0.5, 0.33):
            m = RandomForestRegressor(300, min_samples_leaf=leaf, max_features=mf, random_state=SEED, n_jobs=-1).fit(Xtr, y_tr)
            r2 = r2_score(y_va, np.clip(m.predict(Xva), 0, 20))
            if r2 > best_r2: best, best_r2, best_cfg = m, r2, (leaf, mf)
    print(f"Random Forest best settings (validation): min_samples_leaf={best_cfg[0]}, max_features={best_cfg[1]}")
    model = best
    pred = model.predict(Xte)
    results[MODEL_NAME] = metrics(y_te, pred)

    plt.figure(figsize=(5, 5)); plt.scatter(y_te, np.clip(pred, 0, 20), alpha=0.6); plt.plot([0, 20], [0, 20], "r--")
    plt.xlabel("Actual G3"); plt.ylabel("Predicted G3"); plt.title("Predicted vs Actual"); plt.tight_layout()
    plt.savefig(OUT_DIR / "pred_vs_actual.png", dpi=120); plt.close()

    # permutation importance on original columns (negative = shuffling did not hurt, i.e. no real signal)
    base = mean_absolute_error(y_te, model.predict(Xte)); imp = {}; rng = np.random.default_rng(SEED)
    for c in X.columns:
        errs = []
        for _ in range(10):
            Xp = X_te.copy(); Xp[c] = rng.permutation(Xp[c].values)
            errs.append(mean_absolute_error(y_te, model.predict(pre.transform(Xp))) - base)
        imp[c] = float(np.mean(errs))
    imp = dict(sorted(imp.items(), key=lambda kv: kv[1], reverse=True))
    top = sorted(imp.items(), key=lambda kv: abs(kv[1]), reverse=True)[:12]
    top = sorted(top, key=lambda kv: kv[1])
    plt.figure(figsize=(7, 5))
    plt.barh([k for k, _ in top], [v for _, v in top], color=["#ef4444" if v < 0 else "#6c74ff" for _, v in top])
    plt.axvline(0, color="k", lw=0.8); plt.xlabel("Change in MAE when feature is shuffled")
    plt.title("Feature importance"); plt.tight_layout(); plt.savefig(OUT_DIR / "feature_importance.png", dpi=120); plt.close()

    joblib.dump(model, MODEL_DIR / "model.joblib"); joblib.dump(pre, MODEL_DIR / "preprocessor.joblib")
    defaults = {c: (X[c].mode()[0] if c in cat_cols else float(X[c].median())) for c in X.columns}
    json.dump({"columns": X.columns.tolist(), "cat_cols": cat_cols, "num_cols": num_cols, "defaults": defaults,
               "options": {c: sorted(X[c].unique().tolist()) for c in cat_cols},
               "ranges": {c: [float(X[c].min()), float(X[c].max())] for c in num_cols},
               "use_g1_g2": USE_G1_G2, "model_name": MODEL_NAME}, open(MODEL_DIR / "meta.json", "w"), indent=2)
    json.dump({"results": results, "importance": imp}, open(OUT_DIR / "results.json", "w"), indent=2)

    print("\n=== Test results ===")
    print(pd.DataFrame(results).T.round(3))
    print("\nSaved. Now run:  python server.py")


if __name__ == "__main__":
    main()
