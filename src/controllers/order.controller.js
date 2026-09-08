const orderService = require('../services/order.service');

async function createOrder(req, res, next) {
  try {
    const order = await orderService.createOrder(req.body);
    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
}

async function getOrderStatus(req, res, next) {
  try {
    const result = await orderService.getOrderStatus(req.params.reference);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { createOrder, getOrderStatus };
