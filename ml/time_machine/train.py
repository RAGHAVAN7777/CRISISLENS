"""
Training pipeline for Disaster Time Machine GRU Model
"""

import os
import json
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import pandas as pd
import numpy as np

from model import FloodTimeMachineGRU
from features import FEATURE_COLUMNS, TARGET_COLUMNS

DATA_DIR = "/Users/pranaveashwarang/Desktop/Disaster/ml/time_machine/data"
MODELS_DIR = "/Users/pranaveashwarang/Desktop/Disaster/ml/models"

class TimeMachineDataset(Dataset):
    def __init__(self, df, norm_params):
        self.df = df
        self.means = norm_params['means']
        self.stds = norm_params['stds']

        # Temporal sequence columns (T-4 to T0)
        self.seq_cols = [
            'rainfall_t_minus_4',
            'rainfall_t_minus_3',
            'rainfall_t_minus_2',
            'rainfall_t_minus_1',
            'rainfall_t0'
        ]

        # Spatial and contextual features
        self.spatial_cols = [
            'rainfall_rolling_3h_mean',
            'rainfall_rolling_6h_sum',
            'rainfall_delta_1h',
            'rainfall_acceleration',
            'latitude',
            'longitude',
            'district_flooded_area_pct',
            'district_permanent_water_pct',
            'district_mean_flood_duration',
            'district_hist_event_density',
            'live_report_corroboration',
            'volunteer_verified_weight'
        ]

        # Normalize features
        norm_df = df.copy()
        for col in FEATURE_COLUMNS:
            if col in norm_df.columns:
                m = self.means.get(col, 0.0)
                s = self.stds.get(col, 1.0)
                if s == 0 or np.isnan(s):
                    s = 1.0
                norm_df[col] = (norm_df[col] - m) / s

        # Build tensors
        # Sequence shape: (N, 5, 1) or expanded
        seq_vals = norm_df[self.seq_cols].values # (N, 5)
        # Expand each timestep with lag value and delta
        seq_tensor = np.zeros((len(df), 5, 5), dtype=np.float32)
        for t in range(5):
            seq_tensor[:, t, 0] = seq_vals[:, t]
            if t > 0:
                seq_tensor[:, t, 1] = seq_vals[:, t] - seq_vals[:, t-1]
            seq_tensor[:, t, 2] = norm_df['latitude'].values
            seq_tensor[:, t, 3] = norm_df['longitude'].values
            seq_tensor[:, t, 4] = norm_df['district_flooded_area_pct'].values

        self.x_seq = torch.tensor(seq_tensor, dtype=torch.float32)
        self.x_spatial = torch.tensor(norm_df[self.spatial_cols].values, dtype=torch.float32)
        self.y_targets = torch.tensor(df[TARGET_COLUMNS].values, dtype=torch.float32)

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        return self.x_seq[idx], self.x_spatial[idx], self.y_targets[idx]

def train_model():
    os.makedirs(MODELS_DIR, exist_ok=True)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    print("Loading datasets...")
    df_train = pd.read_csv(os.path.join(DATA_DIR, "train.csv"))
    df_val = pd.read_csv(os.path.join(DATA_DIR, "val.csv"))

    with open(os.path.join(DATA_DIR, "norm_params.json"), "r") as f:
        norm_params = json.load(f)

    train_dataset = TimeMachineDataset(df_train, norm_params)
    val_dataset = TimeMachineDataset(df_val, norm_params)

    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=128, shuffle=False)

    model = FloodTimeMachineGRU(
        temporal_dim=5,
        spatial_dim=12,
        hidden_dim=64,
        num_layers=2,
        dropout=0.25
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=3)
    bce_loss_fn = nn.BCELoss()
    mse_loss_fn = nn.MSELoss()

    best_val_loss = float('inf')
    best_checkpoint_path = os.path.join(MODELS_DIR, "flood_time_machine_gru.pth")

    epochs = 25
    print(f"Starting training for {epochs} epochs...")

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0

        for x_seq, x_spatial, y_true in train_loader:
            x_seq = x_seq.to(device)
            x_spatial = x_spatial.to(device)
            y_true = y_true.to(device)

            optimizer.zero_grad()
            probs, uncertainty = model(x_seq, x_spatial)

            # Combined loss: BCE on probabilities + MSE on continuous risk + uncertainty loss
            bce_loss = bce_loss_fn(probs, y_true)
            mse_loss = mse_loss_fn(probs, y_true)

            # Gaussian NLL style penalty for uncertainty
            var = uncertainty ** 2
            nll_loss = 0.5 * torch.mean((probs - y_true)**2 / var + torch.log(var))

            total_loss = bce_loss + 0.5 * mse_loss + 0.05 * nll_loss
            total_loss.backward()

            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            train_loss += total_loss.item() * len(x_seq)

        train_loss /= len(train_dataset)

        # Validation
        model.eval()
        val_loss = 0.0
        val_bce = 0.0

        with torch.no_grad():
            for x_seq, x_spatial, y_true in val_loader:
                x_seq = x_seq.to(device)
                x_spatial = x_spatial.to(device)
                y_true = y_true.to(device)

                probs, uncertainty = model(x_seq, x_spatial)
                bce = bce_loss_fn(probs, y_true)
                mse = mse_loss_fn(probs, y_true)

                val_loss += (bce + 0.5 * mse).item() * len(x_seq)
                val_bce += bce.item() * len(x_seq)

        val_loss /= len(val_dataset)
        val_bce /= len(val_dataset)
        scheduler.step(val_loss)

        print(f"Epoch {epoch:02d}/{epochs} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val BCE: {val_bce:.4f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save({
                'model_state_dict': model.state_dict(),
                'model_architecture': 'FloodTimeMachineGRU',
                'model_name': 'FloodTimeMachine-GRU',
                'model_version': 'v1.0.0',
                'training_dataset_version': 'TN-Rainfall-2026-v1',
                'temporal_dim': 5,
                'spatial_dim': 12,
                'hidden_dim': 64,
                'num_layers': 2,
                'norm_params': norm_params,
                'val_loss': val_loss
            }, best_checkpoint_path)
            print(f"  -> Saved best model checkpoint to {best_checkpoint_path}")

    print(f"\nTraining completed! Best checkpoint: {best_checkpoint_path}")

if __name__ == "__main__":
    train_model()
