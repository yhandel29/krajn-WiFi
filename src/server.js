const http = require('http');
const env = require('./config/environment');
const app = require('./app');

const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.log(`Wi-Fi voucher server running on port ${env.PORT}`);
});

module.exports = server;
