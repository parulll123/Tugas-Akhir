from flask import Flask, jsonify, request
from flask_cors import CORS
import paho.mqtt.client as mqtt
import json
import threading
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Variabel global untuk menyimpan data real-time dari MQTT
latest_sensor_data = {
    "timestamp": datetime.now().strftime('%H:%M:%S'),
    "vibration": 0.0,
    "temperature": 0.0,
    "current_amp": 0.0,
    "rpm": 0,
    "status": "WAITING",
    "confidence": 0
}

# ========== KONFIGURASI MQTT ==========
BROKER = "broker.hivemq.com"
PORT = 1883
TOPIC = "motor/monitoring"

def on_connect(client, userdata, flags, rc):
    print(f"✅ MQTT Connected! Return code: {rc}")
    client.subscribe(TOPIC)
    print(f"📡 Subscribed to topic: {TOPIC}")

def on_message(client, userdata, msg):
    global latest_sensor_data
    try:
        # Parse data JSON dari MQTT
        data = json.loads(msg.payload.decode())
        
        # Update data global
        latest_sensor_data = {
            "timestamp": datetime.now().strftime('%H:%M:%S'),
            "vibration": data.get("vibration", 0.0),
            "temperature": data.get("temperature", 0.0),
            "current_amp": data.get("current_amp", 0.0),
            "rpm": data.get("rpm", 0),
            "status": data.get("status", "NORMAL"),
            "confidence": data.get("confidence", 0)
        }
        
        print(f"📊 Data diterima: Vib={latest_sensor_data['vibration']}, Temp={latest_sensor_data['temperature']}")
        
    except Exception as e:
        print(f"❌ Error parsing MQTT message: {e}")

def mqtt_thread():
    """Thread terpisah untuk menjalankan MQTT client"""
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        client.connect(BROKER, PORT, 60)
        print(f"🔌 Connecting to MQTT Broker: {BROKER}:{PORT}")
        client.loop_forever()
    except Exception as e:
        print(f"❌ MQTT Connection Error: {e}")

# ========== API ROUTES ==========

@app.route('/api/hello', methods=['GET'])
def hello_world():
    return jsonify({
        "message": "Halo! Ini data dari Flask",
        "status": "sukses"
    })

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if username == "admin" and password == "12345":
        return jsonify({
            "status": "success",
            "message": "Login Berhasil!",
            "token": "dummy-token-123"
        }), 200
    else:
        return jsonify({
            "status": "error",
            "message": "Username atau Password salah!"
        }), 401

@app.route('/api/live-data', methods=['GET'])
def live_data():
    """Endpoint ini sekarang mengembalikan data REAL dari MQTT"""
    return jsonify(latest_sensor_data)

@app.route('/api/mqtt-status', methods=['GET'])
def mqtt_status():
    """Cek apakah MQTT sudah terima data atau belum"""
    is_connected = latest_sensor_data['status'] != "WAITING"
    return jsonify({
        "mqtt_connected": is_connected,
        "last_update": latest_sensor_data['timestamp'],
        "broker": BROKER,
        "topic": TOPIC
    })

if __name__ == '__main__':
    # Jalankan MQTT client di thread terpisah
    print("🚀 Starting MQTT listener...")
    threading.Thread(target=mqtt_thread, daemon=True).start()
    
    # Jalankan Flask server
    print("🚀 Starting Flask server on port 9000...")
    app.run(debug=True, port=9000, use_reloader=False)