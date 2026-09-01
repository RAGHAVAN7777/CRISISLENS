"""
Feature engineering definitions for Disaster Time Machine
"""

import os
import pandas as pd
import numpy as np

# Hydrological and geographic feature constants
SEQUENCE_LENGTH = 5  # T-4, T-3, T-2, T-1, T0

FEATURE_COLUMNS = [
    'rainfall_t0',
    'rainfall_t_minus_1',
    'rainfall_t_minus_2',
    'rainfall_t_minus_3',
    'rainfall_t_minus_4',
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

TARGET_COLUMNS = [
    'target_risk_15m',
    'target_risk_30m',
    'target_risk_60m'
]
