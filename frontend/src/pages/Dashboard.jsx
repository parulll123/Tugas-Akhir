import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import "./Dashboard.css";

// ── Konstanta ──────────────────────────────────────────────
const MAX_POINTS = 60;
const TEMP_WARN  = 70;
const TEMP_FAULT = 90;
const BACKEND_URL = "http://localhost:9000";

// ── Helpers ────────────────────────────────────────────────
const fmtTime = (d) =>
  d.toLocaleTimeString("id-ID", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtDate = (d) =>
  d.toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

// Status dari server: "NORMAL" | "WARNING" | "DANGER"  → kelas css
function statusKey(s, anomaly) {
  if (s) return s.toLowerCase();          // utamakan status dari backend
  return anomaly ? "danger" : "normal";   // fallback
}
const STATUS_META = {
  normal:  { icon: "fa-circle-check",        text: "NORMAL",  cls: "normal"  },
  warning: { icon: "fa-triangle-exclamation",text: "WARNING", cls: "warning" },
  danger:  { icon: "fa-circle-xmark",        text: "DANGER",  cls: "danger"  },
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-panel)", border: "1px solid var(--border-bright)",
      borderRadius: 8, padding: "8px 12px", boxShadow: "var(--shadow-md)",
      fontFamily: "var(--font-mono)", fontSize: 11,
    }}>
      <div style={{ color: "var(--text-dim)", marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>
      ))}
    </div>
  );
};

