import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime

# Konfigurasi MQTT (HARUS SAMA dengan app.py)
BROKER = "broker.hivemq.com"
PORT = 1883
TOPIC = "motor/monitoring"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Terhubung ke MQTT Broker!")
    else:
        print(f"❌ Gagal terhubung, kode: {rc}")

def send_sensor_data(client):
    """Simulasi pengiriman data sensor seperti ESP32"""
    
    while True:
        # Simulasi data sensor (nantinya diganti dengan sensor real di ESP32)
        vib = round(random.uniform(0.5, 2.5), 2)  # Vibration
        temp = round(random.uniform(40, 65), 1)   # Temperature
        amp = round(random.uniform(5.0, 8.0), 2)  # Current
        rpm = random.randint(1400, 1500)
        
        # Logika status
        status = "NORMAL"
        if vib > 2.0 or temp > 60:
            status = "WARNING"
        if vib > 2.3 or temp > 63:
            status = "CRITICAL"
        
        # Data JSON yang dikirim
        payload = {
            "vibration": vib,
            "temperature": temp,
            "current_amp": amp,
            "rpm": rpm,
            "status": status,
            "confidence": random.randint(95, 99),
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Kirim ke MQTT
        result = client.publish(TOPIC, json.dumps(payload))
        
        if result.rc == 0:
            print(f"📤 Data terkirim: Vib={vib}, Temp={temp}, Status={status}")
        else:
            print(f"❌ Gagal kirim data!")
        
        time.sleep(2)  # Kirim setiap 2 detik

if __name__ == "__main__":
    print("🚀 Memulai MQTT Simulator...")
    
    # Setup MQTT Client
    client = mqtt.Client()
    client.on_connect = on_connect
    
    # Connect ke broker
    print(f"🔌 Menghubungkan ke {BROKER}:{PORT}")
    client.connect(BROKER, PORT, 60)
    
    # Mulai loop dan kirim data
    client.loop_start()
    
    try:
        send_sensor_data(client)
    except KeyboardInterrupt:
        print("\n⛔ Program dihentikan")
        client.loop_stop()
        client.disconnect()