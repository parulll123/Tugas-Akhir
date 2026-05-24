# ═══════════════════════════════════════════════════════
# models.py  [FIXED]
# SQLAlchemy ORM Models
#
# CHANGELOG:
#   [FIX-4] Hapus kolom confidence, uptime_sec, wdt_resets
#           — field ini tidak ada di firmware ESP32
#   [FIX-4] Tambah kolom error_code (bitmask dari ESP32)
#   [FIX-4] Update to_dict() agar sinkron dengan kolom baru
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

    # Sensor data
    vib_x       = db.Column(db.Float, nullable=False)   # m/s²
    vib_y       = db.Column(db.Float, nullable=False)
    vib_z       = db.Column(db.Float, nullable=False)
    vib_rms     = db.Column(db.Float, nullable=False)
    temperature = db.Column(db.Float, nullable=False)   # °C

    # Status dari ESP32
    status      = db.Column(db.String(16), nullable=False)   # NORMAL / WARNING / DANGER

    # [FIX-4] error_code: bitmask ESP32 (0=none, 1=temp, 2=imu, 4=ethernet)
    error_code  = db.Column(db.Integer, nullable=True, default=0)

    # [FIX-4] eth_connected tetap ada (masih dikirim firmware)
    eth_connected = db.Column(db.Boolean, nullable=True, default=True)

    # [FIX-4] Kolom dihapus — tidak ada di firmware ESP32:
    #   confidence  → ESP32 tidak punya TinyML output register
    #   uptime_sec  → ESP32 tidak punya register uptime
    #   wdt_resets  → ESP32 tidak punya register WDT counter

    def to_dict(self) -> dict:
        return {
            "id":           self.id,
            "timestamp":    self.timestamp.isoformat() + "Z",
            "motor":        self.motor,
            "vibration":    round(self.vib_rms, 4),   # alias untuk History.jsx
            "vib_x":        self.vib_x,
            "vib_y":        self.vib_y,
            "vib_z":        self.vib_z,
            "vib_rms":      self.vib_rms,
            "temperature":  self.temperature,
            "status":       self.status,
            "error_code":   self.error_code,
            "eth_connected": self.eth_connected,
            # placeholder untuk frontend (belum ada di hardware)
            "confidence":   None,
            "uptime_sec":   None,
            "wdt_resets":   None,
            "current":      None,
            "rpm":          None,
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