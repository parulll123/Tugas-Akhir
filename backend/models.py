# ═══════════════════════════════════════════════════════
# models.py  [REVISI — SINKRON DENGAN New.cpp]
# SQLAlchemy ORM Models
#
# CHANGELOG (revisi sesuai firmware New.cpp):
#   [REV-1] Hapus vib_x / vib_y / vib_z — firmware TIDAK punya
#           getaran per-sumbu, hanya satu VRMS gabungan.
#   [REV-2] vib_rms sekarang satuan mm/s (velocity RMS), bukan m/s².
#   [REV-3] Tambah kolom dari pipeline K-means firmware:
#             cluster        (index K-means 0/1)
#             dist           (jarak ke centroid terdekat)
#             anomaly        (flag anomali K-means)
#             status_system  (bitfield STATUS_* mentah)
#   [REV-4] error_code & eth_connected tetap (sumber: REG6 & REG7).
#   NOTE: ganti skema lama → hapus file motor_monitor.db lama
#         atau jalankan migrasi sebelum dipakai.
# ═══════════════════════════════════════════════════════

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class SensorLog(db.Model):
    """
    Riwayat pembacaan sensor dari ESP32 via Modbus TCP.
    Satu baris = satu snapshot dari polling.
    """
    __tablename__ = "sensor_log"

    id          = db.Column(db.Integer,   primary_key=True, autoincrement=True)
    timestamp   = db.Column(db.DateTime,  nullable=False, default=datetime.utcnow, index=True)
    motor       = db.Column(db.String(32), nullable=False, default="Motor #01")

    # ── Sensor data (sesuai firmware) ──
    temperature = db.Column(db.Float, nullable=False)   # °C
    vib_rms     = db.Column(db.Float, nullable=False)   # [REV-2] mm/s (velocity RMS)

    # [REV-3] Output pipeline K-means firmware
    cluster     = db.Column(db.Integer, nullable=True, default=0)   # index 0/1
    dist        = db.Column(db.Float,   nullable=True, default=0.0) # jarak centroid
    anomaly     = db.Column(db.Boolean, nullable=True, default=False)

    # ── Status & diagnostik ──
    status        = db.Column(db.String(16), nullable=False)   # NORMAL/WARNING/DANGER (diturunkan)
    status_system = db.Column(db.Integer, nullable=True, default=0)   # [REV-3] bitfield STATUS_*
    error_code    = db.Column(db.Integer, nullable=True, default=0)   # bitfield ERR_*
    eth_connected = db.Column(db.Boolean, nullable=True, default=True)

    # [REV-1] Kolom dihapus — firmware tidak menyediakannya:
    #   vib_x / vib_y / vib_z → ESP32 hanya kirim VRMS gabungan (REG1)
    #   confidence / uptime_sec / wdt_resets → tidak ada di firmware

    def to_dict(self) -> dict:
        return {
            "id":            self.id,
            "timestamp":     self.timestamp.isoformat() + "Z",
            "motor":         self.motor,
            "temperature":   self.temperature,
            "vib_rms":       self.vib_rms,
            "vibration":     round(self.vib_rms, 4),   # alias untuk History.jsx
            "cluster":       self.cluster,
            "dist":          self.dist,
            "anomaly":       self.anomaly,
            "status":        self.status,
            "status_system": self.status_system,
            "error_code":    self.error_code,
            "eth_connected": self.eth_connected,
            # placeholder untuk frontend (tidak ada di hardware ini)
            "vib_x":      None,
            "vib_y":      None,
            "vib_z":      None,
            "confidence": None,
            "uptime_sec": None,
            "wdt_resets": None,
            "current":    None,
            "rpm":        None,
        }

    def __repr__(self):
        return f"<SensorLog id={self.id} {self.status} {self.timestamp}>"


class SystemEvent(db.Model):
    """
    Event log level sistem: koneksi, perubahan status, error, dll.
    """
    __tablename__ = "system_event"

    id        = db.Column(db.Integer,   primary_key=True, autoincrement=True)
    timestamp = db.Column(db.DateTime,  nullable=False, default=datetime.utcnow, index=True)
    level     = db.Column(db.String(16), nullable=False)   # INFO / WARNING / ERROR
    source    = db.Column(db.String(32), nullable=False)   # modbus / system / api
    message   = db.Column(db.Text,      nullable=False)

    def to_dict(self) -> dict:
        return {
            "id":        self.id,
            "timestamp": self.timestamp.isoformat() + "Z",
            "level":     self.level,
            "source":    self.source,
            "message":   self.message,
        }