const express = require('express');
const { voucherCodeValidation } = require('../middleware/validation');
const voucherController = require('../controllers/voucher.controller');

const router = express.Router();

router.post('/validate', voucherCodeValidation, voucherController.validateVoucher);
router.post('/use', voucherCodeValidation, voucherController.useVoucher);

module.exports = router;
