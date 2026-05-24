# ═══════════════════════════════════════════════════════
# modbus_client.py  [FIXED]
# Modbus TCP Client — polling ESP32 setiap interval
# Library: pymodbus >= 3.x
#
# CHANGELOG (fixes):
#   [FIX-1] Register map disesuaikan dengan main.cpp ESP32
#           Urutan asli ESP32: TEMP=0, VIB_X=1, VIB_Y=2, VIB_Z=3,
#           STATUS=4, ERROR_CODE=5, ETH_FLAG=6
#   [FIX-2] Scaling vibration diubah /100 → /10 (ESP32 pakai ×10)
#   [FIX-3] Hapus read_coils() — ESP32 tidak register handler coil,
#           ganti baca ETH_FLAG dari Holding Register 0x0006
#   [FIX-4] Field confidence/uptime/wdt_resets dihapus dari polling
#           karena tidak ada di firmware ESP32 saat ini
# ═══════════════════════════════════════════════════════

import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from pymodbus.client import ModbusTcpClient
from pymodbus.exceptions import ModbusException

logger = logging.getLogger(__name__)

# ── Register Map ─────────────────────────────────────
# [FIX-1] Disesuaikan dengan ESP32 main.cpp:
#   REG_TEMPERATURE  = 0   (0x0000) → suhu × 10
#   REG_VIBRATION_X  = 1   (0x0001) → vibration X × 10
#   REG_VIBRATION_Y  = 2   (0x0002) → vibration Y × 10
#   REG_VIBRATION_Z  = 3   (0x0003) → vibration Z × 10
#   REG_STATUS       = 4   (0x0004) → 0=OK 1=WARNING 2=ERROR
#   REG_ERROR_CODE   = 5   (0x0005) → error bitmask
#   REG_ETH_FLAG     = 6   (0x0006) → 1=ethernet connected
#   REG_RESERVED_7   = 7   (0x0007)
#   REG_RESERVED_8   = 8   (0x0008)
#   REG_RESERVED_9   = 9   (0x0009)

HREG_TEMP        = 0x0000   # Suhu × 10 (uint16)        [FIX-1]
HREG_VIB_X       = 0x0001   # Getaran X × 10 (uint16)   [FIX-1]
HREG_VIB_Y       = 0x0002   # Getaran Y × 10 (uint16)   [FIX-1]
HREG_VIB_Z       = 0x0003   # Getaran Z × 10 (uint16)   [FIX-1]
HREG_STATUS      = 0x0004   # 0=Normal 1=Warning 2=Error
HREG_ERROR_CODE  = 0x0005   # Error bitmask              [FIX-1]
HREG_ETH_FLAG    = 0x0006   # 1=Ethernet connected       [FIX-1, FIX-3]

# Baca 7 register sekaligus (0x0000–0x0006)
HREG_READ_COUNT  = 7

STATUS_MAP = {0: "NORMAL", 1: "WARNING", 2: "DANGER"}

# Error bitmask (sesuai firmware)
ERROR_NONE     = 0
ERROR_TEMP     = 1
ERROR_IMU      = 2
ERROR_ETHERNET = 4


@dataclass
class SensorReading:
    """Satu snapshot data dari ESP32."""
    timestamp:     datetime
    vib_x:         float        # m/s²
    vib_y:         float
    vib_z:         float
    vib_rms:       float
    temperature:   float        # °C
    status:        str          # NORMAL / WARNING / DANGER
    error_code:    int          # bitmask
    eth_connected: bool
    motor:         str = "Motor #01"

    def to_dict(self) -> dict:
        return {
            "timestamp":     self.timestamp.isoformat(),
            "motor":         self.motor,
            "vib_x":         self.vib_x,
            "vib_y":         self.vib_y,
            "vib_z":         self.vib_z,
            "vib_rms":       round(self.vib_rms, 4),
            "temperature":   self.temperature,
            "status":        self.status,
            "error_code":    self.error_code,
            "eth_connected": self.eth_connected,
        }


def _to_int16(raw: int) -> int:
    """Konversi uint16 hasil Modbus ke int16 signed."""
    return raw if raw < 0x8000 else raw - 0x10000


