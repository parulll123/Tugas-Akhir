from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Penting: Izinkan React mengakses Flask

# Route sederhana untuk tes
@app.route('/api/data', methods=['GET'])
def get_data():
    return jsonify({
        "pesan": "Halo! Ini data dikirim dari Flask Backend 🐍",
        "status": "Sukses"
    })

if __name__ == '__main__':
    app.run(debug=True, port=9000)