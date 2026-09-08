const test = require('node:test');
const assert = require('node:assert/strict');

const { generateVoucherCode, validateVoucherCode } = require('../src/services/voucher.service');

test('generateVoucherCode returns a valid code format', () => {
  const code = generateVoucherCode();
  assert.match(code, /^WIFI-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
});

test('validateVoucherCode rejects invalid code', () => {
  assert.equal(validateVoucherCode('BADCODE'), false);
});

test('validateVoucherCode accepts the generated format', () => {
  const code = generateVoucherCode();
  assert.equal(validateVoucherCode(code), true);
});
