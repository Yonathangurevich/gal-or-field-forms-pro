// backend/server.js - Enhanced with Google Forms Response Tracking

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

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', username);

    const agents = await getSheetData('Sheet1!A:J');
    
    if (!agents || agents.length <= 1) {
      console.log('No agents found in sheet');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const headers = agents[0];
    console.log('Headers:', headers);
    
    const columnIndices = {
      id: 0,        // A - ID
      role: 1,      // B - Role
      agentCode: 2, // C - AgentCode
      name: 3,      // D - Name
      password: 4,  // E - Password
      phone: 5,     // F - Phone
      email: 6,     // G - Email
      status: 7,    // H - Status
      createdAt: 8, // I - CreatedAt
      createdBy: 9  // J - CreatedBy
    };

    // Find agent by AgentCode
    const agent = agents.slice(1).find(row => {
      const agentCode = row[columnIndices.agentCode];
      const status = row[columnIndices.status];
      return agentCode && agentCode.trim() === username.trim() && status === 'active';
    });
    
    if (!agent) {
      console.log('Agent not found or inactive');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Agent found:', agent);

    // Check password
    const storedPassword = agent[columnIndices.password];
    if (password.trim() !== storedPassword.trim()) {
      console.log('Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userRole = agent[columnIndices.role] || 'agent';
    console.log('User role:', userRole);

    // Create JWT token
    const token = jwt.sign(
      { 
        id: agent[columnIndices.id],
        username: agent[columnIndices.name],
        role: userRole,
        agentCode: agent[columnIndices.agentCode],
        email: agent[columnIndices.email] || ''
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const response = {
      success: true,
      token,
      user: { 
        id: agent[columnIndices.id],
        ID: agent[columnIndices.id],
        username: agent[columnIndices.name],
        name: agent[columnIndices.name],
        Name: agent[columnIndices.name],
        role: userRole,
        Role: userRole,
        agentCode: agent[columnIndices.agentCode],
        AgentCode: agent[columnIndices.agentCode],
        phone: agent[columnIndices.phone],
        email: agent[columnIndices.email] || ''
      }
    };
    
    console.log('Login successful, returning:', response);
    return res.json(response);

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
    const agents = await getSheetData('Sheet1!A:J');
    
    if (!agents || agents.length <= 1) {
      return res.json([]);
    }

    const agentsData = agents.slice(1)
      .filter(row => row[1] !== 'admin')
      .map(row => ({
        ID: row[0] || '',
        Role: row[1] || 'agent',
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

// Create agent
app.post('/api/agents', authenticateToken, async (req, res) => {
  try {
    if (!sheets) {
      return res.status(503).json({ error: 'Google Sheets not connected' });
    }

    const agentData = req.body;
    console.log('Creating agent:', agentData);
    
    const agentId = agentData.AgentCode || ('AGT-' + Date.now());
    
    const rowData = [
      agentId,                         // A - ID
      agentData.Role || 'agent',      // B - Role
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

// Get forms with enhanced response tracking
app.get('/api/forms', authenticateToken, async (req, res) => {
  try {
    let forms = await getSheetData('Sheet2!A:J');
    let responses = await getSheetData('Sheet3!A:H');
    
    if (!forms || forms.length <= 1) {
      return res.json([]);
    }

    // Convert forms to JSON with response tracking
    const formsData = forms.slice(1)
      .filter(row => row[6] !== 'נמחק') // Filter out deleted forms
      .map(row => {
        const formId = row[0];
        
        // Find if this form has been completed by checking Sheet3
        let formStatus = row[6] || 'חדש';
        let completedBy = [];
        
        if (responses && responses.length > 1) {
          const formResponses = responses.slice(1).filter(resp => resp[1] === formId);
          completedBy = formResponses.filter(resp => resp[3] === 'הושלם').map(resp => ({
            agentId: resp[2],
            completedAt: resp[5],
            responseData: resp[7] || ''
          }));
          
          // Update status if completed
          if (completedBy.length > 0) {
            formStatus = 'הושלם';
          }
        }
        
        return {
          ID: formId,
          AgentID: row[1] || '',
          FormType: row[2] || '',
          ClientName: row[3] || '',
          ClientPhone: row[4] || '',
          ClientID: row[5] || '',
          Status: formStatus,
          FormURL: row[7] || '',
          CreatedAt: row[8] || '',
          CreatedBy: row[9] || '',
          CompletedBy: completedBy
        };
      });

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
    
    // אם זה שליחה לכל הסוכנים, קבל את רשימת הסוכנים הפעילים (ללא admin)
    if (formData.sendToAll) {
      const agents = await getSheetData('Sheet1!A:J');
      const activeAgents = agents.slice(1).filter(agent => {
        const status = agent[7];
        const role = agent[1] || '';
        const agentCode = agent[2] || '';
        return status === 'active' && 
               role.toLowerCase() !== 'admin' && 
               agentCode.toLowerCase() !== 'admin' && 
               agentCode.toLowerCase() !== 'admin123';
      });
      
      // יצירת טופס לכל סוכן פעיל (ללא admin)
      for (const agent of activeAgents) {
        const rowData = [
          'FRM-' + Date.now() + '-' + agent[0],
          agent[0], // Agent ID
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
      }
      
      return res.json({
        success: true,
        message: `Form created for ${activeAgents.length} agents`,
        count: activeAgents.length
      });
    }
    
    // יצירת טופס בודד
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

// Submit form response - NEW ENDPOINT
app.post('/api/forms/:id/submit', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseData } = req.body;
    const agentId = req.user.agentCode;
    const agentEmail = req.user.email || `${req.user.agentCode}@fieldforms.com`;
    const timestamp = new Date().toISOString();
    
    console.log(`Agent ${agentId} submitting form ${id}`);
    
    // Add response record to Sheet3
    const responseId = 'RESP-' + Date.now();
    const responseRow = [
      responseId,              // A: ResponseID
      id,                      // B: FormID
      agentId,                 // C: AgentID
      'הושלם',                 // D: Status
      timestamp,               // E: StartedAt
      timestamp,               // F: CompletedAt
      agentEmail,              // G: AgentEmail
      JSON.stringify(responseData || {}) // H: ResponseData
    ];
    
    await appendSheetData('Sheet3!A:H', [responseRow]);
    console.log('Added response tracking to Sheet3');
    
    // Update form status in Sheet2
    const forms = await getSheetData('Sheet2!A:J');
    const formIndex = forms.slice(1).findIndex(row => row[0] === id);
    
    if (formIndex !== -1) {
      const range = `Sheet2!G${formIndex + 2}`;
      await updateSheetData(range, [['הושלם']]);
      console.log('Updated form status in Sheet2');
    }
    
    res.json({
      success: true,
      message: 'Form submitted successfully',
      responseId
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get form completion status for admin dashboard
app.get('/api/forms/status', authenticateToken, async (req, res) => {
  try {
    const agents = await getSheetData('Sheet1!A:J');
    const forms = await getSheetData('Sheet2!A:J');
    const responses = await getSheetData('Sheet3!A:H');
    
    // Build status report
    const statusReport = [];
    
    if (forms && forms.length > 1) {
      forms.slice(1).forEach(form => {
        const formId = form[0];
        const formType = form[2];
        const formUrl = form[7];
        
        // Find all agents who should complete this form
        const activeAgents = agents.slice(1).filter(agent => agent[7] === 'active');
        
        activeAgents.forEach(agent => {
          const agentId = agent[2]; // AgentCode
          const agentName = agent[3]; // Name
          
          // Check if agent completed this form
          let completed = false;
          let completionDate = null;
          
          if (responses && responses.length > 1) {
            const agentResponse = responses.slice(1).find(resp => 
              resp[1] === formId && resp[2] === agentId && resp[3] === 'הושלם'
            );
            
            if (agentResponse) {
              completed = true;
              completionDate = agentResponse[5];
            }
          }
          
          statusReport.push({
            formId,
            formType,
            formUrl,
            agentId,
            agentName,
            status: completed ? 'הושלם' : 'ממתין',
            completionDate
          });
        });
      });
    }
    
    res.json(statusReport);
  } catch (error) {
    console.error('Error getting form status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get agent's pending forms
app.get('/api/forms/agent/:agentId', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    let forms = await getSheetData('Sheet2!A:J');
    const responses = await getSheetData('Sheet3!A:H');
    
    if (!forms || forms.length <= 1) {
      return res.json([]);
    }
    
    // Get all forms
    const allForms = forms.slice(1).map(row => ({
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
    
    // Check which forms were completed by this agent
    const completedFormIds = responses.slice(1)
      .filter(row => row[2] === agentId && row[3] === 'הושלם')
      .map(row => row[1]);
    
    // Return only forms not yet completed by this agent
    const pendingForms = allForms.filter(form => 
      !completedFormIds.includes(form.ID) && form.Status !== 'הושלם'
    );
    
    console.log(`Agent ${agentId}: ${pendingForms.length} pending forms`);
    res.json(pendingForms);
  } catch (error) {
    console.error('Get agent forms error:', error);
    res.json([]);
  }
});

// ========== START SERVER ==========

async function startServer() {
  const initialized = await initializeGoogleSheets();
  
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║    Field Forms Pro Backend Server     ║
╠══════════════════════════════════════╣
║  🚀 Server: http://localhost:${PORT}     ║
║  📊 Google Sheets: ${initialized ? 'Connected ✅' : 'Failed ❌'}      ║
╠══════════════════════════════════════╣
║  Sheet Structure:                      ║
║  Sheet1: Agents data                   ║
║  Sheet2: Forms data                    ║
║  Sheet3: Response tracking             ║
╚══════════════════════════════════════╝
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
