import { useState, useEffect } from 'react';
import './Settings.css';

export default function Config() {
  const [activeTab, setActiveTab] = useState('general');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    systemName: 'EDGE AI MONITOR',
    updateInterval: 1000,
    dataRetention: 30,
    autoBackup: true,
    emailNotifications: true,
    soundAlerts: false,
  });

  // Threshold Settings
  const [thresholds, setThresholds] = useState({
    vibration: { warning: 30, danger: 50 },
    temperature: { warning: 70, danger: 85 },
    current: { warning: 15, danger: 20 },
    rpm: { warning: 1800, danger: 2000 },
  });

  // Motor List
  const [motors, setMotors] = useState([
    { id: 1, name: 'Motor #01', location: 'Line Produksi A - Zona B', active: true },
    { id: 2, name: 'Motor #02', location: 'Line Produksi A - Zona C', active: true },
    { id: 3, name: 'Motor #03', location: 'Line Produksi B - Zona A', active: false },
  ]);

  // API Settings
  const [apiSettings, setApiSettings] = useState({
    endpoint: 'http://localhost:5000/api',
    apiKey: '****-****-****-****',
    timeout: 5000,
    retryAttempts: 3,
  });

  // Track changes
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [generalSettings, thresholds, apiSettings]);

  // Show message temporarily
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // Save all configurations
  const handleSaveConfig = async () => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In production, send to backend:
      // await fetch('/api/config', {
      //   method: 'POST',
      //   body: JSON.stringify({ generalSettings, thresholds, apiSettings }),
      // });

      setHasUnsavedChanges(false);
      showMessage('success', 'Konfigurasi berhasil disimpan!');
    } catch (error) {
      showMessage('error', 'Gagal menyimpan konfigurasi!');
    }
  };

  // Reset to defaults
  const handleResetConfig = () => {
    if (confirm('Yakin ingin mereset semua konfigurasi ke default?')) {
      setGeneralSettings({
        systemName: 'EDGE AI MONITOR',
        updateInterval: 1000,
        dataRetention: 30,
        autoBackup: true,
        emailNotifications: true,
        soundAlerts: false,
      });
      setThresholds({
        vibration: { warning: 30, danger: 50 },
        temperature: { warning: 70, danger: 85 },
        current: { warning: 15, danger: 20 },
        rpm: { warning: 1800, danger: 2000 },
      });
      showMessage('success', 'Konfigurasi direset ke default');
    }
  };

  // Export config
  const handleExportConfig = () => {
    const config = { generalSettings, thresholds, apiSettings, motors };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showMessage('success', 'Konfigurasi berhasil di-export!');
  };

  // Toggle motor status
  const toggleMotorStatus = (id) => {
    setMotors(motors.map(motor => 
      motor.id === id ? { ...motor, active: !motor.active } : motor
    ));
    setHasUnsavedChanges(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="config-header">
        <h1>
          <i className="fa-solid fa-sliders"></i>
          Konfigurasi Sistem
        </h1>
        <div className={`save-indicator ${hasUnsavedChanges ? 'unsaved' : 'saved'}`}>
          <i className={`fa-solid ${hasUnsavedChanges ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i>
          {hasUnsavedChanges ? 'Ada perubahan belum disimpan' : 'Semua tersimpan'}
        </div>
      </div>

      {/* Message Box */}
      {message.text && (
        <div className={`message-box ${message.type}`}>
          <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="config-tabs">
        <button
          className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          <i className="fa-solid fa-gear"></i>
          Umum
        </button>
        <button
          className={`tab-btn ${activeTab === 'threshold' ? 'active' : ''}`}
          onClick={() => setActiveTab('threshold')}
        >
          <i className="fa-solid fa-sliders"></i>
          Threshold
        </button>
        <button
          className={`tab-btn ${activeTab === 'motors' ? 'active' : ''}`}
          onClick={() => setActiveTab('motors')}
        >
          <i className="fa-solid fa-gears"></i>
          Motor Management
        </button>
        <button
          className={`tab-btn ${activeTab === 'api' ? 'active' : ''}`}
          onClick={() => setActiveTab('api')}
        >
          <i className="fa-solid fa-code"></i>
          API Settings
        </button>
      </div>

      {/* General Settings Tab */}
      {activeTab === 'general' && (
        <div className="config-grid">
          <div className="config-card">
            <div className="config-card-header">
              <h3 className="config-card-title">
                <i className="fa-solid fa-display"></i>
                Pengaturan Tampilan
              </h3>
            </div>
            <div className="config-card-body">
              <div className="form-group">
                <label className="form-label">
                  <i className="fa-solid fa-tag"></i>
                  Nama Sistem
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={generalSettings.systemName}
                  onChange={(e) => setGeneralSettings({...generalSettings, systemName: e.target.value})}
                  placeholder="Masukkan nama sistem"
                />
                <p className="form-description">Nama yang ditampilkan di sidebar dan header</p>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <i className="fa-solid fa-clock"></i>
                  Interval Update (ms)
                </label>
                <div className="range-slider">
                  <input
                    type="range"
                    className="range-input"
                    min="500"
                    max="5000"
                    step="500"
                    value={generalSettings.updateInterval}
                    onChange={(e) => setGeneralSettings({...generalSettings, updateInterval: parseInt(e.target.value)})}
                  />
                  <div className="range-values">
                    <span>500ms</span>
                    <span className="range-current">{generalSettings.updateInterval}ms</span>
                    <span>5000ms</span>
                  </div>
                </div>
                <p className="form-description">Seberapa cepat data di-refresh</p>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <i className="fa-solid fa-database"></i>
                  Retensi Data (hari)
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={generalSettings.dataRetention}
                  onChange={(e) => setGeneralSettings({...generalSettings, dataRetention: parseInt(e.target.value)})}
                  min="1"
                  max="365"
                />
                <p className="form-description">Berapa lama data history disimpan</p>
              </div>
            </div>
          </div>

          <div className="config-card">
            <div className="config-card-header">
              <h3 className="config-card-title">
                <i className="fa-solid fa-bell"></i>
                Notifikasi & Peringatan
              </h3>
            </div>
            <div className="config-card-body">
              <div className="toggle-switch">
                <div className="toggle-info">
                  <div className="toggle-title">Auto Backup</div>
                  <div className="toggle-desc">Backup otomatis setiap hari pukul 00:00</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={generalSettings.autoBackup}
                    onChange={(e) => setGeneralSettings({...generalSettings, autoBackup: e.target.checked})}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="toggle-switch">
                <div className="toggle-info">
                  <div className="toggle-title">Email Notifications</div>
                  <div className="toggle-desc">Kirim notifikasi ke email saat ada alert</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={generalSettings.emailNotifications}
                    onChange={(e) => setGeneralSettings({...generalSettings, emailNotifications: e.target.checked})}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="toggle-switch">
                <div className="toggle-info">
                  <div className="toggle-title">Sound Alerts</div>
                  <div className="toggle-desc">Mainkan suara alarm saat status DANGER</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={generalSettings.soundAlerts}
                    onChange={(e) => setGeneralSettings({...generalSettings, soundAlerts: e.target.checked})}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="info-box">
                <div className="info-box-title">
                  <i className="fa-solid fa-circle-info"></i>
                  Informasi
                </div>
                <div className="info-box-content">
                  Pastikan email dan webhook sudah dikonfigurasi dengan benar di pengaturan API.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Threshold Settings Tab */}
      {activeTab === 'threshold' && (
        <div className="config-grid">
          <div className="config-card">
            <div className="config-card-header">
              <h3 className="config-card-title">
                <i className="fa-solid fa-triangle-exclamation"></i>
                Batas Ambang Sensor
              </h3>
            </div>
            <div className="config-card-body">
              {/* Vibration */}
              <div className="threshold-group">
                <div className="threshold-header">
                  <div className="threshold-icon vibration">
                    <i className="fa-solid fa-wave-square"></i>
                  </div>
                  <div className="threshold-title">Vibration (mm/s)</div>
                </div>
                <div className="threshold-inputs">
                  <div className="form-group">
                    <label className="form-label">Warning Level</label>
                    <input
                      type="number"
                      className="form-input"
                      value={thresholds.vibration.warning}
                      onChange={(e) => setThresholds({
                        ...thresholds,
                        vibration: {...thresholds.vibration, warning: parseFloat(e.target.value)}
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Danger Level</label>
                    <input
                      type="number"
                      className="form-input"
                      value={thresholds.vibration.danger}
                      onChange={(e) => setThresholds({
                        ...thresholds,
                        vibration: {...thresholds.vibration, danger: parseFloat(e.target.value)}
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Temperature */}
              <div className="threshold-group">
                <div className="threshold-header">
                  <div className="threshold-icon temperature">
                    <i className="fa-solid fa-temperature-high"></i>
                  </div>
                  <div className="threshold-title">Temperature (°C)</div>
                </div>
                <div className="threshold-inputs">
                  <div className="form-group">
                    <label className="form-label">Warning Level</label>
                    <input
                      type="number"
                      className="form-input"
                      value={thresholds.temperature.warning}
                      onChange={(e) => setThresholds({
                        ...thresholds,
                        temperature: {...thresholds.temperature, warning: parseFloat(e.target.value)}
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Danger Level</label>
                    <input
                      type="number"
                      className="form-input"
                      value={thresholds.temperature.danger}
                      onChange={(e) => setThresholds({
                        ...thresholds,
                        temperature: {...thresholds.temperature, danger: parseFloat(e.target.value)}
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="config-card">
            <div className="config-card-header">
              <h3 className="config-card-title">
                <i className="fa-solid fa-bolt"></i>
                Batas Ambang Lanjutan
              </h3>
            </div>
            <div className="config-card-body">
              {/* Current */}
              <div className="threshold-group">
                <div className="threshold-header">
                  <div className="threshold-icon current">
                    <i className="fa-solid fa-bolt"></i>
                  </div>
                  <div className="threshold-title">Current (Ampere)</div>
                </div>
                <div className="threshold-inputs">
                  <div className="form-group">
                    <label className="form-label">Warning Level</label>
                    <input
                      type="number"
                      className="form-input"
                      value={thresholds.current.warning}
                      onChange={(e) => setThresholds({
                        ...thresholds,
                        current: {...thresholds.current, warning: parseFloat(e.target.value)}
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Danger Level</label>
                    <input
                      type="number"
                      className="form-input"
                      value={thresholds.current.danger}
                      onChange={(e) => setThresholds({
                        ...thresholds,
                        current: {...thresholds.current, danger: parseFloat(e.target.value)}
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* RPM */}
              <div className="threshold-group">
                <div className="threshold-header">
                  <div className="threshold-icon rpm">
                    <i className="fa-solid fa-gauge-high"></i>
                  </div>
                  <div className="threshold-title">Speed (RPM)</div>
                </div>
                <div className="threshold-inputs">
                  <div className="form-group">
                    <label className="form-label">Warning Level</label>
                    <input
                      type="number"
                      className="form-input"
                      value={thresholds.rpm.warning}
                      onChange={(e) => setThresholds({
                        ...thresholds,
                        rpm: {...thresholds.rpm, warning: parseInt(e.target.value)}
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Danger Level</label>
                    <input
                      type="number"
                      className="form-input"
                      value={thresholds.rpm.danger}
                      onChange={(e) => setThresholds({
                        ...thresholds,
                        rpm: {...thresholds.rpm, danger: parseInt(e.target.value)}
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Motors Management Tab */}
      {activeTab === 'motors' && (
        <div className="config-card">
          <div className="config-card-header">
            <h3 className="config-card-title">
              <i className="fa-solid fa-gears"></i>
              Daftar Motor yang Dimonitor
            </h3>
          </div>
          <div className="config-card-body">
            <div className="motor-list">
              {motors.map(motor => (
                <div key={motor.id} className="motor-item">
                  <div className="motor-icon">
                    <i className="fa-solid fa-gear"></i>
                  </div>
                  <div className="motor-details">
                    <div className="motor-name">{motor.name}</div>
                    <div className="motor-location">{motor.location}</div>
                  </div>
                  <div className={`motor-status ${motor.active ? 'active' : 'inactive'}`}>
                    <i className={`fa-solid ${motor.active ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                    {motor.active ? 'Active' : 'Inactive'}
                  </div>
                  <div className="motor-actions">
                    <button
                      className="icon-btn"
                      onClick={() => toggleMotorStatus(motor.id)}
                      title={motor.active ? 'Nonaktifkan' : 'Aktifkan'}
                    >
                      <i className={`fa-solid ${motor.active ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                    <button className="icon-btn" title="Edit">
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button className="icon-btn" title="Hapus">
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-config secondary" style={{ marginTop: '20px', width: '100%' }}>
              <i className="fa-solid fa-plus"></i>
              Tambah Motor Baru
            </button>
          </div>
        </div>
      )}

      {/* API Settings Tab */}
      {activeTab === 'api' && (
        <div className="config-card">
          <div className="config-card-header">
            <h3 className="config-card-title">
              <i className="fa-solid fa-code"></i>
              Konfigurasi API Backend
            </h3>
          </div>
          <div className="config-card-body">
            <div className="form-group">
              <label className="form-label">
                <i className="fa-solid fa-link"></i>
                API Endpoint
              </label>
              <input
                type="text"
                className="form-input"
                value={apiSettings.endpoint}
                onChange={(e) => setApiSettings({...apiSettings, endpoint: e.target.value})}
                placeholder="http://localhost:5000/api"
              />
              <p className="form-description">URL backend server untuk komunikasi data</p>
            </div>

            <div className="form-group">
              <label className="form-label">
                <i className="fa-solid fa-key"></i>
                API Key
              </label>
              <input
                type="password"
                className="form-input"
                value={apiSettings.apiKey}
                onChange={(e) => setApiSettings({...apiSettings, apiKey: e.target.value})}
                placeholder="Masukkan API Key"
              />
              <p className="form-description">API key untuk autentikasi dengan backend</p>
            </div>

            <div className="form-group">
              <label className="form-label">
                <i className="fa-solid fa-hourglass"></i>
                Request Timeout (ms)
              </label>
              <input
                type="number"
                className="form-input"
                value={apiSettings.timeout}
                onChange={(e) => setApiSettings({...apiSettings, timeout: parseInt(e.target.value)})}
                min="1000"
                max="30000"
              />
              <p className="form-description">Batas waktu tunggu request ke backend</p>
            </div>

            <div className="form-group">
              <label className="form-label">
                <i className="fa-solid fa-rotate"></i>
                Retry Attempts
              </label>
              <input
                type="number"
                className="form-input"
                value={apiSettings.retryAttempts}
                onChange={(e) => setApiSettings({...apiSettings, retryAttempts: parseInt(e.target.value)})}
                min="0"
                max="10"
              />
              <p className="form-description">Berapa kali mencoba ulang saat request gagal</p>
            </div>

            <button className="btn-config secondary" style={{ width: '100%' }}>
              <i className="fa-solid fa-plug"></i>
              Test Connection
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-buttons-section">
        <button
          className="btn-config primary"
          onClick={handleSaveConfig}
          disabled={!hasUnsavedChanges}
        >
          <i className="fa-solid fa-floppy-disk"></i>
          Simpan Konfigurasi
        </button>
        <button className="btn-config secondary" onClick={handleExportConfig}>
          <i className="fa-solid fa-download"></i>
          Export Config
        </button>
        <button className="btn-config danger" onClick={handleResetConfig}>
          <i className="fa-solid fa-rotate-left"></i>
          Reset to Default
        </button>
      </div>
    </div>
  );
}