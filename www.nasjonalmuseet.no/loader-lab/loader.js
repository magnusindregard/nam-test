/* Loader lab – lastes synkront i <head> så loaderen vises før resten av siden.
   URL-parametre:
     ?loader=reveal|title|spinner|dots|bar|fade|curtain|weight|none   (side-loader)
     ?img=fade|blur|skeleton|none                  (bilde-effekt)
     ?hover=zoom|tilt|tight|none                   (hover på kort)
     ?menu= ?sticky= ?grow= ?btnw= ?navw=  on|off  (meny-animasjon, sticky tittel/nav og voksende bilde
                                                    på utstillingsside, vekt ved hover på knapper/nav)
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

  var hover = store.get('hover', 'zoom');
  html.classList.add('ll-loading', 'll-loader-' + loader, 'll-img-' + img, 'll-hover-' + hover);

  /* --- av/på-valg som virker live (klasse på <html>) --- */
  var TOGGLES = [
    ['Meny-animasjon', 'menu', 'll-menu-anim'],
    ['Sticky tittel/nav', 'sticky', 'll-sticky'],
    ['Bilde vokser', 'grow', 'll-grow'],
    ['Knapper: vekt ved hover', 'btnw', 'll-btn-wght'],
    ['Nav: vekt ved hover', 'navw', 'll-nav-wght']
  ];
  function isOn(t) { var v = store.get(t[1], 'on'); return v !== 'off' && v !== 'none'; }
  TOGGLES.forEach(function (t) { html.classList.toggle(t[2], isOn(t)); });

  /* --- justerbare CSS-variabler (endres live fra panelet, huskes i localStorage) --- */
  var VARS = [
    ['Overskrift', 'Vekt fra', '--ll-h-from', 300, 10, ''],
    ['Overskrift', 'Vekt-tid (ms)', '--ll-h-duration', 1000, 100, 'ms'],
    ['Meny', 'Steg (ms)', '--ll-menu-step', 25, 5, 'ms'],
    ['Meny', 'Fade (ms)', '--ll-menu-dur', 250, 50, 'ms'],
    ['Meny', 'Vekt-tid (ms)', '--ll-menu-wght-dur', 900, 100, 'ms'],
    ['Hover', 'Zoom', '--ll-zoom', 1.05, 0.01, ''],
    ['Hover', 'Zoom-tid (ms)', '--ll-zoom-dur', 450, 50, 'ms'],
    ['Hover', 'Vekt-tid (ms)', '--ll-hw-dur', 250, 50, 'ms'],
    ['Sticky', 'Nav fader over (px)', '--ll-nav-fade', 200, 25, 'px'],
    ['Sticky', 'Slipp ved (% av bildet)', '--ll-sticky-stop', 50, 5, '']
  ];
  function varVal(v) { return store.get('v' + v[2], String(v[3])); }
  VARS.forEach(function (v) { html.style.setProperty(v[2], varVal(v) + v[5]); });
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

  /* --- reveal: blokker toner inn én etter én nedover når de kommer til syne ---
     Rekkefølge: logo (0) → tittel (+200) → meny (+MENU_DELAY) → ingress (tittel + AFTER_TITLE) → resten */
  var STEP = 80, MAX_DELAY = 600, nextSlot = 0;
  var MENU_DELAY = 400, AFTER_TITLE = 300;
  var io = null, revealStarted = false;
  function bgOf(el) {
    for (; el; el = el.parentElement) {
      var c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'transparent' && !/,\s*0\)$/.test(c)) return c;
    }
    return '#fff';
  }
  var ROOTS = 'main'; // footeren vises som vanlig
  var SEL = 'h1, h2, h3, h4, p, li, .ulc-item, figure, picture, img, form, .search-input, a, button, .hero__type-tag';
  // Står over tittelen, men skal inn rett etter at tittelen er på plass (ikke i vanlig topp-til-bunn-rekkefølge)
  var AFTER_TITLE_SEL = '.hero__type-tag';
  // Tagger blokkene i root (ytterste treff vinner, så et kort toner inn som én enhet). Returnerer de nye.
  function tag(root) {
    var added = [];
    var hs = [].slice.call(root.querySelectorAll('h1, h2, h3, h4'));
    if (root.matches && root.matches('h1, h2, h3, h4')) hs.push(root);
    // Overskrifter: husk faktisk vekt, start på --ll-h-from.
    // Ligger hele teksten i en lenke/span (som hero-tittelen på forsiden), er det den som har vekten.
    hs.forEach(function (h) {
      if (h.classList.contains('ll-h')) return;
      var inner = h.querySelector('a, span');
      var src = inner && inner.textContent.trim() === h.textContent.trim() ? inner : h;
      h.style.setProperty('--ll-w', getComputedStyle(src).fontWeight);
      h.classList.add('ll-h');
    });
    var els = [].slice.call(root.querySelectorAll(SEL));
    if (root.matches && root.matches(SEL)) els.unshift(root);
    els.forEach(function (el) {
      for (var a = el; a && a !== document.body; a = a.parentElement) if (a.__llr) return;
      el.__llr = 1;
      el.classList.add('ll-r');
      if (el.matches(AFTER_TITLE_SEL)) { el.classList.add('ll-after'); return; }
      added.push(el);
    });
    return added;
  }
  var lateObserver;
  function setupReveal() {
    var logo = document.querySelector('.header__logo');
    if (logo) html.style.setProperty('--ll-logo-bg', bgOf(logo));
    document.querySelectorAll(ROOTS).forEach(tag);
    // Menypunktene i toppen: egen tur, kun fade (ikke via IntersectionObserver)
    document.querySelectorAll('.header__nav-item').forEach(function (el) { el.classList.add('ll-r'); });
    // Innhold Vue tegner senere (API-data, byttede noder) skal også inn i rekkefølgen, ikke bare dukke opp
    lateObserver = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1 || !n.closest(ROOTS)) return;
          // Før start plukkes de opp av startReveal; etterpå går de via observeren som resten
          var added = tag(n);
          if (revealStarted) added.forEach(function (el) { if (io) io.observe(el); else show([el]); });
        });
      });
    });
    lateObserver.observe(document.body, { childList: true, subtree: true });
  }
  function showMenu() {
    document.querySelectorAll('.header__nav-item').forEach(function (el) {
      el.style.transitionDelay = MENU_DELAY + 'ms';
      requestAnimationFrame(function () { el.classList.add('ll-in'); });
    });
  }
  // Vue hydrerer og bytter ut noder (f.eks. ingressen, som er v-html). Noen sider hydrerer på
  // 'readyforssr' etter DOMContentLoaded, andre synkront i HTML-en. Vent til hydreringen er i gang
  // og DOM-en har vært rolig en stund, så klassene ikke forsvinner.
  var hydrated = new Promise(function (resolve) {
    var QUIET = 80, CAP = 600, started;
    function settle() {
      if (started) return; started = 1;
      var t;
      var mo = new MutationObserver(function () { clearTimeout(t); t = setTimeout(finish, QUIET); });
      function finish() { mo.disconnect(); resolve(); }
      mo.observe(document.body, { childList: true, subtree: true });
      t = setTimeout(finish, QUIET);
      setTimeout(finish, CAP);
    }
    window.addEventListener('readyforssr', settle, { once: true });
    document.addEventListener('DOMContentLoaded', function () {
      var roots = document.querySelectorAll('[id^="vue_"]');
      if (roots.length && [].every.call(roots, function (r) { return r.__vue_app__; })) settle();
    });
  });
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
    // Etter sidetittelen: lengre pause, så tittelen rekker å komme i gang før ingressen
    var isTitle = els.some(function (el) { return el.tagName === 'H1' || el.querySelector('h1'); });
    if (isTitle) nextSlot = at + AFTER_TITLE;
    els.forEach(function (el) {
      var hs = [].slice.call(el.querySelectorAll('.ll-h'));
      if (el.classList.contains('ll-h')) hs.push(el);
      if (isRow) el.classList.add('ll-row');
      [el].concat(hs).forEach(function (n) { n.style.transitionDelay = delay; });
      // en frame så .ll-row sin startposisjon er på plass før overgangen
      requestAnimationFrame(function () { [el].concat(hs).forEach(function (n) { n.classList.add('ll-in'); }); });
    });
    if (isTitle) {
      var after = [].filter.call(document.querySelectorAll('.ll-after'), function (a) { return !a.__lls; });
      after.forEach(function (a) { a.__lls = 1; });
      if (after.length) show(after);
    }
  }
  function startReveal() {
    nextSlot = performance.now() + 200; // logoen først
    revealStarted = true;
    showMenu();
    var els = document.querySelectorAll('.ll-r:not(.header__nav-item):not(.ll-after)');
    io = 'IntersectionObserver' in window && new IntersectionObserver(function (entries) {
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

  if (loader === 'title' || loader === 'reveal') {
    // Ikke vent på alle bildene: vis siden når HTML-en er klar og den variable fonten er lastet.
    document.addEventListener('DOMContentLoaded', function () {
      var f = document.fonts ? document.fonts.load('300 1em "MuseetSansVF-lab"') : Promise.resolve();
      var ready = loader === 'reveal' ? Promise.all([f, hydrated]) : f;
      var timeout = new Promise(function (r) { setTimeout(r, 3000); });
      Promise.race([ready, timeout]).then(function () {
        if (loader === 'reveal') setupReveal();
        requestAnimationFrame(function () { requestAnimationFrame(done); });
      });
    });
  } else {
    window.addEventListener('load', done);
  }

  /* --- meny: rask fade fra topp til bunn, store titler går fra tynn til sin vekt ---
     Vue lager menyen (og undermenyene) på nytt hver gang den åpnes, så CSS-animasjonene spilles av hver gang.
     Her får hvert punkt rekkefølgen sin (--ll-i) etter plassering på skjermen. */
  var MENU_ITEMS = '.menu__small-list li, .menu__opening-hours > *, .menu__large li, .menu__sublevel li';
  function tagMenu(root) {
    var items = [].filter.call(root.querySelectorAll(MENU_ITEMS), function (el) { return !el.__llm; });
    if (!items.length) return;
    items.map(function (el) { return { el: el, r: el.getBoundingClientRect() }; })
      .sort(function (a, b) { return (a.r.top - b.r.top) || (a.r.left - b.r.left); })
      .forEach(function (o, i) {
        o.el.__llm = 1;
        o.el.style.setProperty('--ll-i', i);
        o.el.classList.add('ll-mi');
        var t = o.el.querySelector('.menu__large-item > span');
        if (t) { t.style.setProperty('--ll-w', getComputedStyle(t).fontWeight); t.classList.add('ll-mt'); }
      });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var host = document.querySelector('.menu-new');
    if (!host) return;
    var pending;
    new MutationObserver(function () {
      // vent én frame så punktene har fått plassen sin før de sorteres
      if (pending) return;
      pending = requestAnimationFrame(function () { pending = 0; tagMenu(host); });
    }).observe(host, { childList: true, subtree: true });
  });

  /* --- utstillingsside: tittelen står stille der den lastes til midten av den er --ll-sticky-stop % ned på bildet ---
     Sticky slipper når tittelens margin-boks treffer bunnen av forelderen. Vi gir tittelen en stor
     margin-bottom og trekker bildet like mye opp igjen, så oppsettet er uendret, men slippet skjer
     på rett sted i bildet.
     Nav og logo står også stille og fader ut (CSS, scroll-drevet).
     Bilde vokser: fra man begynner å scrolle til bildet når toppen av skjermen, skaleres det opp til det
     dekker hele viewporten. Bildeteksten skyves ned like mye, og plassen er reservert under bildet. */
  var stickyUpdate = function () {};
  function setupSticky() {
    var hc = document.querySelector('.event-page .hero__heading-container');
    var media = hc && hc.parentElement.querySelector('.hero__media');
    if (!media) return;
    var parent = hc.parentElement;
    var pic = media.querySelector('.responsive-image__image') || media;
    var hr = hc.getBoundingClientRect();
    var gap = media.getBoundingClientRect().top - hr.bottom;
    // Står der den er når siden er scrollet helt opp (avstanden fra toppen av dokumentet)
    hc.style.setProperty('--ll-sticky-top', Math.round(hr.top + window.scrollY) + 'px');
    html.classList.add('ll-event');
    stickyUpdate = function () {
      // Bilde vokser – mål uten skalering (offsetWidth/-Height og forelderens posisjon påvirkes ikke av den)
      var vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var mr0 = media.getBoundingClientRect();
      var s = Math.max(vw / pic.offsetWidth, vh / pic.offsetHeight, 1);
      html.style.setProperty('--ll-grow-end', Math.max(1, Math.round(mr0.top + window.scrollY)) + 'px');
      html.style.setProperty('--ll-grow-scale', s.toFixed(4));
      html.style.setProperty('--ll-grow-extra', Math.round(pic.offsetHeight * (s - 1)) + 'px');
      pic.style.transformOrigin = Math.round(vw / 2 - mr0.left) + 'px 0';

      var on = html.classList.contains('ll-sticky');
      if (!on) { hc.style.marginBottom = media.style.marginTop = ''; return; }
      var stop = (parseFloat(getComputedStyle(html).getPropertyValue('--ll-sticky-stop')) || 50) / 100;
      var pr = parent.getBoundingClientRect(), mr = media.getBoundingClientRect();
      var bottom = pr.bottom - parseFloat(getComputedStyle(parent).paddingBottom);
      var mb = Math.max(0, bottom - (mr.top + stop * mr.height) - hc.offsetHeight / 2);
      hc.style.marginBottom = mb + 'px';
      media.style.marginTop = (gap - mb) + 'px';
    };
    hc.classList.add('ll-sticky-h');
    stickyUpdate();
    if ('ResizeObserver' in window) new ResizeObserver(function () { stickyUpdate(); }).observe(media);
    window.addEventListener('resize', function () { stickyUpdate(); });
  }
  document.addEventListener('DOMContentLoaded', function () { hydrated.then(setupSticky); });

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
    document.querySelectorAll('img').forEach(track);
    var d = document.createElement('div');
    d.id = 'll-panel';
    if (store.get('min_panel', '') === '1') d.className = 'll-min';
    d.innerHTML =
      '<div class="ll-title">Loader lab <span id="ll-toggle">–</span></div>' +
      '<label>Side-loader <select id="ll-loader">' + opt(['reveal', 'title', 'spinner', 'dots', 'bar', 'fade', 'curtain', 'weight', 'none'], loader) + '</select></label>' +
      '<label>Bilder <select id="ll-img-sel">' + opt(['fade', 'blur', 'skeleton', 'none'], img) + '</select></label>' +
      '<label>Hover <select id="ll-hover">' + opt(['zoom', 'tilt', 'tight', 'none'], hover) + '</select></label>' +
      '<label>Min. tid (ms) <input id="ll-min" type="number" step="100" value="' + min + '"></label>' +
      '<label>Delay alt (ms) <input id="ll-delay" type="number" step="100" value="' + (q.get('delay') || cookie('delay')) + '"></label>' +
      '<label>Delay bilder (ms) <input id="ll-imgdelay" type="number" step="250" value="' + (q.get('imgdelay') || cookie('imgdelay')) + '"></label>' +
      '<button id="ll-reload">Last inn på nytt</button>' +
      '<div class="ll-sec">Live <span id="ll-reset">nullstill</span></div>' +
      TOGGLES.map(function (t, i) {
        return '<label>' + t[0] + ' <select data-toggle="' + i + '">' + opt(['on', 'off'], isOn(t) ? 'on' : 'off') + '</select></label>';
      }).join('') +
      VARS.map(function (v, i) {
        var head = i === 0 || VARS[i - 1][0] !== v[0] ? '<div class="ll-sub">' + v[0] + '</div>' : '';
        return head + '<label>' + v[1] + ' <input data-var="' + i + '" type="number" step="' + v[4] + '" value="' + varVal(v) + '"></label>';
      }).join('') +
      '<div class="ll-time" id="ll-time">laster…</div>';
    document.body.appendChild(d);
    // Live-endringer: ingen omlasting
    d.querySelectorAll('[data-var]').forEach(function (inp) {
      inp.oninput = function () {
        var v = VARS[inp.dataset.var];
        html.style.setProperty(v[2], inp.value + v[5]);
        store.set('v' + v[2], inp.value);
        if (v[2] === '--ll-sticky-stop') stickyUpdate();
      };
    });
    document.getElementById('ll-reset').onclick = function () {
      d.querySelectorAll('[data-var]').forEach(function (inp) {
        var v = VARS[inp.dataset.var];
        inp.value = v[3];
        html.style.setProperty(v[2], v[3] + v[5]);
        try { localStorage.removeItem('ll2_v' + v[2]); } catch (e) {}
      });
      stickyUpdate();
    };
    d.querySelectorAll('[data-toggle]').forEach(function (sel) {
      sel.onchange = function () {
        var t = TOGGLES[sel.dataset.toggle];
        store.set(t[1], sel.value);
        html.classList.toggle(t[2], sel.value === 'on');
        stickyUpdate();
      };
    });
    document.getElementById('ll-toggle').onclick = function () {
      d.classList.toggle('ll-min'); store.set('min_panel', d.classList.contains('ll-min') ? '1' : '');
    };
    document.getElementById('ll-reload').onclick = function () {
      var v = function (id) { return document.getElementById(id).value; };
      store.set('loader', v('ll-loader')); store.set('img', v('ll-img-sel')); store.set('min', v('ll-min'));
      store.set('hover', v('ll-hover'));
      var u = new URL(location.href);
      ['loader', 'img', 'min', 'hover'].forEach(function (k) { u.searchParams.delete(k); });
      u.searchParams.set('delay', v('ll-delay') || '0');
      u.searchParams.set('imgdelay', v('ll-imgdelay') || '0');
      location.href = u.toString();
    };
  });
})();
