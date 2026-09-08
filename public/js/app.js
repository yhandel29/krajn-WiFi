const form = document.getElementById('voucherForm');
const messageBox = document.getElementById('message');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    voucherPlanId: 1,
    customerName: document.getElementById('customerName').value.trim(),
    customerEmail: document.getElementById('customerEmail').value.trim(),
    customerMobile: document.getElementById('customerMobile').value.trim(),
  };

  try {
    messageBox.textContent = 'Creating order...';

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to create voucher order.');
    }

    const order = result.data;
    window.location.href = `/payment.html?reference=${encodeURIComponent(order.referenceNo)}`;
  } catch (error) {
    messageBox.textContent = error.message;
  }
});
