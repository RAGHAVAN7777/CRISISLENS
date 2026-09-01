I want to upgrade the existing Disaster Intelligence Network with a REAL, DATA-DRIVEN version of the:

🔥 DISASTER TIME MACHINE

This is no longer just a UI simulation.

I have downloaded the following datasets/resources locally:

1. India Flood Inventory
   Folder/file:
   11275211 / 11275211.zip

2. Tamil Nadu hourly rainfall telemetry:
   rainfall_tel_hr_tamil_...csv

3. Prithvi segmentation resources:
   prithvi_segmentation-main.zip
   prithvi_segmentation-main-1.zip
   prithvi_segmentation-main/

The screenshot I provided shows these files.

IMPORTANT:
FIRST inspect the actual contents, schemas, columns, timestamps, coordinates, labels, raster/image formats and metadata of every dataset before writing the training pipeline.

Do NOT assume column names or dataset structure.

========================================================
GOAL
========================================================

Build a production-oriented prototype of:

DISASTER TIME MACHINE

which estimates how flood risk may evolve over time.

The system should eventually answer:

"Given the current flood/weather/spatial conditions, what areas are likely to become high-risk over the next 15, 30 and 60 minutes?"

The output should be a geospatial risk map that integrates with my existing:

- Citizen Report
- AI Image Classification
- Voice Report
- SMS Report
- Incident Fusion
- Volunteer Verification
- Leaflet Live Map
- Safe Evacuation Routing
- Dynamic Rerouting

Do NOT create a separate unrelated application.

========================================================
STEP 1 — INSPECT DATASETS
========================================================

Before implementing anything, inspect all provided datasets.

For each dataset determine:

- number of records
- number of files
- file formats
- columns
- data types
- latitude/longitude availability
- timestamps
- rainfall measurements
- flood labels
- flood polygons/raster information
- satellite imagery
- spatial resolution
- temporal resolution
- missing values
- duplicate records
- geographic coverage
- date range

Generate:

ml/TIME_MACHINE_DATASET_REPORT.md

containing:

Dataset
Purpose
Records
Time range
Geographic coverage
Important columns
Missing data
Limitations
Potential use for forecasting

DO NOT invent information.

========================================================
STEP 2 — UNDERSTAND THE ROLE OF EACH DATASET
========================================================

Use the datasets for different purposes.

India Flood Inventory:

Use as historical flood-event/ground-truth information where its structure supports it.

Tamil Nadu hourly rainfall:

Use as temporal weather/rainfall input.

Prithvi / segmentation resources:

Inspect carefully.

If they provide suitable satellite imagery and segmentation/flood labels, use them as spatial flood information.

If they do NOT provide temporal sequences suitable for forecasting, do not pretend they do.

Document the limitation.

========================================================
STEP 3 — DO NOT MIX DATA INCORRECTLY
========================================================

This is extremely important.

Do NOT simply concatenate unrelated datasets.

Only merge datasets when there is a valid:

TIME relationship

and/or

SPATIAL relationship.

For example:

rainfall station
+
nearby flood event
+
matching timestamp/date

should only be merged when the relationship is justified.

Use:

latitude
longitude
timestamp
date
region/district
spatial distance

where appropriate.

Document the matching methodology.

========================================================
STEP 4 — CREATE A FORECASTING DATASET
========================================================

Build:

ml/time_machine/

with:

prepare_forecasting_dataset.py

The goal is to create temporal sequences.

Conceptually:

PAST

T-60
T-45
T-30
T-15
T0

        ↓

FORECAST MODEL

        ↓

FUTURE

T+15
T+30
T+60

Example input features where available:

rainfall_1h
rainfall_3h
rainfall_6h
rainfall_24h
cumulative_rainfall
latitude
longitude
elevation
distance_to_water
historical_flood
observed_flood_extent
flood_event_density
etc.

Only include features actually supported by the datasets.

========================================================
STEP 5 — TARGET
========================================================

The forecasting target should be future flood risk.

Possible targets:

flood_probability_15m
flood_probability_30m
flood_probability_60m

OR spatial flood/no-flood labels if the data supports spatial forecasting.

Do NOT fabricate future labels.

If the available datasets cannot produce genuine 15/30/60-minute targets, STOP and clearly explain this in:

ml/time_machine/DATA_LIMITATIONS.md

Then implement the strongest scientifically valid forecasting target possible from the available data.

========================================================
STEP 6 — BASELINE FIRST
========================================================

Before using a complex neural network, implement a baseline.

Examples:

- persistence model
- logistic regression
- random forest
- gradient boosting

depending on the actual dataset.

Evaluate whether the neural model actually improves over the baseline.

Do NOT assume deep learning is better.

========================================================
STEP 7 — FORECAST MODEL
========================================================

If the dataset contains sufficient temporal sequences, implement a lightweight temporal model.

Preferred starting point:

LSTM / GRU

or

Temporal CNN

Do NOT immediately use an enormous transformer.

