document.documentElement.classList.remove('no-js');

window.Zavyxo = window.Zavyxo || {};

/* ---------------- Shared scroll lock ----------------
   Every overlay (age gate, mobile menu, cart drawer, filter drawer, quick
   view) locks/unlocks by its own id through this single reference-counted
   module, so closing one overlay never releases the lock while another is
   still open. Uses the position:fixed technique (not just overflow:hidden)
   because iOS Safari still background-scrolls/bounces with overflow:hidden
   alone. */
Zavyxo.ScrollLock = (function () {
  var locks = {};
  var scrollY = 0;

  function count() { return Object.keys(locks).length; }

  function apply() {
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function release() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  }

  function lock(id) {
    if (count() === 0) apply();
    locks[id] = true;
  }

  function unlock(id) {
    delete locks[id];
    if (count() === 0) release();
  }

  return { lock: lock, unlock: unlock };
})();

/* ---------------- Shared focus trap ----------------
   Keeps Tab/Shift+Tab cycling within `container` while a modal is open.
   Call from a keydown listener on the container: Zavyxo.trapFocus(event, container) */
Zavyxo.trapFocus = function (event, container) {
  if (!container) return;
  var focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;
  var first = focusable[0];
  var last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

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
    Zavyxo.ScrollLock.lock('mobile-menu');
    var firstLink = menu.querySelector('.mobile-menu__link, a, button');
    if (firstLink) firstLink.focus();
  }
  function close() {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    Zavyxo.ScrollLock.unlock('mobile-menu');
    setTimeout(function () { menu.setAttribute('hidden', ''); }, 300);
    toggle.focus();
  }
  toggle.addEventListener('click', function () {
    menu.hasAttribute('hidden') || !menu.classList.contains('is-open') ? open() : close();
  });
  closeEls.forEach(function (el) { el.addEventListener('click', close); });
  menu.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') Zavyxo.trapFocus(e, menu.querySelector('.mobile-menu__panel'));
  });

  menu.querySelectorAll('[data-submenu-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var submenu = document.getElementById(btn.getAttribute('data-submenu-toggle'));
      if (!submenu) return;
      var isOpen = submenu.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', isOpen);
    });
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

    function clampToViewport() {
      // The menu is centered under its trigger by default (left:50%, translateX(-50%)),
      // which can push it past the viewport edge for nav items near the left/right
      // edge of the header. Measure and nudge it back on-screen when that happens.
      menu.style.setProperty('--mega-menu-shift', '0px');
      var rect = menu.getBoundingClientRect();
      var margin = 16;
      var overflowRight = rect.right - (window.innerWidth - margin);
      var overflowLeft = margin - rect.left;
      if (overflowRight > 0) {
        menu.style.setProperty('--mega-menu-shift', '-' + overflowRight + 'px');
      } else if (overflowLeft > 0) {
        menu.style.setProperty('--mega-menu-shift', overflowLeft + 'px');
      }
    }

    function openMenu() {
      clearTimeout(closeTimer);
      item.classList.add('is-open');
      requestAnimationFrame(clampToViewport);
    }
    function scheduleClose() { closeTimer = setTimeout(function () { item.classList.remove('is-open'); }, 150); }
    item.addEventListener('mouseenter', openMenu);
    item.addEventListener('mouseleave', scheduleClose);
    trigger.addEventListener('focus', openMenu);
    item.addEventListener('focusout', function (e) {
      if (!item.contains(e.relatedTarget)) item.classList.remove('is-open');
    });
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { item.classList.remove('is-open'); trigger.focus(); }
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

  var lastTrigger = null;

  function isOpen() { return !container.hasAttribute('hidden'); }

  function close() {
    if (!isOpen()) return;
    container.setAttribute('hidden', '');
    panel.innerHTML = '';
    Zavyxo.ScrollLock.unlock('quick-view');
    if (lastTrigger) lastTrigger.focus();
  }
  container.querySelectorAll('[data-quick-view-close]').forEach(function (el) {
    el.addEventListener('click', close);
  });
  container.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') Zavyxo.trapFocus(e, panel);
  });

  function initQuickViewForm(root) {
    var form = root.querySelector('[data-quick-view-form]');
    if (!form) return;
    var jsonEl = root.querySelector('[data-quick-view-json]');
    var variants = [];
    try { variants = JSON.parse(jsonEl.textContent); } catch (err) { variants = []; }
    var idInput = form.querySelector('[data-quick-view-variant-input]');
    var priceWrap = root.querySelector('[data-quick-view-price]');
    var imageEl = root.querySelector('[data-quick-view-image]');
    var addBtn = form.querySelector('[data-quick-view-add]');
    var addText = form.querySelector('[data-quick-view-add-text]');
    var optionInputs = form.querySelectorAll('[data-qv-option-input]');

    function currentValues() {
      var groups = {};
      optionInputs.forEach(function (input) {
        if (!input.checked) return;
        var wrapper = input.closest('[data-option-index]');
        var index = wrapper ? parseInt(wrapper.getAttribute('data-option-index'), 10) : 0;
        groups[index] = input.value;
      });
      var values = [];
      var maxIndex = -1;
      Object.keys(groups).forEach(function (k) { maxIndex = Math.max(maxIndex, parseInt(k, 10)); });
      for (var i = 0; i <= maxIndex; i++) values.push(groups[i]);
      return values;
    }

    function findVariant() {
      var values = currentValues();
      if (!values.length) return variants[0];
      return variants.find(function (v) {
        var opts = [v.option1, v.option2, v.option3].filter(function (o) { return o !== null && o !== undefined; });
        return values.every(function (val, i) { return opts[i] === val; });
      });
    }

    function updateForVariant(variant) {
      if (!variant) return;
      if (idInput) idInput.value = variant.id;
      if (priceWrap) {
        priceWrap.innerHTML = variant.compare_at_price && variant.compare_at_price > variant.price
          ? '<span class="sale-price">' + Zavyxo.formatMoney(variant.price) + '</span><span class="compare-at">' + Zavyxo.formatMoney(variant.compare_at_price) + '</span>'
          : '<span>' + Zavyxo.formatMoney(variant.price) + '</span>';
      }
      if (imageEl && variant.featured_image) imageEl.src = variant.featured_image.src || imageEl.src;
      if (addBtn) addBtn.disabled = !variant.available;
      if (addText) addText.textContent = variant.available ? 'Add to Cart' : 'Sold Out';
    }

    optionInputs.forEach(function (input) {
      input.addEventListener('change', function () {
        var group = input.closest('[data-option-index]');
        if (group) {
          group.querySelectorAll('.variant-pill').forEach(function (el) { el.classList.remove('is-selected'); });
          var pill = input.closest('.variant-pill');
          if (pill) pill.classList.add('is-selected');
          var strong = group.querySelector('[data-selected-value]');
          if (strong) strong.textContent = input.value;
        }
        updateForVariant(findVariant());
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!idInput || !window.Zavyxo || !window.Zavyxo.Cart) return;
      var qtyInput = form.querySelector('input[name="quantity"]');
      var quantity = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
      if (addBtn) addBtn.classList.add('is-loading');
      Zavyxo.Cart.add([{ id: idInput.value, quantity: quantity }])
        .then(function () { close(); Zavyxo.Cart.open(); })
        .catch(function (err) { console.error(err); })
        .finally(function () { if (addBtn) addBtn.classList.remove('is-loading'); });
    });
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-quick-view]');
    if (!trigger) return;
    e.preventDefault();
    lastTrigger = trigger;
    var url = trigger.getAttribute('data-quick-view');
    panel.innerHTML = '<div class="shimmer" style="height:320px;border-radius:12px;"></div>';
    container.removeAttribute('hidden');
    Zavyxo.ScrollLock.lock('quick-view');
    fetch(url + (url.indexOf('?') > -1 ? '&' : '?') + 'section_id=quick-view')
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var section = doc.querySelector('#shopify-section-quick-view, [data-quick-view-content]');
        panel.innerHTML = section ? section.innerHTML : html;
        if (window.Zavyxo && window.Zavyxo.Wishlist) window.Zavyxo.Wishlist.refreshUI();
        initQuickViewForm(panel);
        var firstFocusable = panel.querySelector('a[href], button:not([disabled])');
        if (firstFocusable) firstFocusable.focus();
      })
      .catch(function () {
        panel.innerHTML = '<p>Unable to load product. <a href="' + url + '">View full page</a>.</p>';
      });
  });
})();
