"""
Data preprocessing & temporal sequence builder for Disaster Time Machine
"""

import os
import json
import pandas as pd
import numpy as np
from datetime import datetime

DS_DIR = "/Users/pranaveashwarang/Desktop/Disaster/ds"
OUTPUT_DIR = "/Users/pranaveashwarang/Desktop/Disaster/ml/time_machine/data"

def prepare_dataset():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Loading raw datasets...")

    # 1. Rainfall telemetry
    rf_file = os.path.join(DS_DIR, "rainfall_tel_hr_tamil_nadu_sw_gw_tn_2026_2030.csv")
    df_rf = pd.read_csv(rf_file)
    df_rf['datetime'] = pd.to_datetime(df_rf['Data Acquisition Time'], format='%d-%m-%Y %H:%M', errors='coerce')
    df_rf = df_rf.dropna(subset=['datetime']).sort_values(by=['Station', 'datetime']).reset_index(drop=True)

    # 2. District Flooded Area & Impact
    area_file = os.path.join(DS_DIR, "11275211/District_FloodedArea.csv")
    imp_file = os.path.join(DS_DIR, "11275211/District_FloodImpact.csv")
    df_area = pd.read_csv(area_file) if os.path.exists(area_file) else pd.DataFrame()
    df_imp = pd.read_csv(imp_file) if os.path.exists(imp_file) else pd.DataFrame()

    # Create district lookup
    district_stats = {}
    if not df_area.empty:
        for _, row in df_area.iterrows():
            dname = str(row.get('Dist_Name', '')).strip().lower()
            district_stats[dname] = {
                'flooded_area_pct': float(row.get('Corrected_Percent_Flooded_Area', row.get('Percent_Flooded_Area', 2.0))),
                'perm_water_pct': float(row.get('Parmanent_Water', 1.0)),
                'mean_duration': 2.0
            }
    if not df_imp.empty:
        for _, row in df_imp.iterrows():
            dname = str(row.get('Dist_Name', '')).strip().lower()
            if dname in district_stats:
                dur = row.get('Mean_Flood_Duration')
                if pd.notnull(dur) and float(dur) > 0:
                    district_stats[dname]['mean_duration'] = float(dur)

    # 3. India Flood Inventory
    inv_file = os.path.join(DS_DIR, "11275211/India_Flood_Inventory_v3.csv")
    tn_district_event_counts = {}
    if os.path.exists(inv_file):
        df_inv = pd.read_csv(inv_file)
        tn_inv = df_inv[df_inv['State'].str.contains('Tamil', case=False, na=False)]
        for _, row in tn_inv.iterrows():
            dists = str(row.get('Districts', '')).lower().split(',')
            for d in dists:
                d = d.strip()
                tn_district_event_counts[d] = tn_district_event_counts.get(d, 0) + 1

    # Build sequence dataset per station
    print(f"Building temporal sequences across {df_rf['Station'].nunique()} stations...")
    samples = []

    for station, group in df_rf.groupby('Station'):
        group = group.sort_values(by='datetime').reset_index(drop=True)
        district = str(group['District'].iloc[0]).strip().lower()
        lat = float(group['Latitude'].iloc[0])
        lng = float(group['Longitude'].iloc[0])

        d_stat = district_stats.get(district, {
            'flooded_area_pct': 3.5,
            'perm_water_pct': 1.2,
            'mean_duration': 2.0
        })
        hist_events = tn_district_event_counts.get(district, 3)

        rain_series = group['Telemetry Hourly Rainfall (mm)'].values
        time_series = group['datetime'].values

        n_records = len(rain_series)
        if n_records < 5:
            continue

        for i in range(4, n_records):
            r_t0 = float(rain_series[i])
            r_t1 = float(rain_series[i-1])
            r_t2 = float(rain_series[i-2])
            r_t3 = float(rain_series[i-3])
            r_t4 = float(rain_series[i-4])

            # Rolling stats
            r_3h_mean = float(np.mean([r_t0, r_t1, r_t2]))
            r_6h_sum = float(np.sum(rain_series[max(0, i-5):i+1]))
            r_delta = r_t0 - r_t1
            r_accel = (r_t0 - r_t1) - (r_t1 - r_t2)

            # Target formulation: Hydrological flood risk escalation probability
            # Based on IMD/CWC rainfall severity scales + topography susceptibility
            # 15m risk: Driven by instantaneous rainfall + rate of change
            base_15 = (r_t0 / 40.0) + (max(0, r_delta) / 30.0) * 0.5
            suscept_factor = (d_stat['flooded_area_pct'] / 10.0)
            risk_15 = np.clip(base_15 * 0.7 + suscept_factor * 0.3, 0.0, 1.0)

            # 30m risk: Driven by 3-hour accumulation + accelerating rainfall
            base_30 = (r_3h_mean / 35.0) + (max(0, r_accel) / 25.0) * 0.4
            risk_30 = np.clip(base_30 * 0.65 + suscept_factor * 0.35, 0.0, 1.0)

            # 60m risk: Driven by 6-hour saturation + basin vulnerability
            base_60 = (r_6h_sum / 75.0)
            risk_60 = np.clip(base_60 * 0.60 + suscept_factor * 0.40, 0.0, 1.0)

            samples.append({
                'station': station,
                'district': district,
                'datetime': pd.to_datetime(time_series[i]).strftime('%Y-%m-%d %H:%M'),
                'timestamp_epoch': pd.to_datetime(time_series[i]).timestamp(),
                'rainfall_t0': r_t0,
                'rainfall_t_minus_1': r_t1,
                'rainfall_t_minus_2': r_t2,
                'rainfall_t_minus_3': r_t3,
                'rainfall_t_minus_4': r_t4,
                'rainfall_rolling_3h_mean': r_3h_mean,
                'rainfall_rolling_6h_sum': r_6h_sum,
                'rainfall_delta_1h': r_delta,
                'rainfall_acceleration': r_accel,
                'latitude': lat,
                'longitude': lng,
                'district_flooded_area_pct': d_stat['flooded_area_pct'],
                'district_permanent_water_pct': d_stat['perm_water_pct'],
                'district_mean_flood_duration': d_stat['mean_duration'],
                'district_hist_event_density': hist_events,
                'live_report_corroboration': 0.0,
                'volunteer_verified_weight': 0.0,
                'target_risk_15m': float(risk_15),
                'target_risk_30m': float(risk_30),
                'target_risk_60m': float(risk_60),
                # Binary classification labels (> 0.5 threshold)
                'target_class_15m': int(risk_15 >= 0.5),
                'target_class_30m': int(risk_30 >= 0.5),
                'target_class_60m': int(risk_60 >= 0.5),
            })

    df_dataset = pd.DataFrame(samples)
    print(f"Total processed samples: {len(df_dataset):,}")

    # Temporal split: Older data for Train, mid for Val, latest for Test
    df_dataset = df_dataset.sort_values(by='timestamp_epoch').reset_index(drop=True)
    n_total = len(df_dataset)
    n_train = int(n_total * 0.70)
    n_val = int(n_total * 0.15)

    df_train = df_dataset.iloc[:n_train]
    df_val = df_dataset.iloc[n_train:n_train+n_val]
    df_test = df_dataset.iloc[n_train+n_val:]

    print(f"Train split: {len(df_train):,} ({df_train['datetime'].min()} to {df_train['datetime'].max()})")
    print(f"Val split:   {len(df_val):,} ({df_val['datetime'].min()} to {df_val['datetime'].max()})")
    print(f"Test split:  {len(df_test):,} ({df_test['datetime'].min()} to {df_test['datetime'].max()})")

    # Save splits
    df_dataset.to_csv(os.path.join(OUTPUT_DIR, "all_sequences.csv"), index=False)
    df_train.to_csv(os.path.join(OUTPUT_DIR, "train.csv"), index=False)
    df_val.to_csv(os.path.join(OUTPUT_DIR, "val.csv"), index=False)
    df_test.to_csv(os.path.join(OUTPUT_DIR, "test.csv"), index=False)

    # Compute and save normalization parameters from TRAIN ONLY
    from features import FEATURE_COLUMNS
    feature_means = df_train[FEATURE_COLUMNS].mean().to_dict()
    feature_stds = df_train[FEATURE_COLUMNS].std().replace(0, 1.0).to_dict()

    norm_params = {
        'means': feature_means,
        'stds': feature_stds,
        'feature_columns': FEATURE_COLUMNS,
        'sequence_length': 5,
        'created_at': datetime.now().isoformat(),
        'n_train': len(df_train),
        'n_val': len(df_val),
        'n_test': len(df_test)
    }

    with open(os.path.join(OUTPUT_DIR, "norm_params.json"), "w") as f:
        json.dump(norm_params, f, indent=2)

    print("Dataset prepared successfully in", OUTPUT_DIR)

if __name__ == "__main__":
    prepare_dataset()
