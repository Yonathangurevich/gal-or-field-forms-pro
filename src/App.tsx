// src/App.tsx - Updated with Role-based Views

import React, { useState, useEffect } from 'react';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper to request notification permission
async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

// Helper to show notification
function showNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
  }
}

// Register service worker
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}

// Simple API Service
const api = {
  token: localStorage.getItem('authToken'),
  
  async call(endpoint: string, options: RequestInit = {}) {
    const headers: any = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        window.location.reload();
      }
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }
    
    return response.json();
  },
  
  async login(username: string, password: string) {
    const data = await this.call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    if (data.token) {
      this.token = data.token;
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  },
  
  logout() {
    this.token = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.reload();
  }
};

// Login Component (שאר אותו דבר)
function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.login(username, password);
      if (result.success) {
        onLogin(result.user);
      } else {
        setError('שם משתמש או סיסמה שגויים');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f6fa',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            background: '#e3e8ff',
            borderRadius: '50%',
            margin: '0 auto 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            📋
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'normal' }}>
            Field Forms Pro
          </h1>
          <p style={{ color: '#666', marginTop: '8px' }}>מערכת ניהול טפסים</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
              placeholder="שם משתמש / קוד סוכן"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
              placeholder="סיסמה"
            />
          </div>

          {error && (
            <div style={{
              padding: '10px',
              background: '#fee',
              color: '#c00',
              borderRadius: '6px',
              marginBottom: '20px',
              textAlign: 'center',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#94a3d8' : '#5b7cfd',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'מתחבר...' : 'כניסה למערכת'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          padding: '12px',
          background: '#f8f9fa',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#666',
          textAlign: 'center'
        }}>
          <div><strong>מנהל:</strong> admin / Admin123</div>
        </div>
      </div>
    </div>
  );
}

