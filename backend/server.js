// backend/server.js - שרת מעודכן עם סיסמאות פשוטות

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-secret-jwt-key-' + Date.now();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json());

// Google Sheets configuration
const SPREADSHEET_ID = '1yz-bzIRRvT5_UWQ_XNo1V8kYXtumjFiTYxSJWX0OB9c';

let sheets;

// Initialize Google Sheets
async function initializeGoogleSheets() {
  try {
    console.log('📋 Initializing Google Sheets...');
    
    const serviceAccountPath = path.join(__dirname, 'service-account-key.json');
    const fs = require('fs');
    
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('❌ service-account-key.json not found!');
      return false;
    }
    
    const serviceAccount = require(serviceAccountPath);
    console.log('✅ Service account loaded:', serviceAccount.client_email);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    sheets = google.sheets({ version: 'v4', auth });
    
    // Test connection
    try {
      const metadata = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });
      console.log('✅ Connected to spreadsheet:', metadata.data.properties.title);
      console.log('📊 Available sheets:', metadata.data.sheets.map(s => s.properties.title).join(', '));
      
      return true;
    } catch (error) {
      console.error('❌ Cannot access spreadsheet. Error:', error.message);
      console.log('Please share the spreadsheet with:', serviceAccount.client_email);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to initialize Google Sheets:', error);
    return false;
  }
}

// Helper functions
async function getSheetData(range) {
  if (!sheets) {
    console.error('Sheets not initialized');
    return [];
  }
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });
    return response.data.values || [];
  } catch (error) {
    console.error('Error reading sheet:', error.message);
    return [];
  }
}

async function appendSheetData(range, values) {
  if (!sheets) {
    throw new Error('Sheets not initialized');
  }
  
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
    return response.data;
  } catch (error) {
    console.error('Error appending to sheet:', error.message);
    throw error;
  }
}

async function updateSheetData(range, values) {
  if (!sheets) {
    throw new Error('Sheets not initialized');
  }
  
  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
    return response.data;
  } catch (error) {
    console.error('Error updating sheet:', error.message);
    throw error;
  }
}

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ========== ROUTES ==========

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: sheets ? 'healthy' : 'no-sheets',
    timestamp: new Date().toISOString(),
    spreadsheetId: SPREADSHEET_ID
  });
});

