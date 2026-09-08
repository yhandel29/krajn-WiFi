const paymongoService = require('./paymongo.service');

async function createPaymentRecord(order, paymongoRes) {
  return {
    orderId: order.id || order.referenceNo,
    provider: 'paymongo',
    paymentIntentId: paymongoRes.id,
    amount: order.amount,
    currency: order.currency,
    status: 'PENDING',
  };
}

module.exports = {
  createPaymentRecord,
};
