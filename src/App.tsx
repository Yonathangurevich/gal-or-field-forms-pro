import React, { useState, useEffect } from 'react';

// API Configuration
const API_URL = 'https://gal-or-field-forms-pro.onrender.com/api';

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

// Login Component
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
      </div>
    </div>
  );
}

// Enhanced Agent View with form submission tracking
function AgentView({ user, onLogout }: any) {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  useEffect(() => {
    loadAgentForms();
    setupNotifications();
    const interval = setInterval(loadAgentForms, 30000);
    return () => clearInterval(interval);
  }, []);

  const setupNotifications = async () => {
    const permission = await requestNotificationPermission();
    setNotificationsEnabled(permission);
  };
  
  const loadAgentForms = async () => {
    try {
      // Get forms assigned to this agent
      const response = await api.call(`/forms/agent/${user.agentCode || user.id}`);
      setForms(response);
      
      // Show notification for new forms
      const newForms = response.filter((f: any) => f.Status === 'חדש');
      if (newForms.length > 0 && notificationsEnabled) {
        showNotification('טופס חדש!', `יש לך ${newForms.length} טפסים חדשים למילוי`);
      }
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormClick = async (form: any) => {
    // Track form start
    await api.call(`/forms/${form.ID}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        responseData: { started: true }
      })
    });

    // Open form in new tab
    window.open(form.FormURL, '_blank');
    
    // Reload forms after a delay
    setTimeout(loadAgentForms, 3000);
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
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
              <h3 style={{ margin: '0 0 10px' }}>הכל מעודכן!</h3>
              <p style={{ margin: 0 }}>אין טפסים חדשים למילוי כרגע.</p>
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
                      <button 
                        onClick={() => handleFormClick(form)}
                        style={{
                          padding: '10px 20px',
                          background: '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        מלא טופס
                      </button>
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

// Enhanced Admin Dashboard with form completion tracking
function AdminDashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'agents' | 'forms' | 'status'>('status');
  const [agents, setAgents] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [statusReport, setStatusReport] = useState<any[]>([]);
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
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [agentsData, formsData, statusData] = await Promise.all([
        api.call('/agents'),
        api.call('/forms'),
        api.call('/forms/status')
      ]);
      setAgents(Array.isArray(agentsData) ? agentsData : []);
      setForms(Array.isArray(formsData) ? formsData : []);
      setStatusReport(Array.isArray(statusData) ? statusData : []);
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

    const activeAgents = agents.filter(a => a.Status === 'active');
    
    if (activeAgents.length === 0) {
      alert('אין סוכנים פעילים במערכת! צור סוכנים תחילה.');
      return;
    }

    try {
      // Create form for all active agents
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

  // Group status report by form
  const formStatusGroups = statusReport.reduce((acc: any, item: any) => {
    if (!acc[item.formId]) {
      acc[item.formId] = {
        formId: item.formId,
        formType: item.formType,
        formUrl: item.formUrl,
        agents: [],
        totalAgents: 0,
        completedAgents: 0
      };
    }
    
    // Add agent only if not admin
    if (item.agentName !== 'admin' && item.agentId !== 'admin' && item.agentId !== 'Admin123') {
      acc[item.formId].agents.push({
        agentId: item.agentId,
        agentName: item.agentName,
        status: item.status,
        completionDate: item.completionDate
      });
      
      // Update counts
      acc[item.formId].totalAgents++;
      if (item.status === 'הושלם') {
        acc[item.formId].completedAgents++;
      }
    }
    
    return acc;
  }, {});

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
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'normal' }}>
          Field Forms Pro - ניהול
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
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

      <div style={{
        background: 'white',
        borderBottom: '1px solid #e0e0e0',
        padding: '0 30px'
      }}>
        <button
          onClick={() => setActiveTab('status')}
          style={{
            padding: '16px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'status' ? '2px solid #5b7cfd' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '15px',
            color: activeTab === 'status' ? '#5b7cfd' : '#666'
          }}
        >
          סטטוס טפסים
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          style={{
            padding: '16px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'agents' ? '2px solid #5b7cfd' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '15px',
            color: activeTab === 'agents' ? '#5b7cfd' : '#666',
            marginRight: '10px'
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
      </div>

      <div style={{ padding: '30px' }}>
        {activeTab === 'status' && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0 }}>סטטוס מילוי טפסים</h2>
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
                שלח טופס חדש לכולם
              </button>
            </div>

            {Object.keys(formStatusGroups).length === 0 ? (
              <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#999'
              }}>
                אין טפסים פעילים כרגע
              </div>
            ) : (
              Object.values(formStatusGroups).map((group: any) => (
                <div key={group.formId} style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                }}>
                  <h3 style={{ margin: '0 0 15px' }}>
                    {group.formType} - {group.formId}
                  </h3>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px',
                    marginBottom: '15px'
                  }}>
                    <div style={{
                      padding: '15px',
                      background: '#e8f5e9',
                      borderRadius: '8px'
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                        {group.agents.filter((a: any) => a.status === 'הושלם').length}
                      </div>
                      <div style={{ color: '#666', marginTop: '5px' }}>הושלמו</div>
                    </div>
                    
                    <div style={{
                      padding: '15px',
                      background: '#fff3e0',
                      borderRadius: '8px'
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>
                        {group.agents.filter((a: any) => a.status === 'ממתין').length}
                      </div>
                      <div style={{ color: '#666', marginTop: '5px' }}>ממתינים</div>
                    </div>
                  </div>
                  
                  <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '15px' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#666' }}>
                      פירוט לפי סוכן:
                    </h4>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {group.agents.map((agent: any) => (
                        <div key={agent.agentId} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: '#f5f5f5',
                          borderRadius: '4px'
                        }}>
                          <span>{agent.agentName}</span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            background: agent.status === 'הושלם' ? '#e8f5e9' : '#fff3e0',
                            color: agent.status === 'הושלם' ? '#2e7d32' : '#e65100'
                          }}>
                            {agent.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

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
                    <input
                      placeholder="אימייל (אופציונלי)"
                      type="email"
                      value={newAgent.Email}
                      onChange={(e) => setNewAgent({ ...newAgent, Email: e.target.value })}
                      style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', gridColumn: 'span 2' }}
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
                    <th style={{ padding: '12px', textAlign: 'right' }}>אימייל</th>
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
                        {agent.Email || '-'}
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
                      <th style={{ padding: '12px', textAlign: 'right' }}>הושלם ע"י</th>
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
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            background: form.Status === 'הושלם' ? '#e8f5e9' : 
                                       form.Status === 'בטיפול' ? '#e3f2fd' : '#fff3e0',
                            color: form.Status === 'הושלם' ? '#2e7d32' : 
                                   form.Status === 'בטיפול' ? '#1565c0' : '#e65100'
                          }}>
                            {form.Status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
                          {form.CompletedBy?.length > 0 ? 
                            form.CompletedBy.length + ' סוכנים' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Main Dashboard
function Dashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const isAdmin = user.username === 'admin' || 
                  user.username === 'Admin123' || 
                  user.AgentCode === 'Admin123' ||
                  user.agentCode === 'Admin123' ||
                  user.role === 'admin';
  
  if (!isAdmin) {
    return <AgentView user={user} onLogout={onLogout} />;
  }
  
  return <AdminDashboard user={user} onLogout={onLogout} />;
}

// Main App
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
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
