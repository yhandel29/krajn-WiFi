async function handlePaymentStatus(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        referenceNo: req.params.reference,
        status: 'PENDING',
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { handlePaymentStatus };
