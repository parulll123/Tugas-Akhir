import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import History from './pages/History';
import Settings from './pages/Settings';
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Halaman Login (Tanpa Sidebar) */}
        <Route path="/" element={<Login />} />

        {/* Halaman dengan Sidebar (Layout) */}
        <Route element={<Layout />}>
           <Route path="/dashboard" element={<Dashboard />} />
           <Route path="/history" element={<History />} />
           <Route path="/settings" element={<Settings />} />
        </Route>
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;