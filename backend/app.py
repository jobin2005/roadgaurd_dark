from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()

import numpy as np
from tensorflow.keras.models import load_model
from PIL import Image
import io
from supabase import create_client
import os
import uuid
import math
from datetime import datetime, timedelta, timezone

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


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in meters between two lat/lng points"""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "RoadGuard Pothole Detection API is running"})


# ─────────────────────────────── EXISTING ENDPOINT ───────────────────────────

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

        public_url = supabase.storage.from_("Potholes").get_public_url(filename)

        # ====== INSERT INTO DATABASE ======
        supabase.table("potholes").insert({
            "user_id": user_id,
            "latitude": float(latitude),
            "longitude": float(longitude),
            "severity": severity,
            "image_url": public_url,
            "description": description,
            "confidence": confidence,
            "verified": False,
            "status": "active"
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


# ─────────────────────────────── NEW ENDPOINTS ───────────────────────────────

@app.route("/potholes/nearby", methods=["GET"])
def potholes_nearby():
    """
    Returns potholes within a radius (km) of a given lat/lng.
    Query params: lat, lng, radius_km (default 5)
    Excludes potholes with status='removed'.
    """
    try:
        lat = request.args.get("lat")
        lng = request.args.get("lng")
        radius_km = float(request.args.get("radius_km", 5))

        if not lat or not lng:
            return jsonify({"error": "lat and lng are required"}), 400

        lat = float(lat)
        lng = float(lng)
        radius_m = radius_km * 1000

        # Fetch all active potholes (status != removed)
        result = supabase.table("potholes").select("*").neq("status", "removed").execute()
        all_potholes = result.data or []

        # Filter by haversine distance
        nearby = []
        for p in all_potholes:
            dist = haversine_distance(lat, lng, p["latitude"], p["longitude"])
            if dist <= radius_m:
                p["distance_m"] = round(dist, 1)
                nearby.append(p)

        # Sort by distance
        nearby.sort(key=lambda p: p["distance_m"])

        return jsonify({"potholes": nearby, "count": len(nearby)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/potholes/<pothole_id>/flag", methods=["POST"])
def flag_pothole(pothole_id):
    """
    Flag a pothole as fake/not-present.
    Body JSON: { user_id, verified_passed (bool) }
    - Checks that user hasn't flagged this pothole before (UNIQUE constraint)
    - Records journey passage
    - Runs collective verification: if >=90% flagged AND >=3 flags → mark removed
    """
    try:
        data = request.get_json()
        user_id = data.get("user_id") if data else None

        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        # Check pothole exists
        pot_result = supabase.table("potholes").select("id, status").eq("id", pothole_id).maybeSingle().execute()
        if not pot_result.data:
            return jsonify({"error": "Pothole not found"}), 404

        if pot_result.data.get("status") == "removed":
            return jsonify({"error": "Pothole already removed"}), 400

        # Record journey passage (GPS verified by frontend; backend trusts the call)
        try:
            supabase.table("journey_passages").insert({
                "pothole_id": pothole_id,
                "user_id": user_id
            }).execute()
        except Exception:
            pass  # Passage may already exist, that's fine

        # Insert flag (UNIQUE constraint prevents duplicates)
        try:
            supabase.table("pothole_flags").insert({
                "pothole_id": pothole_id,
                "user_id": user_id
            }).execute()
        except Exception as e:
            error_msg = str(e)
            if "unique" in error_msg.lower() or "duplicate" in error_msg.lower():
                return jsonify({"error": "You have already flagged this pothole"}), 409
            raise

        # ────── Collective verification logic ──────
        # Count total passages in last 30 days
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

        passages_result = supabase.table("journey_passages") \
            .select("id", count="exact") \
            .eq("pothole_id", pothole_id) \
            .gte("passed_at", thirty_days_ago) \
            .execute()

        flags_result = supabase.table("pothole_flags") \
            .select("id", count="exact") \
            .eq("pothole_id", pothole_id) \
            .execute()

        total_passages = passages_result.count or 0
        total_flags = flags_result.count or 0

        removed = False
        if total_flags >= 3 and total_passages > 0:
            ratio = total_flags / total_passages
            if ratio >= 0.9:
                supabase.table("potholes").update({"status": "removed"}).eq("id", pothole_id).execute()
                removed = True

        return jsonify({
            "flagged": True,
            "total_flags": total_flags,
            "total_passages": total_passages,
            "pothole_removed": removed
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/potholes/<pothole_id>/passage", methods=["POST"])
def record_passage(pothole_id):
    """
    Record that a user passed a pothole location (GPS-verified by frontend).
    Body JSON: { user_id }
    """
    try:
        data = request.get_json()
        user_id = data.get("user_id") if data else None

        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        supabase.table("journey_passages").insert({
            "pothole_id": pothole_id,
            "user_id": user_id
        }).execute()

        return jsonify({"recorded": True})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/potholes/<pothole_id>/status", methods=["GET"])
def get_pothole_status(pothole_id):
    """Returns the current status of a specific pothole."""
    try:
        result = supabase.table("potholes").select("id, status, severity, latitude, longitude, created_at") \
            .eq("id", pothole_id).maybeSingle().execute()

        if not result.data:
            return jsonify({"error": "Pothole not found"}), 404

        return jsonify(result.data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=8000)
