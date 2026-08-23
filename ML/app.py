"""
FastAPI for Cattle & Buffalo Breed Recognition- (PyTorch version)

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
    (equivalently: uvicorn app:app --host 0.0.0.0 --port 5000)

Then test:
    curl -X POST -F "file=@sample.jpg" http://localhost:5000/predict

Interactive API docs (FastAPI gives you this for free):
    http://localhost:5000/docs
"""

import os
import io
import json
import logging
from contextlib import asynccontextmanager

import numpy as np
from PIL import Image, UnidentifiedImageError

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms
from torchvision.models import efficientnet_v2_s

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

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

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

eval_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
])

# Populated at startup by load_artifacts()
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


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def preprocess_image(file_bytes: bytes):
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
# App setup — load model once at startup (FastAPI's lifespan hook), not per-request
# --------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_artifacts()
    yield  # app runs here
    logger.info("Shutting down.")


app = FastAPI(
    title="Cattle & Buffalo Breed Recognition API",
    description="SIH 2026 — image-based breed recognition, PyTorch/EfficientNetV2-S backend.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow the frontend (likely on a different port/origin) to call this API
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {
        "status": "ok" if model is not None else "model_not_loaded",
        "model_loaded": model is not None,
        "num_classes": len(class_names) if class_names else 0,
        "device": str(DEVICE),
    }


@app.get("/breeds")
async def list_breeds():
    if class_names is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"breeds": class_names, "count": len(class_names)}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None or class_names is None:
        raise HTTPException(status_code=503, detail="Model is not loaded. Check server logs.")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Empty filename.")

    if not allowed_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {sorted(ALLOWED_EXTENSIONS)}"
        )

    file_bytes = await file.read()

    if len(file_bytes) > MAX_CONTENT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {MAX_CONTENT_LENGTH // (1024*1024)} MB."
        )

    try:
        img_tensor = preprocess_image(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error during image preprocessing")
        raise HTTPException(status_code=400, detail=f"Failed to process image: {e}")

    try:
        with torch.no_grad():
            outputs = model(img_tensor)
            probs = F.softmax(outputs, dim=1)[0].cpu().numpy()
    except Exception:
        logger.exception("Model inference failed")
        raise HTTPException(status_code=500, detail="Model inference failed. See server logs.")

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
    return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    # Normalize to {"error": ...} (instead of FastAPI's default {"detail": ...})
    # so this matches the same response shape the frontend (predict_test.html) expects.
    # Registered on the base Starlette class so this also catches routing-level 404s
    # (unmatched URLs), not just HTTPExceptions raised explicitly in route handlers.
    detail = exc.detail if exc.detail else "Not found."
    content = {"error": detail}
    if exc.status_code == 404:
        content["available_endpoints"] = ["/health", "/breeds", "/predict", "/docs"]
    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Raised by FastAPI when required form fields (like the 'file' upload) are
    # missing entirely -- give the same clear message the Flask version gave.
    missing_file = any(err.get("loc", [None])[-1] == "file" for err in exc.errors())
    if missing_file:
        message = "No file provided. Send an image under form field 'file'."
    else:
        message = "Invalid request."
    return JSONResponse(status_code=400, content={"error": message})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server error")
    return JSONResponse(status_code=500, content={"error": "Internal server error."})


# --------------------------------------------------------------------------
# Entry point — plain `python app.py` still works, same convenience as Flask's app.run()
# --------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