class ModbusPollingClient:
    """
    Polling Modbus TCP ke ESP32 secara periodik di background thread.
    Thread-safe: data terbaru bisa diakses via .get_latest()
    """

    def __init__(
        self,
        host: str = "192.168.1.50",
        port: int = 502,
        unit_id: int = 1,
        poll_interval: float = 0.5,
        timeout: float = 3.0,
        retry_delay: float = 5.0,
        on_new_data=None,           # callback(SensorReading)
    ):
        self.host          = host
        self.port          = port
        self.unit_id       = unit_id
        self.poll_interval = poll_interval
        self.timeout       = timeout
        self.retry_delay   = retry_delay
        self.on_new_data   = on_new_data

        self._client: Optional[ModbusTcpClient] = None
        self._lock   = threading.Lock()
        self._thread = threading.Thread(
            target=self._run, daemon=True, name="modbus-poller"
        )
        self._stop = threading.Event()

        self.latest:      Optional[SensorReading] = None
        self.connected:   bool = False
        self.error_count: int = 0
        self.total_polls: int = 0

    # ── Public API ────────────────────────────────────
    def start(self):
        logger.info(f"Modbus poller starting → {self.host}:{self.port}")
        self._thread.start()

    def stop(self):
        self._stop.set()
        self._thread.join(timeout=5)
        if self._client:
            self._client.close()
        logger.info("Modbus poller stopped.")

    def get_latest(self) -> Optional[dict]:
        with self._lock:
            return self.latest.to_dict() if self.latest else None

    def is_connected(self) -> bool:
        return self.connected

    # ── Internal ──────────────────────────────────────
    def _connect(self) -> bool:
        try:
            self._client = ModbusTcpClient(
                host=self.host,
                port=self.port,
                timeout=self.timeout,
            )
            result = self._client.connect()
            self.connected = result
            if result:
                logger.info(f"Modbus TCP connected → {self.host}:{self.port}")
            else:
                logger.warning("Modbus TCP connect() returned False")
            return result
        except Exception as e:
            logger.error(f"Modbus connect error: {e}")
            self.connected = False
            return False

    def _poll(self) -> Optional[SensorReading]:
        """
        Baca 7 Holding Register sekaligus (1 request batch).
        [FIX-3] Tidak lagi baca coil — ETH_FLAG dibaca dari HR[6].
        """
        try:
            # Baca 7 register: 0x0000 s/d 0x0006
            hr = self._client.read_holding_registers(
                address=0x0000, count=HREG_READ_COUNT, slave=self.unit_id
            )
            if hr.isError():
                raise ModbusException(f"HR read error: {hr}")

            regs = hr.registers  # list[uint16], len=7

            # [FIX-1] Urutan register sesuai ESP32 main.cpp
            temperature = regs[HREG_TEMP]    / 10.0          # suhu ÷10

            # [FIX-2] Vibration scaling ×10 di ESP32, jadi bagi 10 (bukan 100)
            # ESP32 pakai fabs() jadi nilai selalu positif — decode sebagai uint16
            vib_x = regs[HREG_VIB_X] / 10.0
            vib_y = regs[HREG_VIB_Y] / 10.0
            vib_z = regs[HREG_VIB_Z] / 10.0

            status_raw  = regs[HREG_STATUS]
            error_code  = regs[HREG_ERROR_CODE]

            # [FIX-3] Baca ethernet flag dari HR[6], bukan dari coil
            eth_connected = bool(regs[HREG_ETH_FLAG])

            vib_rms = (vib_x**2 + vib_y**2 + vib_z**2) ** 0.5

            reading = SensorReading(
                timestamp     = datetime.utcnow(),
                vib_x         = round(vib_x, 3),
                vib_y         = round(vib_y, 3),
                vib_z         = round(vib_z, 3),
                vib_rms       = vib_rms,
                temperature   = round(temperature, 1),
                status        = STATUS_MAP.get(status_raw, "UNKNOWN"),
                error_code    = int(error_code),
                eth_connected = eth_connected,
            )
            return reading

        except (ModbusException, AttributeError, IndexError) as e:
            logger.warning(f"Poll error: {e}")
            self.connected = False
            return None

    def _run(self):
        while not self._stop.is_set():
            # Connect / reconnect
            if not self.connected:
                if not self._connect():
                    logger.info(f"Retry in {self.retry_delay}s...")
                    self._stop.wait(self.retry_delay)
                    continue

            reading = self._poll()
            self.total_polls += 1

            if reading:
                self.connected   = True
                self.error_count = 0
                with self._lock:
                    self.latest = reading
                if self.on_new_data:
                    try:
                        self.on_new_data(reading)
                    except Exception as e:
                        logger.error(f"on_new_data callback error: {e}")
            else:
                self.error_count += 1
                if self.error_count >= 3:
                    logger.warning("3 consecutive errors — reconnecting...")
                    self.connected = False
                    if self._client:
                        self._client.close()

            self._stop.wait(self.poll_interval)