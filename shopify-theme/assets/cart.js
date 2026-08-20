window.Zavyxo = window.Zavyxo || {};

Zavyxo.Cart = (function () {
  var drawer = document.getElementById('CartDrawer');
  var routes = window.Zavyxo.routes || {};

  function open() {
    drawer = document.getElementById('CartDrawer');
    if (!drawer) return;
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function updateCartCount(count) {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  function announce(message) {
    var region = document.getElementById('CartLiveRegion');
    if (region) region.textContent = message;
  }

  function refreshDrawer() {
    return fetch('/?section_id=cart-drawer')
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var newDrawer = doc.getElementById('CartDrawer');
        var oldDrawer = document.getElementById('CartDrawer');
        if (newDrawer && oldDrawer) {
          var wasOpen = oldDrawer.classList.contains('is-open');
          oldDrawer.replaceWith(newDrawer);
          drawer = newDrawer;
          if (wasOpen) drawer.classList.add('is-open');
          bindDrawerEvents();
          initUpsell();
        }
      });
  }

  function add(items) {
    return fetch(routes.cartAddUrl || '/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: items })
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (err) { throw err; });
        return res.json();
      })
      .then(function (data) {
        return fetchCartState().then(function (cart) {
          updateCartCount(cart.item_count);
          announce(cart.item_count + ' items in cart');
          return refreshDrawer().then(function () { return data; });
        });
      });
  }

  function fetchCartState() {
    return fetch('/cart.js').then(function (res) { return res.json(); });
  }

  function changeLine(key, quantity) {
    return fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: key, quantity: quantity })
    })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        updateCartCount(cart.item_count);
        return refreshDrawer().then(function () { return cart; });
      });
  }

  function bindDrawerEvents() {
    if (!drawer) return;
    drawer.querySelectorAll('[data-cart-drawer-close]').forEach(function (el) {
      el.addEventListener('click', close);
    });

    drawer.querySelectorAll('[data-cart-line]').forEach(function (line) {
      var key = line.getAttribute('data-line-key');
      var input = line.querySelector('[data-cart-qty-input]');
      var decrease = line.querySelector('[data-cart-qty-decrease]');
      var increase = line.querySelector('[data-cart-qty-increase]');
      var remove = line.querySelector('[data-cart-remove]');

      if (decrease) decrease.addEventListener('click', function () {
        var qty = Math.max(0, parseInt(input.value, 10) - 1);
        changeLine(key, qty);
      });
      if (increase) increase.addEventListener('click', function () {
        var qty = parseInt(input.value, 10) + 1;
        changeLine(key, qty);
      });
      if (input) input.addEventListener('change', function () {
        changeLine(key, Math.max(0, parseInt(input.value, 10) || 0));
      });
      if (remove) remove.addEventListener('click', function () { changeLine(key, 0); });
    });
  }

  function initUpsell() {
    var upsellEl = document.getElementById('CartUpsell');
    if (!upsellEl) return;
    var url = upsellEl.getAttribute('data-url');
    if (!url) return;
    fetch(url)
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var section = doc.querySelector('[data-cart-upsell]') || doc.body;
        upsellEl.innerHTML = section.innerHTML;
        upsellEl.querySelectorAll('[data-cart-upsell-add]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            add([{ id: btn.getAttribute('data-variant-id'), quantity: 1 }]);
          });
        });
      })
      .catch(function () {});
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-cart-drawer-toggle]')) {
      e.preventDefault();
      open();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  document.addEventListener('DOMContentLoaded', function () {
    bindDrawerEvents();
    initUpsell();
  });

  return { open: open, close: close, add: add, changeLine: changeLine, refresh: refreshDrawer };
})();

/* ---------------- Quick add custom element (product cards) ---------------- */
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-quick-add-button]');
    if (!btn) return;
    e.preventDefault();
    var variantId = btn.getAttribute('data-variant-id');
    if (!variantId) return;
    btn.classList.add('is-loading');
    Zavyxo.Cart.add([{ id: variantId, quantity: 1 }])
      .then(function () { Zavyxo.Cart.open(); })
      .catch(function (err) { console.error(err); })
      .finally(function () { btn.classList.remove('is-loading'); });
  });
})();

/* ---------------- Standalone cart page quantity controls ---------------- */
(function () {
  var page = document.querySelector('[data-cart-page]');
  if (!page) return;
  page.querySelectorAll('[data-cart-line]').forEach(function (line) {
    var key = line.getAttribute('data-line-key');
    var input = line.querySelector('[data-cart-qty-input]');
    var decrease = line.querySelector('[data-cart-qty-decrease]');
    var increase = line.querySelector('[data-cart-qty-increase]');
    var remove = line.querySelector('[data-cart-remove]');
    function commit(qty) {
      Zavyxo.Cart.changeLine(key, qty).then(function () { window.location.reload(); });
    }
    if (decrease) decrease.addEventListener('click', function () { commit(Math.max(0, parseInt(input.value, 10) - 1)); });
    if (increase) increase.addEventListener('click', function () { commit(parseInt(input.value, 10) + 1); });
    if (remove) remove.addEventListener('click', function () { commit(0); });
    if (input) input.addEventListener('change', function () { commit(Math.max(0, parseInt(input.value, 10) || 0)); });
  });
})();
