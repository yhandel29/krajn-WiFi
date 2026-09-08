const db = require('../config/database');
const env = require('../config/environment');
const paymongoService = require('../services/paymongo.service');
const { createVoucherForOrder } = require('../services/voucher.service');

async function handleWebhook(req, res, next) {
  try {
    const signatureHeader = req.headers['paymongo-signature'] || req.headers['x-paymongo-signature'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});

    if (!signatureHeader || !env.PAYMONGO_WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Missing PayMongo signature or secret.' });
    }

    const signatureValue = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const isValid = paymongoService.verifyWebhookSignature(rawBody, signatureValue, env.PAYMONGO_WEBHOOK_SECRET);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid webhook JSON payload.' });
    }

    const eventType = payload?.data?.attributes?.type || payload?.type || 'unknown';
    const eventId = payload?.data?.id || payload?.id;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Webhook payload missing event id.' });
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [existingEvents] = await connection.execute(
        'SELECT id, processed FROM webhook_events WHERE event_id = ? LIMIT 1',
        [eventId]
      );

      if (existingEvents.length && existingEvents[0].processed) {
        await connection.commit();
        connection.release();
        return res.status(200).json({ success: true, message: 'Duplicate webhook processed.', eventType });
      }

      if (!existingEvents.length) {
        await connection.execute(
          `INSERT INTO webhook_events (event_id, event_type, payload, processed, created_at)
           VALUES (?, ?, ?, 0, NOW())`,
          [eventId, eventType, JSON.stringify(payload)]
        );
      }

      const paymentData = payload?.data?.attributes?.data || payload?.data?.attributes || {};
      const paymentIntentId = paymentData?.id || paymentData?.attributes?.id || payload?.data?.attributes?.id;
      const paymentStatus = paymentData?.attributes?.status || paymentData?.status || 'pending';
      const orderReference = paymentData?.attributes?.metadata?.order_reference || paymentData?.metadata?.order_reference;

      let selectedOrderId = null;
      if (paymentIntentId) {
        const [paymentRows] = await connection.execute(
          `SELECT p.order_id, p.status, o.reference_no, o.voucher_plan_id, o.id
           FROM payments p
           JOIN orders o ON o.id = p.order_id
           WHERE p.payment_intent_id = ?
           LIMIT 1`,
          [paymentIntentId]
        );

        if (paymentRows.length) {
          selectedOrderId = paymentRows[0].order_id;
        }
      }

      if (!selectedOrderId && orderReference) {
        const [orderRows] = await connection.execute(
          'SELECT id, voucher_plan_id FROM orders WHERE reference_no = ? LIMIT 1',
          [orderReference]
        );

        if (orderRows.length) {
          selectedOrderId = orderRows[0].id;
        }
      }

      if (!selectedOrderId) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: 'Order not found for PayMongo webhook.' });
      }

      if (paymentStatus === 'paid' || paymentStatus === 'succeeded' || eventType === 'payment.paid') {
        const [existingVoucherRows] = await connection.execute(
          'SELECT id FROM vouchers WHERE order_id = ? LIMIT 1',
          [selectedOrderId]
        );

        await connection.execute(
          `UPDATE orders
           SET status = 'PAID', paid_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [selectedOrderId]
        );

        await connection.execute(
          `UPDATE payments
           SET status = 'PAID', raw_response = ?, updated_at = NOW()
           WHERE order_id = ?`,
          [JSON.stringify(payload), selectedOrderId]
        );

        if (!existingVoucherRows.length) {
          const [orderRows] = await connection.execute(
            'SELECT id, voucher_plan_id FROM orders WHERE id = ? LIMIT 1',
            [selectedOrderId]
          );

          const voucher = await createVoucherForOrder(orderRows[0], connection);
          await connection.execute(
            `UPDATE vouchers
             SET status = 'ACTIVE', activated_at = NOW(), expires_at = ?, updated_at = NOW()
             WHERE order_id = ?`,
            [voucher.expiresAt, selectedOrderId]
          );
        }
      } else {
        await connection.execute(
          `UPDATE orders
           SET status = 'FAILED', updated_at = NOW()
           WHERE id = ?`,
          [selectedOrderId]
        );
      }

      await connection.execute(
        `UPDATE webhook_events
         SET processed = 1, processed_at = NOW()
         WHERE event_id = ?`,
        [eventId]
      );

      await connection.commit();
      return res.status(200).json({ success: true, message: 'Webhook processed.', eventType });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
}

module.exports = { handleWebhook };
