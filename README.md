# CrisisLens AI 🌍🚨

CrisisLens AI is an end-to-end disaster classification system that combines a deep learning backend with an interactive web interface. It analyzes disaster imagery to classify the type of disaster and uses Explainable AI (XAI) via Grad-CAM to visually highlight the regions of the image that influenced the model's prediction.

## 🌟 Key Features

- **Disaster Classification**: Classifies images into categories like Flood, Wildfire, Earthquake (building damage), and others.
- **Explainable AI (Grad-CAM)**: Generates heatmaps over input images to explain the model's reasoning, providing transparency for critical use cases.
- **FastAPI Backend**: A robust, high-performance API server for serving model predictions and Grad-CAM visualizations.
- **Next.js Frontend**: A modern, responsive web application for users to upload images and view analysis results in real-time.

## 🏗️ Project Structure

- `train.py`: Fine-tunes a pre-trained **MobileNetV3 Large** model using PyTorch.
- `evaluate.py`: Script to evaluate the model's performance on the validation set.
- `inference.py`: Handles model loading and generates Grad-CAM heatmaps for single images.
- `app.py`: FastAPI application exposing the `/predict` endpoint.
- `prepare_data.py`: Utility to parse, split, and structure the raw dataset.
- `crisislens-ui/`: Next.js web frontend.

## 🚀 Getting Started

### 1. Backend Setup (Machine Learning & API)

Ensure you have Python 3.8+ installed.

```bash
# Clone the repository
git clone https://github.com/RAGHAVAN7777/CRISISLENS.git
cd CRISISLENS

# Create and activate a virtual environment (optional but recommended)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Frontend Setup (Next.js UI)

Ensure you have Node.js and npm installed.

```bash
cd crisislens-ui

# Install dependencies
npm install
```

## 🛠️ Usage

### Training the Model
1. Place your raw images in the source directory.
2. Run data preparation:
   ```bash
   python prepare_data.py
   ```
3. Train the model:
   ```bash
   python train.py
   ```
   *This will save `best_model.pth` and `class_names.txt` in the root directory.*

### Running the System
To run the full stack, you need to start both the backend API and the frontend UI.

**Terminal 1 (Backend API):**
```bash
uvicorn app:app --reload
```
*The API will be available at http://localhost:8000*

**Terminal 2 (Frontend UI):**
```bash
cd crisislens-ui
npm run dev
```
*The UI will be available at http://localhost:3000*

## 📚 Tech Stack

- **Machine Learning**: PyTorch, Torchvision, Grad-CAM
- **Backend API**: FastAPI, Uvicorn, Python-Multipart
- **Frontend**: Next.js, React, CSS Modules
- **Data Processing**: OpenCV, Pillow, Numpy
