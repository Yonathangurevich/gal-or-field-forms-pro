// backend/server.js - שרת מעודכן עם תמיכה ב-Role

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
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

// Login - עדכון לתמיכה ב-Role מ-Google Sheets
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', username);

    // קרא את הנתונים מ-Sheet1 עם העמודה החדשה של Role
    const agents = await getSheetData('Sheet1!A:J');
    
    if (!agents || agents.length <= 1) {
      console.log('No agents found in sheet');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // הכותרות בשורה הראשונה
    const headers = agents[0];
    console.log('Headers:', headers);
    
    // מצא את האינדקסים של העמודות
    // המבנה החדש: ID | Role | AgentCode | Name | Password | Phone | Email | Status | CreatedAt | CreatedBy
    const columnIndices = {
      id: 0,        // A - ID
      role: 1,      // B - Role (עמודה חדשה!)
      agentCode: 2, // C - AgentCode
      name: 3,      // D - Name
      password: 4,  // E - Password
      phone: 5,     // F - Phone
      email: 6,     // G - Email
      status: 7,    // H - Status
      createdAt: 8, // I - CreatedAt
      createdBy: 9  // J - CreatedBy
    };

    // חפש את הסוכן לפי AgentCode
    const agent = agents.slice(1).find(row => {
      const agentCode = row[columnIndices.agentCode];
      const status = row[columnIndices.status];
      return agentCode === username && status === 'active';
    });
    
    if (!agent) {
      console.log('Agent not found or inactive');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // בדוק סיסמה
    const storedPassword = agent[columnIndices.password];
    if (password !== storedPassword) {
      console.log('Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // קבל את ה-Role (ברירת מחדל: agent)
    const userRole = agent[columnIndices.role] || 'agent';
    console.log('User role:', userRole);

    // צור JWT token
    const token = jwt.sign(
      { 
        id: agent[columnIndices.id],
        username: agent[columnIndices.name],
        role: userRole, // כולל את ה-Role!
        agentCode: agent[columnIndices.agentCode]
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // החזר תגובה עם כל הפרטים
    return res.json({
      success: true,
      token,
      user: { 
        id: agent[columnIndices.id],
        ID: agent[columnIndices.id], // לתאימות
        username: agent[columnIndices.name],
        name: agent[columnIndices.name],
        Name: agent[columnIndices.name], // לתאימות
        role: userRole, // חשוב!
        Role: userRole, // לתאימות
        agentCode: agent[columnIndices.agentCode],
        AgentCode: agent[columnIndices.agentCode], // לתאימות
        phone: agent[columnIndices.phone],
        email: agent[columnIndices.email]
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }

  // ב-login endpoint, אחרי שקורא את הנתונים:
  console.log('All agents:', agents);
  console.log('Looking for username:', username);
  agents.slice(1).forEach((row, index) => {
  console.log(`Row ${index + 2}:`, {
     agentCode: row[columnIndices.agentCode],
     password: row[columnIndices.password],
     role: row[columnIndices.role]
  });
});


// Verify token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Get agents - עדכון לקריאה עם Role
app.get('/api/agents', authenticateToken, async (req, res) => {
  try {
    const agents = await getSheetData('Sheet1!A:J');
    
    if (!agents || agents.length <= 1) {
      return res.json([]);
    }

    // המרה ל-JSON עם העמודה החדשה של Role
    const agentsData = agents.slice(1).map(row => ({
      ID: row[0] || '',
      Role: row[1] || 'agent', // עמודה חדשה!
      AgentCode: row[2] || '',
      Name: row[3] || '',
      Password: row[4] || '',
      Phone: row[5] || '',
      Email: row[6] || '',
      Status: row[7] || 'active',
      CreatedAt: row[8] || '',
      CreatedBy: row[9] || ''
    }));

    res.json(agentsData);
  } catch (error) {
    console.error('Get agents error:', error);
    res.json([]);
  }
});

// Create agent - עדכון ליצירה עם Role
app.post('/api/agents', authenticateToken, async (req, res) => {
  try {
    if (!sheets) {
      return res.status(503).json({ error: 'Google Sheets not connected' });
    }

    const agentData = req.body;
    console.log('Creating agent:', agentData);
    
    // השתמש ב-AgentCode כ-ID או צור חדש
    const agentId = agentData.AgentCode || ('AGT-' + Date.now());
    
    // יצירת שורה עם Role (ברירת מחדל: agent)
    const rowData = [
      agentId,                         // A - ID
      agentData.Role || 'agent',      // B - Role (עמודה חדשה!)
      agentData.AgentCode || agentId, // C - AgentCode
      agentData.Name || '',            // D - Name
      agentData.Password || '1234',   // E - Password
      agentData.Phone || '',          // F - Phone
      agentData.Email || '',          // G - Email
      agentData.Status || 'active',   // H - Status
      new Date().toISOString(),       // I - CreatedAt
      req.user.username                // J - CreatedBy
    ];

    await appendSheetData('Sheet1!A:J', [rowData]);

    res.json({
      success: true,
      message: 'Agent created successfully',
      agentId,
      credentials: {
        username: agentData.AgentCode,
        password: agentData.Password || '1234'
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

// Delete agent - עדכון לעמודת Status החדשה
app.delete('/api/agents/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const agents = await getSheetData('Sheet1!A:J');
    const agentIndex = agents.slice(1).findIndex(row => row[0] === id);
    
    if (agentIndex === -1) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // סמן כ-DELETED בעמודת Status (עכשיו בעמודה H - אינדקס 7)
    const range = `Sheet1!H${agentIndex + 2}`;
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
║  Admin: use AgentCode from Sheet       ║
║  Agent: [AgentCode] / [Password]       ║
╠════════════════════════════════════════╣
║  Sheet Structure (Sheet1):             ║
║  A:ID | B:Role | C:AgentCode | D:Name  ║
║  E:Password | F:Phone | G:Email        ║
║  H:Status | I:CreatedAt | J:CreatedBy  ║
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
