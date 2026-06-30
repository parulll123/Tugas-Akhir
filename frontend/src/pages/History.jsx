import { useState, useEffect } from 'react';
import './History.css';

export default function History() {
  const [historyData,   setHistoryData]   = useState([]);
  const [filteredData,  setFilteredData]  = useState([]);
  const [loading,       setLoading]       = useState(true);

  const [filters, setFilters] = useState({
    search:   '',
    status:   'all',
    dateFrom: '',
    dateTo:   '',
    motor:    'all'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [stats, setStats] = useState({ total:0, normal:0, warning:0, danger:0 });

  // ── Fetch dari backend ────────────────────────────────
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res  = await fetch('/api/history');
        const data = await res.json();
        setHistoryData(data);
        setFilteredData(data);
        calculateStats(data);
      } catch (err) {
        console.error("Gagal fetch history:", err);
        // Tampilkan kosong jika gagal — tidak pakai mock data lagi
        setHistoryData([]);
        setFilteredData([]);
        calculateStats([]);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const calculateStats = (data) => {
    setStats({
      total:   data.length,
      normal:  data.filter(d => d.status === 'NORMAL').length,
      warning: data.filter(d => d.status === 'WARNING').length,
      danger:  data.filter(d => d.status === 'DANGER').length,
    });
  };

  // ── Filters ───────────────────────────────────────────
  useEffect(() => {
    let filtered = [...historyData];

    if (filters.search) {
      filtered = filtered.filter(item =>
        item.motor.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.status.toLowerCase().includes(filters.search.toLowerCase())
      );
    }
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item.status === filters.status.toUpperCase());
    }
    if (filters.motor !== 'all') {
      filtered = filtered.filter(item => item.motor === filters.motor);
    }
    if (filters.dateFrom) {
      filtered = filtered.filter(item => new Date(item.timestamp) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filtered = filtered.filter(item => new Date(item.timestamp) <= new Date(filters.dateTo));
    }

    setFilteredData(filtered);
    calculateStats(filtered);
    setCurrentPage(1);
  }, [filters, historyData]);

  // ── Pagination ────────────────────────────────────────
  const indexOfLastItem  = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems     = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages       = Math.ceil(filteredData.length / itemsPerPage);

  const formatDateTime = (isoString) => {
    return new Date(isoString).toLocaleString('id-ID', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  // ── Export CSV ────────────────────────────────────────
  // [FIX] Kolom CSV disesuaikan: hapus confidence/current/rpm, tambah error_code
  const exportToCSV = () => {
    const headers = ['ID','Timestamp','Motor','Status','Vib X','Vib Y','Vib Z','Vib RMS','Temperature','Error Code','Eth Connected'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => [
        row.id,
        row.timestamp,
        row.motor,
        row.status,
        row.vib_x,
        row.vib_y,
        row.vib_z,
        row.vib_rms,
        row.temperature,
        row.error_code ?? 0,
        row.eth_connected ? 1 : 0,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setFilters({ search:'', status:'all', dateFrom:'', dateTo:'', motor:'all' });
  };

  // Error code → label
  const errorLabel = (code) => {
    if (!code || code === 0) return <span style={{ color:'var(--normal,#00ff88)' }}>NONE</span>;
    const parts = [];
    if (code & 1) parts.push('TEMP');
    if (code & 2) parts.push('IMU');
    if (code & 4) parts.push('ETH');
    return <span style={{ color:'var(--fault,#ff3333)', fontSize:'0.75rem' }}>{parts.join('+')}</span>;
  };

  return (
    <div>
      {/* Header */}
      <div className="history-header">
        <h1>
          <i className="fa-solid fa-clock-rotate-left"></i>
          Riwayat Monitoring
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon info"><i className="fa-solid fa-database"></i></div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Records</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon normal"><i className="fa-solid fa-circle-check"></i></div>
          <div className="stat-content">
            <div className="stat-value">{stats.normal}</div>
            <div className="stat-label">Normal</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning"><i className="fa-solid fa-triangle-exclamation"></i></div>
          <div className="stat-content">
            <div className="stat-value">{stats.warning}</div>
            <div className="stat-label">Warning</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon danger"><i className="fa-solid fa-circle-exclamation"></i></div>
          <div className="stat-content">
            <div className="stat-value">{stats.danger}</div>
            <div className="stat-label">Danger</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="controls-section">
        <div className="controls-grid">
          <div className="control-group">
            <label className="control-label">
              <i className="fa-solid fa-magnifying-glass"></i> Pencarian
            </label>
            <input type="text" className="control-input"
              placeholder="Cari motor atau status..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </div>
          <div className="control-group">
            <label className="control-label">
              <i className="fa-solid fa-filter"></i> Status
            </label>
            <select className="control-select" value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}>
              <option value="all">Semua Status</option>
              <option value="normal">Normal</option>
              <option value="warning">Warning</option>
              <option value="danger">Danger</option>
            </select>
          </div>
          <div className="control-group">
            <label className="control-label">
              <i className="fa-solid fa-calendar-days"></i> Dari Tanggal
            </label>
            <input type="date" className="control-input" value={filters.dateFrom}
              onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
            />
          </div>
          <div className="control-group">
            <label className="control-label">
              <i className="fa-solid fa-calendar-days"></i> Sampai Tanggal
            </label>
            <input type="date" className="control-input" value={filters.dateTo}
              onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
            />
          </div>
        </div>

        <div className="action-buttons">
          <button className="btn btn-primary" onClick={exportToCSV}>
            <i className="fa-solid fa-download"></i> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={resetFilters}>
            <i className="fa-solid fa-rotate-right"></i> Reset Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-header">
          <h3 className="table-title">
            <i className="fa-solid fa-table"></i> Data History
          </h3>
          <div className="table-info">
            Menampilkan {filteredData.length === 0 ? 0 : indexOfFirstItem + 1}–
            {Math.min(indexOfLastItem, filteredData.length)} dari {filteredData.length} data
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <div>Memuat data...</div>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><i className="fa-solid fa-inbox"></i></div>
              <div className="empty-text">Tidak ada data ditemukan</div>
              <div className="empty-subtext">Coba ubah filter atau tunggu data masuk dari ESP32</div>
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Timestamp</th>
                  <th>Motor</th>
                  <th>Status</th>
                  <th>Sensor Data</th>
                  <th>Error</th>
                  <th>Ethernet</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item) => (
                  <tr key={item.id}>
                    <td>#{String(item.id).padStart(4, '0')}</td>
                    <td>{formatDateTime(item.timestamp)}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <i className="fa-solid fa-gear" style={{ color:'#00d2ff' }}></i>
                        {item.motor}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${item.status.toLowerCase()}`}>
                        <i className={`fa-solid ${
                          item.status === 'DANGER'  ? 'fa-circle-exclamation' :
                          item.status === 'WARNING' ? 'fa-triangle-exclamation' :
                          'fa-circle-check'
                        }`}></i>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {/* [FIX] Tampilkan vib_x/y/z/rms dan temperature — hapus current/rpm */}
                      <div className="sensor-values">
                        <div>vX: <span>{(item.vib_x ?? 0).toFixed(3)} m/s²</span></div>
                        <div>vY: <span>{(item.vib_y ?? 0).toFixed(3)} m/s²</span></div>
                        <div>vZ: <span>{(item.vib_z ?? 0).toFixed(3)} m/s²</span></div>
                        <div>RMS: <span>{(item.vib_rms ?? 0).toFixed(3)} m/s²</span></div>
                        <div>Temp: <span>{(item.temperature ?? 0).toFixed(1)} °C</span></div>
                      </div>
                    </td>
                    <td>{errorLabel(item.error_code)}</td>
                    <td>
                      <span style={{ color: item.eth_connected ? '#00ff88' : '#ff3333', fontSize:'0.8rem' }}>
                        <i className={`fa-solid ${item.eth_connected ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                        {' '}{item.eth_connected ? 'ON' : 'OFF'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && currentItems.length > 0 && (
          <div className="pagination">
            <div className="pagination-info">Halaman {currentPage} dari {totalPages}</div>
            <div className="pagination-controls">
              <button className="page-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                <i className="fa-solid fa-angles-left"></i>
              </button>
              <button className="page-btn" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
                <i className="fa-solid fa-chevron-left"></i>
              </button>

              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                  return (
                    <button key={page}
                      className={`page-btn ${currentPage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}>
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} style={{ padding:'0 5px' }}>...</span>;
                }
                return null;
              })}

              <button className="page-btn" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>
                <i className="fa-solid fa-chevron-right"></i>
              </button>
              <button className="page-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                <i className="fa-solid fa-angles-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}