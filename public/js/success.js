const params = new URLSearchParams(window.location.search);
const code = params.get('code');
const duration = params.get('duration');
const voucherCodeEl = document.getElementById('voucherCode');
const voucherDurationEl = document.getElementById('voucherDuration');

if (code) {
  voucherCodeEl.textContent = code;
}

if (duration) {
  voucherDurationEl.textContent = `${duration} minutes`;
}
