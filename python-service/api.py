import json
import logging
import os
from pathlib import Path
from typing import Dict, List

import cv2
import numpy as np
from deepface import DeepFace
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect

app = FastAPI(title="Face Recognition Microservice")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("face-service")

MODEL = "SFace"
DETECTOR = "yunet"
DATA_DIR = Path("/app/data")
DB_FILE = DATA_DIR / "embeddings.json"

# In-memory cache of registered embeddings: { "user_id": [[float, ...], ...] }
embedding_store: Dict[str, List[List[float]]] = {}


def load_store() -> None:
    """Load persisted embeddings from disk into memory on startup."""
    global embedding_store
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if DB_FILE.exists():
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                embedding_store = json.load(f)
            logger.info(f"[startup] Loaded {len(embedding_store)} users from {DB_FILE}")
        except (json.JSONDecodeError, IOError) as err:
            logger.error(f"[startup] Failed to load embeddings: {err}")
            embedding_store = {}


def save_store() -> None:
    """Persist the in-memory embeddings to disk."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(embedding_store, f)
    logger.info(f"[store] Saved {len(embedding_store)} users to {DB_FILE}")


def decode_image(file_bytes: bytes) -> np.ndarray:
    """Convert raw uploaded bytes into an OpenCV BGR image."""
    np_arr = np.frombuffer(file_bytes, dtype=np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid or corrupted image file.")
    return image


def extract_verified_embedding(image: np.ndarray) -> tuple[List[float], bool]:
    """Run face detection and extract the SFace embedding."""
    is_real = True

    # Attempt anti-spoofing if PyTorch with FasNet is functional
    try:
        import torch
        if hasattr(torch, "device"):
            faces = DeepFace.extract_faces(
                img_path=image,
                detector_backend=DETECTOR,
                enforce_detection=True,
                anti_spoofing=True,
            )
            if len(faces) != 1:
                raise ValueError(f"Expected exactly one face, found {len(faces)}.")
            is_real = bool(faces[0].get("is_real", True))
            if not is_real:
                raise ValueError("Liveness check failed. Possible spoof detected.")
    except (AttributeError, ImportError):
        # PyTorch environment does not support FasNet torch.device; skip anti-spoofing
        pass
    except ValueError:
        raise
    except Exception:
        pass

    representations = DeepFace.represent(
        img_path=image,
        model_name=MODEL,
        detector_backend=DETECTOR,
        enforce_detection=True,
        align=True,
    )
    return representations[0]["embedding"], is_real


def cosine_distance(vec_a: list[float], vec_b: list[float]) -> float:
    """Fast vectorized cosine distance."""
    a = np.asarray(vec_a, dtype=np.float32)
    b = np.asarray(vec_b, dtype=np.float32)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 1.0
    return float(1.0 - np.dot(a, b) / denom)


@app.on_event("startup")
def startup_event():
    """Load database and pre-warm DeepFace models on container boot."""
    load_store()
    # Warm up SFace & YuNet weights so the first API call is fast
    dummy = np.zeros((224, 224, 3), dtype=np.uint8)
    try:
        DeepFace.represent(
            img_path=dummy,
            model_name=MODEL,
            detector_backend=DETECTOR,
            enforce_detection=False,
        )
        logger.info("[startup] DeepFace models warmed up successfully")
    except Exception as err:
        logger.error(f"[startup] DeepFace warmup failed: {err}")


@app.get("/health")
def health():
    return {"status": "healthy", "registered_users": len(embedding_store)}


@app.post("/register")
async def register_face(user_id: str = Form(None), file: UploadFile = File(...)):
    """Register a face embedding for a given user_id."""
    # Accept both user_id and userId form fields
    if user_id is None:
        raise HTTPException(status_code=400, detail="user_id is required")

    logger.info(f"[register] user_id={user_id} file={file.filename}")

    image_bytes = await file.read()
    try:
        image = decode_image(image_bytes)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    try:
        vector, _is_real = extract_verified_embedding(image)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except Exception as err:
        logger.error(f"[register] Face extraction failed: {err}")
        raise HTTPException(status_code=500, detail=f"Face extraction failed: {str(err)}")

    if user_id not in embedding_store:
        embedding_store[user_id] = []
    embedding_store[user_id].append(vector)
    save_store()

    return {
        "status": "registered",
        "user_id": user_id,
        "total_samples": len(embedding_store[user_id]),
    }


@app.post("/recognize")
async def recognize_face(request: Request, user_id: str = Form(None), userId: str = Form(None)):
    """
    Compare a live capture against registered embeddings.
    If user_id is provided, performs 1:1 verification.
    If user_id is omitted, performs 1:N identification across all registered users.
    Accepts either 'file' or 'frame' as the upload field name.
    """
    # Accept both user_id and userId form fields
    target_user_id = user_id or userId

    logger.info(f"[recognize] Request received user_id={target_user_id}")

    if not embedding_store:
        return {
            "matched": False,
            "user_id": None,
            "distance": None,
            "threshold": 0.593,
            "confidence": 0.0,
            "liveness": None,
            "error": "No registered faces in database. Enroll a face first at /api/face/register.",
        }

    # Accept both 'file' and 'frame' as the upload field name
    try:
        form = await request.form()
    except Exception as err:
        logger.error(f"[recognize] Form parse error: {err}")
        raise HTTPException(status_code=400, detail=f"Failed to parse form data: {str(err)}")

    upload_file = form.get("file") or form.get("frame")
    if upload_file is None:
        raise HTTPException(status_code=400, detail="No image file provided. Send as 'file' or 'frame' field.")

    if not isinstance(upload_file, UploadFile):
        raise HTTPException(status_code=400, detail="Invalid file upload.")

    try:
        image_bytes = await upload_file.read()
    except Exception as err:
        raise HTTPException(status_code=400, detail=f"Failed to read image file: {str(err)}")

    try:
        image = decode_image(image_bytes)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    try:
        sample_vector, _is_real = extract_verified_embedding(image)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except Exception as err:
        logger.error(f"[recognize] Face extraction failed: {err}")
        raise HTTPException(status_code=500, detail=f"Face extraction failed: {str(err)}")

    # Filter targets (1:1 if user_id is given, else 1:N)
    if user_id:
        if user_id not in embedding_store:
            raise HTTPException(status_code=404, detail=f"User '{user_id}' is not registered.")
        targets = {user_id: embedding_store[user_id]}
    else:
        targets = embedding_store

    best_match = None
    lowest_distance = float("inf")
    cutoff = 0.593  # Default SFace cosine threshold

    for uid, vectors in targets.items():
        for ref_vector in vectors:
            dist = cosine_distance(sample_vector, ref_vector)
            if dist < lowest_distance:
                lowest_distance = dist
                is_match = dist <= cutoff
                best_match = {
                    "matched": bool(is_match),
                    "user_id": uid if is_match else None,
                    "distance": round(dist, 4),
                    "threshold": round(cutoff, 4),
                    "confidence": round(1.0 - dist, 4),
                    "liveness": is_real,
                }

    if best_match is None:
        best_match = {
            "matched": False,
            "user_id": None,
            "distance": round(lowest_distance, 4),
            "threshold": round(cutoff, 4),
            "confidence": round(1.0 - lowest_distance, 4),
            "liveness": is_real,
        }

    logger.info(f"[recognize] user_id={target_user_id} matched={best_match['matched']} confidence={best_match.get('confidence')}")
    return best_match


@app.delete("/register/{user_id}")
def delete_user(user_id: str):
    """Remove a user's face data from memory and disk."""
    if user_id not in embedding_store:
        raise HTTPException(status_code=404, detail="User not found.")
    del embedding_store[user_id]
    save_store()
    return {"status": "deleted", "user_id": user_id}


