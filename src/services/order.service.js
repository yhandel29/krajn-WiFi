const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const paymongoService = require('./paymongo.service');

async function createOrder(payload) {
  const voucherPlanId = Number(payload.voucherPlanId);
  const customerName = String(payload.customerName || '').trim();
  const customerEmail = String(payload.customerEmail || '').trim();
  const customerMobile = String(payload.customerMobile || '').trim();

  if (!voucherPlanId || !customerName || !customerEmail || !customerMobile) {
    const error = new Error('Missing required order information.');
    error.statusCode = 400;
    throw error;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [planRows] = await connection.execute(
      'SELECT id, name, price, duration_minutes FROM voucher_plans WHERE id = ? AND is_active = 1 LIMIT 1',
      [voucherPlanId]
    );

    if (!planRows.length) {
      const error = new Error('Invalid voucher plan.');
      error.statusCode = 404;
      throw error;
    }

    const voucherPlan = planRows[0];
    const amountInCents = Math.round(parseFloat(voucherPlan.price || 0) * 100);
    const referenceNo = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uuidv4().slice(0, 6).toUpperCase()}`;

    const [orderResult] = await connection.execute(
      `INSERT INTO orders
       (reference_no, voucher_plan_id, customer_name, customer_email, customer_mobile, amount, currency, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PHP', 'PENDING', NOW(), NOW())`,
      [referenceNo, voucherPlan.id, customerName, customerEmail, customerMobile, amountInCents / 100]
    );

    const paymentIntent = await paymongoService.createPaymentIntent({
      amount: amountInCents,
      currency: 'PHP',
      description: `Wi-Fi voucher - ${voucherPlan.name}`,
      metadata: {
        order_reference: referenceNo,
        voucher_plan_id: String(voucherPlan.id),
        customer_email: customerEmail,
      },
    });

    const paymentIntentId = paymentIntent.id;
    const [paymentResult] = await connection.execute(
      `INSERT INTO payments
       (order_id, provider, payment_intent_id, amount, currency, status, raw_response, created_at, updated_at)
       VALUES (?, 'paymongo', ?, ?, 'PHP', 'PENDING', ?, NOW(), NOW())`,
      [orderResult.insertId, paymentIntentId, amountInCents / 100, JSON.stringify(paymentIntent)]
    );

    const paymentMethod = await paymongoService.createQrPhSource({
      amount: amountInCents,
      currency: 'PHP',
      description: `QR Ph payment for ${referenceNo}`,
      metadata: {
        order_reference: referenceNo,
        payment_intent_id: paymentIntentId,
      },
    });

    if (paymentMethod?.id) {
      await paymongoService.attachPaymentMethodToIntent({
        paymentIntentId,
        paymentMethodId: paymentMethod.id,
      });

      await connection.execute(
        `UPDATE payments
         SET payment_method_id = ?, raw_response = ?, updated_at = NOW()
         WHERE id = ?`,
        [paymentMethod.id, JSON.stringify(paymentMethod), paymentResult.insertId]
      );
    }

    await connection.commit();

    return {
      referenceNo,
      voucherPlanId,
      customerName,
      customerEmail,
      customerMobile,
      amount: amountInCents / 100,
      currency: 'PHP',
      status: 'PENDING',
      paymentIntentId,
      paymentMethodId: paymentMethod?.id || null,
      paymentUrl: paymentIntent?.attributes?.next_action?.redirect?.url || null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getOrderStatus(reference) {
  if (!reference) {
    const error = new Error('Order reference is required.');
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await db.execute(
    `SELECT o.reference_no, o.status, o.amount, o.currency,
            v.voucher_code, v.duration_minutes, v.status AS voucher_status
     FROM orders o
     LEFT JOIN vouchers v ON v.order_id = o.id
     WHERE o.reference_no = ?
     LIMIT 1`,
    [reference]
  );

  if (!rows.length) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  const order = rows[0];

  return {
    referenceNo: order.reference_no,
    status: order.status,
    voucher: order.voucher_code ? {
      code: order.voucher_code,
      durationMinutes: Number(order.duration_minutes || 0),
      status: order.voucher_status,
    } : null,
  };
}

module.exports = { createOrder, getOrderStatus };
