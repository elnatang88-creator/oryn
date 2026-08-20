(function () {
  var grid = document.getElementById('WishlistGrid');
  var empty = document.getElementById('WishlistEmpty');
  var loading = document.getElementById('WishlistLoading');
  if (!grid) return;

  var handles = (window.Zavyxo && window.Zavyxo.Wishlist) ? window.Zavyxo.Wishlist.get() : [];

  if (!handles.length) {
    if (loading) loading.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }

  Promise.all(
    handles.map(function (handle) {
      return fetch('/products/' + handle + '.js')
        .then(function (res) { return res.ok ? res.json() : null; })
        .catch(function () { return null; });
    })
  ).then(function (products) {
    if (loading) loading.hidden = true;
    var valid = products.filter(Boolean);
    if (!valid.length) {
      if (empty) empty.hidden = false;
      return;
    }
    grid.innerHTML = valid.map(renderCard).join('');
    grid.querySelectorAll('[data-wishlist-toggle]').forEach(function (btn) {
      btn.classList.add('is-active');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        window.Zavyxo.Wishlist.toggle ? window.Zavyxo.Wishlist.toggle(btn.getAttribute('data-wishlist-toggle')) : null;
        btn.closest('.product-card').remove();
        if (!grid.children.length && empty) empty.hidden = false;
      });
    });
    grid.querySelectorAll('[data-quick-add-button]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!window.Zavyxo || !window.Zavyxo.Cart) return;
        Zavyxo.Cart.add([{ id: btn.getAttribute('data-variant-id'), quantity: 1 }]).then(function () {
          Zavyxo.Cart.open();
        });
      });
    });
  });

  function renderCard(product) {
    var variant = product.variants[0];
    var priceHtml = variant.compare_at_price && variant.compare_at_price > variant.price
      ? '<span class="sale-price">' + Zavyxo.formatMoney(variant.price) + '</span><span class="compare-at">' + Zavyxo.formatMoney(variant.compare_at_price) + '</span>'
      : '<span>' + Zavyxo.formatMoney(variant.price) + '</span>';
    return (
      '<div class="product-card">' +
        '<div class="product-card__media" data-ratio="portrait">' +
          '<a href="' + product.url + '">' +
            (product.featured_image ? '<img class="product-card__img--primary" src="' + product.featured_image + '&width=600" alt="' + escapeHtml(product.title) + '" loading="lazy">' : '') +
          '</a>' +
          '<button type="button" class="product-card__wishlist is-active" data-wishlist-toggle="' + product.handle + '" aria-label="Remove from wishlist">' +
            '<svg class="icon icon-heart" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 20.5s-7.5-4.6-10-9.3C.4 8 1.7 4.3 5.2 3.4c2.1-.5 4.2.4 5.4 2.1l1.4 1.9 1.4-1.9c1.2-1.7 3.3-2.6 5.4-2.1 3.5.9 4.8 4.6 3.2 7.8-2.5 4.7-10 9.3-10 9.3z"></path></svg>' +
          '</button>' +
          (product.available ? '<div class="product-card__quick-add"><button type="button" class="btn btn--secondary btn--sm btn--block" data-quick-add-button data-variant-id="' + variant.id + '">Quick Add</button></div>' : '') +
        '</div>' +
        '<div class="product-card__body">' +
          '<h3 class="product-card__title"><a href="' + product.url + '">' + escapeHtml(product.title) + '</a></h3>' +
          '<div class="product-card__price">' + priceHtml + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
