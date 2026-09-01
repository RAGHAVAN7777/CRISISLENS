Integrate the Hugging Face dataset:

Rayford295/BiTemporal-StreetView-Damage

into our existing Disaster Intelligence Network prototype.

IMPORTANT:

* This is a hackathon prototype.
* DO NOT introduce any database.
* Do not use PostgreSQL, MongoDB, Firebase, Supabase, Prisma, or SQLite.
* Use local files/localStorage for prototype data.
* Do not break the existing application.
* First inspect the current project before making changes.

STEP 1 — Inspect the dataset

Create a Python script:

ml/inspect_dataset.py

Use:

from datasets import load_dataset
ds = load_dataset("Rayford295/BiTemporal-StreetView-Damage")
print(ds)
print(ds.keys())
for split in ds.keys():
    print("\nSPLIT:", split)
    print("Columns:", ds[split].column_names)
    print("Features:", ds[split].features)
    print("Number of samples:", len(ds[split]))
    if len(ds[split]) > 0:
        print("Sample:")
        print(ds[split][0])

Run the script.

DO NOT assume the dataset column names, labels, or structure.

Inspect the actual dataset first.

Determine:

* Available splits
* Image columns
* Before/after image structure
* Label columns
* Label names
* Number of classes
* Number of samples
* Image dimensions/types
* Whether the dataset is suitable for our disaster-damage classification task

Do not modify the web application yet.

⸻

STEP 2 — Create dataset documentation

After inspection, create:

ml/DATASET_INFO.md

Document:

* Dataset name
* Hugging Face repository
* Dataset size
* Splits
* Columns
* Image format
* Labels
* Class distribution
* Example sample structure
* How the dataset relates to our project

Also clearly state any limitations.

For example, if the dataset primarily contains before/after street-view damage imagery, do not pretend it directly provides Flood/Fire classifications.

⸻

STEP 3 — Create preprocessing pipeline

Create:

ml/prepare_dataset.py

The script should:

1. Load the dataset using Hugging Face datasets.
2. Inspect the actual image fields.
3. Convert images into a format suitable for model training.
4. Normalize/resize images.
5. Convert labels into model-compatible IDs.
6. Create train/validation/test splits if the dataset does not already provide them.
7. Save only the processed metadata/images required for training.

Do not create a database.

Keep the preprocessing reproducible.

Use:

* Python
* Hugging Face datasets
* PIL
* NumPy
* PyTorch or TensorFlow, depending on the existing project

⸻

STEP 4 — Determine the correct ML strategy

Before training, analyze whether this dataset should be used for:

1. Direct image classification
2. Before/after damage comparison
3. Feature extraction
4. Transfer learning
5. Fine-tuning

Choose the simplest approach that can produce a convincing hackathon prototype.

Do NOT train a huge model from scratch.

Prefer transfer learning with a lightweight pretrained vision model.

Possible models:

* ResNet18
* EfficientNet
* MobileNet
* ConvNeXt-Tiny

Choose based on compatibility and available compute.

⸻

STEP 5 — Train the prototype model

Create:

ml/train.py

Train a lightweight damage-classification model using the dataset.

Requirements:

* Train/validation split
* Data augmentation
* Transfer learning
* Cross-entropy loss where appropriate
* Accuracy
* Precision
* Recall
* F1 score
* Confusion matrix

Save the trained model to:

ml/models/

Do not commit large model files to Git if they are too large.

Instead document how to generate/download them.

Create:

ml/README.md

explaining:

Install dependencies
↓
Download dataset
↓
Inspect dataset
↓
Prepare dataset
↓
Train model
↓
Evaluate model
↓
Export model

⸻

STEP 6 — IMPORTANT HAZARD CLASSIFICATION REQUIREMENT

Our final application needs to demonstrate disaster hazards such as:

* FLOOD
* FIRE
* STRUCTURAL DAMAGE
* FALLEN OBJECT / ROAD BLOCKAGE

Do NOT falsely claim that the BiTemporal-StreetView-Damage dataset directly trains all of these classes unless the actual dataset labels support that.

If the dataset only supports structural/street-view damage classification, use it specifically for that capability.

Create a clean architecture allowing additional hazard classifiers to be added later.

For example:

VisionService
    |
    ├── DamageClassifier
    ├── FloodClassifier
    ├── FireClassifier
    └── RoadBlockageClassifier

For the current prototype, use the trained damage model where appropriate and provide a clearly labeled fallback/demo classifier for unsupported hazard categories.

Never silently misrepresent the dataset.

⸻

STEP 7 — Connect model to the web application

After the model works, integrate it into the existing /judge page.

The flow should become:

Judge uploads image
        ↓
Frontend
        ↓
Vision API
        ↓
Trained Damage Model
        ↓
Prediction
        ↓
AI Reasoning
        ↓
Hazard
Severity
Confidence
Evidence
        ↓
UI

Create a lightweight inference API if necessary.

Prefer FastAPI if the project already has a Python backend.

Example endpoint:

POST /api/predict

Input:

image

Output:

{
  "hazard": "STRUCTURAL DAMAGE",
  "severity": "HIGH",
  "confidence": 0.91,
  "evidence": [
    "Visible structural damage",
    "Damaged building surface"
  ]
}

Do not hardcode the prediction based on filename.

⸻

STEP 8 — Keep the prototype database-free

The application architecture must remain:

                 ┌── PHOTO ──→ Vision Model
                 │
Citizen ─────────┼── SMS ────→ Groq/NLP
                 │
                 └── VOICE ──→ ASR/IVR
                              ↓
                         AI Reasoning
                              ↓
                    Normalized Incident
                              ↓
                         localStorage
                              ↓
                         Live Map
                              ↓
                    Incident Verification
                              ↓
                     Road Risk Changes
                              ↓
                     Dynamic Rerouting
                              ↓
                       Safe Shelter

No database should be introduced.

Use localStorage for:

* Reports
* Incidents
* Verification status
* Demo routes
* Demo shelters
* User state

The ML model itself can be stored locally on the backend/server filesystem.

⸻

STEP 9 — Judge demonstration

The /judge page must be extremely polished.

Create this flow:

LIVE AI CLASSIFICATION
[ Upload Image ]
        ↓
Analyzing image...
        ↓
HAZARD
STRUCTURAL DAMAGE
SEVERITY
HIGH
CONFIDENCE
91%
VISUAL EVIDENCE
✓ Damaged structure
✓ Visible debris
✓ Structural deformation

Show the uploaded image next to the prediction.

If possible, provide a visual explanation such as Grad-CAM.

The judge must be able to upload completely new images.

Do NOT create five hardcoded demo images.

⸻

STEP 10 — Do not break existing features

After integrating the model, verify that these existing features still work:

* Overview dashboard
* Photo reporting
* SMS simulation
* Voice simulation
* Incident fusion
* Live map
* Responder verification
* Safe routing
* Dynamic rerouting
* Safe shelters

Run the entire application.

Fix all build/runtime/API errors.

⸻

FINAL REQUIREMENT

Do the work incrementally.

First inspect the dataset.

Then show me the actual dataset structure and your conclusion about how it can be used.

Only after that implement preprocessing/training/inference.

DO NOT blindly assume the dataset structure.

DO NOT create a database.

DO NOT replace the existing application architecture.

The final goal is a reliable hackathon prototype where a judge can upload an unseen disaster image and see a genuine model inference integrated into our disaster-reporting pipeline.