from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()   # ← THIS LINE IS THE FIX

import numpy as np
from tensorflow.keras.models import load_model
from PIL import Image
import io
from supabase import create_client
import os
import uuid


SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_SERVICE")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)



app = Flask(__name__)
CORS(app)

# Load model once at startup
model = load_model("models/real_pothole_model.h5")

IMG_SIZE = 128


def preprocess_image(img):
    img = img.resize((IMG_SIZE, IMG_SIZE))
    img = np.array(img) / 255.0
    img = np.expand_dims(img, axis=0)
    return img


def classify_severity(confidence):
    """Convert confidence to severity level"""
    if confidence < 0.5:
        return "none"
    elif confidence < 0.75:
        return "medium"
    else:
        return "high"


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Pothole Detection API is running"})


@app.route("/predict", methods=["POST"])
def predict():
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image provided"}), 400

        file = request.files["image"]
        user_id = request.form.get("user_id")
        latitude = request.form.get("latitude")
        longitude = request.form.get("longitude")
        description = request.form.get("description")

        if not user_id:
            return jsonify({"error": "Missing user_id"}), 400

        # Read image
        image_bytes = file.read()
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        processed = preprocess_image(img)

        prediction = model.predict(processed)[0][0]
        confidence = float(prediction)

        result = "Pothole" if confidence > 0.5 else "No Pothole"
        severity = classify_severity(confidence)

        # If NOT pothole → just return result
        if result == "No Pothole":
            return jsonify({
                "result": result,
                "confidence": confidence
            })

        # ====== UPLOAD IMAGE TO SUPABASE STORAGE ======
        filename = f"{user_id}/{uuid.uuid4()}.jpg"

        supabase.storage.from_("Potholes").upload(
            filename,
            image_bytes,
            {"content-type": "image/jpeg"}
        )

        public_url = supabase.storage.from_("pothole-images").get_public_url(filename)

        # ====== INSERT INTO DATABASE ======
        supabase.table("potholes").insert({
            "user_id": user_id,
            "latitude": float(latitude),
            "longitude": float(longitude),
            "severity": severity,
            "image_url": public_url,
            "description": description,
            "confidence": confidence,
            "verified": False
        }).execute()

        # ====== Increment contributions ======
        supabase.rpc("increment_contributions", {"user_id": user_id}).execute()

        return jsonify({
            "result": result,
            "confidence": confidence,
            "severity": severity,
            "stored": True
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500



if __name__ == "__main__":
    app.run(debug=True, port=8000)
