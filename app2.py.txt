from flask import Flask, render_template, jsonify, request, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import datetime
import os

app = Flask(__name__)

# --- KONFIGURASI KEAMANAN & DATABASE ---
app.config['SECRET_KEY'] = 'rahasia-skripsi-123' # Ganti dengan kunci acak
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///motor_monitor.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# --- MODEL DATABASE ---
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)

class SensorData(db.Model):
    __tablename__ = 'sensor_data'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    temperature = db.Column(db.Float, nullable=False)
    vibration = db.Column(db.Float, nullable=False)
    current_amp = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default='NORMAL')
    confidence = db.Column(db.Float, default=0.0)
    
    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'temperature': self.temperature,
            'vibration': self.vibration,
            'current_amp': self.current_amp,
            'status': self.status,
            'confidence': self.confidence
        }

class AnomalyLog(db.Model):
    __tablename__ = 'anomaly_logs'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    status = db.Column(db.String(20), nullable=False)
    vibration = db.Column(db.Float, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(200), default='')
    
    def to_dict(self):
        return {
            'id': self.id,
            'time': self.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'status': self.status,
            'vib': self.vibration,
            'temp': self.temperature,
            'description': self.description
        }

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- VARIABEL GLOBAL DATA SENSOR ---
current_motor_data = {
    "temperature": 0.0,
    "vibration": 0.0,
    "current_amp": 0.0,
    "status": "OFFLINE",
    "confidence": 0.0,
    "last_update": "-"
}

system_config = {
    "max_vib": 5.0,
    "max_temp": 80.0
}

# --- ROUTE LOGIN & LOGOUT ---
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('index'))
        else:
            flash('Username atau password salah!', 'error')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Anda telah logout.', 'info')
    return redirect(url_for('login'))

# --- ROUTE DASHBOARD ---
@app.route('/')
@login_required
def index():
    return render_template('index.html')

# --- ROUTE RIWAYAT ---
@app.route('/history')
@login_required
def history():
    # Ambil data anomali dari database, urutkan dari terbaru
    logs = AnomalyLog.query.order_by(AnomalyLog.timestamp.desc()).limit(100).all()
    return render_template('history.html', logs=[log.to_dict() for log in logs])

# --- ROUTE KONFIGURASI ---
@app.route('/settings', methods=['GET', 'POST'])
@login_required
def config_page():
    if request.method == 'POST':
        system_config['max_vib'] = float(request.form.get('max_vib'))
        system_config['max_temp'] = float(request.form.get('max_temp'))
        flash('Konfigurasi berhasil diperbarui!', 'success')
        
    return render_template('config.html', config_data=system_config)

# --- API UPDATE FROM ESP32 ---
@app.route('/api/update', methods=['POST'])
def update_data():
    global current_motor_data
    try:
        data = request.json
        
        # Update current data
        current_motor_data['temperature'] = data.get('temp', 0)
        current_motor_data['vibration'] = data.get('vib', 0)
        current_motor_data['current_amp'] = data.get('current', 0)
        current_motor_data['status'] = data.get('status', 'UNKNOWN')
        current_motor_data['confidence'] = data.get('confidence', 0)
        current_motor_data['last_update'] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Simpan ke database sensor_data
        new_sensor = SensorData(
            temperature=current_motor_data['temperature'],
            vibration=current_motor_data['vibration'],
            current_amp=current_motor_data['current_amp'],
            status=current_motor_data['status'],
            confidence=current_motor_data['confidence']
        )
        db.session.add(new_sensor)
        
        # Jika Status BAHAYA, simpan ke anomaly_logs
        if data.get('status') == "DANGER":
            new_anomaly = AnomalyLog(
                status="DANGER",
                vibration=data.get('vib'),
                temperature=data.get('temp'),
                description="AI detected bearing fault"
            )
            db.session.add(new_anomaly)
        
        db.session.commit()
        
        return jsonify({"message": "Success", "saved": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

# --- API GET LIVE DATA ---
@app.route('/api/live-data', methods=['GET'])
@login_required
def get_live_data():
    return jsonify(current_motor_data)

# --- API GET HISTORICAL DATA ---
@app.route('/api/historical-data', methods=['GET'])
@login_required
def get_historical_data():
    # Get query parameters
    limit = request.args.get('limit', 100, type=int)
    hours = request.args.get('hours', 1, type=int)
    
    # Calculate time threshold
    time_threshold = datetime.datetime.utcnow() - datetime.timedelta(hours=hours)
    
    # Query database
    data = SensorData.query.filter(
        SensorData.timestamp >= time_threshold
    ).order_by(SensorData.timestamp.desc()).limit(limit).all()
    
    return jsonify([d.to_dict() for d in reversed(data)])

# --- API GET ANOMALIES ---
@app.route('/api/anomalies', methods=['GET'])
@login_required
def get_anomalies():
    limit = request.args.get('limit', 50, type=int)
    anomalies = AnomalyLog.query.order_by(
        AnomalyLog.timestamp.desc()
    ).limit(limit).all()
    
    return jsonify([a.to_dict() for a in anomalies])

# --- API CLEAR OLD DATA (Maintenance) ---
@app.route('/api/clear-old-data', methods=['POST'])
@login_required
def clear_old_data():
    try:
        days = request.json.get('days', 7)
        threshold = datetime.datetime.utcnow() - datetime.timedelta(days=days)
        
        # Delete old sensor data
        deleted_sensors = SensorData.query.filter(
            SensorData.timestamp < threshold
        ).delete()
        
        db.session.commit()
        
        return jsonify({
            "message": f"Deleted {deleted_sensors} old records",
            "threshold": threshold.strftime('%Y-%m-%d %H:%M:%S')
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

# --- DATABASE STATISTICS ---
@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    try:
        total_records = SensorData.query.count()
        total_anomalies = AnomalyLog.query.count()
        
        # Get latest record
        latest = SensorData.query.order_by(SensorData.timestamp.desc()).first()
        
        # Get records from last 24 hours
        last_24h = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
        records_24h = SensorData.query.filter(
            SensorData.timestamp >= last_24h
        ).count()
        
        return jsonify({
            "total_records": total_records,
            "total_anomalies": total_anomalies,
            "records_last_24h": records_24h,
            "latest_timestamp": latest.timestamp.strftime('%Y-%m-%d %H:%M:%S') if latest else None
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- SETUP AWAL DATABASE ---
def init_database():
    with app.app_context():
        db.create_all()
        
        # Create admin user if not exists
        if not User.query.filter_by(username='admin').first():
            hashed_pw = generate_password_hash('admin123', method='pbkdf2:sha256')
            admin_user = User(username='admin', password=hashed_pw)
            db.session.add(admin_user)
            db.session.commit()
            print("✓ User 'admin' berhasil dibuat!")
        
        print("✓ Database initialized successfully!")
        print(f"✓ Total sensor records: {SensorData.query.count()}")
        print(f"✓ Total anomaly logs: {AnomalyLog.query.count()}")

if __name__ == '__main__':
    # Initialize database
    if not os.path.exists('instance/motor_monitor.db'):
        init_database()
    
    app.run(debug=True, host='0.0.0.0', port=9000)