import os
import argparse
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader
from tqdm import tqdm
from PIL import ImageFile

# Tell PIL to tolerate truncated images
ImageFile.LOAD_TRUNCATED_IMAGES = True

def main():
    parser = argparse.ArgumentParser(description="Train the disaster classification model")
    parser.add_argument('--resume', action='store_true', help='Resume training from best_model.pth')
    args = parser.parse_args()

    # Hyperparameters
    BATCH_SIZE = 32
    EPOCHS = 10
    LEARNING_RATE = 1e-3
    DATA_DIR = 'data'
    # NUM_CLASSES will be determined dynamically

    # Determine the device to use
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    # 1. Data Preparation and Augmentation
    data_transforms = {
        'train': transforms.Compose([
            transforms.RandomResizedCrop(224),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
        'val': transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
    }

    # Create DataLoaders
    image_datasets = {x: datasets.ImageFolder(os.path.join(DATA_DIR, x), data_transforms[x])
                      for x in ['train', 'val']}
    dataloaders = {x: DataLoader(image_datasets[x], batch_size=BATCH_SIZE, shuffle=True, num_workers=4)
                  for x in ['train', 'val']}
    dataset_sizes = {x: len(image_datasets[x]) for x in ['train', 'val']}
    class_names = image_datasets['train'].classes
    NUM_CLASSES = len(class_names)

    print(f"Classes: {class_names}")

    # 2. Model Setup
    # Load pre-trained MobileNetV3 Large
    model = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.IMAGENET1K_V1)

    # Replace the classifier head
    num_ftrs = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(num_ftrs, NUM_CLASSES)

    if args.resume and os.path.exists('best_model.pth'):
        print("Loading existing best_model.pth to resume training...")
        state_dict = torch.load('best_model.pth', map_location=device)
        
        # Check if the number of classes has changed (e.g., added new classes)
        if 'classifier.3.weight' in state_dict and state_dict['classifier.3.weight'].shape[0] != NUM_CLASSES:
            print(f"Warning: Model checkpoint has {state_dict['classifier.3.weight'].shape[0]} classes, but current dataset has {NUM_CLASSES} classes.")
            print("Removing old classifier weights and initializing a new head for transfer learning...")
            del state_dict['classifier.3.weight']
            del state_dict['classifier.3.bias']
            
        # strict=False allows loading even if classifier weights were removed
        model.load_state_dict(state_dict, strict=False)

    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

    # 3. Training Loop
    best_acc = 0.0

    print("Starting training...")
    for epoch in range(EPOCHS):
        print(f'Epoch {epoch+1}/{EPOCHS}')
        print('-' * 10)

        for phase in ['train', 'val']:
            if phase == 'train':
                model.train()
            else:
                model.eval()

            running_loss = 0.0
            running_corrects = 0

            # Create a progress bar for the batches
            if dataset_sizes[phase] > 0:
                pbar = tqdm(dataloaders[phase], desc=f"{phase.capitalize()} Phase")
                for inputs, labels in pbar:
                    inputs = inputs.to(device)
                    labels = labels.to(device)

                    optimizer.zero_grad()

                    with torch.set_grad_enabled(phase == 'train'):
                        outputs = model(inputs)
                        _, preds = torch.max(outputs, 1)
                        loss = criterion(outputs, labels)

                        if phase == 'train':
                            loss.backward()
                            optimizer.step()

                    running_loss += loss.item() * inputs.size(0)
                    running_corrects += torch.sum(preds == labels.data)
                    
                    # Update progress bar
                    pbar.set_postfix({'loss': loss.item()})
            else:
                print(f"Warning: No images found in {phase} folder.")

            if dataset_sizes[phase] > 0:
                epoch_loss = running_loss / dataset_sizes[phase]
                epoch_acc = running_corrects.double() / dataset_sizes[phase]
                print(f'{phase} Loss: {epoch_loss:.4f} Acc: {epoch_acc:.4f}')

                # Save the best model
                if phase == 'val' and epoch_acc > best_acc:
                    best_acc = epoch_acc
                    torch.save(model.state_dict(), 'best_model.pth')
                    print(f"--> Saved new best model with accuracy {best_acc:.4f}")
        
        print()

    print("Training complete.")
    if best_acc > 0:
        print(f'Best val Acc: {best_acc:4f}')
    else:
        print("Warning: Model might not have trained correctly due to empty dataset.")

    # Save class names mapping for later use
    with open('class_names.txt', 'w') as f:
        for cls in class_names:
            f.write(f"{cls}\n")

if __name__ == '__main__':
    main()
