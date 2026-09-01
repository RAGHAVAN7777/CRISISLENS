# Disaster Time Machine — Comprehensive Dataset Inspection Report

> **Generated**: 2026-09-01
> **Location**: `/Users/pranaveashwarang/Desktop/Disaster/ds`
> **Purpose**: Systematic evaluation of all local dataset resources for real, data-driven disaster risk forecasting.

---

## Executive Summary

Four distinct data and code assets were inspected in the dataset directory:
1. **Tamil Nadu Hourly Rainfall Telemetry (`rainfall_tel_hr_tamil_nadu_sw_gw_tn_2026_2030.csv`)**: High-temporal-resolution telemetry records across 139 monitoring stations in 36 districts of Tamil Nadu for the year 2026.
2. **India Flood Inventory v3 (`11275211/India_Flood_Inventory_v3.csv`)**: Historical national inventory of 6,876 recorded flood events (1967–2023) detailing causes, casualties, duration, and district codes.
3. **District Flood Impact & Flooded Area (`11275211/District_FloodedArea.csv` & `District_FloodImpact.csv`)**: 732 Indian districts with computed flood inundation percentage, permanent water bodies, population, and mean duration.
4. **Prithvi Segmentation Repository (`prithvi_segmentation-main/`)**: PyTorch/ViT/UNet segmentation model code architecture for geospatial Earth observation (Sen1Floods11 format). No local raster imagery/weights are present in the download.

---

## 1. Tamil Nadu Hourly Rainfall Telemetry

- **File**: `rainfall_tel_hr_tamil_nadu_sw_gw_tn_2026_2030.csv`
- **Records**: 13,573 rows, 20 columns
- **File Size**: 1,834,089 bytes
- **Time Range**: 2026-01-01 00:00 to 2026-08-30 23:00
- **Geographic Coverage**: Tamil Nadu, India (Lat: 8.1197°N – 13.3314°N, Lon: 76.4228°E – 80.2792°E)
- **Monitoring Stations**: 139 unique stations across 36 districts
- **Important Columns**:
  - `Station`: Monitoring station name
  - `District`, `Tehsil`, `Block`, `Village`: Administrative spatial hierarchy
  - `River`, `Basin`, `Tributary`, `Subtributary`: Hydrological basin hierarchy
  - `Latitude`, `Longitude`: Exact WGS84 coordinates
  - `Data Acquisition Time`: Timestamp of telemetry reading
  - `Telemetry Hourly Rainfall (mm)`: Measured precipitation in millimeters
- **Rainfall Distribution Summary**:
  - Mean: 6.22 mm
  - Median: 1.00 mm
  - Max: 1545.50 mm
  - Heavy Rain (>20 mm/hr): 673 records
  - Extreme Rain (>50 mm/hr): 241 records
- **Missing Data**: 0 missing values across all columns
- **Potential Use for Forecasting**: Serves as the core dynamic temporal driving force for short-term flood risk escalation. Sequential telemetry per station enables lag features ($T-60\text{m}, T-45\text{m}, T-30\text{m}, T-15\text{m}, T_0$) and rolling aggregations (1h, 3h, 6h cumulative rainfall).

---

## 2. India Flood Inventory v3

- **File**: `11275211/India_Flood_Inventory_v3.csv`
- **Records**: 6,876 flood event records, 23 columns
- **File Size**: 1,801,579 bytes
- **Time Range**: 1967 to 2023
- **Geographic Coverage**: Pan-India across all major states (188 documented historical events in Tamil Nadu)
- **Important Columns**:
  - `UEI`: Unique Event Identifier
  - `Start Date`, `End Date`, `Duration(Days)`: Temporal extent
  - `Main Cause`: Primary trigger (`heavy rains`, `flash flood`, `cyclonic storm`, etc.)
  - `Districts`, `State`, `District_LGD_Codes`, `State_Codes`: Spatial identifiers
  - `Human fatality`, `Human injured`, `Human Displaced`, `Animal Fatality`: Severity impact metrics
  - `Extent of damage`: Qualitative and quantitative damage descriptions
- **Missing Data**: Point coordinates (`Latitude`, `Longitude`) are empty in the summary table (recorded at district code level instead).
- **Potential Use for Forecasting**: Provides historical flood frequency baseline per district and empirical validation of trigger thresholds (e.g. heavy rains as main cause in >65% of recorded events).

---

## 3. District Flooded Area & Impact Statistics

- **Files**: `District_FloodedArea.csv` & `District_FloodImpact.csv`
- **Records**: 732 districts across India
- **Important Columns**:
  - `Dist_Name`: District Name
  - `Percent_Flooded_Area`: Remote-sensing derived historical inundated area percentage
  - `Parmanent_Water`: Baseline water surface percentage
  - `Corrected_Percent_Flooded_Area`: Normalized inundation susceptibility
  - `Human_fatality`, `Human_injured`, `Population`, `Mean_Flood_Duration`: Vulnerability factors
- **Spatial Matching**: 31 out of 36 Tamil Nadu districts match directly with telemetry station district names.
- **Potential Use for Forecasting**: Acts as static geospatial susceptibility features (terrain, drainage, historical vulnerability) when combined with dynamic rainfall telemetry.

---

## 4. Prithvi Segmentation Resources

- **Path**: `ds/prithvi_segmentation-main/`
- **Contents**: Python codebase containing PyTorch implementations for:
  - `models/prithvi_encoder.py`: ViT / Masked Autoencoder backbone
  - `models/prithvi_segmenter.py`, `models/prithvi_unet.py`: UNet and ensemble segmentation heads
  - `data_loading/sen1floods11.py`: Dataset loader for Sentinel-1/Sentinel-2 flood imagery
- **Missing/Limitations**: The local repository zip does NOT contain downloaded satellite imagery GeoTIFF rasters or pre-trained `.pth` checkpoint weights.
- **Conclusion**: While this codebase demonstrates architecture for static 2D flood segmentation from satellite rasters, it does NOT provide temporal multi-timestep satellite sequences suitable for 15/30/60-minute time-series forecasting. As per scientific guidelines in Step 2, we document this limitation transparently rather than fabricating artificial raster sequences.

---

## Summary Matrix

| Dataset | Purpose | Records | Time Range | Geographic Scope | Key Forecasting Role |
|---|---|---|---|---|---|
| **Tamil Nadu Telemetry** | Dynamic Rainfall Series | 13,573 | 2026 (Hourly) | 139 stations in TN | Temporal driving input ($T_{-60\text{m}} \to T_0$) |
| **India Flood Inventory** | Historical Ground Truth | 6,876 | 1967–2023 | Pan-India (188 in TN) | Frequency & trigger validation |
| **District Flooded Area** | Spatial Susceptibility | 732 | Multi-year satellite | All India districts | Static topographic / drainage risk index |
| **Prithvi Repo** | Segmentation Architecture | Code only | N/A | Global (Sen1Floods11) | Architecture template (No local rasters) |