// Login - Updated to support simple passwords
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Admin login
    if (username === 'admin' && password === 'Admin123') {
      const token = jwt.sign(
        { id: 'admin-1', username: 'admin', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        token,
        user: { id: 'admin-1', username: 'admin', role: 'admin' }
      });
    }

    // Agent login - check from Sheet1
    const agents = await getSheetData('Sheet1!A:I');
    
    if (agents.length > 1) {
      // Find agent by AgentCode (column 1)
      const agent = agents.slice(1).find(row => 
        row[1] === username  // AgentCode
      );
      
      if (agent) {
        // Check password - it's stored in column 4 (index 3)
        // In real app, you should hash passwords
        const storedPassword = agent[3] || agent[2]; // Try column 4 first, then column 3
        
        if (password === storedPassword || password === agent[1]) { // Allow login with code as password too
          const token = jwt.sign(
            { 
              id: agent[0], 
              username: agent[2], // Name
              role: 'agent', 
              agentCode: agent[1] 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          return res.json({
            success: true,
            token,
            user: { 
              id: agent[0], 
              username: agent[2], 
              role: 'agent', 
              agentCode: agent[1] 
            }
          });
        }
      }
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Get agents
app.get('/api/agents', authenticateToken, async (req, res) => {
  try {
    const agents = await getSheetData('Sheet1!A:I');
    
    if (!agents || agents.length <= 1) {
      return res.json([]);
    }

    // Convert to JSON with Password field
    const agentsData = agents.slice(1).map(row => ({
      ID: row[0] || '',
      AgentCode: row[1] || '',
      Name: row[2] || '',
      Password: row[3] || '',  // Include password for display
      Phone: row[4] || '',
      Email: row[5] || '',
      Status: row[6] || 'active',
      CreatedAt: row[7] || '',
      CreatedBy: row[8] || ''
    }));

    res.json(agentsData);
  } catch (error) {
    console.error('Get agents error:', error);
    res.json([]);
  }
});

// Create agent - Store simple password
app.post('/api/agents', authenticateToken, async (req, res) => {
  try {
    if (!sheets) {
      return res.status(503).json({ error: 'Google Sheets not connected' });
    }

    const agentData = req.body;
    console.log('Creating agent:', agentData);
    
    // Generate ID
    const agentId = 'AGT-' + Date.now();
    
    // Create row with password in column 4
    const rowData = [
      agentId,                    // ID
      agentData.AgentCode || '',  // AgentCode
      agentData.Name || '',       // Name
      agentData.Password || '',   // Password (simple)
      agentData.Phone || '',      // Phone
      agentData.Email || '',      // Email
      agentData.Status || 'active', // Status
      new Date().toISOString(),   // CreatedAt
      req.user.username           // CreatedBy
    ];

    await appendSheetData('Sheet1!A:I', [rowData]);

    res.json({
      success: true,
      message: 'Agent created successfully',
      agentId,
      credentials: {
        username: agentData.AgentCode,
        password: agentData.Password
      }
    });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ 
      error: 'Failed to create agent', 
      details: error.message 
    });
  }
});

// Delete agent
app.delete('/api/agents/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const agents = await getSheetData('Sheet1!A:I');
    const agentIndex = agents.slice(1).findIndex(row => row[0] === id);
    
    if (agentIndex === -1) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Mark as deleted in Status column (index 6)
    const range = `Sheet1!G${agentIndex + 2}`;
    await updateSheetData(range, [['DELETED']]);

    res.json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get forms
app.get('/api/forms', authenticateToken, async (req, res) => {
  try {
    let forms = await getSheetData('Sheet2!A:J');
    
    if (!forms || forms.length <= 1) {
      return res.json([]);
    }

    // Convert to JSON
    const formsData = forms.slice(1).map(row => ({
      ID: row[0] || '',
      AgentID: row[1] || '',
      FormType: row[2] || '',
      ClientName: row[3] || '',
      ClientPhone: row[4] || '',
      ClientID: row[5] || '',
      Status: row[6] || '',
      FormURL: row[7] || '',
      CreatedAt: row[8] || '',
      CreatedBy: row[9] || ''
    }));

    res.json(formsData);
  } catch (error) {
    console.error('Get forms error:', error);
    res.json([]);
  }
});

// Create form
app.post('/api/forms', authenticateToken, async (req, res) => {
  try {
    if (!sheets) {
      return res.status(503).json({ error: 'Google Sheets not connected' });
    }

    const formData = req.body;
    const formId = 'FRM-' + Date.now();
    
    const rowData = [
      formId,
      formData.AgentID || '',
      formData.FormType || 'Google Form',
      formData.ClientName || '',
      formData.ClientPhone || '',
      formData.ClientID || '',
      formData.Status || 'חדש',
      formData.FormURL || '',
      new Date().toISOString(),
      req.user.username
    ];

    await appendSheetData('Sheet2!A:J', [rowData]);

    res.json({
      success: true,
      message: 'Form created successfully',
      formId
    });
  } catch (error) {
    console.error('Create form error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update form status
app.put('/api/forms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const forms = await getSheetData('Sheet2!A:J');
    const formIndex = forms.slice(1).findIndex(row => row[0] === id);
    
    if (formIndex === -1) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Update status
    if (updateData.Status) {
      const range = `Sheet2!G${formIndex + 2}`;
      await updateSheetData(range, [[updateData.Status]]);
    }

    res.json({
      success: true,
      message: 'Form updated successfully'
    });
  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== START SERVER ==========

async function startServer() {
  const initialized = await initializeGoogleSheets();
  
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║    Field Forms Pro Backend Server     ║
╠════════════════════════════════════════╣
║  🚀 Server: http://localhost:${PORT}     ║
║  📊 Google Sheets: ${initialized ? 'Connected ✅' : 'Failed ❌'}      ║
╠════════════════════════════════════════╣
║  Login Credentials:                    ║
║  Admin: admin / Admin123               ║
║  Agent: [AgentCode] / [Password]       ║
╚════════════════════════════════════════╝
    `);
    
    if (!initialized) {
      console.log('\n⚠️  WARNING: Google Sheets not connected!');
      console.log('Please check:');
      console.log('1. service-account-key.json exists');
      console.log('2. Spreadsheet is shared with service account');
      console.log('3. Sheet names are correct\n');
    }
  });
}

startServer();