The model must accept sequences such as:

[T-60, T-45, T-30, T-15, T0]

and produce:

[T+15, T+30, T+60]

where supported by the data.

Use PyTorch.

Create:

ml/time_machine/train.py

ml/time_machine/evaluate.py

ml/time_machine/predict.py

========================================================
STEP 8 — SPATIAL FORECAST
========================================================

If the Prithvi/segmentation data supports spatial flood masks, investigate using it to produce spatial flood-risk predictions.

The desired conceptual output is:

CURRENT:

        🔴
      Flood
      Zone

+15 MIN:

      🟠🟠
    🟠🔴🟠

+30 MIN:

    🟠🟠🟠
   🟠🔴🟠🟠

+60 MIN:

   🟡🟠🟠🟡
  🟡🟠🔴🟠🟡

But DO NOT simply enlarge circles.

These zones must come from the model if spatial forecasting is supported.

If spatial prediction cannot be trained from the available data, implement a clearly labelled risk-projection layer and document that it is NOT a learned spatial forecast.

========================================================
STEP 9 — PROPER EVALUATION
========================================================

Do NOT report a random "accuracy percentage".

Evaluate using appropriate metrics.

For classification:

Precision
Recall
F1
ROC-AUC where appropriate
PR-AUC where appropriate

For spatial segmentation:

IoU
Dice/F1
Precision
Recall

For numerical prediction:

MAE
RMSE
R²

Evaluate separately for:

15 MIN
30 MIN
60 MIN

Generate:

ml/time_machine/evaluation_report.md

Example structure:

15 MIN

F1:
IoU:
Precision:
Recall:

30 MIN

F1:
IoU:
Precision:
Recall:

60 MIN

F1:
IoU:
Precision:
Recall:

ONLY display real measured values.

Never hardcode example values.

========================================================
STEP 10 — TEMPORAL SPLIT
========================================================

Do NOT randomly split temporal data.

Avoid:

random train/test splitting

when it causes future information leakage.

Prefer:

TRAIN:
older events

VALIDATION:
later events

TEST:
latest unseen events

The model must be evaluated on future-like unseen periods.

Document this.

========================================================
STEP 11 — UNCERTAINTY
========================================================

The system must NOT pretend every prediction is certain.

Return:

prediction
confidence
uncertainty

Example:

+15 MIN
Flood risk: HIGH
Confidence: 91%

+30 MIN
Flood risk: HIGH
Confidence: 78%

+60 MIN
Flood risk: MEDIUM
Confidence: 61%

IMPORTANT:

These confidence values must come from the actual model/evaluation/calibration methodology.

Do NOT generate fake confidence numbers.

========================================================
STEP 12 — FORECAST API
========================================================

Create a FastAPI service if the existing architecture already uses FastAPI.

Example:

POST /forecast

Input:

{
  "latitude": ...,
  "longitude": ...,
  "timestamp": ...
}

Output should contain something similar to:

{
  "location": {
    "latitude": ...,
    "longitude": ...
  },

  "forecast": {
    "15min": {
      "risk": ...,
      "probability": ...,
      "confidence": ...
    },

    "30min": {
      "risk": ...,
      "probability": ...,
      "confidence": ...
    },

    "60min": {
      "risk": ...,
      "probability": ...,
      "confidence": ...
    }
  },

  "model": "...",
  "data_sources": [...]
}

Use actual model output.

========================================================
STEP 13 — INTEGRATE WITH EXISTING INCIDENTS
========================================================

The existing citizen reports must become an additional live signal.

Existing:

PHOTO
VOICE
SMS

↓

INCIDENT

↓

FLOOD

↓

LOCATION

↓

TIME MACHINE

The live incident stream should NOT automatically be treated as ground truth.

Instead:

Citizen observation
↓
confidence
↓
verification
↓
corroboration
↓
forecast input

========================================================
STEP 14 — VOLUNTEER VERIFICATION
========================================================

Integrate volunteer verification.

Example:

Citizen:

FLOOD
confidence: 0.82
status: UNVERIFIED

↓

Volunteer:

CONFIRMED

↓

Forecast engine receives:

verified flood evidence

The system should record this as an additional evidence feature.

If:

FALSE REPORT

then remove/reduce its contribution.

========================================================
STEP 15 — DISASTER TIME MACHINE UI
========================================================

Create/update:

/forecast

UI:

================================================

🔮 DISASTER TIME MACHINE

LIVE FLOOD RISK FORECAST

[ NOW ] [ +15 MIN ] [ +30 MIN ] [ +60 MIN ]

================================================

LEAFLET MAP

Show:

🔴 observed/current flood

🟠 predicted high-risk area

🟡 predicted moderate-risk area

🟢 lower-risk area

================================================

FORECAST

NOW
Risk: HIGH

+15 MIN
Risk: HIGH
Confidence: XX%

+30 MIN
Risk: MEDIUM/HIGH
Confidence: XX%

+60 MIN
Risk: ...