// Component פשוט לסוכנים
function AgentView({ user, onLogout }: any) {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  useEffect(() => {
    loadAgentForms();
    setupNotifications();
    const interval = setInterval(loadAgentForms, 30000); // רענון כל 30 שניות
    return () => clearInterval(interval);
  }, []);

  const setupNotifications = async () => {
    const permission = await requestNotificationPermission();
    setNotificationsEnabled(permission);
  };
  
  const loadAgentForms = async () => {
    try {
      const response = await api.call('/forms');
      // סנן רק טפסים של הסוכן הנוכחי
      const myForms = response.filter((f: any) => 
        f.AgentID === user.agentCode || 
        f.AgentID === user.id ||
        f.AgentID === user.ID
      );
      setForms(myForms);
      
      // הודעה על טפסים חדשים
      const newForms = myForms.filter((f: any) => f.Status === 'חדש');
      if (newForms.length > 0 && notificationsEnabled) {
        showNotification('טופס חדש!', `יש לך ${newForms.length} טפסים חדשים למילוי`);
      }
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: 'Arial, sans-serif' }}>
      <header style={{
        background: 'white',
        padding: '20px 30px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'normal' }}>
            שלום {user.username || user.Name}
          </h2>
          <p style={{ margin: '5px 0 0', color: '#666', fontSize: '14px' }}>
            סוכן {notificationsEnabled ? '🔔' : '🔕'}
          </p>
        </div>
        <button onClick={onLogout} style={{
          padding: '8px 16px',
          background: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          יציאה
        </button>
      </header>
      
      <div style={{ padding: '30px' }}>
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '18px' }}>הטפסים שלך</h3>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              טוען טפסים...
            </div>
          ) : forms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
              <h3 style={{ margin: '0 0 10px' }}>אין משימות חדשות</h3>
              <p style={{ margin: 0 }}>כרגע אין טפסים למילוי. נעדכן אותך כשיגיעו טפסים חדשים.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {forms.map(form => (
                <div key={form.ID} style={{
                  padding: '20px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  background: form.Status === 'חדש' ? '#fff3e0' : '#fff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h4 style={{ margin: '0 0 10px', fontSize: '16px' }}>
                        {form.FormType || 'טופס כללי'}
                      </h4>
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                        לקוח: {form.ClientName || 'טופס כללי'}
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '14px' }}>
                        סטטוס: 
                        <span style={{
                          marginRight: '10px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          background: form.Status === 'חדש' ? '#ff9800' : 
                                     form.Status === 'בטיפול' ? '#2196f3' : '#4caf50',
                          color: 'white'
                        }}>
                          {form.Status}
                        </span>
                      </p>
                    </div>
                    {form.FormURL && (
                      <a 
                        href={form.FormURL} 
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '10px 20px',
                          background: '#4caf50',
                          color: 'white',
                          textDecoration: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                      >
                        מלא טופס
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Admin Dashboard - הקוד המקורי שלך
function AdminDashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  // כל הקוד המקורי של Dashboard נשאר כמו שהוא
  const [activeTab, setActiveTab] = useState<'agents' | 'forms' | 'status'>('agents');
  const [agents, setAgents] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const [newAgent, setNewAgent] = useState({
    Name: '',
    AgentCode: '',
    Password: '',
    Phone: '',
    Email: ''
  });

  useEffect(() => {
    loadData();
    setupNotifications();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const setupNotifications = async () => {
    const permission = await requestNotificationPermission();
    setNotificationsEnabled(permission);
    if (!permission) {
      console.log('Notifications not permitted');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [agentsData, formsData] = await Promise.all([
        api.call('/agents'),
        api.call('/forms')
      ]);
      setAgents(Array.isArray(agentsData) ? agentsData : []);
      setForms(Array.isArray(formsData) ? formsData : []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.call('/agents', {
        method: 'POST',
        body: JSON.stringify({
          ...newAgent,
          Status: 'active'
        })
      });
      
      setShowNewAgent(false);
      setNewAgent({ Name: '', AgentCode: '', Password: '', Phone: '', Email: '' });
      await loadData();
      
      showNotification('סוכן נוצר בהצלחה', `${newAgent.Name} (${newAgent.AgentCode})`);
      alert(`סוכן נוצר בהצלחה!\nקוד: ${newAgent.AgentCode}\nסיסמה: ${newAgent.Password}`);
    } catch (error: any) {
      alert('שגיאה: ' + error.message);
    }
  };

  const handleShareForm = async () => {
    const formUrl = prompt('הכנס קישור לטופס Google Forms:');
    if (!formUrl) return;

    const activeAgents = agents.filter(a => a.Status === 'active' && a.Status !== 'DELETED');
    
    if (activeAgents.length === 0) {
      alert('אין סוכנים פעילים במערכת! צור סוכנים תחילה.');
      return;
    }

    try {
      for (const agent of activeAgents) {
        await api.call('/forms', {
          method: 'POST',
          body: JSON.stringify({
            AgentID: agent.ID,
            FormType: 'Google Form',
            FormURL: formUrl,
            Status: 'חדש',
            ClientName: 'טופס כללי'
          })
        });
      }
      
      showNotification('טופס נשלח', `נשלח ל-${activeAgents.length} סוכנים`);
      alert(`הטופס נשלח ל-${activeAgents.length} סוכנים פעילים!`);
      await loadData();
    } catch (error: any) {
      alert('שגיאה בשליחת טופס: ' + error.message);
    }
  };

  const handleInstallPWA = () => {
    alert('להתקנת האפליקציה:\n1. Chrome: לחץ על 3 הנקודות > Install app\n2. Safari: לחץ על Share > Add to Home Screen');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        טוען...
      </div>
    );
  }

  // המשך הקוד המקורי של Dashboard
  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <header style={{
        background: 'white',
        padding: '20px 30px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'normal' }}>
          Field Forms Pro - ניהול
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            onClick={handleInstallPWA}
            style={{
              padding: '8px 16px',
              background: '#34a853',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            📱 התקן אפליקציה
          </button>
          <span>{notificationsEnabled ? '🔔' : '🔕'}</span>
          <span>{user?.username}</span>
          <button
            onClick={onLogout}
            style={{
              padding: '8px 16px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            יציאה
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e0e0e0',
        padding: '0 30px'
      }}>
        <button
          onClick={() => setActiveTab('agents')}
          style={{
            padding: '16px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'agents' ? '2px solid #5b7cfd' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '15px',
            color: activeTab === 'agents' ? '#5b7cfd' : '#666'
          }}
        >
          סוכנים ({agents.filter(a => a.Status === 'active').length})
        </button>
        <button
          onClick={() => setActiveTab('forms')}
          style={{
            padding: '16px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'forms' ? '2px solid #5b7cfd' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '15px',
            color: activeTab === 'forms' ? '#5b7cfd' : '#666',
            marginRight: '10px'
          }}
        >
          טפסים ({forms.length})
        </button>
        <button
          onClick={() => setActiveTab('status')}
          style={{
            padding: '16px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'status' ? '2px solid #5b7cfd' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '15px',
            color: activeTab === 'status' ? '#5b7cfd' : '#666',
            marginRight: '10px'
          }}
        >
          סטטוסים
        </button>
      </div>

      {/* Content - כל התוכן המקורי נשאר */}
      <div style={{ padding: '30px' }}>
        {activeTab === 'agents' && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0 }}>סוכנים</h2>
              <button
                onClick={() => setShowNewAgent(!showNewAgent)}
                style={{
                  padding: '10px 20px',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                + סוכן חדש
              </button>
            </div>

            {showNewAgent && (
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
              }}>
                <form onSubmit={handleCreateAgent}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <input
                      placeholder="שם מלא"
                      value={newAgent.Name}
                      onChange={(e) => setNewAgent({ ...newAgent, Name: e.target.value })}
                      required
                      style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <input
                      placeholder="קוד סוכן"
                      value={newAgent.AgentCode}
                      onChange={(e) => setNewAgent({ ...newAgent, AgentCode: e.target.value })}
                      required
                      style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <input
                      placeholder="סיסמה"
                      value={newAgent.Password}
                      onChange={(e) => setNewAgent({ ...newAgent, Password: e.target.value })}
                      required
                      style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <input
                      placeholder="טלפון"
                      value={newAgent.Phone}
                      onChange={(e) => setNewAgent({ ...newAgent, Phone: e.target.value })}
                      required
                      style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      marginTop: '15px',
                      padding: '10px 20px',
                      background: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    שמור
                  </button>
                </form>
              </div>
            )}

            <div style={{
              background: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '12px', textAlign: 'right' }}>קוד</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>שם</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>טלפון</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.filter(a => a.Status === 'active').map(agent => (
                    <tr key={agent.ID}>
                      <td style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
                        {agent.AgentCode}
                      </td>
                      <td style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
                        {agent.Name}
                      </td>
                      <td style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
                        {agent.Phone}
                      </td>
                      <td style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          background: '#e8f5e9',
                          color: '#2e7d32'
                        }}>
                          פעיל
                        </span>
                      </td>
                    </tr>
                  ))}
                  {agents.filter(a => a.Status === 'active').length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                        אין סוכנים פעילים - צור סוכן חדש
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'forms' && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0 }}>טפסים</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => window.open('https://forms.google.com/create', '_blank')}
                  style={{
                    padding: '10px 20px',
                    background: '#4285f4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  צור טופס ב-Google Forms
                </button>
                <button
                  onClick={handleShareForm}
                  style={{
                    padding: '10px 20px',
                    background: '#34a853',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  שלח טופס לסוכנים
                </button>
              </div>
            </div>

            {forms.length === 0 ? (
              <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#999'
              }}>
                אין טפסים במערכת
              </div>
            ) : (
              <div style={{
                background: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '12px', textAlign: 'right' }}>מספר</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>סוג</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>סוכן</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forms.map(form => (
                      <tr key={form.ID}>
                        <td style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
                          {form.ID}
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
                          {form.FormType}
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
                          {agents.find(a => a.ID === form.AgentID)?.Name || form.AgentID}
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
                          {form.Status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'status' && (
          <div>
            <h2 style={{ margin: '0 0 20px' }}>סטטוסים</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px'
            }}>
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
              }}>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#4caf50' }}>
                  {forms.filter(f => f.Status === 'הושלם').length}
                </div>
                <div style={{ color: '#666', marginTop: '10px' }}>הושלמו</div>
              </div>
              
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
              }}>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#2196f3' }}>
                  {forms.filter(f => f.Status === 'בטיפול').length}
                </div>
                <div style={{ color: '#666', marginTop: '10px' }}>בטיפול</div>
              </div>
              
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
              }}>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#ff9800' }}>
                  {forms.filter(f => f.Status === 'חדש').length}
                </div>
                <div style={{ color: '#666', marginTop: '10px' }}>חדשים</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Dashboard - מכריע לפי תפקיד
function Dashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  // בדוק אם זה admin לפי AgentCode או username
  const isAdmin = user.username === 'admin' || 
                  user.username === 'Admin123' || 
                  user.AgentCode === 'Admin123' ||
                  user.agentCode === 'Admin123';
  
  // אם זה לא admin - הצג ממשק סוכן
  if (!isAdmin) {
    return <AgentView user={user} onLogout={onLogout} />;
  }
  
  // אם זה admin - הצג הכל
  return <AdminDashboard user={user} onLogout={onLogout} />;
}

// Main App
function App() {
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Register service worker
    registerServiceWorker();
    
    // Check auth
    const checkAuth = async () => {
      const savedUser = localStorage.getItem('user');
      const token = localStorage.getItem('authToken');
      
      if (savedUser && token) {
        try {
          await api.call('/auth/verify');
          setUser(JSON.parse(savedUser));
        } catch (error) {
          localStorage.clear();
        }
      }
      setCheckingAuth(false);
    };
    
    checkAuth();
  }, []);

  if (checkingAuth) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>טוען...</div>;
  }

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => {
    api.logout();
    setUser(null);
  }} />;
}

export default App;
