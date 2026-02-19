from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from tensorflow.keras.models import load_model
from PIL import Image
import io



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
        # Check file exists
        if "image" not in request.files:
            return jsonify({"error": "No image provided"}), 400

        file = request.files["image"]

        # Validate filename
        if file.filename == "":
            return jsonify({"error": "Empty file"}), 400

        # Read image safely
        img = Image.open(io.BytesIO(file.read())).convert("RGB")

        # Preprocess
        processed = preprocess_image(img)

        # Predict
        prediction = model.predict(processed)[0][0]
        confidence = float(prediction)

        result = "Pothole" if confidence > 0.5 else "No Pothole"
        severity = classify_severity(confidence)

        return jsonify({
            "result": result,
            "confidence": confidence,
            "severity": "High" if prediction > 0.8 else "Medium"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=8000)
