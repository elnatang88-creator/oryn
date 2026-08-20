document.documentElement.classList.remove('no-js');

window.Zavyxo = window.Zavyxo || {};

Zavyxo.formatMoney = function (cents, format) {
  if (typeof cents === 'string') cents = cents.replace('.', '');
  var value = '';
  var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
  var formatString = format || (window.Zavyxo.moneyFormat || '${{amount}}');

  function defaultTo(value, defaultValue) {
    return value == null || value !== value ? defaultValue : value;
  }
  function formatWithDelimiters(number, precision, thousands, decimal) {
    precision = defaultTo(precision, 2);
    thousands = defaultTo(thousands, ',');
    decimal = defaultTo(decimal, '.');
    if (isNaN(number) || number == null) return 0;
    number = (number / 100.0).toFixed(precision);
    var parts = number.split('.');
    var dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
    var cents2 = parts[1] ? decimal + parts[1] : '';
    return dollars + cents2;
  }

  switch (formatString.match(placeholderRegex)[1]) {
    case 'amount':
      value = formatWithDelimiters(cents, 2);
      break;
    case 'amount_no_decimals':
      value = formatWithDelimiters(cents, 0);
      break;
    case 'amount_with_comma_separator':
      value = formatWithDelimiters(cents, 2, '.', ',');
      break;
    case 'amount_no_decimals_with_comma_separator':
      value = formatWithDelimiters(cents, 0, '.', ',');
      break;
    default:
      value = formatWithDelimiters(cents, 2);
  }
  return formatString.replace(placeholderRegex, value);
};

/* ---------------- Announcement bar rotator ---------------- */
(function () {
  var bar = document.querySelector('[data-announcement-bar]');
  if (!bar) return;
  var items = bar.querySelectorAll('.announcement-bar__item');
  if (items.length < 2) return;
  var index = 0;
  var interval = parseInt(bar.getAttribute('data-interval'), 10) || 4000;
  setInterval(function () {
    items[index].classList.remove('is-active');
    index = (index + 1) % items.length;
    items[index].classList.add('is-active');
  }, interval);
})();

/* ---------------- Mobile menu ---------------- */
(function () {
  var toggle = document.querySelector('[data-mobile-menu-toggle]');
  var menu = document.querySelector('[data-mobile-menu]');
  if (!toggle || !menu) return;
  var closeEls = menu.querySelectorAll('[data-mobile-menu-close]');

  function open() {
    menu.classList.add('is-open');
    menu.removeAttribute('hidden');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    setTimeout(function () { menu.setAttribute('hidden', ''); }, 300);
  }
  toggle.addEventListener('click', function () {
    menu.hasAttribute('hidden') || !menu.classList.contains('is-open') ? open() : close();
  });
  closeEls.forEach(function (el) { el.addEventListener('click', close); });

  menu.querySelectorAll('[data-submenu-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var submenu = document.getElementById(btn.getAttribute('data-submenu-toggle'));
      if (!submenu) return;
      var isOpen = submenu.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', isOpen);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
})();

/* ---------------- Header search toggle (mobile) ---------------- */
(function () {
  var toggle = document.querySelector('[data-header-search-toggle]');
  var panel = document.querySelector('[data-header-search-panel]');
  if (!toggle || !panel) return;
  toggle.addEventListener('click', function () {
    var isOpen = panel.classList.toggle('is-open');
    if (isOpen) {
      panel.removeAttribute('hidden');
      var input = panel.querySelector('input[type="search"]');
      if (input) input.focus();
    } else {
      panel.setAttribute('hidden', '');
    }
  });
})();

/* ---------------- Mega menu (hover + keyboard) ---------------- */
(function () {
  var items = document.querySelectorAll('.main-nav__item');
  items.forEach(function (item) {
    var trigger = item.querySelector('.main-nav__link');
    var menu = item.querySelector('.mega-menu');
    if (!menu || !trigger) return;
    var closeTimer;
    function openMenu() { clearTimeout(closeTimer); item.classList.add('is-open'); }
    function scheduleClose() { closeTimer = setTimeout(function () { item.classList.remove('is-open'); }, 150); }
    item.addEventListener('mouseenter', openMenu);
    item.addEventListener('mouseleave', scheduleClose);
    trigger.addEventListener('focus', openMenu);
    item.addEventListener('focusout', function (e) {
      if (!item.contains(e.relatedTarget)) item.classList.remove('is-open');
    });
  });
})();

/* ---------------- Wishlist (localStorage) ---------------- */
Zavyxo.Wishlist = (function () {
  var KEY = 'zavyxo_wishlist';
  function get() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }
  function toggle(id) {
    var list = get();
    var idx = list.indexOf(id);
    if (idx > -1) { list.splice(idx, 1); } else { list.push(id); }
    save(list);
    return list.indexOf(id) > -1;
  }
  function has(id) { return get().indexOf(id) > -1; }
  function updateCount() {
    var count = get().length;
    document.querySelectorAll('[data-wishlist-count]').forEach(function (el) {
      el.textContent = count;
      el.hidden = count === 0;
    });
  }
  function refreshUI() {
    document.querySelectorAll('[data-wishlist-toggle]').forEach(function (btn) {
      var id = btn.getAttribute('data-wishlist-toggle');
      btn.classList.toggle('is-active', has(id));
    });
    updateCount();
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-wishlist-toggle]');
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute('data-wishlist-toggle');
    var active = toggle(id);
    btn.classList.toggle('is-active', active);
    updateCount();
  });
  document.addEventListener('DOMContentLoaded', refreshUI);
  return { get: get, has: has, toggle: toggle, refreshUI: refreshUI };
})();