================================================
WHY IS RISK CHANGING?
================================================

Show actual contributing signals.

Example:

✓ Rainfall increased
✓ Nearby flood observations increased
✓ Historical flood pattern detected
✓ Volunteer confirmation received

Do not invent explanations.

Only display features actually used by the model/risk engine.

================================================
STEP 16 — DYNAMIC ROUTING
================================================

Connect the Time Machine to Safe Evacuation Routing.

Current route:

Citizen
 ↓
Road A
 ↓
Road B
 ↓
Shelter

If Road B intersects a predicted high-risk region:

show:

⚠️ FUTURE ROUTE RISK

"This route intersects a forecast high-risk area."

Then calculate an alternative route.

Example:

CURRENT:

4.2 km
Risk: HIGH

ALTERNATIVE:

5.1 km
Risk: LOW

Then:

✓ SAFER ROUTE FOUND

Do NOT prioritize shortest distance over safety.

================================================
STEP 17 — ROUTE FORECAST
================================================

The system should distinguish:

CURRENTLY SAFE

from:

PREDICTED TO BECOME RISKY

Example:

🟢 CURRENT
Route is currently passable.

⚠️ +30 MIN
Route intersects forecast flood zone.

🔄 ACTION
Alternative route selected.

This is the core "Time Machine" experience.

================================================
STEP 18 — LIVE UPDATE
================================================

When a new citizen report is submitted:

1. Create incident.
2. Save to existing local storage/state system.
3. Update incident map.
4. Recalculate live risk.
5. Update forecast.
6. Check route.
7. Trigger rerouting if necessary.

When volunteer verification changes:

1. Update incident.
2. Recalculate forecast.
3. Update map.
4. Recalculate route.

No page reload.

================================================
STEP 19 — PRODUCTION DATA PIPELINE
================================================

Structure:

ml/time_machine/

├── inspect_data.py
├── prepare_forecasting_dataset.py
├── features.py
├── baseline.py
├── train.py
├── evaluate.py
├── predict.py
├── model.py
├── forecast_api.py
├── DATASET_REPORT.md
├── DATA_LIMITATIONS.md
└── EVALUATION_REPORT.md

Keep preprocessing reproducible.

Save:

feature configuration
normalization parameters
model checkpoint
dataset split information
evaluation metrics

================================================
STEP 20 — MODEL VERSIONING
================================================

Every forecast response should identify:

model_name
model_version
training_dataset_version
timestamp

Example:

model:
FloodTimeMachine-GRU

version:
v1.0

This is important for production auditing.

================================================
STEP 21 — FAIL-SAFE BEHAVIOR
================================================

If the forecasting model is unavailable:

DO NOT pretend a prediction exists.

Return:

FORECAST UNAVAILABLE

and allow the normal incident/routing system to continue.

For safety-critical routing:

AI forecast must never override an official emergency closure or evacuation order.

================================================
STEP 22 — NO FAKE ACCURACY
================================================

This is extremely important.

NEVER write:

"95% accurate"

unless the evaluation script actually measured it.

NEVER hardcode:

confidence = 0.95

NEVER create fake validation metrics.

The UI must consume the actual evaluation/model output.

================================================
STEP 23 — FINAL JUDGE EXPERIENCE
================================================

The demo should work like this:

1. Citizen uploads flood image.

2. GPS automatically captured.

3. Existing AI identifies:

FLOOD

4. Incident appears on Leaflet.

5. Volunteer receives alert.

6. Another citizen reports flooding nearby.

7. Incident fusion detects corroboration.

8. Volunteer verifies.

9. Open:

DISASTER TIME MACHINE.

10. Select:

NOW

Show observed flood.

11. Select:

+15 MIN

Show model forecast.

12. Select:

+30 MIN

Show model forecast.

13. Select:

+60 MIN

Show model forecast.

14. Existing evacuation route is checked.

15. System detects:

⚠️ CURRENT ROUTE MAY BECOME HIGH-RISK

16. Alternative route is calculated.

17. Show:

✓ SAFER ROUTE FOUND

18. Explain:

WHY?

using actual model inputs.

================================================
FINAL PRINCIPLE
================================================

Do NOT build a flashy fake prediction system.

Build the strongest scientifically defensible forecasting system that these datasets actually support.

If the datasets are insufficient for genuine 15/30/60-minute forecasting:

1. Clearly identify the limitation.
2. Do not fabricate labels.
3. Do not fabricate accuracy.
4. Build the strongest valid model possible.
5. Clearly distinguish:
   OBSERVED
   FORECAST
   SIMULATED
6. Make the architecture ready to ingest better real-time datasets later.

The final product should make this distinction visually obvious:

🔴 WHAT WE KNOW NOW

        ↓

🧠 WHAT THE MODEL EXPECTS

        ↓

🔮 WHAT MAY HAPPEN NEXT

        ↓

🛣️ WHAT ROUTE IS SAFER

This is the production direction for the Disaster Time Machine.