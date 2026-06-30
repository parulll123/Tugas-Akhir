import logging
import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from pymodbus.client import ModbusTcpClient

logger = logging.getLogger(__name__)

# ==========================================================
# Register Map
# ==========================================================

HREG_TEMPERATURE = 0
HREG_VRMS = 1
HREG_CLUSTER = 2
HREG_DIST_INT = 3
HREG_ANOMALY = 4
HREG_STATUS_SYSTEM = 5
HREG_ERROR_CODE = 6
HREG_CONN_FLAG = 7

HREG_READ_COUNT = 8

STATUS_SENSOR_OK = 0x0001
STATUS_ETH_OK = 0x0004
STATUS_MODBUS_OK = 0x0008

ERR_MAX6675_FAIL = 0x0001
ERR_MPU6050_FAIL = 0x0002
ERR_ETH_FAIL = 0x0008

ERR_SENSOR_MASK = ERR_MAX6675_FAIL | ERR_MPU6050_FAIL


# ==========================================================
# Data Class
# ==========================================================

@dataclass
class SensorReading:
    timestamp: datetime
    temperature: float
    vib_rms: float
    cluster: int
    dist: float
    anomaly: bool
    status: str
    status_system: int
    error_code: int
    eth_connected: bool
    motor: str = "Motor #01"

    def to_dict(self):
        return {
            "timestamp": self.timestamp.isoformat(),
            "motor": self.motor,
            "temperature": self.temperature,
            "vib_rms": self.vib_rms,
            "vibration": self.vib_rms,
            "cluster": self.cluster,
            "dist": self.dist,
            "anomaly": self.anomaly,
            "status": self.status,
            "status_system": self.status_system,
            "error_code": self.error_code,
            "eth_connected": self.eth_connected,
        }


# ==========================================================
# Helper
# ==========================================================

def _to_int16(raw):
    return raw if raw < 32768 else raw - 65536


def _derive_status(anomaly, error):

    if error & ERR_SENSOR_MASK:
        return "WARNING"

    if anomaly:
        return "DANGER"

    return "NORMAL"


# ==========================================================
# Client
# ==========================================================

class ModbusPollingClient:

    def __init__(
        self,
        host="192.168.1.50",
        port=502,
        unit_id=1,
        poll_interval=1.0,
        timeout=3,
        retry_delay=5,
        on_new_data=None,
    ):

        self.host = host
        self.port = port
        self.unit_id = unit_id

        self.poll_interval = poll_interval
        self.timeout = timeout
        self.retry_delay = retry_delay

        self.on_new_data = on_new_data

        self._client = None

        self._stop = threading.Event()

        self._thread = threading.Thread(
            target=self._run,
            daemon=True,
            name="modbus-poller"
        )

        self._lock = threading.Lock()

        self.connected = False
        self.latest = None

        self.total_polls = 0
        self.error_count = 0

    # ======================================================

    def start(self):

        logger.info(
            f"Modbus poller starting -> {self.host}:{self.port}"
        )

        self._thread.start()

    # ======================================================

    def stop(self):

        self._stop.set()

        if self._client:

            try:
                self._client.close()
            except:
                pass

        self._thread.join(timeout=5)

    # ======================================================

    def get_latest(self):

        with self._lock:

            if self.latest:
                return self.latest.to_dict()

            return None

    # ======================================================

    def is_connected(self):

        return self.connected

    # ======================================================

    def _close_client(self):

        if self._client:

            try:
                self._client.close()
            except:
                pass

        self._client = None
        self.connected = False

    # ======================================================

    def _connect(self):

        self._close_client()

        try:

            self._client = ModbusTcpClient(
                host=self.host,
                port=self.port,
                timeout=self.timeout,
            )

            if self._client.connect():

                self.connected = True

                logger.info(
                    f"Modbus TCP connected -> {self.host}:{self.port}"
                )

                return True

            logger.warning("Connect failed.")

        except Exception as e:

            logger.exception(f"Connect error : {e}")

        self.connected = False
        return False

    # ======================================================

    def _poll(self):

        if self._client is None:
            return None

        try:

            rr = self._client.read_holding_registers(
                address=0,
                count=HREG_READ_COUNT,
                slave=self.unit_id,
            )

            if rr.isError():
                raise Exception(rr)

            reg = rr.registers

            temp = _to_int16(reg[0]) / 10
            vrms = _to_int16(reg[1]) / 1000

            cluster = reg[2]

            dist = reg[3] / 10000

            anomaly = bool(reg[4])

            status_sys = reg[5]

            error = reg[6]

            eth = bool(reg[7])

            status = _derive_status(anomaly, error)

            reading = SensorReading(
                timestamp=datetime.utcnow(),
                temperature=round(temp, 1),
                vib_rms=round(vrms, 3),
                cluster=cluster,
                dist=round(dist, 4),
                anomaly=anomaly,
                status=status,
                status_system=status_sys,
                error_code=error,
                eth_connected=eth,
            )

            logger.info(
                f"POLL OK | "
                f"T={reading.temperature:.1f}°C | "
                f"Vrms={reading.vib_rms:.3f} mm/s | "
                f"Cluster={reading.cluster} | "
                f"Status={reading.status}"
            )

            return reading

        except Exception as e:

            logger.exception(f"Polling failed : {e}")

            self.connected = False

            return None

    # ======================================================

    def _run(self):

        while not self._stop.is_set():

            if not self.connected:

                if not self._connect():

                    logger.info(
                        f"Retry in {self.retry_delay}s..."
                    )

                    self._stop.wait(self.retry_delay)

                    continue

            reading = self._poll()

            self.total_polls += 1

            if reading:

                self.error_count = 0

                with self._lock:
                    self.latest = reading

                if self.on_new_data:

                    try:
                        self.on_new_data(reading)
                    except Exception:
                        logger.exception("Callback error")

            else:

                self.error_count += 1

                logger.warning(
                    f"Polling failed ({self.error_count}/3)"
                )

                if self.error_count >= 3:

                    logger.warning(
                        "Reconnecting Modbus..."
                    )

                    self._close_client()

            self._stop.wait(self.poll_interval)