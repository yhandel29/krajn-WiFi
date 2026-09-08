const voucherService = require('../services/voucher.service');

async function validateVoucher(req, res, next) {
  try {
    const code = req.body.voucherCode;
    const result = await voucherService.validateVoucherCodeInDb(code);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function useVoucher(req, res, next) {
  try {
    const code = req.body.voucherCode;
    const result = await voucherService.useVoucher(code);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = { validateVoucher, useVoucher };
