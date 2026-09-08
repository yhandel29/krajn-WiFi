const express = require('express');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

router.get('/:reference', paymentController.handlePaymentStatus);

module.exports = router;
