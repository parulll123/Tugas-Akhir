import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './Dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const [sensorData, setSensorData] = useState({
    vibration: 0,
    temperature: 0,
    current_amp: 0,
    rpm: 0,
    status: 'LOADING...',
    confidence: 0
  });

  const [chartHistory, setChartHistory] = useState({
    labels: [],
    vibData: [],
    tempData: [],
    currentData: []
  });

  const [chartTimeRange, setChartTimeRange] = useState('1m'); // 1m, 5m, 15m
  const [uptime, setUptime] = useState(0);

  // Simulasi uptime counter
  useEffect(() => {
    const uptimeInterval = setInterval(() => {
      setUptime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(uptimeInterval);
  }, []);

  // Format uptime ke HH:MM:SS
  const formatUptime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/live-data');
        const data = await res.json();

        setSensorData(data);

        setChartHistory(prev => {
          const maxPoints = chartTimeRange === '1m' ? 20 : chartTimeRange === '5m' ? 60 : 120;
          const newLabels = [...prev.labels, data.timestamp].slice(-maxPoints);
          const newVib = [...prev.vibData, data.vibration].slice(-maxPoints);
          const newTemp = [...prev.tempData, data.temperature].slice(-maxPoints);
          const newCurrent = [...prev.currentData, data.current_amp].slice(-maxPoints);
          
          return { 
            labels: newLabels, 
            vibData: newVib, 
            tempData: newTemp,
            currentData: newCurrent
          };
        });

      } catch (err) {
        console.error("Gagal ambil data sensor:", err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [chartTimeRange]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      y: { 
        beginAtZero: true,
        grid: { 
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false
        },
        ticks: { color: '#a0a0a0' }
      },
      x: { 
        grid: { 
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false
        },
        ticks: { 
          color: '#a0a0a0',
          maxTicksLimit: 10
        }
      }
    },
    plugins: {
      legend: { 
        labels: { 
          color: '#fff',
          usePointStyle: true,
          padding: 15,
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: '#00d2ff',
        bodyColor: '#fff',
        borderColor: 'rgba(0, 210, 255, 0.3)',
        borderWidth: 1
      }
    }
  };

  const chartDataConfig = {
    labels: chartHistory.labels,
    datasets: [
      {
        label: 'Vibrasi (mm/s)',
        data: chartHistory.vibData,
        borderColor: '#00d2ff',
        backgroundColor: 'rgba(0, 210, 255, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
      {
        label: 'Suhu (°C)',
        data: chartHistory.tempData,
        borderColor: '#ff6b6b',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
      {
        label: 'Arus (A)',
        data: chartHistory.currentData,
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
    ],
  };

  const getStatusColor = (status) => {
    if (status === 'WARNING') return 'warning';
    if (status === 'DANGER') return 'danger';
    return 'normal';
  };

  const getStatusIcon = (status) => {
    if (status === 'DANGER') return 'fa-circle-exclamation';
    if (status === 'WARNING') return 'fa-triangle-exclamation';
    return 'fa-circle-check';
  };

  const getTrendIcon = (value) => {
    // Simulasi trend berdasarkan nilai
    if (value > 50) return { icon: 'fa-arrow-up', color: '#ff3333' };
    if (value > 30) return { icon: 'fa-arrow-right', color: '#ffcc00' };
    return { icon: 'fa-arrow-down', color: '#00ff88' };
  };

  return (
    <div>
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <h1>
          <i className="fa-solid fa-chart-line"></i> Real-time Monitoring
        </h1>
        <div className="dashboard-stats">
          <div className="stat-pill">
            <i className="fa-solid fa-clock"></i>
            Uptime: {formatUptime(uptime)}
          </div>
          <div className="stat-pill">
            <i className="fa-solid fa-server"></i>
            Connected
          </div>
        </div>
      </div>

      {/* Main Monitor Card */}
      <div className="monitor-card">
        <div className="card-header">
          <div className="motor-title">
            <h2>
              <i className="fa-solid fa-gear"></i>
              3-Phase Motor #01
            </h2>
            <div className="motor-subtitle">
              <i className="fa-solid fa-location-dot"></i>
              Line Produksi A - Zona B
            </div>
          </div>
          <div className="live-indicator">
            <div className="live-dot"></div>
            <span>LIVE</span>
          </div>
        </div>

        <div className="card-body">
          {/* AI Status Section */}
          <div className="ai-status-section">
            <div className="status-icon-wrapper">
              <i 
                className={`fa-solid ${getStatusIcon(sensorData.status)} status-icon ${getStatusColor(sensorData.status)}`}
              ></i>
              <div className={`status-ring ${getStatusColor(sensorData.status)}`}></div>
            </div>
            
            <div className={`status-text ${getStatusColor(sensorData.status)}`}>
              {sensorData.status}
            </div>
            
            <div className="confidence-badge">
              <i className="fa-solid fa-brain"></i>
              AI Confidence: {sensorData.confidence}%
            </div>
            
            <div className="confidence-bar">
              <div 
                className="confidence-fill" 
                style={{ width: `${sensorData.confidence}%` }}
              ></div>
            </div>
          </div>

          {/* Sensor Grid */}
          <div className="sensor-grid">
            <div className={`sensor-item bg-${getStatusColor(sensorData.status)}`}>
              <div className="sensor-label">
                <i className="fa-solid fa-wave-square"></i>
                Vibration
              </div>
              <div className="sensor-value">
                {sensorData.vibration}
                <span className="sensor-unit">mm/s</span>
              </div>
              <div className="sensor-trend" style={{ color: getTrendIcon(sensorData.vibration).color }}>
                <i className={`fa-solid ${getTrendIcon(sensorData.vibration).icon}`}></i>
                <span>Trend</span>
              </div>
            </div>

            <div className="sensor-item bg-normal">
              <div className="sensor-label">
                <i className="fa-solid fa-temperature-high"></i>
                Temperature
              </div>
              <div className="sensor-value">
                {sensorData.temperature}
                <span className="sensor-unit">°C</span>
              </div>
              <div className="sensor-trend" style={{ color: getTrendIcon(sensorData.temperature).color }}>
                <i className={`fa-solid ${getTrendIcon(sensorData.temperature).icon}`}></i>
                <span>Trend</span>
              </div>
            </div>

            <div className="sensor-item">
              <div className="sensor-label">
                <i className="fa-solid fa-bolt"></i>
                Current
              </div>
              <div className="sensor-value">
                {sensorData.current_amp}
                <span className="sensor-unit">A</span>
              </div>
              <div className="sensor-trend" style={{ color: getTrendIcon(sensorData.current_amp).color }}>
                <i className={`fa-solid ${getTrendIcon(sensorData.current_amp).icon}`}></i>
                <span>Stable</span>
              </div>
            </div>

            <div className="sensor-item">
              <div className="sensor-label">
                <i className="fa-solid fa-gauge-high"></i>
                Speed
              </div>
              <div className="sensor-value">
                {sensorData.rpm}
                <span className="sensor-unit">RPM</span>
              </div>
              <div className="sensor-trend" style={{ color: getTrendIcon(sensorData.rpm).color }}>
                <i className={`fa-solid ${getTrendIcon(sensorData.rpm).icon}`}></i>
                <span>Optimal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">
            <i className="fa-solid fa-chart-area"></i>
            Sensor History
          </h3>
          <div className="chart-controls">
            <button 
              className={`chart-btn ${chartTimeRange === '1m' ? 'active' : ''}`}
              onClick={() => setChartTimeRange('1m')}
            >
              1 Min
            </button>
            <button 
              className={`chart-btn ${chartTimeRange === '5m' ? 'active' : ''}`}
              onClick={() => setChartTimeRange('5m')}
            >
              5 Min
            </button>
            <button 
              className={`chart-btn ${chartTimeRange === '15m' ? 'active' : ''}`}
              onClick={() => setChartTimeRange('15m')}
            >
              15 Min
            </button>
          </div>
        </div>
        <div style={{ height: '360px' }}>
          <Line options={chartOptions} data={chartDataConfig} />
        </div>
      </div>
    </div>
  );
}