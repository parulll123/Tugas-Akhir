import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './login.css';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMsg("");

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                navigate('/dashboard');
            } else {
                setErrorMsg(data.message || "Login gagal");
            }
        } catch (error) {
            setErrorMsg("Gagal menghubungi server backend.");
        }
    };

    return (
        <div className="login-page-wrapper">
            <div className="login-card">
                <h2>EDGE AI SYSTEM</h2>
                <p className="subtitle">Motor 3 Phase Monitoring</p>

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

                <span className="footer">© 2026 Edge AI</span>
            </div>
        </div>
    );
}
