import numpy as np
import cv2
from tensorflow.keras.models import load_model

model = load_model("pothole_detector.h5")

# ═══════════════════════════════════════════════════════════════
#  ADVANCED POTHOLE EXTRACTOR
#  Techniques used:
#  1. CLAHE         → contrast enhancement (handles dark/wet roads)
#  2. Gaussian Blur → noise reduction
#  3. Adaptive Threshold → isolate dark pothole regions
#  4. Canny Edge Detection → find pothole boundaries precisely
#  5. Morphological Ops → clean up mask (close holes, remove noise)
#  6. Contour Detection → find pothole shape
#  7. Bounding Box + Contour overlay → visual output
# ═══════════════════════════════════════════════════════════════

def extract_and_analyze_pothole(img_path):
    img = cv2.imread(img_path)
    if img is None:
        return None, None, "Could not read image", {}

    original = img.copy()
    h, w = img.shape[:2]
    total_area = h * w

    # ── Step 1: CLAHE contrast enhancement ──────────────────────
    # Makes pothole darker regions more distinct from road surface
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # ── Step 2: Gaussian Blur to reduce noise ───────────────────
    blurred = cv2.GaussianBlur(enhanced, (7, 7), 0)

    # ── Step 3: Adaptive Threshold — isolate dark pothole areas ─
    thresh = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=31,
        C=10
    )

    # ── Step 4: Canny Edge Detection ────────────────────────────
    # Detects sharp boundaries — pothole edges are very pronounced
    edges = cv2.Canny(blurred, threshold1=30, threshold2=100)

    # Dilate edges slightly so they connect with threshold mask
    edge_kernel = np.ones((3, 3), np.uint8)
    edges_dilated = cv2.dilate(edges, edge_kernel, iterations=2)

    # Combine threshold + edge map for stronger pothole mask
    combined = cv2.bitwise_or(thresh, edges_dilated)

    # ── Step 5: Morphological operations ────────────────────────
    # CLOSE: fills small holes inside pothole region
    # OPEN:  removes small noise blobs outside
    close_kernel = np.ones((9, 9), np.uint8)
    open_kernel  = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, close_kernel)
    mask = cv2.morphologyEx(mask,    cv2.MORPH_OPEN,  open_kernel)

    # ── Step 6: Contour detection ────────────────────────────────
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return original, mask, "LOW", _default_params()

    # Filter contours — ignore tiny noise blobs (< 0.5% of image)
    valid_contours = [c for c in contours if cv2.contourArea(c) > 0.005 * total_area]
    if not valid_contours:
        return original, mask, "LOW", _default_params()

    # Use the largest contour as the main pothole
    main_contour = max(valid_contours, key=cv2.contourArea)
    pothole_area = cv2.contourArea(main_contour)

    # ── Step 7: Extract severity parameters ─────────────────────

    # 1. Relative area (how much of the image is pothole)
    relative_area = pothole_area / total_area

    # 2. Depth estimate — potholes are darker than surrounding road
    pothole_mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.drawContours(pothole_mask, [main_contour], -1, 255, -1)
    road_mask_inv = cv2.bitwise_not(pothole_mask)
    mean_inside  = cv2.mean(enhanced, mask=pothole_mask)[0]
    mean_outside = cv2.mean(enhanced, mask=road_mask_inv)[0]
    depth_score  = max(0.0, (mean_outside - mean_inside) / 255.0)

    # 3. Jaggedness — irregular/rough edges = more severe damage
    perimeter   = cv2.arcLength(main_contour, True)
    circularity = (4 * np.pi * pothole_area) / (perimeter ** 2) if perimeter > 0 else 1.0
    jaggedness  = 1.0 - min(circularity, 1.0)

    # 4. Aspect ratio of bounding box (spread of damage)
    x, y, bw, bh = cv2.boundingRect(main_contour)
    aspect_ratio = min(bw, bh) / max(bw, bh) if max(bw, bh) > 0 else 0

    # 5. Edge intensity inside pothole (surface roughness/texture)
    sobel_x = cv2.Sobel(enhanced, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(enhanced, cv2.CV_64F, 0, 1, ksize=3)
    sobel_combined = np.uint8(np.clip(np.sqrt(sobel_x**2 + sobel_y**2), 0, 255))
    edge_intensity = cv2.mean(sobel_combined, mask=pothole_mask)[0] / 255.0

    # 6. Convexity defects — measures how "broken" the shape is
    hull = cv2.convexHull(main_contour)
    hull_area = cv2.contourArea(hull)
    solidity = pothole_area / hull_area if hull_area > 0 else 1.0
    irregularity = 1.0 - solidity  # higher = more broken/irregular shape

    # ── Step 8: Weighted severity score ─────────────────────────
    score = (
        0.30 * min(relative_area * 20, 1.0) +   # area (scaled)
        0.25 * depth_score +                      # darkness/depth
        0.15 * jaggedness +                       # edge roughness
        0.15 * irregularity +                     # shape irregularity
        0.10 * edge_intensity +                   # surface texture
        0.05 * aspect_ratio                       # spread
    )
    score = round(score, 4)

    params = {
        "relative_area":  round(relative_area, 4),
        "depth_score":    round(depth_score, 4),
        "jaggedness":     round(jaggedness, 4),
        "irregularity":   round(irregularity, 4),
        "edge_intensity": round(edge_intensity, 4),
        "aspect_ratio":   round(aspect_ratio, 4),
        "contour":        main_contour,
        "bbox":           (x, y, bw, bh),
        "score":          score
    }

    if score < 0.30:   severity = "LOW"
    elif score < 0.60: severity = "MEDIUM"
    else:              severity = "HIGH"

    return original, pothole_mask, severity, params


def _default_params():
    return {
        "relative_area": 0, "depth_score": 0,
        "jaggedness": 0, "irregularity": 0,
        "edge_intensity": 0, "aspect_ratio": 0,
        "score": 0.1
    }


# ── Visual output generator ──────────────────────────────────────
def draw_results(original, params, severity, detection_confidence):
    output = original.copy()

    color_map = {
        "LOW":    (0, 255, 0),     # green
        "MEDIUM": (0, 165, 255),   # orange
        "HIGH":   (0, 0, 255)      # red
    }
    color = color_map[severity]

    # Draw filled semi-transparent contour overlay
    if "contour" in params:
        overlay = output.copy()
        cv2.drawContours(overlay, [params["contour"]], -1, color, -1)
        cv2.addWeighted(overlay, 0.3, output, 0.7, 0, output)

        # Draw contour boundary
        cv2.drawContours(output, [params["contour"]], -1, color, 2)

        # Draw bounding box
        x, y, bw, bh = params["bbox"]
        cv2.rectangle(output, (x, y), (x + bw, y + bh), color, 2)

        # Draw corner ticks on bounding box (cleaner look)
        tick = 12
        for (px, py) in [(x, y), (x+bw, y), (x, y+bh), (x+bw, y+bh)]:
            dx = tick if px == x else -tick
            dy = tick if py == y else -tick
            cv2.line(output, (px, py), (px + dx, py), color, 3)
            cv2.line(output, (px, py), (px, py + dy), color, 3)

        # Label above bounding box
        label = f"Pothole [{severity}] Score:{params['score']}"
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
        cv2.rectangle(output, (x, y - lh - 10), (x + lw + 6, y), color, -1)
        cv2.putText(output, label, (x + 3, y - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

    # Info panel at bottom
    panel_h = 130
    panel = np.zeros((panel_h, output.shape[1], 3), dtype=np.uint8)
    panel[:] = (30, 30, 30)

    lines = [
        f"Severity: {severity}   |   Weighted Score: {params['score']}   |   CNN Confidence: {detection_confidence:.2f}",
        f"Area: {params['relative_area']}   Depth: {params['depth_score']}   Jaggedness: {params['jaggedness']}",
        f"Irregularity: {params['irregularity']}   Edge Intensity: {params['edge_intensity']}   Aspect: {params['aspect_ratio']}"
    ]

    for i, line in enumerate(lines):
        cv2.putText(panel, line, (10, 30 + i * 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color if i == 0 else (200, 200, 200), 1)

    final = np.vstack([output, panel])
    return final


# ═══════════════════════════════════════════════════════════════
#  MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════

recommendations = {
    "LOW":    "Minor surface damage. Monitor periodically.",
    "MEDIUM": "Moderate damage. Schedule repair within 2 weeks.",
    "HIGH":   "Severe pothole. Immediate repair required."
}

def analyze_image(img_path):
    # ── CNN detection ────────────────────────────────────────────
    img_rgb = cv2.imread(img_path)
    img_resized = cv2.resize(img_rgb, (128, 128)) / 255.0
    input_arr = np.expand_dims(img_resized, axis=0)

    cnn_score = float(model.predict(input_arr, verbose=0)[0][0])

    print(f"\nCNN Prediction Score : {cnn_score:.4f}")

    if cnn_score <= 0.5:
        print("Result              : No Pothole Detected\n")
        return

    # ── Severity analysis ────────────────────────────────────────
    original, mask, severity, params = extract_and_analyze_pothole(img_path)

    print("=" * 50)
    print("         POTHOLE SEVERITY REPORT")
    print("=" * 50)
    print(f"  CNN Confidence     : {cnn_score:.2f}")
    print(f"  Relative Area      : {params['relative_area']}")
    print(f"  Depth Estimate     : {params['depth_score']}")
    print(f"  Jaggedness         : {params['jaggedness']}")
    print(f"  Irregularity       : {params['irregularity']}")
    print(f"  Edge Intensity     : {params['edge_intensity']}")
    print(f"  Aspect Ratio       : {params['aspect_ratio']}")
    print("-" * 50)
    print(f"  WEIGHTED SCORE     : {params['score']}")
    print(f"  SEVERITY           : {severity}")
    print(f"  RECOMMENDATION     : {recommendations[severity]}")
    print("=" * 50)

    # ── Save visual output ───────────────────────────────────────
    result_img = draw_results(original, params, severity, cnn_score)
    output_path = "hhh.jpg"
    cv2.imwrite(output_path, result_img)
    print(f"\n  Visual saved → {output_path}")


# ── Run ──────────────────────────────────────────────────────────
analyze_image("lh.jpeg")   # ← change filename here when testing