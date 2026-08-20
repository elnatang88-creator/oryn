(function () {
  var KEY = 'zavyxo_age_verified';
  var DAYS = 30;

  function isVerified() {
    try {
      var stored = JSON.parse(localStorage.getItem(KEY));
      if (!stored || !stored.expires) return false;
      return Date.now() < stored.expires;
    } catch (e) {
      return false;
    }
  }

  function setVerified() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ expires: Date.now() + DAYS * 24 * 60 * 60 * 1000 }));
    } catch (e) {}
  }

  var gate = document.getElementById('AgeGate');
  if (!gate) return;

  if (isVerified()) {
    gate.setAttribute('hidden', '');
    document.body.classList.remove('age-gate-pending');
  } else {
    gate.removeAttribute('hidden');
  }

  var confirmBtn = document.getElementById('AgeGateConfirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      setVerified();
      gate.setAttribute('hidden', '');
      document.body.classList.remove('age-gate-pending');
    });
  }
})();
