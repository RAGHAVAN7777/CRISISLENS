import os
import shutil
import random
from pathlib import Path

# Set random seed for reproducibility
random.seed(42)

TARGET_DIR = r"D:\Hacktronics\data"

# Map (source_base_dir, source_folder_name) to target_class
CLASS_MAPPING = [
    # Cyclone/Earthquake/Flood/Wildfire Dataset
    (r"D:\Hacktronics\dataa\archive (2)\Cyclone_Wildfire_Flood_Earthquake_Database\Cyclone_Wildfire_Flood_Earthquake_Database", "Cyclone", "cyclone"),
    (r"D:\Hacktronics\dataa\archive (2)\Cyclone_Wildfire_Flood_Earthquake_Database\Cyclone_Wildfire_Flood_Earthquake_Database", "Earthquake", "earthquake"),
    (r"D:\Hacktronics\dataa\archive (2)\Cyclone_Wildfire_Flood_Earthquake_Database\Cyclone_Wildfire_Flood_Earthquake_Database", "Flood", "flood"),
    (r"D:\Hacktronics\dataa\archive (2)\Cyclone_Wildfire_Flood_Earthquake_Database\Cyclone_Wildfire_Flood_Earthquake_Database", "Wildfire", "fire"),
    
    # Comprehensive Disaster Dataset (CDD)
    (r"D:\Hacktronics\dataa\archive (3)\Comprehensive Disaster Dataset(CDD)\Damaged_Infrastructure", "Infrastructure", "structural_damage"),
    (r"D:\Hacktronics\dataa\archive (3)\Comprehensive Disaster Dataset(CDD)", "Fire_Disaster", "fire"),
    (r"D:\Hacktronics\dataa\archive (3)\Comprehensive Disaster Dataset(CDD)", "Human_Damage", "human_damage"),
    (r"D:\Hacktronics\dataa\archive (3)\Comprehensive Disaster Dataset(CDD)\Land_Disaster", "Drought", "drought"),
    (r"D:\Hacktronics\dataa\archive (3)\Comprehensive Disaster Dataset(CDD)\Land_Disaster", "Land_Slide", "landslide"),
    (r"D:\Hacktronics\dataa\archive (3)\Comprehensive Disaster Dataset(CDD)", "Water_Disaster", "water_disaster"),
    
    # Normal / Non-Damage Dataset (Mapped to 'normal')
    (r"D:\Hacktronics\dataa\archive (3)\Comprehensive Disaster Dataset(CDD)\Non_Damage", "Non_Damage_Buildings_Street", "normal"),
    (r"D:\Hacktronics\dataa\archive (3)\Comprehensive Disaster Dataset(CDD)\Non_Damage", "Non_Damage_Wildlife_Forest", "normal"),
    (r"D:\Hacktronics\dataa\archive (3)\Comprehensive Disaster Dataset(CDD)\Non_Damage", "human", "normal"),
    (r"D:\Hacktronics\dataa\archive (3)\Comprehensive Disaster Dataset(CDD)\Non_Damage", "sea", "normal")
]

def split_data():
    print("Cleaning up old data directories...")
    if os.path.exists(TARGET_DIR):
        shutil.rmtree(TARGET_DIR)
        
    for source_base, source_folder, target_folder in CLASS_MAPPING:
        src_path = Path(source_base) / source_folder
        if not src_path.exists():
            print(f"Warning: Source folder {src_path} not found.")
            continue
            
        train_dst = Path(TARGET_DIR) / "train" / target_folder
        val_dst = Path(TARGET_DIR) / "val" / target_folder
        
        train_dst.mkdir(parents=True, exist_ok=True)
        val_dst.mkdir(parents=True, exist_ok=True)
        
        # Get all images
        images = [f for f in src_path.iterdir() if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png']]
        
        # Shuffle images
        random.shuffle(images)
        
        # Split 80/20
        split_idx = int(len(images) * 0.8)
        train_images = images[:split_idx]
        val_images = images[split_idx:]
        
        print(f"Copying {len(train_images)} images to {train_dst}...")
        for img in train_images:
            shutil.copy2(img, train_dst / img.name)
            
        print(f"Copying {len(val_images)} images to {val_dst}...")
        for img in val_images:
            shutil.copy2(img, val_dst / img.name)

if __name__ == "__main__":
    split_data()
    print("Data preparation complete!")
