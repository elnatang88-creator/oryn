(function () {
  var roots = document.querySelectorAll('[data-product-page]');
  if (!roots.length) return;

  roots.forEach(initProductPage);

  function initProductPage(root) {
    var form = root.querySelector('[data-product-form]');
    if (!form) return;

    var variantJsonEl = root.querySelector('[data-product-json]');
    var variants = [];
    try { variants = JSON.parse(variantJsonEl.textContent); } catch (e) { variants = []; }

    var variantIdInput = form.querySelector('[data-variant-id-input]');
    var optionInputs = form.querySelectorAll('[data-option-input]');
    var priceWrap = root.querySelector('[data-product-price]');
    var availabilityWrap = root.querySelector('[data-availability]');
    var addToCartBtn = form.querySelector('[data-add-to-cart]');
    var addToCartText = form.querySelector('[data-add-to-cart-text]');
    var buyNowBtn = form.querySelector('[data-buy-it-now]');
    var stickyBar = document.querySelector('[data-sticky-atc]');
    var stickyPrice = stickyBar && stickyBar.querySelector('[data-sticky-price]');
    var stickyAddBtn = stickyBar && stickyBar.querySelector('[data-sticky-add-to-cart]');

    function currentOptionValues() {
      var values = [];
      var groups = {};
      optionInputs.forEach(function (input) {
        if (!input.checked) return;
        var wrapper = input.closest('[data-option-index]');
        var index = wrapper ? parseInt(wrapper.getAttribute('data-option-index'), 10) : 0;
        groups[index] = input.value;
      });
      var maxIndex = -1;
      Object.keys(groups).forEach(function (k) { maxIndex = Math.max(maxIndex, parseInt(k, 10)); });
      for (var i = 0; i <= maxIndex; i++) values.push(groups[i]);
      return values;
    }

    function findMatchingVariant() {
      var values = currentOptionValues();
      if (!values.length) return variants[0];
      return variants.find(function (v) {
        var opts = [v.option1, v.option2, v.option3].filter(function (o) { return o !== null && o !== undefined; });
        return values.every(function (val, i) { return opts[i] === val; });
      });
    }

    function updateUI(variant) {
      if (!variant) {
        if (addToCartBtn) { addToCartBtn.disabled = true; }
        if (addToCartText) addToCartText.textContent = 'Unavailable';
        return;
      }
      if (variantIdInput) variantIdInput.value = variant.id;

      if (priceWrap) {
        var priceEl = priceWrap.querySelector('[data-price]');
        var compareEl = priceWrap.querySelector('[data-compare-price]');
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          priceWrap.innerHTML =
            '<span class="sale-price" data-price>' + Zavyxo.formatMoney(variant.price) + '</span>' +
            '<span class="compare-at" data-compare-price>' + Zavyxo.formatMoney(variant.compare_at_price) + '</span>';
        } else {
          priceWrap.innerHTML = '<span data-price>' + Zavyxo.formatMoney(variant.price) + '</span>';
        }
      }
      if (stickyPrice) stickyPrice.textContent = Zavyxo.formatMoney(variant.price);

      if (availabilityWrap) {
        var dot = availabilityWrap.querySelector('.availability-dot');
        if (variant.available) {
          if (dot) dot.classList.remove('is-out');
          availabilityWrap.childNodes[availabilityWrap.childNodes.length - 1];
        } else if (dot) {
          dot.classList.add('is-out');
        }
      }

      var available = variant.available;
      [addToCartBtn, buyNowBtn, stickyAddBtn].forEach(function (btn) {
        if (btn) btn.disabled = !available;
      });
      if (addToCartText) addToCartText.textContent = available ? addToCartText.getAttribute('data-label-available') || 'Add to Cart' : 'Sold Out';

      updateGalleryForVariant(variant);

      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url);
      }
    }

    optionInputs.forEach(function (input) {
      input.addEventListener('change', function () {
        var group = input.closest('[data-option-index]');
        if (group) {
          group.querySelectorAll('.swatch, .variant-pill').forEach(function (el) { el.classList.remove('is-selected'); });
          input.closest('.swatch, .variant-pill') && input.closest('.swatch, .variant-pill').classList.add('is-selected');
          var strong = group.querySelector('[data-selected-value]');
          if (strong) strong.textContent = input.value;
        }
        updateUI(findMatchingVariant());
      });
    });

    function updateGalleryForVariant(variant) {
      if (!variant.featured_media) return;
      var thumb = root.querySelector('[data-gallery-thumb][data-media-id="' + variant.featured_media.id + '"]');
      if (thumb) thumb.click();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      addCurrentToCart();
    });

    function addCurrentToCart() {
      var id = variantIdInput ? variantIdInput.value : variants[0] && variants[0].id;
      var qtyInput = form.querySelector('input[name="quantity"]');
      var quantity = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
      setLoading(true);
      Zavyxo.Cart.add([{ id: id, quantity: quantity }])
        .then(function () { Zavyxo.Cart.open(); })
        .catch(function (err) { console.error(err); })
        .finally(function () { setLoading(false); });
    }

    function setLoading(isLoading) {
      [addToCartBtn, stickyAddBtn].forEach(function (btn) {
        if (btn) btn.classList.toggle('is-loading', isLoading);
      });
    }

    if (stickyAddBtn) {
      stickyAddBtn.addEventListener('click', addCurrentToCart);
    }

    if (buyNowBtn) {
      buyNowBtn.addEventListener('click', function () {
        var id = variantIdInput ? variantIdInput.value : variants[0] && variants[0].id;
        var qtyInput = form.querySelector('input[name="quantity"]');
        var quantity = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
        Zavyxo.Cart.add([{ id: id, quantity: quantity }]).then(function () {
          window.location.href = Zavyxo.routes.cartUrl.replace('/cart', '/checkout');
        });
      });
    }

    /* -------- Sticky ATC visibility -------- */
    var buyBox = root.querySelector('.buy-box');
    if (stickyBar && buyBox && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyBar.classList.toggle('is-visible', !entry.isIntersecting);
        });
      }, { rootMargin: '-80px 0px 0px 0px' });
      io.observe(buyBox);
    }

    /* -------- Gallery -------- */
    initGallery(root);

    /* -------- FBT -------- */
    initFBT(root);
  }

  function initGallery(root) {
    var mainImg = root.querySelector('[data-gallery-main-image]');
    var mainSlot = root.querySelector('[data-gallery-main-slot]');
    var thumbs = root.querySelectorAll('[data-gallery-thumb]');
    var mobileTrack = root.querySelector('[data-gallery-mobile]');
    var prevBtn = root.querySelector('[data-gallery-prev]');
    var nextBtn = root.querySelector('[data-gallery-next]');
    var zoomBtn = root.querySelector('[data-gallery-zoom]');
    var productId = root.getAttribute('data-product-handle');
    var productData = null;
    Object.keys(window.ZAVYXO_PRODUCT || {}).forEach(function (key) {
      if (!productData) productData = window.ZAVYXO_PRODUCT[key];
    });
    var mediaList = (productData && productData.media) || [];

    function renderVideo(container, mediaId) {
      var media = mediaList.find(function (m) { return String(m.id) === String(mediaId); });
      if (!media) return;
      container.innerHTML = '';
      if (media.type === 'video' && media.sources && media.sources.length) {
        var video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.poster = media.preview_image;
        media.sources.forEach(function (s) {
          var source = document.createElement('source');
          source.src = s.url;
          source.type = s.mime_type;
          video.appendChild(source);
        });
        container.appendChild(video);
      } else if (media.type === 'external_video') {
        var iframe = document.createElement('iframe');
        iframe.src = (media.host === 'youtube' ? 'https://www.youtube.com/embed/' : 'https://player.vimeo.com/video/') + media.embed_url;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.allow = 'autoplay; fullscreen';
        container.appendChild(iframe);
      }
    }

    if (mainSlot) {
      var firstThumb = thumbs[0];
      if (firstThumb) renderVideo(mainSlot, firstThumb.getAttribute('data-media-id'));
    }

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        thumbs.forEach(function (t) { t.classList.remove('is-active'); });
        thumb.classList.add('is-active');
        var mediaId = thumb.getAttribute('data-media-id');
        var media = mediaList.find(function (m) { return String(m.id) === String(mediaId); });
        if (!media) return;
        var mainWrap = root.querySelector('.product-gallery__main');
        if (media.type === 'video' || media.type === 'external_video') {
          if (!mainSlot) {
            mainSlot = document.createElement('div');
            mainWrap.insertBefore(mainSlot, mainWrap.firstChild);
            if (mainImg) mainImg.remove();
          } else if (mainImg) {
            mainImg.style.display = 'none';
          }
          renderVideo(mainSlot, mediaId);
        } else {
          if (mainSlot) mainSlot.innerHTML = '';
          if (mainImg) {
            mainImg.style.display = '';
            mainImg.src = media.preview_image;
            mainImg.alt = media.alt || '';
          }
        }
        var mobileSlide = mobileTrack && mobileTrack.querySelector('[data-media-id="' + mediaId + '"]');
        if (mobileSlide) mobileSlide.scrollIntoView({ behavior: 'smooth', inline: 'start' });
      });
    });

    if (prevBtn && nextBtn && thumbs.length) {
      var activeIndex = 0;
      function goTo(index) {
        activeIndex = (index + thumbs.length) % thumbs.length;
        thumbs[activeIndex].click();
      }
      prevBtn.addEventListener('click', function () { goTo(activeIndex - 1); });
      nextBtn.addEventListener('click', function () { goTo(activeIndex + 1); });
    }

    if (zoomBtn) {
      zoomBtn.addEventListener('click', function () {
        var mainWrap = root.querySelector('.product-gallery__main');
        mainWrap.classList.toggle('is-zoomed');
        if (mainImg) mainImg.style.transform = mainWrap.classList.contains('is-zoomed') ? 'scale(1.6)' : '';
      });
    }

    mediaList.forEach(function (media) {
      var slot = root.querySelector('[data-mobile-media-slot][data-media-id="' + media.id + '"]');
      if (slot) renderVideo(slot, media.id);
    });
  }

  function initFBT(root) {
    var widget = root.querySelector('[data-fbt-widget]');
    if (!widget) return;
    var checkboxes = widget.querySelectorAll('[data-fbt-checkbox]');
    var totalEl = widget.querySelector('[data-fbt-total]');
    var savingsEl = widget.querySelector('[data-fbt-savings]');
    var addAllBtn = widget.querySelector('[data-fbt-add-all]');

    function recalc() {
      var total = 0;
      var savings = 0;
      checkboxes.forEach(function (cb) {
        if (!cb.checked) return;
        var price = parseInt(cb.getAttribute('data-price'), 10) || 0;
        var comparePrice = parseInt(cb.getAttribute('data-compare-price'), 10) || 0;
        total += price;
        if (comparePrice > price) savings += comparePrice - price;
      });
      if (totalEl) totalEl.textContent = Zavyxo.formatMoney(total);
      if (savingsEl) {
        if (savings > 0) {
          savingsEl.hidden = false;
          savingsEl.textContent = 'Save ' + Zavyxo.formatMoney(savings);
        } else {
          savingsEl.hidden = true;
        }
      }
    }

    checkboxes.forEach(function (cb) { cb.addEventListener('change', recalc); });
    recalc();

    if (addAllBtn) {
      addAllBtn.addEventListener('click', function () {
        var items = [];
        checkboxes.forEach(function (cb) {
          if (cb.checked) items.push({ id: cb.getAttribute('data-variant-id'), quantity: 1 });
        });
        if (!items.length) return;
        Zavyxo.Cart.add(items).then(function () { Zavyxo.Cart.open(); });
      });
    }
  }

  /* -------- Product recommendations -------- */
  var recEl = document.querySelector('[data-product-recommendations]');
  if (recEl) {
    fetch(recEl.getAttribute('data-url'))
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var section = doc.querySelector('[data-product-recommendations], .product-grid, .section-padding');
        if (section) recEl.innerHTML = section.outerHTML || html;
        if (window.Zavyxo && window.Zavyxo.Wishlist) window.Zavyxo.Wishlist.refreshUI();
      })
      .catch(function () {});
  }
})();
