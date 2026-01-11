// frontend/src/pages/Login.jsx
import { useState } from 'react';
import './Login.css'; // Import CSS yang tadi dibuat

export default function Login() {
    // 1. State untuk menyimpan input user
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // 2. Fungsi saat tombol login ditekan
    const handleLogin = async (e) => {
        e.preventDefault(); // Mencegah reload halaman
        
        // Disini nanti kita panggil API Flask
        console.log("Login diklik!", username, password);
        
        // Contoh validasi dummy dulu
        if(!username || !password) {
            setErrorMsg("Username dan Password wajib diisi!");
        } else {
            setErrorMsg(""); // Reset error
            alert("Siap mengirim data ke Flask!");
        }
    };

    return (
        <div className="login-page-wrapper">
            <div className="login-card">
                <h2>System Login</h2>
                
                {/* Tampilkan error jika ada */}
                {errorMsg && <div className="alert">{errorMsg}</div>}

                <form onSubmit={handleLogin}>
                    <input 
                        type="text" 
                        placeholder="Username" 
                        required 
                        autoComplete="off"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    
                    <input 
                        type="password" 
                        placeholder="Password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    
                    <button type="submit">ACCESS DASHBOARD</button>
                </form>
            </div>
        </div>
    );
}