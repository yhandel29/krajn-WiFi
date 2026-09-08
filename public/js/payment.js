const urlParams = new URLSearchParams(window.location.search);
const reference = urlParams.get('reference');
const statusElement = document.getElementById('paymentStatus');
const countdownElement = document.getElementById('countdown');
const orderReferenceElement = document.getElementById('orderReference');
const voucherSection = document.getElementById('voucherSection');
const voucherCodeElement = document.getElementById('voucherCode');
const voucherDurationElement = document.getElementById('voucherDuration');

if (reference) {
  orderReferenceElement.textContent = reference;
}

async function refreshOrderStatus() {
  if (!reference) {
    return;
  }

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(reference)}/status`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to retrieve order status.');
    }

    const status = result.data?.status || 'PENDING';
    statusElement.textContent = status === 'PAID' ? 'Payment successful.' : 'Waiting for payment...';

    if (result.data?.voucher) {
      voucherSection.classList.remove('hidden');
      voucherCodeElement.textContent = result.data.voucher.code;
      voucherDurationElement.textContent = `${result.data.voucher.durationMinutes} minutes`;
      statusElement.textContent = 'Payment successful.';
      countdownElement.textContent = 'Voucher is ready';
    }
  } catch (error) {
    statusElement.textContent = 'Unable to confirm payment status.';
  }
}

refreshOrderStatus();
setInterval(refreshOrderStatus, 5000);
