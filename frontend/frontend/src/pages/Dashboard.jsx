import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import "./Dashboard.css";

// ── Constants ──────────────────────────────────────────────
const MAX_POINTS = 60;
const TEMP_MIN   = 0;
const TEMP_MAX   = 120;
const TEMP_WARN  = 70;
const TEMP_FAULT = 90;
const VIB_FAULT  = 3.5;
const VIB_WARN   = 2.0;

// Ganti dengan URL backend Flask kamu
const BACKEND_URL = "http://localhost:9000";

const TASKS = [
  { name: "TASK_SENSOR",   prio: "HIGH",   id: "sensor" },
  { name: "TASK_MODBUS",   prio: "HIGH",   id: "modbus" },
  { name: "TASK_ETHERNET", prio: "NORMAL", id: "ethernet" },
];

// ── Helpers ────────────────────────────────────────────────
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

function formatTime(d) {
  return d.toLocaleTimeString("id-ID", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}
function formatDate(d) {
  return d.toLocaleDateString("id-ID", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric"
  }).toUpperCase();
}

function tempColor(t) {
  if (t >= TEMP_FAULT) return "var(--fault)";
  if (t >= TEMP_WARN)  return "var(--warning)";
  return "var(--normal)";
}

function statusFromData(vib_rms, temperature) {
  if (temperature >= TEMP_FAULT || vib_rms >= VIB_FAULT) return "fault";
  if (temperature >= TEMP_WARN  || vib_rms >= VIB_WARN)  return "warning";
  return "normal";
}

function statusLabel(s) {
  if (s === "normal")  return { icon: "✓", text: "NORMAL" };
  if (s === "warning") return { icon: "⚠", text: "WARNING" };
  return { icon: "✕", text: "FAULT" };
}

// ── Custom Tooltip ─────────────────────────────────────────
const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-panel)", border: "1px solid var(--border-bright)",
      borderRadius: 4, padding: "8px 12px",
      fontFamily: "var(--font-mono)", fontSize: 10
    }}>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── Main Dashboard Component ───────────────────────────────
