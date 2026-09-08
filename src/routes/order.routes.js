const express = require('express');
const { orderValidation } = require('../middleware/validation');
const orderController = require('../controllers/order.controller');

const router = express.Router();

router.post('/', orderValidation, orderController.createOrder);
router.get('/:reference/status', orderController.getOrderStatus);

module.exports = router;