// ── Komponen Utama ─────────────────────────────────────────
export default function Dashboard() {
  const [time,       setTime]      = useState(new Date());
  const [rmsSeries,  setRmsSeries] = useState([]);
  const [tempSeries, setTempSeries]= useState([]);
  const [latest,     setLatest]    = useState({
    motor: "Motor #01", temperature: 0, vib_rms: 0, cluster: 0, dist: 0, anomaly: false,
  });
  const [status,    setStatus]    = useState("normal");
  const [counts,    setCounts]    = useState({ normal: 0, anomaly: 0 });
  const [logs,      setLogs]      = useState([]);
  const [connected, setConnected] = useState(false);
  const [ethConn,   setEthConn]   = useState(false);

  const prevStatusRef = useRef("normal");

  // Jam
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // SocketIO
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ["websocket"] });
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("sensor_update", (data) => {
      const ts = fmtTime(new Date());
      const sk = statusKey(data.status, data.anomaly);

      setLatest(data);
      setEthConn(!!data.eth_connected);
      setStatus(sk);

      setCounts((c) => ({
        normal:  c.normal  + (data.anomaly ? 0 : 1),
        anomaly: c.anomaly + (data.anomaly ? 1 : 0),
      }));

      setRmsSeries((prev) => {
        const next = [...prev, { name: ts, rms: Number((data.vib_rms ?? 0).toFixed(3)) }];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
      setTempSeries((prev) => {
        const next = [...prev, { name: ts, temp: Number((data.temperature ?? 0).toFixed(1)) }];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });

      if (sk !== prevStatusRef.current) {
        setLogs((prev) => [{
          time: ts, status: sk,
          detail: `vRMS=${(data.vib_rms ?? 0).toFixed(2)}mm/s · T=${(data.temperature ?? 0).toFixed(1)}°C · C${data.cluster}`,
        }, ...prev].slice(0, 80));
        prevStatusRef.current = sk;
      }
    });

    return () => socket.disconnect();
  }, []);

  const meta  = STATUS_META[status] ?? STATUS_META.normal;
  const total = counts.normal + counts.anomaly;
  const anomalyPct = total ? Math.round((counts.anomaly / total) * 100) : 0;
  const donutData = total
    ? [{ name: "Normal", value: counts.normal }, { name: "Anomali", value: counts.anomaly }]
    : [{ name: "—", value: 1 }];
  const donutColors = total ? ["var(--normal)", "var(--fault)"] : ["var(--border-bright)"];

  return (
    <div className="dashboard">

      {/* ── TOP BAR ─────────────────────────────────────── */}
      <div className="dash-topbar">
        <div className="dash-title">
          <h2>Dashboard</h2>
          <p>{latest.motor} · ESP32 Edge-AI · Modbus TCP</p>
        </div>
        <div className="dash-meta">
          <div className="dash-clock">
            <div className="clock">{fmtTime(time)}</div>
            <div className="date">{fmtDate(time)}</div>
          </div>
          <div className={`conn-pill ${connected ? "online" : "offline"}`}>
            <span className="dot" />{connected ? "BACKEND ONLINE" : "BACKEND OFFLINE"}
          </div>
        </div>
      </div>

      {/* ── KPI GRID ────────────────────────────────────── */}
      <div className="kpi-grid">
        {/* Kondisi motor */}
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Kondisi Motor</div>
            <div className={`kpi-value ${meta.cls}`}>{meta.text}</div>
            <div className="kpi-sub">Status via Modbus TCP</div>
          </div>
          <div className={`kpi-icon is-status ${meta.cls}`}>
            <i className={`fa-solid ${meta.icon}`} />
          </div>
        </div>

        {/* Suhu */}
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Suhu Motor</div>
            <div className="kpi-value">{(latest.temperature ?? 0).toFixed(1)}<span style={{ fontSize: 14, color: "var(--text-dim)", marginLeft: 4 }}>°C</span></div>
            <div className="kpi-sub">MAX6675 · Thermocouple</div>
          </div>
          <div className="kpi-icon is-temp"><i className="fa-solid fa-temperature-half" /></div>
        </div>

        {/* Getaran RMS */}
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Getaran RMS</div>
            <div className="kpi-value">{(latest.vib_rms ?? 0).toFixed(2)}<span style={{ fontSize: 14, color: "var(--text-dim)", marginLeft: 4 }}>mm/s</span></div>
            <div className="kpi-sub">MPU6050 · Velocity RMS</div>
          </div>
          <div className="kpi-icon is-vib"><i className="fa-solid fa-wave-square" /></div>
        </div>

        {/* Klaster K-Means */}
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Klaster K-Means</div>
            <div className="kpi-value">C{latest.cluster ?? 0}</div>
            <div className="kpi-sub">{latest.anomaly ? "Anomali terdeteksi" : "Pola normal"} · d={(latest.dist ?? 0).toFixed(2)}</div>
          </div>
          <div className="kpi-icon is-cluster"><i className="fa-solid fa-diagram-project" /></div>
        </div>

        {/* Koneksi */}
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Ethernet ESP32</div>
            <div className={`kpi-value ${ethConn ? "normal" : "danger"}`}>{ethConn ? "ONLINE" : "OFFLINE"}</div>
            <div className="kpi-sub">W5500 · {connected ? "backend tersambung" : "backend terputus"}</div>
          </div>
          <div className="kpi-icon is-conn"><i className="fa-solid fa-network-wired" /></div>
        </div>
      </div>

      {/* ── BARIS 1: Getaran RMS + Donut ────────────────── */}
      <div className="chart-row">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Tren Getaran RMS</div>
            <div className="panel-tag">Realtime · mm/s</div>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={rmsSeries} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={false} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-dim)", fontSize: 9 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} width={42} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="rms" name="RMS" stroke="var(--accent)" strokeWidth={2}
                  fill="url(#rg)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Distribusi Sampel</div>
            <div className="panel-tag">Sesi ini</div>
          </div>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={donutData} dataKey="value" innerRadius={56} outerRadius={78}
                  startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                  {donutData.map((_, i) => <Cell key={i} fill={donutColors[i]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <div className="pct">{anomalyPct}%</div>
              <div className="pct-label">Anomali</div>
            </div>
          </div>
          <div className="donut-legend">
            <div className="item"><span className="swatch" style={{ background: "var(--normal)" }} />Normal <span className="count">{counts.normal}</span></div>
            <div className="item"><span className="swatch" style={{ background: "var(--fault)" }} />Anomali <span className="count">{counts.anomaly}</span></div>
          </div>
        </div>
      </div>

      {/* ── BARIS 2: Suhu + Event Log ───────────────────── */}
      <div className="chart-row">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Tren Suhu Motor</div>
            <div className="panel-tag">Realtime · °C</div>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={tempSeries} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--warning)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--warning)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={false} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis domain={[0, 120]} tick={{ fill: "var(--text-dim)", fontSize: 9 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} width={42} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={TEMP_WARN}  stroke="var(--warning)" strokeDasharray="4 4" strokeOpacity={0.6} />
                <ReferenceLine y={TEMP_FAULT} stroke="var(--fault)"   strokeDasharray="4 4" strokeOpacity={0.6} />
                <Area type="monotone" dataKey="temp" name="Suhu" stroke="var(--warning)" strokeWidth={2}
                  fill="url(#tg)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Event Log</div>
            <div className="panel-tag">{logs.length} record</div>
          </div>
          <div className="events">
            <div className="event-head">
              <span>Waktu</span><span>Status</span><span>Detail</span>
            </div>
            <div className="event-scroll">
              {logs.length === 0 && (
                <div className="event-empty">
                  {connected ? "Menunggu perubahan status…" : "Tidak terhubung ke backend"}
                </div>
              )}
              {logs.map((log, i) => {
                const m = STATUS_META[log.status] ?? STATUS_META.normal;
                return (
                  <div key={i} className="event-row">
                    <span className="event-time">{log.time}</span>
                    <span className={`event-badge ${m.cls}`}>
                      <i className={`fa-solid ${m.icon}`} style={{ fontSize: 9 }} />{m.text}
                    </span>
                    <span className="event-detail">{log.detail}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <div className="dash-footer">
        <div className="item"><span className="k">Device</span><span className="v">ESP32</span></div>
        <div className="item"><span className="k">IMU</span><span className="v">MPU6050</span></div>
        <div className="item"><span className="k">Temp</span><span className="v">MAX6675</span></div>
        <div className="item"><span className="k">Eth</span><span className="v">W5500</span></div>
        <div className="item"><span className="k">Modbus</span><span className="v">TCP:502</span></div>
      </div>
    </div>
  );
}
