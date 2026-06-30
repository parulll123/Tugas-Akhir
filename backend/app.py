# ═══════════════════════════════════════════════════════
# app.py  [REVISI — SINKRON DENGAN New.cpp]
# Flask Backend — Motor Monitor ESP32
# Stack: Flask + SQLAlchemy + pymodbus + Flask-SocketIO
#
# CHANGELOG (revisi sesuai firmware New.cpp):
#   [REV-1] Insert SensorLog disesuaikan: hapus vib_x/y/z,
#           tambah vib_rms(mm/s), cluster, dist, anomaly, status_system.
#   [REV-2] Pesan event status memakai satuan mm/s (bukan m/s²).
# ═══════════════════════════════════════════════════════

import logging
import os
import time
from datetime import datetime

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO

from models import SensorLog, SystemEvent, db
from modbus_client import ModbusPollingClient, SensorReading
from routes.api import api

# ── Logging ───────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────
class Config:
    # Database — SQLite default, ganti ke PostgreSQL untuk production
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "sqlite:///motor_monitor.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
    }

    # Host = IP ESP32 di New.cpp (STATIC_IP 192.168.1.50)
    MODBUS_HOST    = os.getenv("MODBUS_HOST", "192.168.1.50")
    MODBUS_PORT    = int(os.getenv("MODBUS_PORT", "502"))
    MODBUS_UNIT_ID = int(os.getenv("MODBUS_UNIT_ID", "1"))
    POLL_INTERVAL  = float(os.getenv("POLL_INTERVAL", "0.5"))   # detik

    # Flask
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-key-ganti-di-production")
    DEBUG      = os.getenv("FLASK_DEBUG", "false").lower() == "true"

    # Log ke DB setiap N poll (hemat storage)
    LOG_EVERY_N = int(os.getenv("LOG_EVERY_N", "10"))   # setiap 5 detik


# ── Factory ───────────────────────────────────────────
def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # Extensions
    db.init_app(app)
    CORS(app, origins=["http://localhost:5173", "http://localhost:3000"])

    # Blueprints
    app.register_blueprint(api)

    # DB init
    with app.app_context():
        db.create_all()
        logger.info("Database tables ready.")

    # SocketIO — untuk push realtime ke React
    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode="threading",
        logger=False,
        engineio_logger=False,
    )
    app.config["SOCKETIO"] = socketio

    # ── Modbus polling callback ───────────────────────
    poll_counter = {"n": 0, "last_status": None}

    def on_new_reading(reading: SensorReading):
        """
        Dipanggil setiap kali polling berhasil.
        1. Push ke frontend via SocketIO
        2. Simpan ke DB setiap LOG_EVERY_N poll
        3. Catat event jika status berubah
        """
        poll_counter["n"] += 1
        data = reading.to_dict()

        # Push realtime ke semua client yang connect
        socketio.emit("sensor_update", data)

        # Simpan ke database setiap N poll
        if poll_counter["n"] % app.config["LOG_EVERY_N"] == 0:
            with app.app_context():
                # [REV-1] Field disesuaikan dengan register firmware New.cpp
                log = SensorLog(
                    timestamp     = reading.timestamp,
                    motor         = reading.motor,
                    temperature   = reading.temperature,
                    vib_rms       = reading.vib_rms,
                    cluster       = reading.cluster,
                    dist          = reading.dist,
                    anomaly       = reading.anomaly,
                    status        = reading.status,
                    status_system = reading.status_system,
                    error_code    = reading.error_code,
                    eth_connected = reading.eth_connected,
                )
                db.session.add(log)

                # Catat perubahan status sebagai event
                if reading.status != poll_counter["last_status"]:
                    event = SystemEvent(
                        level   = "WARNING" if reading.status != "NORMAL" else "INFO",
                        source  = "modbus",
                        message = (
                            f"Status berubah: {poll_counter['last_status']} → "
                            f"{reading.status} | "
                            f"T={reading.temperature}°C "
                            f"vRMS={reading.vib_rms:.3f}mm/s "      # [REV-2]
                            f"cluster={reading.cluster} "
                            f"anomaly={int(reading.anomaly)}"
                        ),
                    )
                    db.session.add(event)
                    poll_counter["last_status"] = reading.status
                    # Push event ke frontend
                    socketio.emit("status_change", {
                        "status":    reading.status,
                        "anomaly":   reading.anomaly,
                        "timestamp": reading.timestamp.isoformat(),
                    })

                db.session.commit()

    # ── Start Modbus Poller ───────────────────────────
    poller = ModbusPollingClient(
        host          = app.config["MODBUS_HOST"],
        port          = app.config["MODBUS_PORT"],
        unit_id       = app.config["MODBUS_UNIT_ID"],
        poll_interval = app.config["POLL_INTERVAL"],
        on_new_data   = on_new_reading,
    )
    app.config["MODBUS_POLLER"] = poller
    poller.start()

    # ── SocketIO events ───────────────────────────────
    @socketio.on("connect")
    def on_connect():
        logger.info("WebSocket client connected")
        latest = poller.get_latest()
        if latest:
            socketio.emit("sensor_update", latest)

    @socketio.on("disconnect")
    def on_disconnect():
        logger.info("WebSocket client disconnected")

    # ── Health check ──────────────────────────────────
    @app.route("/health")
    def health():
        from flask import jsonify
        return jsonify({
            "status":    "ok",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "modbus":    poller.is_connected(),
            "db_records": SensorLog.query.count(),
        })

    logger.info(
        f"Flask app ready | Modbus→{app.config['MODBUS_HOST']}:{app.config['MODBUS_PORT']} "
        f"| Poll {app.config['POLL_INTERVAL']}s | Log every {app.config['LOG_EVERY_N']} polls"
    )

    return app, socketio


# ── Entry Point ───────────────────────────────────────
if __name__ == "__main__":
    app, socketio = create_app()
    socketio.run(
        app,
        host="0.0.0.0",
        port=9000,
        debug=app.config["DEBUG"],
        use_reloader=False,   # PENTING: reloader akan duplikasi thread Modbus
        allow_unsafe_werkzeug=True,
    )