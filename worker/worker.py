import os
import io
import time
import uuid
from datetime import datetime, timedelta

import cv2
import numpy as np
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
POLL_INTERVAL = 3  # seconds

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def apply_settings(img_bgr: np.ndarray, settings: dict) -> np.ndarray:
    '''
    Apply edit settings to an OpenCV image (BGR)
    Returns processed BGR image
    '''
    brightness  = settings.get("brightness", 1.0)
    contrast    = settings.get("contrast", 1.0)
    saturation  = settings.get("saturation", 1.0)
    hue_shift   = settings.get("hue", 0)          # degrees, 0–360
    tint        = settings.get("tint", 0)          # -180–180
    warmth      = settings.get("warmth", 0)        # -100–100
    black_point = settings.get("blackPoint", 0)    # 0–100

    img = img_bgr.copy().astype(np.float32)

    # --- Brightness & Contrast ---
    # formula: output = contrast * input + (brightness - 1) * 128
    # then scale brightness separately for cleaner control
    img = img * contrast
    img = img * brightness
    img = np.clip(img, 0, 255)

    # --- Warmth: shift R and B channels ---
    if warmth != 0:
        factor = warmth / 100.0
        if factor > 0:
            # Warm: boost red (index 2 in BGR), reduce blue (index 0)
            img[:, :, 2] = np.clip(img[:, :, 2] * (1 + factor * 0.3), 0, 255)
            img[:, :, 0] = np.clip(img[:, :, 0] * (1 - factor * 0.2), 0, 255)
        else:
            # Cool: boost blue, reduce red
            img[:, :, 0] = np.clip(img[:, :, 0] * (1 + abs(factor) * 0.3), 0, 255)
            img[:, :, 2] = np.clip(img[:, :, 2] * (1 - abs(factor) * 0.2), 0, 255)

    img = img.astype(np.uint8)

    # --- Saturation & Hue via HSV ---
    # OpenCV HSV: H in [0,180], S in [0,255], V in [0,255]
    if saturation != 1.0 or hue_shift != 0:
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)

        if hue_shift != 0:
            # OpenCV hue is 0–180, so divide degree shift by 2
            hsv[:, :, 0] = (hsv[:, :, 0] + hue_shift / 2.0) % 180

        if saturation != 1.0:
            hsv[:, :, 1] = np.clip(hsv[:, :, 1] * saturation, 0, 255)

        hsv = np.clip(hsv, 0, 255).astype(np.uint8)
        img = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    # --- Tint: color overlay matching CSS mix-blend-mode:color ---
    # Positive tint = magenta/pink, negative tint = green (same as CSS preview)
    if tint != 0:
        alpha = (abs(tint) / 180) * 0.25
        if tint > 0:
            overlay = np.array([255, 0, 255], dtype=np.float32)  # magenta in BGR
        else:
            overlay = np.array([0, 255, 0], dtype=np.float32)   # green in BGR
        img = img.astype(np.float32)
        img = img * (1 - alpha) + overlay * alpha
        img = np.clip(img, 0, 255).astype(np.uint8)

    # --- Black Point: lift shadows ---
    if black_point > 0:
        threshold = int(black_point * 2.55)  # 0–100 → 0–255
        lut = np.arange(256, dtype=np.uint8)
        lut[:threshold] = threshold
        img = cv2.LUT(img, lut)

    return img


def resolve_settings(batch_settings: dict, image_overrides: dict | None) -> dict:
    """Merge per-field: image overrides take precedence over batch template."""
    resolved = dict(batch_settings)
    if image_overrides:
        resolved.update(image_overrides)
    return resolved


def download_image(url: str) -> np.ndarray:
    """Download image from URL and decode into BGR numpy array."""
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    arr = np.frombuffer(response.content, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Could not decode image from {url}")
    return img


def upload_edited_image(img_bgr: np.ndarray, image_id: str) -> str:
    """Encode image as JPEG, upload to Supabase Storage, return public URL."""
    success, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not success:
        raise ValueError("Failed to encode image as JPEG")

    # Use a unique run ID so the URL changes on every reprocess,
    # preventing browsers from serving a stale cached version
    run_id = str(uuid.uuid4())
    path = f"edited/{image_id}_{run_id}.jpg"
    supabase.storage.from_("edited").upload(
        path,
        buf.tobytes(),
        {"content-type": "image/jpeg"},
    )
    return supabase.storage.from_("edited").get_public_url(path)


def process_one(image_row: dict, batch_settings: dict) -> None:
    image_id = image_row["id"]
    print(f"[worker] Processing {image_id}")

    # Mark as processing immediately to prevent double-pickup
    supabase.table("images").update({"status": "processing"}).eq("id", image_id).execute()

    try:
        final_settings = resolve_settings(
            batch_settings,
            image_row.get("image_override_settings"),
        )

        img = download_image(image_row["original_url"])
        edited = apply_settings(img, final_settings)
        edited_url = upload_edited_image(edited, image_id)

        supabase.table("images").update({
            "status": "done",
            "edited_url": edited_url,
        }).eq("id", image_id).execute()

        print(f"[worker] Done: {image_id}")

    except Exception as e:
        print(f"[worker] Failed {image_id}: {e}")
        supabase.table("images").update({"status": "failed"}).eq("id", image_id).execute()


def reset_stuck_rows() -> None:
    '''On startup, reset rows stuck in 'processing' for > 10 minutes back to pending'''
    cutoff = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
    result = supabase.table("images") \
        .update({"status": "pending"}) \
        .eq("status", "processing") \
        .lt("created_at", cutoff) \
        .execute()
    if result.data:
        print(f"[worker] Reset {len(result.data)} stuck row(s) to pending")


def poll() -> None:
    while True:
        result = supabase.table("images") \
            .select("id, batch_id, original_url, image_override_settings, batches(edit_settings)") \
            .eq("status", "pending") \
            .execute()

        rows = result.data or []
        if rows:
            print(f"[worker] Found {len(rows)} pending image(s)")

        for row in rows:
            batch_settings = (row.get("batches") or {}).get("edit_settings") or {}
            process_one(row, batch_settings)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    print(f"[worker] Starting — polling every {POLL_INTERVAL}s")
    reset_stuck_rows()
    poll()
