const { body, param, validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }

  return next();
}

const orderValidation = [
  body('voucherPlanId').isInt({ min: 1 }).withMessage('voucherPlanId is required and must be a positive integer.'),
  body('customerName').trim().isLength({ min: 2, max: 120 }).withMessage('customerName must be between 2 and 120 characters.'),
  body('customerEmail').isEmail().withMessage('customerEmail must be a valid email address.'),
  body('customerMobile').trim().matches(/^[0-9+()\-\s]{8,20}$/).withMessage('customerMobile must be a valid phone number.'),
  handleValidationErrors,
];

const voucherCodeValidation = [
  body('voucherCode').trim().matches(/^WIFI-[A-Z0-9]{4}-[A-Z0-9]{4}$/).withMessage('voucherCode is invalid.'),
  handleValidationErrors,
];

const referenceValidation = [
  param('reference').trim().notEmpty().withMessage('reference is required.'),
  handleValidationErrors,
];

module.exports = {
  orderValidation,
  voucherCodeValidation,
  referenceValidation,
  handleValidationErrors,
};
