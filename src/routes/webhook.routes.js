const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/webhook', webhookController.handleWebhook);

module.exports = router;
