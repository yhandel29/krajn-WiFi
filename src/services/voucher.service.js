const crypto = require('node:crypto');
const db = require('../config/database');

const VOUCHER_PREFIX = 'WIFI';
const CODE_FORMAT = /^WIFI-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function generateVoucherCode() {
  const randomSegment = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `${VOUCHER_PREFIX}-${randomSegment()}-${randomSegment()}`;
}

function validateVoucherCode(code) {
  if (typeof code !== 'string') {
    return false;
  }

  return CODE_FORMAT.test(code.trim().toUpperCase());
}

async function validateVoucherCodeInDb(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!validateVoucherCode(normalized)) {
    return { valid: false, voucherCode: normalized, status: 'INVALID', durationMinutes: 0 };
  }

  const [rows] = await db.execute(
    `SELECT voucher_code, status, duration_minutes, expires_at
     FROM vouchers
     WHERE voucher_code = ?
     LIMIT 1`,
    [normalized]
  );

  if (!rows.length) {
    return { valid: false, voucherCode: normalized, status: 'INVALID', durationMinutes: 0 };
  }

  const voucher = rows[0];
  const now = new Date();
  const expired = voucher.expires_at && new Date(voucher.expires_at) < now;

  return {
    valid: voucher.status === 'ACTIVE' && !expired,
    voucherCode: voucher.voucher_code,
    status: expired ? 'EXPIRED' : voucher.status,
    durationMinutes: Number(voucher.duration_minutes || 0),
  };
}

async function useVoucher(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!validateVoucherCode(normalized)) {
    const error = new Error('Invalid voucher code.');
    error.statusCode = 400;
    throw error;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, status, expires_at, duration_minutes
       FROM vouchers
       WHERE voucher_code = ?
       FOR UPDATE`,
      [normalized]
    );

    if (!rows.length) {
      const error = new Error('Invalid voucher code.');
      error.statusCode = 400;
      throw error;
    }

    const voucher = rows[0];
    const now = new Date();

    if (voucher.status === 'USED' || voucher.status === 'CANCELLED') {
      const error = new Error('Voucher is already used or cancelled.');
      error.statusCode = 400;
      throw error;
    }

    if (voucher.expires_at && new Date(voucher.expires_at) < now) {
      const error = new Error('Voucher has expired.');
      error.statusCode = 400;
      throw error;
    }

    await connection.execute(
      `UPDATE vouchers
       SET status = 'USED', updated_at = NOW()
       WHERE id = ?`,
      [voucher.id]
    );

    await connection.commit();

    return {
      valid: true,
      voucherCode: normalized,
      status: 'USED',
      durationMinutes: Number(voucher.duration_minutes || 0),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createVoucherForOrder(order, connection) {
  const [planRows] = await connection.execute(
    'SELECT duration_minutes FROM voucher_plans WHERE id = ? LIMIT 1',
    [order.voucher_plan_id]
  );

  if (!planRows.length) {
    throw new Error('Voucher plan not found.');
  }

  const durationMinutes = Number(planRows[0].duration_minutes || 0);
  let attempts = 0;

  while (attempts < 10) {
    const code = generateVoucherCode();
    try {
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
      await connection.execute(
        `INSERT INTO vouchers
         (order_id, voucher_plan_id, voucher_code, status, duration_minutes, activated_at, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, 'ACTIVE', ?, NOW(), ?, NOW(), NOW())`,
        [order.id, order.voucher_plan_id, code, durationMinutes, expiresAt]
      );

      return {
        code,
        durationMinutes,
        expiresAt,
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        attempts += 1;
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to generate a unique voucher code.');
}

function createVoucher(order, dbConnection) {
  return createVoucherForOrder(order, dbConnection);
}

function activateVoucher(code) {
  return { valid: true, code, status: 'ACTIVE' };
}

function expireVoucher(code) {
  return { valid: false, code, status: 'EXPIRED' };
}

module.exports = {
  generateVoucherCode,
  validateVoucherCode,
  validateVoucherCodeInDb,
  useVoucher,
  createVoucher,
  createVoucherForOrder,
  activateVoucher,
  expireVoucher,
};
