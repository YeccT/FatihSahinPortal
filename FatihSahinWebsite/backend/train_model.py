import os
import glob
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from PIL import Image, ImageDraw, ImageFont
import json
import random
import string

# Configuration
IMG_SIZE = (128, 128)
BATCH_SIZE = 32
EPOCHS = 10
SAMPLES_PER_FONT = 200
model_path = "font_model.keras"
classes_path = "font_classes.json"

# Fonts to look for in C:\Windows\Fonts
TARGET_FONTS = {
    "Arial": "arial.ttf",
    "Times New Roman": "times.ttf",
    "Courier New": "cour.ttf",
    "Verdana": "verdana.ttf",
    "Tahoma": "tahoma.ttf",
    "Comic Sans MS": "comic.ttf",
    "Impact": "impact.ttf",
    "Georgia": "georgia.ttf",
    "Trebuchet MS": "trebuc.ttf",
    "Segoe UI": "segoeui.ttf"
}

def get_available_fonts():
    available = {}
    font_dir = "C:\\Windows\\Fonts"
    for name, filename in TARGET_FONTS.items():
        path = os.path.join(font_dir, filename)
        if os.path.exists(path):
            available[name] = path
    return available

def generate_text_image(text, font_path, size=IMG_SIZE):
    try:
        font_size = random.randint(40, 80)
        font = ImageFont.truetype(font_path, font_size)
    except Exception as e:
        print(f"Error loading font {font_path}: {e}")
        return None

    # Create image
    img = Image.new('L', size, color=255) # L = Grayscale, 255 = White
    draw = ImageDraw.Draw(img)

    # Calculate text position to center it
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        x = (size[0] - text_w) / 2
        y = (size[1] - text_h) / 2
        
        # Add some random offset
        x += random.randint(-10, 10)
        y += random.randint(-10, 10)

        draw.text((x, y), text, font=font, fill=0)
        return img
    except Exception as e:
        print(f"Error drawing text: {e}")
        return None

def create_dataset(fonts):
    X = []
    y = []
    class_names = list(fonts.keys())
    
    print(f"Generating dataset for {len(class_names)} fonts...")
    
    for idx, (font_name, font_path) in enumerate(fonts.items()):
        print(f"  Generating samples for {font_name}...")
        for _ in range(SAMPLES_PER_FONT):
            # Generate random text (1-2 characters or a short word)
            text_type = random.choice(['char', 'word'])
            if text_type == 'char':
                text = random.choice(string.ascii_letters)
            else:
                word_len = random.randint(3, 6)
                text = ''.join(random.choices(string.ascii_letters, k=word_len))
            
            img = generate_text_image(text, font_path)
            if img:
                # Convert to numpy array and normalize
                img_array = np.array(img) / 255.0
                X.append(img_array)
                y.append(idx)

    X = np.array(X).reshape(-1, IMG_SIZE[0], IMG_SIZE[1], 1)
    y = np.array(y)
    
    return X, y, class_names

def train_model():
    fonts = get_available_fonts()
    if not fonts:
        print("No target fonts found! Please check C:\\Windows\\Fonts.")
        return

    X, y, class_names = create_dataset(fonts)
    
    # Save class mapping
    with open(classes_path, 'w') as f:
        json.dump(class_names, f)
    
    # Define simple CNN
    model = keras.Sequential([
        keras.Input(shape=(IMG_SIZE[0], IMG_SIZE[1], 1)),
        layers.Conv2D(32, kernel_size=(3, 3), activation="relu"),
        layers.MaxPooling2D(pool_size=(2, 2)),
        layers.Conv2D(64, kernel_size=(3, 3), activation="relu"),
        layers.MaxPooling2D(pool_size=(2, 2)),
        layers.Flatten(),
        layers.Dropout(0.5),
        layers.Dense(len(class_names), activation="softmax"),
    ])

    model.compile(loss="sparse_categorical_crossentropy", optimizer="adam", metrics=["accuracy"])
    
    print("Training model...")
    model.fit(X, y, batch_size=BATCH_SIZE, epochs=EPOCHS, validation_split=0.1)
    
    model.save(model_path)
    print(f"Model saved to {model_path}")
    print(f"Supported fonts: {class_names}")

if __name__ == "__main__":
    train_model()
