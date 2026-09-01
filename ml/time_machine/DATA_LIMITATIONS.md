# Disaster Time Machine — Data Limitations & Scientific Formulation

## 1. Dataset Scope and Limitations

### A. Temporal Resolution of Telemetry
- **Dataset**: `rainfall_tel_hr_tamil_nadu_sw_gw_tn_2026_2030.csv`
- **Native Sampling**: Hourly telemetry acquisition timestamps (e.g. `21-02-2026 16:00`, `17:00`, etc.).
- **Limitation**: Continuous physical rainfall sensors transmit discrete hourly summaries. Sub-hourly increments (15-minute, 30-minute intervals) are not natively recorded at 15-minute sub-intervals in this dataset.
- **Scientific Solution**:
  - We construct temporal sequences from past hourly observations ($T_{-4h}, T_{-3h}, T_{-2h}, T_{-1h}, T_0$) and rolling metrics (1h, 3h, 6h, 24h cumulative rainfall, instantaneous acceleration $d^2R/dt^2$, and antecedent precipitation index).
  - Short-term future horizons ($T+15\text{m}, T+30\text{m}, T+60\text{m}$) are projected through hydraulic escalation curves calibrated with Indian Meteorological Department (IMD) and Central Water Commission (CWC) flash flood thresholds combined with district topographic susceptibility.

### B. Geographic Coverage & Matching
- **Telemetry**: 139 stations across 36 districts of Tamil Nadu.
- **Historical Inventory**: 6,876 records spanning 1967–2023 across India (188 in Tamil Nadu).
- **Matching Methodology**:
  - Stations and historical flood events are merged based on exact administrative district codes (`District LGD Code` / `Dist_Name`) and nearest spatial coordinates (WGS84 Haversine distance).
  - Unrelated geographic regions (e.g. Assam or Himachal Pradesh records) are **never** erroneously joined to Tamil Nadu station sequences without spatial justification.

### C. Satellite Remote Sensing / Prithvi Codebase
- **Dataset**: `prithvi_segmentation-main/`
- **Limitation**: The repository contains PyTorch model definitions for ViT/UNet segmentation on Sen1Floods11, but does **not** include local raster GeoTIFF files or temporal satellite video sequences.
- **Scientific Treatment**:
  - We do **not** claim to run multi-timestep real-time satellite imagery inference.
  - Spatial risk contours are generated via geospatial coordinate interpolation and terrain susceptibility indices rather than fabricated raster passes.

---

## 2. Target Variable Formulation

The forecasting target is defined as the multi-horizon probability of localized flood risk escalation:

$$Y_{h} \in [0, 1] \quad \text{for } h \in \{15\text{m}, 30\text{m}, 60\text{m}\}$$

Where the risk state is classified according to hydrological standards:
- **Low Risk ($< 0.35$)**: Rainfall $< 10\text{ mm/hr}$, normal drainage capacity.
- **Moderate Risk ($0.35 - 0.65$)**: Rainfall $10 - 25\text{ mm/hr}$ with moderate historical susceptibility.
- **High Risk ($0.65 - 0.85$)**: Rainfall $25 - 50\text{ mm/hr}$ or high cumulative antecedent rainfall in flood-prone districts.
- **Critical Risk ($> 0.85$)**: Extreme rainfall $> 50\text{ mm/hr}$ or high-rate surge in districts with $\ge 8\%$ historical flooded area.

Confidence scores and epistemic uncertainty bounds are calibrated based on prediction variance and validation set Brier scores.
