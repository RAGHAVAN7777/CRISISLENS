import os
import torch
import torch.nn as nn
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader
from tqdm import tqdm
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report

def load_class_names(path='class_names.txt'):
    with open(path, 'r') as f:
        classes = [line.strip() for line in f.readlines()]
    return classes

def main():
    BATCH_SIZE = 32
    DATA_DIR = 'data'
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    class_names = load_class_names()
    NUM_CLASSES = len(class_names)
    
    # Use the same transforms as validation to evaluate test metrics
    test_transforms = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    # We evaluate on the 'val' directory as the test holdout set
    test_dataset = datasets.ImageFolder(os.path.join(DATA_DIR, 'val'), test_transforms)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=4)
    
    model = models.mobilenet_v3_large(weights=None)
    num_ftrs = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(num_ftrs, NUM_CLASSES)
    
    model_path = 'best_model.pth'
    if os.path.exists(model_path):
        state_dict = torch.load(model_path, map_location=device)
        model.load_state_dict(state_dict, strict=False)
        print(f"Loaded {model_path} for evaluation.")
    else:
        print(f"Error: {model_path} not found.")
        return
        
    model = model.to(device)
    model.eval()
    
    all_preds = []
    all_labels = []
    
    print("Evaluating on test set...")
    with torch.no_grad():
        for inputs, labels in tqdm(test_loader):
            inputs = inputs.to(device)
            labels = labels.to(device)
            
            outputs = model(inputs)
            _, preds = torch.max(outputs, 1)
            
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            
    accuracy = accuracy_score(all_labels, all_preds)
    precision = precision_score(all_labels, all_preds, average='weighted', zero_division=0)
    recall = recall_score(all_labels, all_preds, average='weighted', zero_division=0)
    f1 = f1_score(all_labels, all_preds, average='weighted', zero_division=0)
    
    print("\n" + "="*30)
    print("Test Metrics:")
    print(f"Overall Accuracy: {accuracy * 100:.2f}%")
    print(f"Precision: {precision * 100:.2f}%")
    print(f"Recall: {recall * 100:.2f}%")
    print(f"F1 Score: {f1 * 100:.2f}%")
    print("="*30 + "\n")
    
    print("Detailed Classification Report:")
    print(classification_report(all_labels, all_preds, target_names=class_names, zero_division=0))

if __name__ == '__main__':
    main()
