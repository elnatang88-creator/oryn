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

  function release() {
    gate.setAttribute('hidden', '');
    document.body.classList.remove('age-gate-pending');
    if (window.Zavyxo && Zavyxo.ScrollLock) Zavyxo.ScrollLock.unlock('age-gate');
  }

  if (isVerified()) {
    release();
  } else {
    gate.removeAttribute('hidden');
    if (window.Zavyxo && Zavyxo.ScrollLock) Zavyxo.ScrollLock.lock('age-gate');
    var confirmBtnInit = document.getElementById('AgeGateConfirm');
    if (confirmBtnInit) confirmBtnInit.focus();
  }

  var confirmBtn = document.getElementById('AgeGateConfirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      setVerified();
      release();
    });
  }

  // Focus trap: the age gate is mandatory and has no Escape-to-close — only
  // Tab/Shift+Tab cycling between "I Am 18 or Older" and "Exit" is allowed.
  gate.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' && window.Zavyxo && Zavyxo.trapFocus) {
      Zavyxo.trapFocus(e, gate.querySelector('.age-gate__panel'));
    }
  });
})();
