import { useState, useEffect } from 'react';
import './History.css';

export default function History() {
  const [historyData, setHistoryData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    motor: 'all'
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    normal: 0,
    warning: 0,
    danger: 0
  });

  // Fetch data dari backend
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/history');
        const data = await res.json();
        setHistoryData(data);
        setFilteredData(data);
        calculateStats(data);
      } catch (err) {
        console.error("Gagal fetch history:", err);
        // Mock data untuk development
        const mockData = generateMockData(50);
        setHistoryData(mockData);
        setFilteredData(mockData);
        calculateStats(mockData);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  // Generate mock data untuk testing
  const generateMockData = (count) => {
    const statuses = ['NORMAL', 'WARNING', 'DANGER'];
    const motors = ['Motor #01', 'Motor #02', 'Motor #03'];
    const data = [];

    for (let i = 0; i < count; i++) {
      const date = new Date();
      date.setHours(date.getHours() - i);
      
      data.push({
        id: i + 1,
        timestamp: date.toISOString(),
        motor: motors[Math.floor(Math.random() * motors.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        vibration: (Math.random() * 50 + 10).toFixed(2),
        temperature: (Math.random() * 40 + 40).toFixed(1),
        current: (Math.random() * 20 + 10).toFixed(2),
        rpm: Math.floor(Math.random() * 500 + 1200),
        confidence: Math.floor(Math.random() * 20 + 80)
      });
    }
    
    return data;
  };

  // Calculate statistics
  const calculateStats = (data) => {
    setStats({
      total: data.length,
      normal: data.filter(d => d.status === 'NORMAL').length,
      warning: data.filter(d => d.status === 'WARNING').length,
      danger: data.filter(d => d.status === 'DANGER').length
    });
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...historyData];

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(item => 
        item.motor.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.status.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item.status === filters.status.toUpperCase());
    }

    // Motor filter
    if (filters.motor !== 'all') {
      filtered = filtered.filter(item => item.motor === filters.motor);
    }

    // Date range filter
    if (filters.dateFrom) {
      filtered = filtered.filter(item => 
        new Date(item.timestamp) >= new Date(filters.dateFrom)
      );
    }
    if (filters.dateTo) {
      filtered = filtered.filter(item => 
        new Date(item.timestamp) <= new Date(filters.dateTo)
      );
    }

    setFilteredData(filtered);
    calculateStats(filtered);
    setCurrentPage(1);
  }, [filters, historyData]);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Format datetime
  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['ID', 'Timestamp', 'Motor', 'Status', 'Vibration', 'Temperature', 'Current', 'RPM', 'Confidence'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => [
        row.id,
        row.timestamp,
        row.motor,
        row.status,
        row.vibration,
        row.temperature,
        row.current,
        row.rpm,
        row.confidence
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      motor: 'all'
    });
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
          <div className="stat-icon info">
            <i className="fa-solid fa-database"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Records</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon normal">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.normal}</div>
            <div className="stat-label">Normal Status</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon warning">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.warning}</div>
            <div className="stat-label">Warning Status</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon danger">
            <i className="fa-solid fa-circle-exclamation"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.danger}</div>
            <div className="stat-label">Danger Status</div>
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="controls-section">
        <div className="controls-grid">
          <div className="control-group">
            <label className="control-label">
              <i className="fa-solid fa-magnifying-glass"></i>
              Pencarian
            </label>
            <input
              type="text"
              className="control-input"
              placeholder="Cari motor atau status..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </div>

          <div className="control-group">
            <label className="control-label">
              <i className="fa-solid fa-filter"></i>
              Status
            </label>
            <select
              className="control-select"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="all">Semua Status</option>
              <option value="normal">Normal</option>
              <option value="warning">Warning</option>
              <option value="danger">Danger</option>
            </select>
          </div>

          <div className="control-group">
            <label className="control-label">
              <i className="fa-solid fa-calendar-days"></i>
              Dari Tanggal
            </label>
            <input
              type="date"
              className="control-input"
              value={filters.dateFrom}
              onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
            />
          </div>

          <div className="control-group">
            <label className="control-label">
              <i className="fa-solid fa-calendar-days"></i>
              Sampai Tanggal
            </label>
            <input
              type="date"
              className="control-input"
              value={filters.dateTo}
              onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
            />
          </div>
        </div>

        <div className="action-buttons">
          <button className="btn btn-primary" onClick={exportToCSV}>
            <i className="fa-solid fa-download"></i>
            Export CSV
          </button>
          <button className="btn btn-secondary" onClick={resetFilters}>
            <i className="fa-solid fa-rotate-right"></i>
            Reset Filter
          </button>
          <button className="btn btn-danger">
            <i className="fa-solid fa-trash"></i>
            Hapus Data Lama
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-header">
          <h3 className="table-title">
            <i className="fa-solid fa-table"></i>
            Data History
          </h3>
          <div className="table-info">
            Menampilkan {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredData.length)} dari {filteredData.length} data
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
              <div className="empty-icon">
                <i className="fa-solid fa-inbox"></i>
              </div>
              <div className="empty-text">Tidak ada data ditemukan</div>
              <div className="empty-subtext">Coba ubah filter atau kriteria pencarian</div>
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
                  <th>Confidence</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id.toString().padStart(4, '0')}</td>
                    <td>{formatDateTime(item.timestamp)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-gear" style={{ color: '#00d2ff' }}></i>
                        {item.motor}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${item.status.toLowerCase()}`}>
                        <i className={`fa-solid ${
                          item.status === 'DANGER' ? 'fa-circle-exclamation' :
                          item.status === 'WARNING' ? 'fa-triangle-exclamation' :
                          'fa-circle-check'
                        }`}></i>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div className="sensor-values">
                        <div>Vib: <span>{item.vibration} mm/s</span></div>
                        <div>Temp: <span>{item.temperature} °C</span></div>
                        <div>Curr: <span>{item.current} A</span></div>
                        <div>RPM: <span>{item.rpm}</span></div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-brain" style={{ color: '#00d2ff' }}></i>
                        {item.confidence}%
                      </div>
                    </td>
                    <td>
                      <div className="action-icons">
                        <div className="action-icon" title="Lihat Detail">
                          <i className="fa-solid fa-eye"></i>
                        </div>
                        <div className="action-icon" title="Download">
                          <i className="fa-solid fa-download"></i>
                        </div>
                        <div className="action-icon" title="Hapus">
                          <i className="fa-solid fa-trash"></i>
                        </div>
                      </div>
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
            <div className="pagination-info">
              Halaman {currentPage} dari {totalPages}
            </div>
            <div className="pagination-controls">
              <button
                className="page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <i className="fa-solid fa-angles-left"></i>
              </button>
              <button
                className="page-btn"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              
              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                // Show only nearby pages
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      className={`page-btn ${currentPage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  page === currentPage - 2 ||
                  page === currentPage + 2
                ) {
                  return <span key={page} style={{ padding: '0 5px' }}>...</span>;
                }
                return null;
              })}
              
              <button
                className="page-btn"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
              <button
                className="page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <i className="fa-solid fa-angles-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}