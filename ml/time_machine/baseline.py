"""
Baseline models for Disaster Time Machine:
1. Persistence Baseline
2. Logistic Regression
3. Random Forest Regressor/Classifier
"""

import os
import json
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score, root_mean_squared_error, brier_score_loss

DATA_DIR = "/Users/pranaveashwarang/Desktop/Disaster/ml/time_machine/data"
from features import FEATURE_COLUMNS, TARGET_COLUMNS

def run_baselines():
    print("Loading data splits...")
    df_train = pd.read_csv(os.path.join(DATA_DIR, "train.csv"))
    df_test = pd.read_csv(os.path.join(DATA_DIR, "test.csv"))

    X_train = df_train[FEATURE_COLUMNS].values
    X_test = df_test[FEATURE_COLUMNS].values

    results = {}

    horizons = ['15m', '30m', '60m']

    for h in horizons:
        target_continuous = f'target_risk_{h}'
        target_class = f'target_class_{h}'

        y_train_cont = df_train[target_continuous].values
        y_test_cont = df_test[target_continuous].values
        y_train_cls = df_train[target_class].values
        y_test_cls = df_test[target_class].values

        print(f"\n=================== HORIZON: {h} ===================")

        # 1. Persistence Baseline (Predicting current rainfall-based risk from t0)
        # Baseline estimate from rainfall_t0 normalized
        y_pred_persist_cont = np.clip(df_test['rainfall_t0'].values / 40.0, 0.0, 1.0)
        y_pred_persist_cls = (y_pred_persist_cont >= 0.5).astype(int)

        persist_f1 = float(f1_score(y_test_cls, y_pred_persist_cls, zero_division=0))
        persist_prec = float(precision_score(y_test_cls, y_pred_persist_cls, zero_division=0))
        persist_rec = float(recall_score(y_test_cls, y_pred_persist_cls, zero_division=0))
        persist_rmse = float(root_mean_squared_error(y_test_cont, y_pred_persist_cont))
        persist_brier = float(brier_score_loss(y_test_cls, y_pred_persist_cont))

        print(f"[Persistence] F1: {persist_f1:.4f} | Prec: {persist_prec:.4f} | Rec: {persist_rec:.4f} | RMSE: {persist_rmse:.4f}")

        # 2. Logistic Regression / Ridge Baseline
        lr_cls = LogisticRegression(max_iter=1000, random_state=42)
        lr_cls.fit(X_train, y_train_cls)
        lr_probs = lr_cls.predict_proba(X_test)[:, 1]
        lr_preds = (lr_probs >= 0.5).astype(int)

        lr_f1 = float(f1_score(y_test_cls, lr_preds, zero_division=0))
        lr_prec = float(precision_score(y_test_cls, lr_preds, zero_division=0))
        lr_rec = float(recall_score(y_test_cls, lr_preds, zero_division=0))
        lr_auc = float(roc_auc_score(y_test_cls, lr_probs))
        lr_brier = float(brier_score_loss(y_test_cls, lr_probs))

        print(f"[Logistic Reg] F1: {lr_f1:.4f} | Prec: {lr_prec:.4f} | Rec: {lr_rec:.4f} | ROC-AUC: {lr_auc:.4f}")

        # 3. Random Forest Baseline
        rf_cls = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1)
        rf_cls.fit(X_train, y_train_cls)
        rf_probs = rf_cls.predict_proba(X_test)[:, 1]
        rf_preds = (rf_probs >= 0.5).astype(int)

        rf_f1 = float(f1_score(y_test_cls, rf_preds, zero_division=0))
        rf_prec = float(precision_score(y_test_cls, rf_preds, zero_division=0))
        rf_rec = float(recall_score(y_test_cls, rf_preds, zero_division=0))
        rf_auc = float(roc_auc_score(y_test_cls, rf_probs))
        rf_brier = float(brier_score_loss(y_test_cls, rf_probs))

        print(f"[Random Forest] F1: {rf_f1:.4f} | Prec: {rf_prec:.4f} | Rec: {rf_rec:.4f} | ROC-AUC: {rf_auc:.4f}")

        results[h] = {
            'persistence': {
                'f1': persist_f1, 'precision': persist_prec, 'recall': persist_rec, 'rmse': persist_rmse, 'brier': persist_brier
            },
            'logistic_regression': {
                'f1': lr_f1, 'precision': lr_prec, 'recall': lr_rec, 'roc_auc': lr_auc, 'brier': lr_brier
            },
            'random_forest': {
                'f1': rf_f1, 'precision': rf_prec, 'recall': rf_rec, 'roc_auc': rf_auc, 'brier': rf_brier
            }
        }

    out_file = os.path.join(DATA_DIR, "baseline_results.json")
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nBaseline results saved to {out_file}")

if __name__ == "__main__":
    run_baselines()
