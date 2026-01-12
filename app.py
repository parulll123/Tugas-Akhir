from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import time
from datetime import datetime

app = Flask(__name__)
CORS(app) # Ini kuncinya agar tidak diblokir browser

@app.route('/api/hello', methods=['GET'])
def hello_world():
    return jsonify({
        "message": "Halo! Ini data dari Flask",
        "status": "sukses"
    })
# Route baru untuk Login
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() # Ambil data JSON dari React
    
    username = data.get('username')
    password = data.get('password')
    
    # Logika Cek Password Sederhana (Nanti bisa diganti pakai Database)
    if username == "admin" and password == "12345":
        return jsonify({
            "status": "success",
            "message": "Login Berhasil!",
            "token": "dummy-token-123" # Nanti dipakai untuk sesi
        }), 200
    else:
        return jsonify({
            "status": "error",
            "message": "Username atau Password salah!"
        }), 401
    
@app.route('/api/live-data', methods=['GET'])
def live_data():
    # Simulasi data sensor
    vib = round(random.uniform(0.5, 2.5), 2)  # Getar: 0.5 - 2.5 mm/s
    temp = round(random.uniform(40, 65), 1)   # Suhu: 40 - 65 C
    amp = round(random.uniform(5.0, 8.0), 2)  # Arus: 5 - 8 A
    
    # Logika status sederhana
    status = "NORMAL"
    if vib > 2.0 or temp > 60:
        status = "WARNING"
    
    return jsonify({
        "timestamp": datetime.now().strftime('%H:%M:%S'),
        "vibration": vib,
        "temperature": temp,
        "current_amp": amp,
        "rpm": 1450,
        "status": status,
        "confidence": 98 # Skor AI ceritanya
    })

if __name__ == '__main__':
    app.run(debug=True, port=9000)