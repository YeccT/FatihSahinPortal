from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np
try:
    import tensorflow as tf
except ImportError:
    print("Warning: TensorFlow not found or broken. Font identification will not work.")
    tf = None
from PIL import Image
import io
import json

app = FastAPI()

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Model
MODEL_PATH = "font_model.keras"
CLASSES_PATH = "font_classes.json"
IMG_SIZE = (128, 128)

try:
    model = tf.keras.models.load_model(MODEL_PATH)
    with open(CLASSES_PATH, 'r') as f:
        class_names = json.load(f)
    print(f"Model loaded with classes: {class_names}")
except Exception as e:
    print(f"Warning: Could not load model. Make sure to run train_model.py first. Error: {e}")
    model = None
    class_names = []

@app.get("/")
def read_root():
    return {"message": "Font Identification API is running. Use POST /identify to check a font."}

@app.post("/identify")
async def identify_font(file: UploadFile = File(...)):
    if not model:
        raise HTTPException(status_code=503, detail="Hizmet Kullanılamıyor: Model yüklenmedi veya TensorFlow çalışmıyor.")

    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('L') # Convert to Grayscale
        
        # Resize to match training data
        image = image.resize(IMG_SIZE)
        
        # Normalize
        img_array = np.array(image) / 255.0
        img_array = img_array.reshape(1, IMG_SIZE[0], IMG_SIZE[1], 1)
        
        # Predict
        predictions = model.predict(img_array)
        predicted_idx = np.argmax(predictions[0])
        confidence = float(np.max(predictions[0]))
        
        # Get Top 3 Predictions
        top_k = 3
        top_indices = predictions[0].argsort()[-top_k:][::-1]
        
        results = []
        for idx in top_indices:
            results.append({
                "font": class_names[idx],
                "confidence": f"{float(predictions[0][idx]):.2%}"
            })

        return {
            "top_candidates": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
