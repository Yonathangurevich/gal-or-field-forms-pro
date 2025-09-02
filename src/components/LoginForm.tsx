// src/components/LoginForm.tsx

import React, { useState } from 'react';
import api from '../services/api';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.auth.login(username, password);
      console.log('Login successful:', result);
      
      // Redirect to dashboard or home
      window.location.href = '/dashboard';
    } catch (err) {
      setError('Login failed. Please check your credentials.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ 
      maxWidth: '400px', 
      margin: '50px auto', 
      padding: '20px',
      boxShadow: '0 0 10px rgba(0,0,0,0.1)',
      borderRadius: '8px'
    }}>
      <h2>התחברות למערכת</h2>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>
            שם משתמש:
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '8px', 
                marginTop: '5px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            סיסמה:
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '8px', 
                marginTop: '5px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </label>
        </div>

        {error && (
          <div style={{ 
            color: 'red', 
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: '#fee',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'מתחבר...' : 'התחבר'}
        </button>
      </form>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p>לבדיקה:</p>
        <p>Username: admin</p>
        <p>Password: admin123</p>
      </div>
    </div>
  );
}