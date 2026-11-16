"""Web server + UI for the UCI Student Performance model.
Run:  python server.py   ->  http://localhost:5000"""
import json, threading, webbrowser
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from flask import Flask, jsonify, request, send_from_directory

BASE = Path(__file__).parent
M, O, D = BASE / "models", BASE / "outputs", BASE / "data"
if not (M / "model.joblib").exists():
    raise SystemExit("Model not found. Run  python train.py  first.")

model = joblib.load(M / "model.joblib")
pre = joblib.load(M / "preprocessor.joblib")
meta = json.load(open(M / "meta.json"))
COLS, DEFAULTS, NUM = meta["columns"], meta["defaults"], meta["num_cols"]
PASS_MARK, GOOD_MARK, SCALE = 10, 14, 20
lock = threading.Lock()

app = Flask(__name__, static_folder="static", static_url_path="/static")


def predict_df(df: pd.DataFrame) -> np.ndarray:
    df = df.copy()
    for c in COLS:
        if c not in df.columns:
            df[c] = DEFAULTS[c]
        elif c in NUM:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(DEFAULTS[c])
        else:
            df[c] = df[c].astype(object).where(df[c].notna(), DEFAULTS[c])
    X = pre.transform(df[COLS])
    with lock:
        out = model.predict(X).ravel()
    return np.clip(out, 0, SCALE)


def status(x):
    return "At risk" if x < PASS_MARK else ("Average" if x < GOOD_MARK else "Good")


@app.get("/")
def index():
    return send_from_directory("static", "index.html")


@app.get("/outputs/<path:name>")
def outputs(name):
    return send_from_directory(O, name)


@app.get("/api/meta")
def api_meta():
    return jsonify({"use_g1_g2": meta.get("use_g1_g2", False), "scale": SCALE,
                    "pass_mark": PASS_MARK, "good_mark": GOOD_MARK,
                    "model_name": meta.get("model_name", "Random Forest")})


@app.post("/api/predict")
def api_predict():
    g = float(predict_df(pd.DataFrame([request.get_json(force=True)]))[0])
    return jsonify({"grade": round(g, 2)})


@app.post("/api/batch")
def api_batch():
    try:
        if request.args.get("sample"):
            df = pd.read_csv(D / "student-mat.csv", sep=";")
        else:
            df = pd.read_csv(request.files["file"], sep=None, engine="python")
    except Exception as e:
        return jsonify({"error": f"Could not read CSV: {e}"}), 400
    df = df.head(2000)
    df["Predicted_G3"] = predict_df(df).round(2)
    df["Status"] = df["Predicted_G3"].apply(status)
    return jsonify({"rows": json.loads(df.to_json(orient="records"))})


@app.get("/api/results")
def api_results():
    p = O / "results.json"
    if not p.exists():
        return jsonify({"error": "Run train.py first"}), 404
    res = json.load(open(p))
    res["images"] = sorted(f.name for f in O.glob("*.png"))
    return jsonify(res)


if __name__ == "__main__":
    threading.Timer(1.5, lambda: webbrowser.open("http://localhost:5000")).start()
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
