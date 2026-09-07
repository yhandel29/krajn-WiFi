const express = require('express');
const axios = require('axios');
const https = require('https');
const path = require('path');
require('dotenv').config();

const app = express();

// Set EJS as view engine and serve static assets
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Omada Controller Config
const OMADA_URL = process.env.OMADA_URL || 'https://12.8.13.2:8043';
const OMADA_USER = process.env.OMADA_USER || 'admin';
const OMADA_PASS = process.env.OMADA_PASS || 'admin_password';
const SITE_NAME = process.env.SITE_NAME || 'Default';

const omadaApi = axios.create({
  baseURL: OMADA_URL,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  withCredentials: true,
});

async function loginToOmada() {
  try {
    const response = await omadaApi.post('/api/v2/hotspot/login', {
      name: OMADA_USER,
      password: OMADA_PASS,
    });
    const cookies = response.headers['set-cookie'];
    const token = response.data.result?.token || response.data.token;
    return { cookies, token };
  } catch (error) {
    console.error('Omada Login Error:', error.response?.data || error.message);
    throw new Error('Could not authenticate with Omada Controller');
  }
}

// Render dynamic dynamic login UI
app.get('/login', (req, res) => {
  const { clientMac, apMac, ssidName, redirectUrl } = req.query;

  // Render EJS view and pass portal parameters
  res.render('login', {
    clientMac: clientMac || '',
    apMac: apMac || '',
    ssidName: ssidName || 'High-Speed Wi-Fi',
    redirectUrl: redirectUrl || 'https://www.google.com',
  });
});

// Voucher authentication handler
app.post('/api/vouch/verify', async (req, res) => {
  const { clientMac, apMac, voucherCode } = req.body;

  if (!voucherCode) {
    return res.status(400).json({ success: false, message: 'Please enter a valid voucher code.' });
  }

  // TODO: Replace with database query validation
  const mockVouchers = {
    'SPEED1H': 60,      // 1 hour in minutes
    'VIP24H': 1440,     // 24 hours in minutes
    'FREE15M': 15,      // 15 minutes test
  };

  const code = voucherCode.trim().toUpperCase();
  const durationInMinutes = mockVouchers[code];

  if (!durationInMinutes) {
    return res.status(400).json({ success: false, message: 'Invalid or used voucher code.' });
  }

  try {
    const { cookies, token } = await loginToOmada();

    const authPayload = {
      clientMac: clientMac,
      apMac: apMac,
      authType: 4,
      time: durationInMinutes * 60 * 1000, // Convert minutes to milliseconds
      site: SITE_NAME,
    };

    const authResponse = await omadaApi.post(
      `/api/v2/hotspot/extPortal/auth?token=${token}`,
      authPayload,
      { headers: { Cookie: cookies.join('; ') } }
    );

    if (authResponse.data.errorCode === 0) {
      return res.json({
        success: true,
        message: 'Access granted! Connected to the Internet.',
        duration: durationInMinutes,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: authResponse.data.msg || 'Controller authorization failed.',
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/', (req, res) => {
    res.redirect('/login');
});
app.listen(3000, () => console.log('Portal Server active on http://localhost:3000'));