/* ---------------- Product tabs ---------------- */
(function () {
  document.querySelectorAll('[data-product-tabs]').forEach(function (wrap) {
    var buttons = wrap.querySelectorAll('.product-tabs__btn');
    var panels = wrap.querySelectorAll('.product-tabs__panel');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('is-active'); });
        panels.forEach(function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var target = document.getElementById(btn.getAttribute('aria-controls'));
        if (target) target.classList.add('is-active');
      });
    });
  });
})();

/* ---------------- Quantity selectors ---------------- */
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-quantity-change]');
  if (!btn) return;
  var wrapper = btn.closest('.quantity-selector');
  var input = wrapper && wrapper.querySelector('input');
  if (!input) return;
  var step = parseInt(input.step, 10) || 1;
  var min = parseInt(input.min, 10) || 1;
  var value = parseInt(input.value, 10) || min;
  value = btn.getAttribute('data-quantity-change') === 'increase' ? value + step : Math.max(min, value - step);
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

/* ---------------- Reveal on scroll ---------------- */
(function () {
  if (!('IntersectionObserver' in window)) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('[data-reveal]').forEach(function (el) { observer.observe(el); });
})();

/* ---------------- Quick view ---------------- */
(function () {
  var container = document.getElementById('QuickViewContainer');
  var panel = document.getElementById('QuickViewPanel');
  if (!container || !panel) return;

  function close() {
    container.setAttribute('hidden', '');
    panel.innerHTML = '';
    document.body.style.overflow = '';
  }
  container.querySelectorAll('[data-quick-view-close]').forEach(function (el) {
    el.addEventListener('click', close);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-quick-view]');
    if (!trigger) return;
    e.preventDefault();
    var url = trigger.getAttribute('data-quick-view');
    panel.innerHTML = '<div class="shimmer" style="height:320px;border-radius:12px;"></div>';
    container.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    fetch(url + (url.indexOf('?') > -1 ? '&' : '?') + 'section_id=quick-view')
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var section = doc.querySelector('#shopify-section-quick-view, [data-quick-view-content]');
        panel.innerHTML = section ? section.innerHTML : html;
        if (window.Zavyxo && window.Zavyxo.Wishlist) window.Zavyxo.Wishlist.refreshUI();
        var form = panel.querySelector('form');
        if (form) {
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var idInput = form.querySelector('input[name="id"]');
            var submitBtn = form.querySelector('button[type="submit"]');
            if (!idInput || !window.Zavyxo || !window.Zavyxo.Cart) return;
            if (submitBtn) submitBtn.classList.add('is-loading');
            Zavyxo.Cart.add([{ id: idInput.value, quantity: 1 }])
              .then(function () { close(); Zavyxo.Cart.open(); })
              .catch(function (err) { console.error(err); })
              .finally(function () { if (submitBtn) submitBtn.classList.remove('is-loading'); });
          });
        }
      })
      .catch(function () {
        panel.innerHTML = '<p>Unable to load product. <a href="' + url + '">View full page</a>.</p>';
      });
  });
})();
