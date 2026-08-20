(function () {
  var toggle = document.querySelector('[data-filter-drawer-toggle]');
  var drawer = document.querySelector('[data-filter-drawer]');
  if (toggle && drawer) {
    var closers = drawer.querySelectorAll('[data-filter-drawer-close]');
    toggle.addEventListener('click', function () {
      drawer.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
    closers.forEach(function (el) {
      el.addEventListener('click', function () {
        drawer.classList.remove('is-open');
        document.body.style.overflow = '';
      });
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
