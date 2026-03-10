"""User file persistence endpoints backed by Firebase Admin (Firestore + Storage)."""
import base64
import json
import os
from datetime import datetime
from uuid import uuid4

from flask import Blueprint, g, jsonify, request, Response
from firebase_admin import firestore, storage

from utils.firebase_auth import require_firebase_auth


user_files_bp = Blueprint("user_files", __name__)


def _get_bucket_name() -> str:
    return (
        os.getenv("FIREBASE_STORAGE_BUCKET")
        or f"{os.getenv('FIREBASE_PROJECT_ID', '').strip()}.firebasestorage.app"
    )


def _get_bucket():
    bucket_name = _get_bucket_name()
    if not bucket_name:
        raise RuntimeError("FIREBASE_STORAGE_BUCKET or FIREBASE_PROJECT_ID is required")
    return storage.bucket(bucket_name)


def _user_documents_collection(user_id: str):
    db = firestore.client()
    return db.collection("users").document(user_id).collection("documents")


def _build_title(payload: dict, explicit_title: str | None = None) -> str:
    if explicit_title:
        return explicit_title

    first_text = ""
    results = payload.get("results") or []
    if results and isinstance(results, list):
        first_page = results[0] if isinstance(results[0], dict) else {}
        first_text = str(first_page.get("full_text") or "").strip()

    if first_text:
        return first_text[:50]

    return f"Saved file {datetime.utcnow().isoformat()}"


@user_files_bp.route("/user-files", methods=["GET"])
@require_firebase_auth
def list_user_files():
    user_id = g.firebase_user.get("uid")
    docs_ref = _user_documents_collection(user_id)

    docs = (
        docs_ref.order_by("updatedAt", direction=firestore.Query.DESCENDING)
        .limit(50)
        .stream()
    )

    items = []
    for item in docs:
        data = item.to_dict() or {}
        updated_at = data.get("updatedAt")
        updated_at_ms = int(updated_at.timestamp() * 1000) if updated_at else int(datetime.utcnow().timestamp() * 1000)
        created_at = data.get("createdAt")
        created_at_ms = int(created_at.timestamp() * 1000) if created_at else updated_at_ms

        items.append({
            "id": item.id,
            "title": data.get("title") or "Untitled file",
            "pageCount": data.get("pageCount") or 0,
            "phoneNumber": data.get("phoneNumber"),
            "hasPreview": bool(data.get("previewPath")),
            "updatedAtMs": updated_at_ms,
            "createdAtMs": created_at_ms,
        })

    return jsonify({"documents": items}), 200


@user_files_bp.route("/user-files", methods=["POST"])
@require_firebase_auth
def save_user_file():
    user_id = g.firebase_user.get("uid")
    phone_number = g.firebase_user.get("phone_number")

    data = request.get_json(silent=True) or {}
    payload = data.get("payload")

    if not payload or not isinstance(payload, dict):
        return jsonify({"error": "payload is required"}), 400

    results = payload.get("results") or []
    if not isinstance(results, list) or len(results) == 0:
        return jsonify({"error": "payload.results must contain at least one page"}), 400

    existing_document_id = data.get("existing_document_id")
    document_id = existing_document_id or str(uuid4())

    docs_ref = _user_documents_collection(user_id)
    document_ref = docs_ref.document(document_id)

    bucket = _get_bucket()
    data_path = f"users/{user_id}/documents/{document_id}/document.json"
    preview_path = f"users/{user_id}/documents/{document_id}/preview.jpg"

    payload_json = json.dumps(payload, ensure_ascii=False)
    bucket.blob(data_path).upload_from_string(payload_json, content_type="application/json")

    first_page = results[0] if isinstance(results[0], dict) else {}
    first_image_base64 = first_page.get("image_base64")
    has_preview = False

    if isinstance(first_image_base64, str) and first_image_base64.strip():
        try:
            preview_bytes = base64.b64decode(first_image_base64)
            bucket.blob(preview_path).upload_from_string(preview_bytes, content_type="image/jpeg")
            has_preview = True
        except Exception:
            has_preview = False

    metadata = {
        "title": _build_title(payload, data.get("title")),
        "phoneNumber": phone_number,
        "pageCount": len(results),
        "dataPath": data_path,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }

    if has_preview:
        metadata["previewPath"] = preview_path

    if not existing_document_id:
        metadata["createdAt"] = firestore.SERVER_TIMESTAMP

    document_ref.set(metadata, merge=True)

    return jsonify({"documentId": document_id}), 200


@user_files_bp.route("/user-files/<document_id>", methods=["GET"])
@require_firebase_auth
def load_user_file(document_id: str):
    user_id = g.firebase_user.get("uid")

    docs_ref = _user_documents_collection(user_id)
    document_snapshot = docs_ref.document(document_id).get()

    if not document_snapshot.exists:
        return jsonify({"error": "Saved file not found"}), 404

    metadata = document_snapshot.to_dict() or {}
    data_path = metadata.get("dataPath")
    if not data_path:
        return jsonify({"error": "Saved file data path missing"}), 500

    bucket = _get_bucket()
    payload_text = bucket.blob(data_path).download_as_text()

    try:
        payload = json.loads(payload_text)
    except Exception:
        return jsonify({"error": "Saved file data is invalid"}), 500

    return jsonify(payload), 200


@user_files_bp.route("/user-files/<document_id>", methods=["DELETE"])
@require_firebase_auth
def delete_user_file(document_id: str):
    user_id = g.firebase_user.get("uid")

    docs_ref = _user_documents_collection(user_id)
    document_ref = docs_ref.document(document_id)
    document_snapshot = document_ref.get()

    if not document_snapshot.exists:
        return jsonify({"error": "Saved file not found"}), 404

    metadata = document_snapshot.to_dict() or {}
    bucket = _get_bucket()

    for path_key in ("dataPath", "previewPath"):
        blob_path = metadata.get(path_key)
        if blob_path:
            try:
                bucket.blob(blob_path).delete()
            except Exception:
                pass

    document_ref.delete()
    return jsonify({"success": True}), 200


@user_files_bp.route("/user-files/<document_id>/preview", methods=["GET"])
@require_firebase_auth
def load_user_file_preview(document_id: str):
    user_id = g.firebase_user.get("uid")

    docs_ref = _user_documents_collection(user_id)
    document_snapshot = docs_ref.document(document_id).get()

    if not document_snapshot.exists:
        return jsonify({"error": "Saved file not found"}), 404

    metadata = document_snapshot.to_dict() or {}
    preview_path = metadata.get("previewPath")
    bucket = _get_bucket()

    if preview_path:
        blob = bucket.blob(preview_path)
        if blob.exists():
            image_bytes = blob.download_as_bytes()
            return Response(image_bytes, mimetype="image/jpeg")

    data_path = metadata.get("dataPath")
    if not data_path:
        return jsonify({"error": "Preview not found"}), 404

    try:
        payload_text = bucket.blob(data_path).download_as_text()
        payload = json.loads(payload_text)
        results = payload.get("results") or []
        first_page = results[0] if results and isinstance(results[0], dict) else {}
        image_base64 = first_page.get("image_base64")

        if isinstance(image_base64, str) and image_base64.strip():
            raw_base64 = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
            image_bytes = base64.b64decode(raw_base64)
            return Response(image_bytes, mimetype="image/jpeg")
    except Exception:
        pass

    return jsonify({"error": "Preview not found"}), 404