export default function Dashboard() {
  const [time,       setTime]      = useState(new Date());
  const [series,     setSeries]    = useState([]);
  const [tempSeries, setTempSeries]= useState([]);
  const [latest,     setLatest]    = useState({ vib_x:0, vib_y:0, vib_z:0, vib_rms:0, temperature:0 });
  const [status,     setStatus]    = useState("normal");
  const [logs,       setLogs]      = useState([]);
  const [connected,  setConnected] = useState(false);   // status koneksi SocketIO
  const [ethConn,    setEthConn]   = useState(false);   // status ethernet ESP32
  const [uptime,     setUptime]    = useState(0);

  const prevStatusRef = useRef("normal");

  // ── Clock ──────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Uptime counter (lokal, dari pertama connect) ───────
  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(t);
  }, [connected]);

  // ── SocketIO Connection ────────────────────────────────
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ["websocket"] });

    socket.on("connect", () => {
      setConnected(true);
      console.log("SocketIO connected");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      console.log("SocketIO disconnected");
    });

    // Event utama: data sensor baru dari ESP32
    socket.on("sensor_update", (data) => {
      const now = new Date();
      const timeStr = formatTime(now);

      const st = statusFromData(data.vib_rms, data.temperature);

      setLatest(data);
      setEthConn(data.eth_connected);

      setSeries(prev => {
        const next = [...prev, {
          name: timeStr,
          vX: data.vib_x,
          vY: data.vib_y,
          vZ: data.vib_z,
        }];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });

      setTempSeries(prev => {
        const next = [...prev, { name: timeStr, temp: data.temperature }];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });

      setStatus(st);

      // Tambah ke event log jika status berubah
      if (st !== prevStatusRef.current) {
        setLogs(prev => [{
          time:   timeStr,
          status: st,
          detail: `vRMS=${data.vib_rms.toFixed(3)} T=${data.temperature}°C`,
        }, ...prev].slice(0, 80));
        prevStatusRef.current = st;
      }
    });

    // Event perubahan status dari server
    socket.on("status_change", (data) => {
      console.log("Status change event:", data);
    });

    return () => socket.disconnect();
  }, []);

  const rms = latest.vib_rms ?? 0;
  const sl  = statusLabel(status);

  const uptimeStr = (() => {
    const h = Math.floor(uptime / 3600).toString().padStart(2, "0");
    const m = Math.floor((uptime % 3600) / 60).toString().padStart(2, "0");
    const s = (uptime % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  })();

  return (
    <div className={`dashboard ${status === "fault" ? "fault-active" : ""}`}>

      {/* ── HEADER ─────────────────────────────────────── */}
      <header className="header">
        <div className="header-brand">
          <div className="brand-icon">ESP<br/>32</div>
          <div className="brand-text">
            <h1>Motor Monitor</h1>
            <p>FreeRTOS · W5500 Ethernet · Modbus TCP</p>
          </div>
        </div>

        <div className="header-center">
          <div className="system-clock">{formatTime(time)}</div>
          <div className="system-date">{formatDate(time)}</div>
        </div>

        <div className="header-status">
          {/* Status koneksi SocketIO ke Flask */}
          <div className={`conn-badge ${connected ? "online" : "offline"}`}>
            <span className="conn-dot"/>
            {connected ? "BACKEND ONLINE" : "BACKEND OFFLINE"}
          </div>
          {/* Status Ethernet ESP32 */}
          <div className={`conn-badge ${ethConn ? "online" : "offline"}`}>
            <span className="conn-dot"/>
            {ethConn ? "ESP32 ETHERNET ON" : "ESP32 ETHERNET OFF"}
          </div>
        </div>
      </header>

      {/* ── STATUS BAR ─────────────────────────────────── */}
      <div className="status-bar">
        {/* Motor Status */}
        <div className="stat-cell motor-status-cell" style={{
          "--before-color": status==="normal"?"var(--normal)":status==="warning"?"var(--warning)":"var(--fault)"
        }}>
          <div className="stat-label">KONDISI MOTOR</div>
          <div className={`status-badge ${status}`}>
            <span className="status-icon">{sl.icon}</span>
            {sl.text}
          </div>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--text-dim)", marginTop:3 }}>
            STATUS VIA MODBUS TCP
          </div>
        </div>

        {/* Temp */}
        <div className="stat-cell">
          <div className="stat-label">SUHU MOTOR</div>
          <div className="stat-value" style={{
            color: tempColor(latest.temperature),
            textShadow: `0 0 12px ${tempColor(latest.temperature)}88`
          }}>
            {(latest.temperature ?? 0).toFixed(1)}
          </div>
          <div className="stat-unit">°C  ·  MAX6675 THERMOCOUPLE</div>
        </div>

        {/* Vibration RMS */}
        <div className="stat-cell">
          <div className="stat-label">GETARAN RMS</div>
          <div className={`stat-value ${rms>=VIB_FAULT?"fault":rms>=VIB_WARN?"warning":"normal"}`}>
            {rms.toFixed(3)}
          </div>
          <div className="stat-unit">m/s²  ·  MPU6050 IMU</div>
        </div>

        {/* Uptime lokal sejak connect */}
        <div className="stat-cell">
          <div className="stat-label">UPTIME SESI</div>
          <div className="stat-value accent">{uptimeStr}</div>
          <div className="stat-unit">HH:MM:SS  ·  SEJAK CONNECT</div>
        </div>

        {/* Motor field */}
        <div className="stat-cell">
          <div className="stat-label">MOTOR</div>
          <div className="stat-value" style={{ color:"var(--accent)", fontSize:18 }}>
            {latest.motor ?? "—"}
          </div>
          <div className="stat-unit">UNIT AKTIF</div>
        </div>
      </div>

      {/* ── MAIN GRID ──────────────────────────────────── */}
      <div className="main-grid">

        {/* Panel 1: Getaran X Y Z Chart */}
        <div className="panel panel-wide">
          <div className="panel-header">
            <div className="panel-title">GETARAN AKSELEROMETER — REAL-TIME</div>
            <div style={{ display:"flex", gap:12 }}>
              {[
                { key:"vX", color:"#00cfff", label:"AXIS-X" },
                { key:"vY", color:"#00e676", label:"AXIS-Y" },
                { key:"vZ", color:"#ffab00", label:"AXIS-Z" },
              ].map(ax => (
                <div key={ax.key} className="legend-item">
                  <div className="legend-dot" style={{ background:ax.color, height:2, width:16 }}/>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--text-secondary)" }}>
                    {ax.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="axis-row">
            {[
              { label:"X-AXIS", val:latest.vib_x ?? 0, color:"#00cfff" },
              { label:"Y-AXIS", val:latest.vib_y ?? 0, color:"#00e676" },
              { label:"Z-AXIS", val:latest.vib_z ?? 0, color:"#ffab00" },
            ].map(ax => (
              <div key={ax.label} className="axis-card">
                <div className="axis-label">{ax.label}</div>
                <div className="axis-value" style={{ color:ax.color,
                  textShadow:`0 0 10px ${ax.color}66` }}>
                  {ax.val.toFixed(3)}
                  <span style={{ fontSize:10, color:"var(--text-dim)", marginLeft:4 }}>m/s²</span>
                </div>
                <div className="axis-bar">
                  <div className="axis-fill" style={{
                    width: `${clamp((ax.val/5)*100, 0, 100)}%`,
                    background: ax.color
                  }}/>
                </div>
              </div>
            ))}
          </div>

          <div className="chart-area">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={series} margin={{ top:4, right:4, bottom:0, left:-20 }}>
                <XAxis dataKey="name" tick={false} axisLine={{ stroke:"var(--border)" }} tickLine={false}/>
                <YAxis domain={[-0.5,6]} tick={{ fill:"var(--text-dim)", fontSize:9, fontFamily:"var(--font-mono)" }}
                  axisLine={{ stroke:"var(--border)" }} tickLine={false}/>
                <Tooltip content={<ChartTooltip/>}/>
                <ReferenceLine y={VIB_WARN}  stroke="var(--warning)" strokeDasharray="4 4" strokeOpacity={0.5}/>
                <ReferenceLine y={VIB_FAULT} stroke="var(--fault)"   strokeDasharray="4 4" strokeOpacity={0.5}/>
                <Line type="monotone" dataKey="vX" stroke="#00cfff" strokeWidth={1.5} dot={false} name="X" isAnimationActive={false}/>
                <Line type="monotone" dataKey="vY" stroke="#00e676" strokeWidth={1.5} dot={false} name="Y" isAnimationActive={false}/>
                <Line type="monotone" dataKey="vZ" stroke="#ffab00" strokeWidth={1.5} dot={false} name="Z" isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Panel 2: Event Log */}
        <div className="panel panel-tall" style={{ gridRow:"span 2" }}>
          <div className="panel-header">
            <div className="panel-title">EVENT LOG — STATUS CHANGE</div>
            <div className="panel-tag">{logs.length} RECORDS</div>
          </div>
          <div className="log-panel">
            <div className="log-table-header">
              <span>TIME</span>
              <span>STATUS</span>
              <span>DETAIL</span>
            </div>
            <div className="log-scroll">
              {logs.length === 0 && (
                <div style={{ padding:"20px", fontFamily:"var(--font-mono)", fontSize:10,
                  color:"var(--text-dim)", textAlign:"center" }}>
                  {connected ? "MENUNGGU EVENT..." : "TIDAK TERHUBUNG KE BACKEND"}
                </div>
              )}
              {logs.map((log, i) => (
                <div key={i} className="log-row">
                  <span className="log-time">{log.time}</span>
                  <span className={`log-status ${log.status}`}>
                    {log.status === "normal" ? "✓" : log.status === "warning" ? "⚠" : "✕"}
                    {" "}{log.status.toUpperCase()}
                  </span>
                  <span className="log-detail">{log.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 3: Suhu Chart */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">SUHU MOTOR — THERMOCOUPLE</div>
            <div className="panel-tag">MAX6675 · SPI</div>
          </div>
          <div className="temp-gauge-wrap">
            <div style={{ display:"flex", alignItems:"flex-start" }}>
              <div className="temp-big" style={{ color: tempColor(latest.temperature),
                textShadow:`0 0 30px ${tempColor(latest.temperature)}88` }}>
                {(latest.temperature ?? 0).toFixed(0)}
              </div>
              <div className="temp-unit-big">°C</div>
            </div>
            <div className="temp-scale">
              <div className="temp-bar-track">
                <div className="temp-bar-fill" style={{
                  width: `${clamp(((latest.temperature - TEMP_MIN)/(TEMP_MAX-TEMP_MIN))*100, 0, 100)}%`,
                  background: `linear-gradient(90deg, var(--normal), ${tempColor(latest.temperature)})`
                }}/>
              </div>
              <div className="temp-scale-labels">
                <span>{TEMP_MIN}°</span>
                <span>{TEMP_WARN}°⚠</span>
                <span>{TEMP_FAULT}°✕</span>
                <span>{TEMP_MAX}°</span>
              </div>
              <div className="temp-thresholds">
                <span className="threshold-badge ok">OK &lt;{TEMP_WARN}°</span>
                <span className="threshold-badge hot">WARN &lt;{TEMP_FAULT}°</span>
                <span className="threshold-badge critical">FAULT ≥{TEMP_FAULT}°</span>
              </div>
            </div>
          </div>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height={90}>
              <AreaChart data={tempSeries} margin={{ top:4, right:4, bottom:0, left:-20 }}>
                <defs>
                  <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--warning)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--warning)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={false} axisLine={{ stroke:"var(--border)" }} tickLine={false}/>
                <YAxis domain={[20,120]} tick={{ fill:"var(--text-dim)", fontSize:8, fontFamily:"var(--font-mono)" }}
                  axisLine={{ stroke:"var(--border)" }} tickLine={false}/>
                <Tooltip content={<ChartTooltip/>}/>
                <ReferenceLine y={TEMP_WARN}  stroke="var(--warning)" strokeDasharray="4 4" strokeOpacity={0.5}/>
                <ReferenceLine y={TEMP_FAULT} stroke="var(--fault)"   strokeDasharray="4 4" strokeOpacity={0.5}/>
                <Area type="monotone" dataKey="temp" stroke="var(--warning)" fill="url(#tg)"
                  strokeWidth={1.5} dot={false} name="SUHU" isAnimationActive={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Panel 4: Koneksi & Task Status */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">SYSTEM STATUS & FREERTOS TASKS</div>
            <div className="panel-tag">MODBUS TCP MONITOR</div>
          </div>

          {/* Koneksi info */}
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between",
              fontFamily:"var(--font-mono)", fontSize:9, color:"var(--text-dim)" }}>
              <span>BACKEND CONNECTION</span>
              <span style={{ color: connected ? "var(--normal)" : "var(--fault)" }}>
                {connected ? "CONNECTED" : "DISCONNECTED"}
              </span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between",
              fontFamily:"var(--font-mono)", fontSize:9, color:"var(--text-dim)" }}>
              <span>ESP32 ETHERNET</span>
              <span style={{ color: ethConn ? "var(--normal)" : "var(--fault)" }}>
                {ethConn ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>

          {/* Sys info */}
          <div className="sys-info-grid">
            <div className="sys-card">
              <div className="sys-card-label">UPTIME SESI</div>
              <div className="sys-card-value" style={{ fontSize:16 }}>{uptimeStr}</div>
              <div className="sys-card-sub">HH:MM:SS</div>
            </div>
            <div className="sys-card">
              <div className="sys-card-label">SAMPLE RATE</div>
              <div className="sys-card-value" style={{ fontSize:16 }}>2 Hz</div>
              <div className="sys-card-sub">500ms POLL</div>
            </div>
            <div className="sys-card">
              <div className="sys-card-label">VIB RMS</div>
              <div className="sys-card-value" style={{ fontSize:16 }}>{rms.toFixed(2)}</div>
              <div className="sys-card-sub">m/s²</div>
            </div>
            <div className="sys-card">
              <div className="sys-card-label">SUHU</div>
              <div className="sys-card-value" style={{ fontSize:16 }}>
                {(latest.temperature ?? 0).toFixed(1)}
              </div>
              <div className="sys-card-sub">°C</div>
            </div>
          </div>

          {/* Task list (status statis sesuai firmware) */}
          <div className="task-list">
            {TASKS.map(task => (
              <div key={task.id} className="task-row">
                <span className="task-name">{task.name}</span>
                <div className="task-indicator">
                  <span className="task-prio">PRIO:{task.prio}</span>
                  {/* Jika eth disconnect, task ethernet dianggap bermasalah */}
                  <div className={`task-dot ${
                    task.id === "ethernet" && !ethConn ? "dead" :
                    task.id === "modbus"   && !connected ? "dead" : ""
                  }`}/>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── FOOTER ─────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-left">
          <div className="footer-item"><span className="footer-key">DEVICE</span><span className="footer-val">ESP32-S3</span></div>
          <div className="footer-item"><span className="footer-key">IMU</span><span className="footer-val">MPU6050 · I2C</span></div>
          <div className="footer-item"><span className="footer-key">TEMP</span><span className="footer-val">MAX6675 · SPI</span></div>
          <div className="footer-item"><span className="footer-key">ETH</span><span className="footer-val">W5500 · {BACKEND_URL}</span></div>
        </div>
        <div className="footer-right">
          <div className="footer-item"><span className="footer-key">MODBUS</span><span className="footer-val">TCP:502</span></div>
          <div className="footer-item"><span className="footer-key">WS</span><span className="footer-val">SocketIO:9000</span></div>
          <div className="footer-item"><span className="footer-key">VER</span><span className="footer-val">v1.1.0</span></div>
        </div>
      </footer>

    </div>
  );
}