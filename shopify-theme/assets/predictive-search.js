(function () {
  var forms = document.querySelectorAll('[data-predictive-search-form]');
  if (!forms.length) return;

  forms.forEach(function (form) {
    var input = form.querySelector('[data-predictive-search-input]');
    var results = form.querySelector('[data-predictive-search-results]');
    if (!input || !results) return;

    var debounceTimer;
    var controller;

    input.addEventListener('input', function () {
      var term = input.value.trim();
      clearTimeout(debounceTimer);
      if (term.length < 2) {
        results.classList.remove('is-open');
        results.innerHTML = '';
        return;
      }
      debounceTimer = setTimeout(function () { fetchResults(term); }, 250);
    });

    input.addEventListener('focus', function () {
      if (results.innerHTML.trim() !== '') results.classList.add('is-open');
    });

    document.addEventListener('click', function (e) {
      if (!form.contains(e.target)) results.classList.remove('is-open');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') results.classList.remove('is-open');
    });

    function fetchResults(term) {
      if (controller) controller.abort();
      controller = new AbortController();
      var url = '/search/suggest.json?q=' + encodeURIComponent(term) +
        '&resources[type]=product,collection,query' +
        '&resources[limit]=6' +
        '&resources[options][unavailable_products]=last' +
        '&section_id=predictive-search';

      fetch(url, { signal: controller.signal })
        .then(function (res) { return res.json(); })
        .then(function (data) { renderResults(term, data.resources.results); })
        .catch(function (err) { if (err.name !== 'AbortError') console.error(err); });
    }

    function renderResults(term, data) {
      var products = data.products || [];
      var collections = data.collections || [];
      var queries = data.queries || [];

      if (!products.length && !collections.length && !queries.length) {
        results.innerHTML = '<p style="font-size:13px;color:var(--color-text-secondary);padding:8px 4px;">' +
          'No results for &ldquo;' + escapeHtml(term) + '&rdquo;</p>';
        results.classList.add('is-open');
        return;
      }

      var html = '';

      if (queries.length) {
        html += '<div class="predictive-search__section">';
        queries.forEach(function (q) {
          html += '<a class="predictive-search__link" href="' + q.url + '">' + q.styled_text + '</a>';
        });
        html += '</div>';
      }

      if (collections.length) {
        html += '<div class="predictive-search__section"><h5>Collections</h5>';
        collections.forEach(function (c) {
          html += '<a class="predictive-search__link" href="' + c.url + '">' + escapeHtml(c.title) + '</a>';
        });
        html += '</div>';
      }

      if (products.length) {
        html += '<div class="predictive-search__section"><h5>Products</h5>';
        products.forEach(function (p) {
          html += '<a class="predictive-search__product" href="' + p.url + '">' +
            (p.image ? '<img src="' + p.image + '" alt="" loading="lazy">' : '') +
            '<span class="predictive-search__product-info"><p>' + escapeHtml(p.title) + '</p><p>' + p.price + '</p></span>' +
            '</a>';
        });
        html += '</div>';
        html += '<a class="predictive-search__link" href="/search?q=' + encodeURIComponent(term) + '&type=product" style="text-align:center;border-top:1px solid var(--color-border);padding-top:12px;">' +
          'View all results</a>';
      }

      results.innerHTML = html;
      results.classList.add('is-open');
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  });
})();