@app.get("/register/{user_id}")
def get_user_embeddings(user_id: str):
    """Get number of registered samples for a user."""
    if user_id not in embedding_store:
        raise HTTPException(status_code=404, detail="User not found.")
    return {
        "user_id": user_id,
        "total_samples": len(embedding_store[user_id]),
    }


@app.websocket("/ws/recognize")
async def websocket_recognize(websocket: WebSocket):
    """Real-time face recognition over WebSocket."""
    await websocket.accept()
    target_user_id = websocket.query_params.get("user_id")
    cutoff = 0.593  # Default SFace cosine threshold

    try:
        while True:
            frame_bytes = await websocket.receive_bytes()

            if not embedding_store:
                await websocket.send_json(
                    {"status": "error", "message": "No registered faces.", "matched": False}
                )
                continue

            try:
                image = decode_image(frame_bytes)
                sample_vector, is_real = extract_verified_embedding(image)
            except ValueError as exc:
                await websocket.send_json({
                    "status": "scanning",
                    "matched": False,
                    "message": str(exc),
                    "user_id": None,
                    "distance": None,
                    "confidence": None,
                    "liveness": is_real,
                })
                continue

            targets = {target_user_id: embedding_store[target_user_id]} if target_user_id else embedding_store

            best_match = None
            lowest_distance = float("inf")

            for uid, vectors in targets.items():
                for ref_vector in vectors:
                    dist = cosine_distance(sample_vector, ref_vector)
                    if dist < lowest_distance:
                        lowest_distance = dist
                        is_match = dist <= cutoff
                        best_match = {
                            "matched": bool(is_match),
                            "user_id": uid if is_match else None,
                            "distance": round(dist, 4),
                            "threshold": round(cutoff, 4),
                            "confidence": round(1.0 - dist, 4),
                            "liveness": is_real,
                        }

            if best_match is None:
                best_match = {
                    "matched": False,
                    "user_id": None,
                    "distance": round(lowest_distance, 4),
                    "threshold": round(cutoff, 4),
                    "confidence": round(1.0 - lowest_distance, 4),
                    "liveness": is_real,
                }

            await websocket.send_json(best_match)

    except WebSocketDisconnect:
        logger.info("[ws] Client disconnected")
    except Exception as err:
        logger.error(f"[recognize-ws] Unexpected error: {err}")
        try:
            await websocket.send_json({
                "status": "error",
                "message": str(err),
                "matched": False,
            })
        except Exception:
            pass