import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"  # Suppress TF logging
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()

import cv2
import numpy as np
from tensorflow.keras.models import load_model
from PIL import Image
import io
from supabase import create_client
import uuid
import math
from datetime import datetime, timedelta, timezone

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_SERVICE")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)
CORS(app)

# Load model once at startup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "pothole_detector.h5")
print(f"[*] Loading model from: {MODEL_PATH}")
model = load_model(MODEL_PATH)
print("[*] Model loaded successfully")

IMG_SIZE = 128


def preprocess_image(img):
    img = img.resize((IMG_SIZE, IMG_SIZE))
    img = np.array(img) / 255.0
    img = np.expand_dims(img, axis=0)
    return img


def _default_params():
    return {
        "relative_area": 0, "depth_score": 0,
        "jaggedness": 0, "irregularity": 0,
        "edge_intensity": 0, "aspect_ratio": 0,
        "score": 0.1
    }


def extract_and_analyze_pothole(img_cv):
    """
    Advanced Pothole Analysis using OpenCV.
    Ported from test_presence.py
    """
    if img_cv is None:
        return "none", _default_params()

    h, w = img_cv.shape[:2]
    total_area = h * w

    # 1. CLAHE contrast enhancement
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # 2. Gaussian Blur to reduce noise
    blurred = cv2.GaussianBlur(enhanced, (7, 7), 0)

    # 3. Adaptive Threshold
    thresh = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=31,
        C=10
    )

    # 4. Canny Edge Detection
    edges = cv2.Canny(blurred, threshold1=30, threshold2=100)
    edge_kernel = np.ones((3, 3), np.uint8)
    edges_dilated = cv2.dilate(edges, edge_kernel, iterations=2)
    combined = cv2.bitwise_or(thresh, edges_dilated)

    # 5. Morphological operations
    close_kernel = np.ones((9, 9), np.uint8)
    open_kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, close_kernel)
    mask = cv2.morphologyEx(mask,    cv2.MORPH_OPEN,  open_kernel)

    # 6. Contour detection
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return "low", _default_params()

    valid_contours = [c for c in contours if cv2.contourArea(c) > 0.005 * total_area]
    if not valid_contours:
        return "low", _default_params()

    main_contour = max(valid_contours, key=cv2.contourArea)
    pothole_area = cv2.contourArea(main_contour)

    # 7. Extract severity parameters
    relative_area = pothole_area / total_area

    pothole_mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.drawContours(pothole_mask, [main_contour], -1, 255, -1)
    road_mask_inv = cv2.bitwise_not(pothole_mask)
    mean_inside  = cv2.mean(enhanced, mask=pothole_mask)[0]
    mean_outside = cv2.mean(enhanced, mask=road_mask_inv)[0]
    depth_score  = max(0.0, (mean_outside - mean_inside) / 255.0)

    perimeter   = cv2.arcLength(main_contour, True)
    circularity = (4 * np.pi * pothole_area) / (perimeter ** 2) if perimeter > 0 else 1.0
    jaggedness  = 1.0 - min(circularity, 1.0)

    x, y, bw, bh = cv2.boundingRect(main_contour)
    aspect_ratio = min(bw, bh) / max(bw, bh) if max(bw, bh) > 0 else 0

    sobel_x = cv2.Sobel(enhanced, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(enhanced, cv2.CV_64F, 0, 1, ksize=3)
    sobel_combined = np.uint8(np.clip(np.sqrt(sobel_x**2 + sobel_y**2), 0, 255))
    edge_intensity = cv2.mean(sobel_combined, mask=pothole_mask)[0] / 255.0

    hull = cv2.convexHull(main_contour)
    hull_area = cv2.contourArea(hull)
    solidity = pothole_area / hull_area if hull_area > 0 else 1.0
    irregularity = 1.0 - solidity

    # 8. Weighted severity score
    score = (
        0.30 * min(relative_area * 20, 1.0) +
        0.25 * depth_score +
        0.15 * jaggedness +
        0.15 * irregularity +
        0.10 * edge_intensity +
        0.05 * aspect_ratio
    )

    params = {
        "relative_area":  round(float(relative_area), 4),
        "depth_score":    round(float(depth_score), 4),
        "jaggedness":     round(float(jaggedness), 4),
        "irregularity":   round(float(irregularity), 4),
        "edge_intensity": round(float(edge_intensity), 4),
        "aspect_ratio":   round(float(aspect_ratio), 4),
        "score":          round(float(score), 4)
    }

    if score < 0.30:   severity = "low"
    elif score < 0.60: severity = "medium"
    else:              severity = "high"

    return severity, params


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

@app.route("/predict", methods=["POST", "OPTIONS"])
def predict():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    print("[*] Received prediction request")
    try:
        if "image" not in request.files:
            print("[!] No image in request")
            return _corsify_actual_response(jsonify({"error": "No image provided"}), 400)

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
        print(f"[*] Prediction result: {result} ({confidence:.2%})")

        # If NOT pothole → just return result
        if result == "No Pothole":
            return _corsify_actual_response(jsonify({
                "result": result,
                "confidence": confidence
            }))

        # ====== ADVANCED SEVERITY ANALYSIS ======
        print("[*] Starting severity analysis...")
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        severity, severity_metrics = extract_and_analyze_pothole(img_cv)
        print(f"[*] Severity: {severity}")

        # ====== UPLOAD IMAGE TO SUPABASE STORAGE ======
        filename = f"{user_id}/{uuid.uuid4()}.jpg"
        print(f"[*] Uploading to Supabase: {filename}")

        supabase.storage.from_("Potholes").upload(
            filename,
            image_bytes,
            {"content-type": "image/jpeg"}
        )

        public_url = supabase.storage.from_("Potholes").get_public_url(filename)

        # ====== INSERT INTO DATABASE ======
        print("[*] Inserting into database...")
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
        print("[*] Success!")

        return _corsify_actual_response(jsonify({
            "result": result,
            "confidence": confidence,
            "severity": severity,
            "severity_metrics": severity_metrics,
            "stored": True
        }))

    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return _corsify_actual_response(jsonify({"error": str(e)}), 500)

def _build_cors_preflight_response():
    response = make_response()
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "*")
    response.headers.add("Access-Control-Allow-Methods", "*")
    return response

def _corsify_actual_response(response, status=200):
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response, status


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
    app.run(debug=True, host='0.0.0.0', port=8000)
