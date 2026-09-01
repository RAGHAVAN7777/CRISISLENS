from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import shutil
import os
import base64
import torch

# Import the inference functions
from inference import get_model, load_class_names, predict_and_visualize

app = FastAPI(title="CrisisLens AI API", description="Disaster Classification and Grad-CAM API")

# Allow CORS for local frontend testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the model once when the app starts
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
class_names = load_class_names()
model = get_model(len(class_names), model_path='best_model.pth', device=device)

@app.get("/")
def read_root():
    return {"message": "Welcome to CrisisLens AI API. Use POST /predict to classify an image."}

def get_resource_recommendations(predicted_class):
    resources = {
        'cyclone': ['Evacuation Transport', 'Emergency Shelters', 'Search & Rescue Teams', 'Medical Aid', 'Food Supplies'],
        'earthquake': ['Heavy Rescue Teams', 'Specialized Dogs', 'Structural Engineers', 'Medical Kits', 'Temporary Shelters'],
        'flood': ['Rescue Boats', 'Sandbags', 'Clean Drinking Water', 'High-Water Vehicles', 'Evacuation Helicopters'],
        'fire': ['Fire Engines', 'Aerial Support', 'Burn Kits', 'Evacuation Transport', 'Fire Retardant Foam'],
        'structural_damage': ['Search & Rescue Teams', 'Heavy Machinery', 'Safety Inspectors', 'Barricades', 'Debris Removal'],
        'human_damage': ['Ambulances', 'First Responders', 'Medical Kits', 'Triage Tents', 'Hospitals Alerted'],
        'drought': ['Water Tankers', 'Food Supplies', 'Agricultural Aid', 'Dehydration Relief', 'Drought-Resistant Seeds'],
        'landslide': ['Heavy Machinery', 'Geotechnical Engineers', 'Search & Rescue', 'Evacuation Transport'],
        'water_disaster': ['Rescue Boats', 'Water Pumps', 'Life Jackets', 'Clean Drinking Water'],
        'normal': ['Routine Monitoring']
    }
    return resources.get(predicted_class, ['Standard Emergency Services'])

def get_explanation(predicted_class):
    explanations = {
        'cyclone': 'Cyclone detected due to severe wind patterns and storm structures',
        'earthquake': 'Earthquake detected due to widespread ground and structural disruption',
        'flood': 'Flood detected due to water regions and elevated water levels',
        'fire': 'Fire detected due to flames and smoke regions',
        'structural_damage': 'Structural damage detected due to collapsed infrastructure and debris',
        'human_damage': 'Human damage/casualties detected requiring immediate medical attention',
        'drought': 'Drought detected due to arid, dry land, and cracked earth',
        'landslide': 'Landslide detected due to collapsed terrain and mud flows',
        'water_disaster': 'Water disaster detected due to hazardous water conditions',
        'normal': 'No disaster detected in the region'
    }
    return explanations.get(predicted_class, 'Disaster features detected in highlighted regions')

def calculate_severity(predicted_class, confidence):
    if predicted_class == 'normal':
        return 'low'
    
    if confidence < 0.5:
        return 'med'
    elif confidence < 0.8:
        return 'high'
    else:
        return 'severe'

@app.post("/predict")
async def predict_disaster(file: UploadFile = File(...)):
    # Save the uploaded file temporarily
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    output_cam_path = f"cam_{file.filename}.jpg"
    
    try:
        # Run inference and Grad-CAM
        predicted_class, confidence_score, saved_path = predict_and_visualize(
            temp_filename, model, class_names, device=device, output_path=output_cam_path
        )
        
        # Read the generated Grad-CAM image and encode to base64
        with open(saved_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            
        resources = get_resource_recommendations(predicted_class)
        severity = calculate_severity(predicted_class, confidence_score)
        explanation = get_explanation(predicted_class)
        
        return JSONResponse(content={
            "prediction": predicted_class,
            "confidence": confidence_score,
            "grad_cam_base64": encoded_string,
            "resources": resources,
            "severity": severity,
            "explanation": explanation
        })
        
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    finally:
        # Clean up temporary files
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        if os.path.exists(output_cam_path):
            os.remove(output_cam_path)

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
