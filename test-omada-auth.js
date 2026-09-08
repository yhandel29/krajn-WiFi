const axios = require('axios');
const https = require('https');

// --- CONFIGURATION ---
const CONTROLLER_URL = 'https://127.0.0.1:8043'; // Localhost controller URL
const OPERATOR_USER = 'your_operator_username';   // Created in Hotspot Manager -> Operators
const OPERATOR_PASS = 'your_operator_password';   // Created in Hotspot Manager -> Operators
const SITE_NAME = 'KRAJN_WiFi_Network_245A9C';    // Your site name

const DUMMY_CLIENT_MAC = 'AA-BB-CC-11-22-33';    // Test Client MAC address
const DUMMY_AP_MAC = '00-00-00-00-00-00';        // Dummy AP MAC address
const DURATION_MINUTES = 60;                     // Access duration in minutes

// Ignore self-signed SSL certificates for local HTTPS calls
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  withCredentials: true
});

async function testOmadaAuth() {
  try {
    console.log('1. Attempting login to Omada Hotspot API...');

    // 1. Log in to the Hotspot Operator endpoint
    const loginUrl = `${CONTROLLER_URL}/api/v2/hotspot/login`;
    const loginResponse = await axiosInstance.post(loginUrl, {
      name: OPERATOR_USER,
      password: OPERATOR_PASS
    });

    console.log('Login Response Status:', loginResponse.status);
    console.log('Login Response Data:', loginResponse.data);

    if (loginResponse.data.errorCode !== 0) {
      throw new Error(`Login failed: ${loginResponse.data.msg}`);
    }

    // Extract CSRF token from response headers and session cookie
    const csrfToken = loginResponse.headers['csrf-token'] || loginResponse.data.result?.token;
    const cookies = loginResponse.headers['set-cookie'];

    console.log('\n2. Authorizing dummy client MAC address...');

    // 2. Authorize the dummy client MAC
    const authUrl = `${CONTROLLER_URL}/api/v2/hotspot/extPortal/auth`;
    const authResponse = await axiosInstance.post(
      authUrl,
      {
        clientMac: DUMMY_CLIENT_MAC,
        apMac: DUMMY_AP_MAC,
        authType: 4, // 4 = External Portal / Operator Authentication
        time: DURATION_MINUTES * 60 // Convert minutes to seconds
      },
      {
        headers: {
          'Csrf-Token': csrfToken,
          'Cookie': cookies ? cookies.join('; ') : ''
        }
      }
    );

    console.log('Auth Response Status:', authResponse.status);
    console.log('Auth Response Data:', authResponse.data);

    if (authResponse.data.errorCode === 0) {
      console.log(`\nSUCCESS: Client [${DUMMY_CLIENT_MAC}] authorized for ${DURATION_MINUTES} minutes!`);
    } else {
      console.log(`\nAUTH FAILED: ${authResponse.data.msg} (Error Code: ${authResponse.data.errorCode})`);
    }

  } catch (error) {
    console.error('\nAPI Test Failed:', error.response ? error.response.data : error.message);
  }
}

testOmadaAuth();
