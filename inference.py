import os
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import numpy as np
import cv2
import argparse

# Import Grad-CAM library
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image

def load_class_names(path='class_names.txt'):
    if not os.path.exists(path):
        return ['building_damage', 'fire', 'flood', 'normal'] # fallback
    with open(path, 'r') as f:
        classes = [line.strip() for line in f.readlines()]
    return classes

def get_model(num_classes, model_path='best_model.pth', device='cpu'):
    # Load MobileNetV3 Large
    model = models.mobilenet_v3_large(weights=None)
    num_ftrs = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(num_ftrs, num_classes)
    
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=device))
        print(f"Loaded trained weights from {model_path}")
    else:
        print(f"Warning: {model_path} not found. Using untrained model for demonstration.")
    
    model = model.to(device)
    model.eval()
    return model

def predict_and_visualize(image_path, model, class_names, device='cpu', output_path='cam_output.jpg'):
    # Load and preprocess the image for the model
    transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    # Load original image for visualization
    img_pil = Image.open(image_path).convert('RGB')
    
    # Resize original image to 224x224 to match the Grad-CAM output size
    img_resized = img_pil.resize((224, 224))
    rgb_img = np.float32(img_resized) / 255
    
    input_tensor = transform(img_pil).unsqueeze(0).to(device)
    
    # Predict
    with torch.no_grad():
        output = model(input_tensor)
        probabilities = torch.nn.functional.softmax(output[0], dim=0)
        conf, predicted_idx = torch.max(probabilities, 0)
        
    predicted_class = class_names[predicted_idx.item()]
    confidence_score = conf.item()
    
    print(f"Prediction: {predicted_class} (Confidence: {confidence_score:.4f})")
    
    # Set up Grad-CAM
    # For MobileNetV3, the last convolutional layer is in features
    target_layers = [model.features[-1]]
    
    cam = GradCAM(model=model, target_layers=target_layers)
    
    # Generate heatmap for the predicted class
    targets = [ClassifierOutputTarget(predicted_idx.item())]
    grayscale_cam = cam(input_tensor=input_tensor, targets=targets)
    grayscale_cam = grayscale_cam[0, :]
    
    # Merge heatmap with original image
    visualization = show_cam_on_image(rgb_img, grayscale_cam, use_rgb=True)
    
    # Convert RGB to BGR for cv2 saving
    visualization = cv2.cvtColor(visualization, cv2.COLOR_RGB2BGR)
    cv2.imwrite(output_path, visualization)
    
    print(f"Saved Grad-CAM visualization to {output_path}")
    return predicted_class, confidence_score, output_path

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Run inference and Grad-CAM on a disaster image")
    parser.add_argument('--image', type=str, required=True, help="Path to the input image")
    parser.add_argument('--model_path', type=str, default='best_model.pth', help="Path to the trained model")
    args = parser.parse_args()
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    class_names = load_class_names()
    
    model = get_model(len(class_names), model_path=args.model_path, device=device)
    predict_and_visualize(args.image, model, class_names, device=device)
