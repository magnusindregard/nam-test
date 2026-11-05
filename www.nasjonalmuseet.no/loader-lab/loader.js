/* Loader lab – lastes synkront i <head> så loaderen vises før resten av siden.
   URL-parametre:
     ?loader=reveal|title|spinner|dots|bar|fade|curtain|weight|none   (side-loader)
     ?img=fade|blur|skeleton|none                  (bilde-effekt)
     ?min=600                                      (minimum visningstid i ms)
     ?delay=ms&imgdelay=ms                         (kunstig forsinkelse fra serve.py)
*/
(function () {
  var q = new URLSearchParams(location.search);
  var store = {
    get: function (k, d) { try { return q.get(k) || localStorage.getItem('ll2_' + k) || d; } catch (e) { return q.get(k) || d; } },
    set: function (k, v) { try { localStorage.setItem('ll2_' + k, v); } catch (e) {} }
  };
  var loader = store.get('loader', 'reveal');
  var img = store.get('img', 'fade');
  var min = parseInt(store.get('min', '0'), 10) || 0;
  var t0 = performance.now();
  var html = document.documentElement;

  var header = store.get('header', 'delayed');
  html.classList.add('ll-loading', 'll-loader-' + loader, 'll-img-' + img);
  if (header === 'delayed') html.classList.add('ll-hdr');
  if (q.get('headline')) html.classList.add('ll-headline');

  /* --- falsk progress for "bar" --- */
  var p = 0, timer = setInterval(function () {
    p += (90 - p) * 0.08;
    html.style.setProperty('--ll-progress', p.toFixed(1) + '%');
  }, 120);

  function done() {
    var wait = Math.max(0, min - (performance.now() - t0));
    setTimeout(function () {
      clearInterval(timer);
      html.classList.remove('ll-loading');
      html.classList.add('ll-done');
      var el = document.getElementById('ll-time');
      if (el) el.textContent = 'load: ' + Math.round(performance.now() - t0) + ' ms';
      if (loader === 'reveal') startReveal();
    }, wait);
  }

  /* --- reveal: blokker toner inn én etter én nedover når de kommer til syne --- */
  var STEP = 80, MAX_DELAY = 600, nextSlot = 0;
  function bgOf(el) {
    for (; el; el = el.parentElement) {
      var c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'transparent' && !/,\s*0\)$/.test(c)) return c;
    }
    return '#fff';
  }
  function setupReveal() {
    var logo = document.querySelector('.header__logo');
    if (logo) html.style.setProperty('--ll-logo-bg', bgOf(logo));
    // Overskrifter: husk faktisk vekt, start på 300
    document.querySelectorAll('h1, h2, h3, h4').forEach(function (h) {
      h.style.setProperty('--ll-w', getComputedStyle(h).fontWeight);
      h.classList.add('ll-h');
    });
    // Blokker: ytterste treff vinner, så et kort toner inn som én enhet
    var sel = 'h1, h2, h3, h4, p, li, .ulc-item, figure, picture, img, form, .search-input, a, button';
    document.querySelectorAll('main, footer, .footer-new').forEach(function (root) {
      root.querySelectorAll(sel).forEach(function (el) {
        for (var a = el; a && a !== document.body; a = a.parentElement) if (a.__llr) return;
        el.__llr = 1;
        el.classList.add('ll-r');
      });
    });
  }
  // Kort på samme rad (samme forelder, samme topp) kommer inn samtidig
  function rowOf(el) {
    var p = el.parentElement, top = el.getBoundingClientRect().top;
    var row = p ? [].filter.call(p.children, function (c) {
      return c.__llr && !c.__lls && Math.abs(c.getBoundingClientRect().top - top) < 8;
    }) : [];
    return row.length > 1 ? row : [el];
  }
  // Klar = alle bildene i enheten er lastet (maks READY_TIMEOUT)
  var READY_TIMEOUT = 2500;
  // Kort utenfor skjermen sideveis (karuseller) lastes lazy først når man blar – ikke vent på dem
  function onScreenX(e) { var r = e.getBoundingClientRect(); return r.right > 0 && r.left < window.innerWidth; }
  // Sjekker på nytt hver 100 ms – Vue kan bytte ut <img>-noder underveis, så load-lyttere er ikke nok
  function whenReady(els, cb) {
    var start = performance.now();
    (function check() {
      var pending = els.filter(onScreenX).some(function (e) {
        if (e.tagName === 'IMG' && !e.complete) return true;
        return [].some.call(e.querySelectorAll('img'), function (i) { return !i.complete; });
      });
      if (!pending || performance.now() - start > READY_TIMEOUT) cb();
      else setTimeout(check, 100);
    })();
  }
  function show(els) {
    var now = performance.now();
    var at = Math.min(Math.max(now, nextSlot), now + MAX_DELAY);
    nextSlot = at + STEP;
    var delay = Math.round(at - now) + 'ms';
    var isRow = els.length > 1;
    els.forEach(function (el) {
      var hs = [].slice.call(el.querySelectorAll('.ll-h'));
      if (el.classList.contains('ll-h')) hs.push(el);
      if (isRow) el.classList.add('ll-row');
      [el].concat(hs).forEach(function (n) { n.style.transitionDelay = delay; });
      // en frame så .ll-row sin startposisjon er på plass før overgangen
      requestAnimationFrame(function () { [el].concat(hs).forEach(function (n) { n.classList.add('ll-in'); }); });
    });
  }
  function startReveal() {
    nextSlot = performance.now() + 200; // logoen først
    var els = document.querySelectorAll('.ll-r');
    var io = 'IntersectionObserver' in window && new IntersectionObserver(function (entries) {
      entries.filter(function (e) { return e.isIntersecting; })
        .map(function (e) { return e.target; })
        .sort(function (a, b) {
          var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          return (ra.top - rb.top) || (ra.left - rb.left);
        })
        .forEach(function (el) {
          if (el.__lls) return;
          var group = rowOf(el);
          group.forEach(function (g) { g.__lls = 1; io.unobserve(g); });
          whenReady(group, function () { show(group); });
        });
    }, { rootMargin: '0px 0px -5% 0px' });
    if (!io) { els.forEach(function (el) { show([el]); }); return; }
    els.forEach(function (el) { io.observe(el); });
  }

  /* --- delayed header: logo → navnetrekk ved scroll, blir stående litt, glir så opp --- */
  var HDR_COMPACT = 10, HDR_HOLD = 240;
  function setupHeader() {
    var hdr = document.querySelector('.header-menu-new > .header');
    if (!hdr) return;
    html.style.setProperty('--ll-hdr-h', hdr.offsetHeight + 'px');
    var logoA = document.querySelector('.header__logo a');
    var foot = document.querySelector('.footer-new__logo svg');
    if (logoA && foot) {
      // Utenfor Vue-treet (ellers hydration mismatch), plassert oppå logoen
      var wm = foot.cloneNode(true);
      wm.classList.add('ll-wordmark');
      wm.setAttribute('aria-hidden', 'true');
      document.body.appendChild(wm);
      var place = function () {
        var r = logoA.getBoundingClientRect();
        html.style.setProperty('--ll-wm-top', r.top + 'px');
        html.style.setProperty('--ll-wm-left', r.left + 'px');
      };
      place();
      window.addEventListener('resize', place);
    }
    function onScroll() {
      var y = Math.max(0, window.scrollY);
      html.classList.toggle('ll-hdr-compact', y > HDR_COMPACT);
      html.classList.toggle('ll-hdr-hidden', y > HDR_HOLD);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  if (loader === 'title' || loader === 'reveal') {
    // Ikke vent på alle bildene: vis siden når HTML-en er klar og den variable fonten er lastet.
    document.addEventListener('DOMContentLoaded', function () {
      if (loader === 'reveal') setupReveal();
      var f = document.fonts ? document.fonts.load('300 1em "MuseetSansVF-lab"') : Promise.resolve();
      var timeout = new Promise(function (r) { setTimeout(r, 3000); });
      Promise.race([f, timeout]).then(function () { requestAnimationFrame(function () { requestAnimationFrame(done); }); });
    });
  } else {
    window.addEventListener('load', done);
  }

  /* --- bilde-effekter --- */
  function track(im) {
    if (im.__ll) return; im.__ll = 1;
    im.classList.add('ll-img');
    var ok = function () { im.classList.add('ll-loaded'); };
    if (im.complete && im.naturalWidth) ok();
    else { im.addEventListener('load', ok); im.addEventListener('error', ok); }
  }
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.tagName === 'IMG') track(n);
        else if (n.querySelectorAll) n.querySelectorAll('img').forEach(track);
      });
    });
  }).observe(html, { childList: true, subtree: true });

  /* --- kontrollpanel --- */
  function opt(list, cur) {
    return list.map(function (v) { return '<option' + (v === cur ? ' selected' : '') + '>' + v + '</option>'; }).join('');
  }
  function cookie(k) { var m = document.cookie.match('(?:^|; )ll_' + k + '=(\\d+)'); return m ? m[1] : '0'; }
  document.addEventListener('DOMContentLoaded', function () {
    if (header === 'delayed') setupHeader();
    document.querySelectorAll('img').forEach(track);
    var d = document.createElement('div');
    d.id = 'll-panel';
    if (store.get('min_panel', '') === '1') d.className = 'll-min';
    d.innerHTML =
      '<div class="ll-title">Loader lab <span id="ll-toggle">–</span></div>' +
      '<label>Side-loader <select id="ll-loader">' + opt(['reveal', 'title', 'spinner', 'dots', 'bar', 'fade', 'curtain', 'weight', 'none'], loader) + '</select></label>' +
      '<label>Bilder <select id="ll-img-sel">' + opt(['fade', 'blur', 'skeleton', 'none'], img) + '</select></label>' +
      '<label>Header <select id="ll-header">' + opt(['delayed', 'original'], header) + '</select></label>' +
      '<label>Min. tid (ms) <input id="ll-min" type="number" step="100" value="' + min + '"></label>' +
      '<label>Delay alt (ms) <input id="ll-delay" type="number" step="100" value="' + (q.get('delay') || cookie('delay')) + '"></label>' +
      '<label>Delay bilder (ms) <input id="ll-imgdelay" type="number" step="250" value="' + (q.get('imgdelay') || cookie('imgdelay')) + '"></label>' +
      '<button id="ll-reload">Last inn på nytt</button>' +
      '<div class="ll-time" id="ll-time">laster…</div>';
    document.body.appendChild(d);
    document.getElementById('ll-toggle').onclick = function () {
      d.classList.toggle('ll-min'); store.set('min_panel', d.classList.contains('ll-min') ? '1' : '');
    };
    document.getElementById('ll-reload').onclick = function () {
      var v = function (id) { return document.getElementById(id).value; };
      store.set('loader', v('ll-loader')); store.set('img', v('ll-img-sel')); store.set('min', v('ll-min'));
      store.set('header', v('ll-header'));
      var u = new URL(location.href);
      ['loader', 'img', 'min', 'header'].forEach(function (k) { u.searchParams.delete(k); });
      u.searchParams.set('delay', v('ll-delay') || '0');
      u.searchParams.set('imgdelay', v('ll-imgdelay') || '0');
      location.href = u.toString();
    };
  });
})();
