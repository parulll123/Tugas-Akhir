import requests
import time
import random

# Alamat Flask server (pastikan Flask sudah running)
URL = "http://127.0.0.1:9000/api/update"

print("Simulasi Edge Device dimulai... (Tekan Ctrl+C untuk stop)")

while True:
    # Simulasi logika Edge AI
    vib_val = round(random.uniform(0.5, 8.0), 2)
    temp_val = round(random.uniform(40, 75), 1)
    
    status = "NORMAL"
    if vib_val > 6.0:
        status = "DANGER"
    elif vib_val > 4.0:
        status = "WARNING"
        
    payload = {
        "temp": temp_val,
        "vib": vib_val,
        "amp": round(random.uniform(3, 6), 2),
        "status": status,
        "conf": round(random.uniform(90, 99), 1)
    }

    try:
        r = requests.post(URL, json=payload)
        print(f"Sent: {payload} | Response: {r.status_code}")
    except Exception as e:
        print("Error connection:", e)

    time.sleep(2) # Kirim data tiap 2 detik