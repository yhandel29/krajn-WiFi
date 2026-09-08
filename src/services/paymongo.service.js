const axios = require('axios');
const crypto = require('node:crypto');
const env = require('../config/environment');

const paymongoClient = axios.create({
  baseURL: env.PAYMONGO_API_BASE_URL,
  timeout: 20000,
  headers: {
    Authorization: `Basic ${Buffer.from(`${env.PAYMONGO_SECRET_KEY}:`).toString('base64')}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

async function createPaymentIntent({ amount, currency = 'PHP', description, metadata = {} }) {
  const response = await paymongoClient.post('/payment_intents', {
    data: {
      attributes: {
        amount,
        currency,
        description,
        payment_method_allowed: ['paymaya', 'gcash', 'grab_pay', 'card'],
        metadata,
      },
    },
  });

  return response.data.data;
}

async function createQrPhSource({ amount, currency = 'PHP', description, metadata = {} }) {
  const response = await paymongoClient.post('/payment_methods', {
    data: {
      attributes: {
        type: 'qr',
        details: {
          type: 'qr_ph',
        },
        amount,
        currency,
        description,
        metadata,
      },
    },
  });

  return response.data.data;
}

async function attachPaymentMethodToIntent({ paymentIntentId, paymentMethodId }) {
  const response = await paymongoClient.post(`/payment_intents/${paymentIntentId}/attach`, {
    data: {
      attributes: {
        payment_method: paymentMethodId,
      },
    },
  });

  return response.data.data;
}

async function getPaymentIntent(paymentIntentId) {
  const response = await paymongoClient.get(`/payment_intents/${paymentIntentId}`);
  return response.data.data;
}

function verifyWebhookSignature(rawBody, signature, secret) {
  if (!signature || !secret) {
    return false;
  }

  const cleanSignature = String(signature).trim();
  const signatureValue = cleanSignature.startsWith('sha256=') ? cleanSignature.slice(7) : cleanSignature;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureValue, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch (error) {
    return false;
  }
}

module.exports = {
  paymongoClient,
  createPaymentIntent,
  createQrPhSource,
  attachPaymentMethodToIntent,
  getPaymentIntent,
  verifyWebhookSignature,
};
