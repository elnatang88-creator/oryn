(function () {
  var toggle = document.querySelector('[data-filter-drawer-toggle]');
  var drawer = document.querySelector('[data-filter-drawer]');
  if (toggle && drawer) {
    var closers = drawer.querySelectorAll('[data-filter-drawer-close]');
    function isOpen() { return drawer.classList.contains('is-open'); }
    function close() {
      if (!isOpen()) return;
      drawer.classList.remove('is-open');
      Zavyxo.ScrollLock.unlock('filter-drawer');
      toggle.focus();
    }
    toggle.addEventListener('click', function () {
      drawer.classList.add('is-open');
      Zavyxo.ScrollLock.lock('filter-drawer');
      var closeBtn = drawer.querySelector('[data-filter-drawer-close]');
      if (closeBtn) closeBtn.focus();
    });
    closers.forEach(function (el) { el.addEventListener('click', close); });
    drawer.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') Zavyxo.trapFocus(e, drawer.querySelector('.filter-drawer__panel'));
    });
  }

  document.querySelectorAll('[data-facets-form]').forEach(function (form) {
    form.querySelectorAll('[data-facet-input]').forEach(function (input) {
      input.addEventListener('change', function () {
        form.submit();
      });
    });
  });
})();
