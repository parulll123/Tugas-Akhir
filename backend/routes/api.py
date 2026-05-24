# ═══════════════════════════════════════════════════════
# routes/api.py
# REST API Blueprint — Motor Monitor ESP32
# Endpoints: auth, history, events, health
# ═══════════════════════════════════════════════════════

import os
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request, session
from functools import wraps

from models import SensorLog, SystemEvent, db

api = Blueprint("api", __name__, url_prefix="/api")

# ── Config Auth ───────────────────────────────────────
# Ganti via env variable di production
VALID_USERS = {
    os.getenv("ADMIN_USERNAME", "admin"): os.getenv("ADMIN_PASSWORD", "admin123"),
    os.getenv("USER_USERNAME",  "user"):  os.getenv("USER_PASSWORD",  "user123"),
}
SECRET_KEY = os.getenv("SECRET_KEY", "dev-key-ganti-di-production")


# ── Auth Decorator ────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return jsonify({"message": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


# ══════════════════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════════════════

@api.route("/login", methods=["POST"])
def login():
    """Login dengan username & password."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"message": "Request body tidak valid"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"message": "Username dan password wajib diisi"}), 400

    expected = VALID_USERS.get(username)
    if not expected or expected != password:
        return jsonify({"message": "Username atau password salah"}), 401

    session["logged_in"] = True
    session["username"]  = username
    return jsonify({"message": "Login berhasil", "username": username}), 200


@api.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logout berhasil"}), 200


@api.route("/me", methods=["GET"])
def me():
    """Cek status login saat ini."""
    if session.get("logged_in"):
        return jsonify({"logged_in": True, "username": session.get("username")}), 200
    return jsonify({"logged_in": False}), 200


# ══════════════════════════════════════════════════════
# SENSOR HISTORY
# ══════════════════════════════════════════════════════

@api.route("/history", methods=["GET"])
def history():
    """
    Ambil riwayat sensor log.
    Query params:
      limit    — jumlah data (default 200, max 1000)
      offset   — pagination offset
      status   — filter NORMAL / WARNING / DANGER
      motor    — filter nama motor
      from     — filter dari timestamp (ISO format)
      to       — filter sampai timestamp (ISO format)
    """
    limit  = min(int(request.args.get("limit",  200)), 1000)
    offset = int(request.args.get("offset", 0))
    status = request.args.get("status")
    motor  = request.args.get("motor")
    from_  = request.args.get("from")
    to_    = request.args.get("to")

    q = SensorLog.query.order_by(SensorLog.timestamp.desc())

    if status:
        q = q.filter(SensorLog.status == status.upper())
    if motor:
        q = q.filter(SensorLog.motor == motor)
    if from_:
        try:
            q = q.filter(SensorLog.timestamp >= datetime.fromisoformat(from_))
        except ValueError:
            pass
    if to_:
        try:
            q = q.filter(SensorLog.timestamp <= datetime.fromisoformat(to_))
        except ValueError:
            pass

    logs  = q.offset(offset).limit(limit).all()
    total = q.count()

    return jsonify([log.to_dict() for log in logs]), 200


@api.route("/history/stats", methods=["GET"])
def history_stats():
    """Statistik ringkas sensor log."""
    total   = SensorLog.query.count()
    normal  = SensorLog.query.filter_by(status="NORMAL").count()
    warning = SensorLog.query.filter_by(status="WARNING").count()
    danger  = SensorLog.query.filter_by(status="DANGER").count()

    latest = SensorLog.query.order_by(SensorLog.timestamp.desc()).first()

    return jsonify({
        "total":   total,
        "normal":  normal,
        "warning": warning,
        "danger":  danger,
        "latest":  latest.to_dict() if latest else None,
    }), 200


@api.route("/history/<int:log_id>", methods=["GET"])
def history_detail(log_id):
    """Detail satu record sensor log."""
    log = SensorLog.query.get_or_404(log_id)
    return jsonify(log.to_dict()), 200


@api.route("/history", methods=["DELETE"])
def history_delete_old():
    """
    Hapus data lama.
    Query param: days — hapus data lebih dari N hari lalu (default 30)
    """
    days   = int(request.args.get("days", 30))
    cutoff = datetime.utcnow() - timedelta(days=days)
    deleted = SensorLog.query.filter(SensorLog.timestamp < cutoff).delete()
    db.session.commit()
    return jsonify({"deleted": deleted, "cutoff": cutoff.isoformat()}), 200


# ══════════════════════════════════════════════════════
# SYSTEM EVENTS
# ══════════════════════════════════════════════════════

@api.route("/events", methods=["GET"])
def events():
    """
    Ambil system event log.
    Query params: limit, offset, level (INFO/WARNING/ERROR)
    """
    limit  = min(int(request.args.get("limit",  100)), 500)
    offset = int(request.args.get("offset", 0))
    level  = request.args.get("level")

    q = SystemEvent.query.order_by(SystemEvent.timestamp.desc())
    if level:
        q = q.filter(SystemEvent.level == level.upper())

    ev_list = q.offset(offset).limit(limit).all()
    return jsonify([e.to_dict() for e in ev_list]), 200


# ══════════════════════════════════════════════════════
# HEALTH & STATUS
# ══════════════════════════════════════════════════════

@api.route("/status", methods=["GET"])
def status():
    """Status sistem secara keseluruhan."""
    from flask import current_app
    poller = current_app.config.get("MODBUS_POLLER")

    latest = None
    if poller:
        latest = poller.get_latest()

    return jsonify({
        "timestamp":      datetime.utcnow().isoformat() + "Z",
        "modbus_connected": poller.is_connected() if poller else False,
        "latest_reading": latest,
        "db_records":     SensorLog.query.count(),
    }), 200


# ══════════════════════════════════════════════════════
# ERROR HANDLERS
# ══════════════════════════════════════════════════════

@api.errorhandler(404)
def not_found(e):
    return jsonify({"message": "Resource tidak ditemukan"}), 404

@api.errorhandler(500)
def server_error(e):
    return jsonify({"message": "Internal server error"}), 500