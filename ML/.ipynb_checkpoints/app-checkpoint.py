"""
Flask API for Cattle & Buffalo Breed Recognition — SIH 2026 (PyTorch version)

Serves the EfficientNetV2-S model trained in project.ipynb.

IMPORTANT: PyTorch's .pt state_dict has no architecture info baked in -- this file
rebuilds the EXACT SAME model architecture as the notebook before loading the
weights. If you change the architecture in the notebook, update build_model() here
to match, or loading will fail (or silently produce garbage predictions).

Expects these files (produced by the notebook) in the same directory as this script,
or pass custom paths via environment variables:
    - cattle_breed_efficientnetv2s.pt   (MODEL_PATH)
    - class_names.json                  (CLASS_NAMES_PATH)

Run:
    pip install -r requirements.txt
    python app.py

Then test:
    curl -X POST -F "file=@sample.jpg" http://localhost:5000/predict
"""

import os
import io
import json
import logging

import numpy as np
from PIL import Image, UnidentifiedImageError
from flask import Flask, request, jsonify
from flask_cors import CORS

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms
from torchvision.models import efficientnet_v2_s

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
MODEL_PATH = os.environ.get("MODEL_PATH", "cattle_breed_efficientnetv2s.pt")
CLASS_NAMES_PATH = os.environ.get("CLASS_NAMES_PATH", "class_names.json")
IMG_SIZE = 224                              # must match training in project.ipynb
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "bmp", "webp"}
MAX_CONTENT_LENGTH = 10 * 1024 * 1024       # 10 MB upload limit
TOP_K = 3
LOW_CONFIDENCE_THRESHOLD = 0.50
IMAGENET_MEAN = [0.485, 0.456, 0.406]       # must match training normalization
IMAGENET_STD = [0.229, 0.224, 0.225]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cattle-breed-api")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
CORS(app)  # allow the frontend (likely on a different port/origin) to call this API

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

eval_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
])

model = None
class_names = None


def build_model(num_classes):
    """MUST exactly match the architecture in project.ipynb's build_model()."""
    m = efficientnet_v2_s(weights=None)  # weights=None: we load our own trained weights next
    in_features = m.classifier[1].in_features
    m.classifier = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(in_features, 128),
        nn.ReLU(),
        nn.Dropout(0.2),
        nn.Linear(128, num_classes),
    )
    return m


def load_artifacts():
    global model, class_names

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model file not found at '{MODEL_PATH}'. "
            f"Run project.ipynb first to train and save the model, "
            f"or set MODEL_PATH to the correct location."
        )
    if not os.path.exists(CLASS_NAMES_PATH):
        raise FileNotFoundError(
            f"Class names file not found at '{CLASS_NAMES_PATH}'. "
            f"Run project.ipynb first — it saves this automatically after training."
        )

    with open(CLASS_NAMES_PATH, "r") as f:
        class_names = json.load(f)

    logger.info(f"Building model architecture for {len(class_names)} classes...")
    model = build_model(len(class_names))

    logger.info(f"Loading weights from '{MODEL_PATH}'...")
    state_dict = torch.load(MODEL_PATH, map_location=DEVICE)
    model.load_state_dict(state_dict)
    model.to(DEVICE)
    model.eval()  # critical: disables dropout/batchnorm training behavior

    logger.info(f"Model loaded. {len(class_names)} breed classes: {class_names}")

    # Warm-up prediction — the first real inference is otherwise slower, which would
    # make your very first live-demo request look broken/slow.
    with torch.no_grad():
        dummy_input = torch.zeros((1, 3, IMG_SIZE, IMG_SIZE)).to(DEVICE)
        model(dummy_input)
    logger.info("Model warm-up complete. API ready.")


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def preprocess_image(file_bytes):
    """Load image bytes -> model-ready tensor. Raises ValueError on bad input."""
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()  # check it's a valid, uncorrupted image
    except (UnidentifiedImageError, Exception) as e:
        raise ValueError(f"Uploaded file is not a valid image: {e}")

    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    tensor = eval_transform(img).unsqueeze(0)  # add batch dimension
    return tensor.to(DEVICE)


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok" if model is not None else "model_not_loaded",
        "model_loaded": model is not None,
        "num_classes": len(class_names) if class_names else 0,
        "device": str(DEVICE),
    })


@app.route("/breeds", methods=["GET"])
def list_breeds():
    if class_names is None:
        return jsonify({"error": "Model not loaded"}), 503
    return jsonify({"breeds": class_names, "count": len(class_names)})


@app.route("/predict", methods=["POST"])
def predict():
    if model is None or class_names is None:
        return jsonify({"error": "Model is not loaded. Check server logs."}), 503

    if "file" not in request.files:
        return jsonify({"error": "No file provided. Send an image under form field 'file'."}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Empty filename."}), 400

    if not allowed_file(file.filename):
        return jsonify({
            "error": f"Unsupported file type. Allowed: {sorted(ALLOWED_EXTENSIONS)}"
        }), 400

    try:
        file_bytes = file.read()
        img_tensor = preprocess_image(file_bytes)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.exception("Unexpected error during image preprocessing")
        return jsonify({"error": f"Failed to process image: {e}"}), 400

    try:
        with torch.no_grad():
            outputs = model(img_tensor)
            probs = F.softmax(outputs, dim=1)[0].cpu().numpy()
    except Exception as e:
        logger.exception("Model inference failed")
        return jsonify({"error": "Model inference failed. See server logs."}), 500

    top_indices = np.argsort(probs)[::-1][:TOP_K]
    top_k_results = [
        {"breed": class_names[i], "confidence": round(float(probs[i]), 4)}
        for i in top_indices
    ]

    best = top_k_results[0]
    response = {
        "breed": best["breed"],
        "confidence": best["confidence"],
        "is_confident": best["confidence"] >= LOW_CONFIDENCE_THRESHOLD,
        "top_k": top_k_results,
    }

    if not response["is_confident"]:
        response["note"] = (
            "Low confidence prediction — consider a clearer photo (full side profile, "
            "good lighting) or manual verification."
        )

    logger.info(f"Prediction: {best['breed']} ({best['confidence']:.2%})")
    return jsonify(response)


@app.errorhandler(413)
def file_too_large(e):
    return jsonify({"error": f"File too large. Max size is {MAX_CONTENT_LENGTH // (1024*1024)} MB."}), 413


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found.", "available_endpoints": ["/health", "/breeds", "/predict"]}), 404


@app.errorhandler(500)
def server_error(e):
    logger.exception("Unhandled server error")
    return jsonify({"error": "Internal server error."}), 500


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------
if __name__ == "__main__":
    load_artifacts()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
