# CrisisLens AI - Disaster Classification Feature Context

This document outlines the implementation details of the CrisisLens AI disaster classification feature, which includes an end-to-end pipeline from data preparation to a functional API backend with explainable AI capabilities.

## 1. Overview
The project implements a deep learning pipeline to classify disaster imagery into three primary categories:
- **Flood** (`flood`)
- **Wildfire** (`fire`)
- **Earthquake** (`building_damage`)

The system also integrates **Grad-CAM** (Gradient-weighted Class Activation Mapping) to visually explain the model's predictions by generating heatmaps on the input images.

## 2. Components

### 2.1. Data Preparation (`prepare_data.py`)
- **Functionality**: Reads raw dataset images from a source directory, maps them to the appropriate target classes, and splits them into training (80%) and validation (20%) datasets.
- **Output**: Structured `train` and `val` folders inside the `data` directory.

### 2.2. Model Training (`train.py`)
- **Architecture**: Fine-tunes a pre-trained **MobileNetV3 Large** model from PyTorch's `torchvision.models`.
- **Process**:
  - Replaces the classification head to match the number of target classes.
  - Applies data augmentation (RandomResizedCrop, RandomHorizontalFlip, ColorJitter) during training.
  - Uses CrossEntropyLoss and Adam optimizer.
  - Saves the best-performing model weights as `best_model.pth`.
  - Generates `class_names.txt` to map output indices to class labels.

### 2.3. Inference and Explainability (`inference.py`)
- **Functionality**: Contains functions to load the trained model and run predictions on single images.
- **Explainable AI (XAI)**: Uses the `grad-cam` library to generate a visual heatmap over the original image, highlighting the regions that most strongly influenced the model's prediction. The target layer used for Grad-CAM is the last convolutional layer in MobileNetV3 (`model.features[-1]`).

### 2.4. API Backend (`app.py`)
- **Framework**: Built with **FastAPI**.
- **Endpoint**: Exposes a `POST /predict` endpoint that accepts an image file upload.
- **Response**: Returns a JSON object containing:
  - `prediction`: The predicted disaster class.
  - `confidence`: The confidence score (probability) of the prediction.
  - `grad_cam_base64`: A Base64 encoded string of the Grad-CAM visualization image, allowing frontends to easily render the result.
- **Features**: Includes CORS middleware to allow requests from local frontend applications.

### 2.5. Dependencies (`requirements.txt`)
Key dependencies required to run the pipeline include:
- `torch`, `torchvision` (Model training and inference)
- `fastapi`, `uvicorn`, `python-multipart` (API server and file handling)
- `grad-cam`, `opencv-python`, `pillow`, `numpy` (Image processing and explainability)

## 3. Workflow
1. Run `python prepare_data.py` to organize the dataset.
2. Run `python train.py` to train the MobileNetV3 model and generate `best_model.pth` and `class_names.txt`.
3. Run `python app.py` (or `uvicorn app:app --reload`) to start the FastAPI server.
4. Clients can send image files to the `http://localhost:8000/predict` endpoint to get real-time classification and visual explanations.
