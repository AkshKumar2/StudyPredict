# StudyPredict: Student Performance Prediction (UCI, 395 students) - Random Forest + Web UI

Predicts a student's final grade G3 (0-20) with a Random Forest (scikit-learn), compared with
a Linear Regression baseline. No TensorFlow needed. Includes a web interface (Flask + HTML/CSS/JS).

## Run the website (trained model is already included)
```
pip install -r requirements.txt
python server.py
```
Opens http://localhost:5000

## Retrain (optional)
```
python train.py
```
Downloads/uses data/student-mat.csv, trains, and overwrites models/ and outputs/.
Set `USE_G1_G2 = True` at the top of train.py to use earlier grades (R2 about 0.9).

## Results (test set)
| Model | R2 | MAE |
|---|---|---|
| Linear Regression | 0.26 | 2.99 |
| Random Forest (served) | 0.32 | 3.00 |

## Structure
train.py, server.py, requirements.txt, static/ (website), data/, models/, outputs/,
sample_students.csv and sample_minimal.csv (for the Batch tab)
