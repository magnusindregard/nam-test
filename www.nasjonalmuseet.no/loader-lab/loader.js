/* Loader lab – lastes synkront i <head> så loaderen vises før resten av siden.
   URL-parametre:
     ?loader=reveal|title|spinner|dots|bar|fade|curtain|weight|none   (side-loader)
     ?img=fade|blur|skeleton|none                  (bilde-effekt)
     ?hover=zoom|tilt|tight|none                   (hover på kort)
     ?menu= ?sticky= ?grow= ?arrowbtn= ?parallax=  on|off
                                                   (meny-animasjon, sticky tittel/nav og voksende bilde på
                                                    utstillingsside, pil-lenke som knapp, parallax på promo-bilder)
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
    ['Pil-lenke som knapp', 'arrowbtn', 'll-arrow-btn'],
    ['Parallax på promo-bilder', 'parallax', 'll-parallax'],
    ['Mørk bakgrunn ovenfra', 'wipe', 'll-wipe-on'],
    ['Stort bilde/video: zoom + ramme', 'heroimg', 'll-hero-img'],
    ['Knapper: pil ved hover', 'btnarrow', 'll-btn-arrow-on'],
    ['Lister/meny: vekt ved hover', 'listw', 'll-list-wght'],
    ['Meny-bakgrunn ovenfra', 'menuwipe', 'll-menu-wipe']
  ];
  function isOn(t) { var v = store.get(t[1], 'on'); return v !== 'off' && v !== 'none'; }
  TOGGLES.forEach(function (t) { html.classList.toggle(t[2], isOn(t)); });

  /* --- justerbare CSS-variabler (endres live fra panelet, huskes i localStorage) --- */
  var VARS = [
    ['Innlasting', 'Start (ms)', '--ll-start', 500, 50, 'ms'],
    ['Innlasting', 'Steg per linje (ms)', '--ll-step', 120, 10, 'ms'],
    ['Innlasting', 'Steg per kort (ms)', '--ll-row-step', 90, 10, 'ms'],
    ['Innlasting', 'Vertikal bevegelse (px)', '--ll-shift', 10, 2, 'px'],
    ['Innlasting', 'Liste-rader spredt (px)', '--ll-spread', 40, 5, 'px'],
    ['Innlasting', 'Linjer hvit → grå (ms)', '--ll-line-dur', 1200, 100, 'ms'],
    ['Overskrift', 'Vekt fra', '--ll-h-from', 300, 10, ''],
    ['Overskrift', 'Vekt-tid (ms)', '--ll-h-duration', 1000, 100, 'ms'],
    ['Overskrift', 'Min. str. (px, last på nytt)', '--ll-h-min', 28, 2, 'px'],
    ['Meny', 'Steg (ms)', '--ll-menu-step', 25, 5, 'ms'],
    ['Meny', 'Fade (ms)', '--ll-menu-dur', 250, 50, 'ms'],
    ['Meny', 'Vekt-tid (ms)', '--ll-menu-wght-dur', 900, 100, 'ms'],
    ['Meny', 'Bakgrunn (ms)', '--ll-menu-wipe-dur', 500, 50, 'ms'],
    ['Hover', 'Zoom', '--ll-zoom', 1.05, 0.01, ''],
    ['Hover', 'Zoom-tid (ms)', '--ll-zoom-dur', 450, 50, 'ms'],
    ['Hover', 'Vekt-tid lister (ms)', '--ll-hw-dur', 300, 50, 'ms'],
    ['Hover', 'Pil-knapp fade (ms)', '--ll-pill-dur', 150, 25, 'ms'],
    ['Hover', 'Pil sprett (px)', '--ll-arrow-shift', 4, 1, 'px'],
    ['Hover', 'Pil avstand (px)', '--ll-arrow-gap', 12, 1, 'px'],
    ['Parallax', 'Styrke (%)', '--ll-parallax', 25, 1, ''],
    ['Bakgrunn', 'Ovenfra-tid (ms)', '--ll-wipe-dur', 700, 50, 'ms'],
    ['Stort bilde', 'Zoom fra', '--ll-hero-zoom', 1.15, 0.01, ''],
    ['Stort bilde', 'Ramme fra (% inn)', '--ll-hero-inset', 6, 1, ''],
    ['Stort bilde', 'Tid (ms)', '--ll-hero-dur', 1400, 100, 'ms'],
    ['Sticky', 'Fader ved (% av bildet)', '--ll-sticky-stop', 60, 5, ''],
    ['Sticky', 'Fade-lengde (px scroll)', '--ll-fade-len', 100, 25, 'px']
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
  // Steg/start leses fra panelet (--ll-step, --ll-row-step, --ll-start). MAX_DELAY: lengste kø før noe vises.
  var MAX_DELAY = 2500, nextSlot = 0;
  function num(k) { for (var i = 0; i < VARS.length; i++) if (VARS[i][2] === k) return parseFloat(varVal(VARS[i])) || 0; return 0; }
  var MENU_DELAY = 400, AFTER_TITLE = 300;
  var io = null, revealStarted = false;
  function bgOf(el) {
    for (; el; el = el.parentElement) {
      var c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(c)) return c;
    }
    return '#fff';
  }
  var ROOTS = 'main'; // footeren vises som vanlig
  var SEL = 'h1, h2, h3, h4, p, li, .ulc-item, .category-list-block__item, figure, picture, img, form, .search-input, a, button, .hero__type-tag';
  // Enheter med mange små bilder: vent ikke på bildene (de toner inn selv), og la radene starte spredt og gli sammen
  var NO_WAIT_SEL = '.category-list-block__item', SPREAD_SEL = '.category-list-block__item';
  // Står over tittelen, men skal inn rett etter at tittelen er på plass (ikke i vanlig topp-til-bunn-rekkefølge)
  var AFTER_TITLE_SEL = '.hero__type-tag';
  function isBlock(el) {
    if (el.matches(SEL)) return true;
    if (el.closest('svg') || /^(SCRIPT|STYLE|SOURCE|BR|TEMPLATE)$/.test(el.tagName)) return false;
    if ([].some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); })) return true;
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!r.height || r.height > 150 || r.width > window.innerWidth * 0.8) return false;
    var bg = cs.backgroundColor, hasBg = bg !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(bg);
    return hasBg || (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none');
  }
  // Tagger blokkene i root (ytterste treff vinner, så et kort toner inn som én enhet). Returnerer de nye.
  function tag(root) {
    var added = [];
    var hs = [].slice.call(root.querySelectorAll('h1, h2, h3, h4'));
    if (root.matches && root.matches('h1, h2, h3, h4')) hs.push(root);
    // Overskrifter: husk faktisk vekt, start på --ll-h-from. Små overskrifter (under --ll-h-min) bare toner inn.
    // Ligger hele teksten i en lenke/span (som hero-tittelen på forsiden), er det den som har vekten.
    var hMin = num('--ll-h-min');
    hs.forEach(function (h) {
      if (h.classList.contains('ll-h') || parseFloat(getComputedStyle(h).fontSize) < hMin) return;
      var inner = h.querySelector('a, span');
      var src = inner && inner.textContent.trim() === h.textContent.trim() ? inner : h;
      h.style.setProperty('--ll-w', getComputedStyle(src).fontWeight);
      h.classList.add('ll-h');
      lockLines(h);
    });
    // Alt innhold: SEL, elementer med egen tekst, og små brikker med egen bakgrunn/ramme (etiketter, merker).
    // Dokumentrekkefølge, så ytterste treff vinner.
    var els = [].filter.call(root.querySelectorAll('*'), isBlock);
    if (root.matches && isBlock(root)) els.unshift(root);
    els.forEach(function (el) {
      for (var a = el; a && a !== document.body; a = a.parentElement) if (a.__llr) return;
      el.__llr = 1;
      el.classList.add('ll-r');
      if (el.matches(AFTER_TITLE_SEL)) { el.classList.add('ll-after'); return; }
      if (el.matches(SPREAD_SEL)) {
        // Linjene (rammene) går fra bakgrunnsfargen til sin egen farge (les før .ll-spread endrer den)
        el.style.setProperty('--ll-line-c', getComputedStyle(el).borderTopColor);
        el.style.setProperty('--ll-line-from', bgOf(el.parentElement));
        el.classList.add('ll-spread');
        el.style.setProperty('--ll-si', [].indexOf.call(el.parentElement.children, el));
      }
      // Avsnitt kommer inn linje for linje
      if (el.tagName === 'P' && el.textContent.trim() && !el.querySelector('.button')) { el.__llWords = wrapWords(el, 'll-wd'); el.classList.add('ll-lines'); }
      added.push(el);
    });
    return added;
  }
  // Lås linjeskiftene i en overskrift slik de blir ved full vekt (den bredeste den animeres til),
  // så teksten ikke hopper mellom én og to linjer når vekten endres. Gjøres på nytt ved resize.
  // Pakker hvert ord i en <span> (struktur som lenker beholdes). Returnerer spanene.
  function wrapWords(el, cls) {
    var words = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(function (t) {
      var parts = t.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
      parts.forEach(function (w) {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
        var s = document.createElement('span'); s.textContent = w; if (cls) s.className = cls;
        frag.appendChild(s); words.push(s);
      });
      t.parentNode.replaceChild(frag, t);
    });
    return words;
  }
  // Grupperer ord-spans i linjer etter plassering på skjermen
  function linesOf(words) {
    var lines = [], prev = null;
    words.forEach(function (w) {
      var top = w.getBoundingClientRect().top;
      if (prev == null || top > prev + 2) lines.push([]);
      lines[lines.length - 1].push(w);
      prev = top;
    });
    return lines;
  }
  var locked = [];
  function lockLines(h) {
    if (h.__llOrig == null) { h.__llOrig = h.innerHTML; locked.push(h); }
    else h.innerHTML = h.__llOrig;
    var words = wrapWords(h);
    // Mål ved full vekt uten overgang (inline !important slår stilarkets !important)
    h.style.setProperty('transition', 'none', 'important');
    h.style.setProperty('font-weight', getComputedStyle(h).getPropertyValue('--ll-w') || '500', 'important');
    var prev = null;
    words.forEach(function (s) {
      var top = s.getBoundingClientRect().top;
      if (prev != null && top > prev + 2) s.parentNode.insertBefore(document.createElement('br'), s);
      prev = top;
    });
    h.style.whiteSpace = 'nowrap';
    h.style.removeProperty('font-weight');
    getComputedStyle(h).fontWeight; // ta i bruk vekten igjen før overgangen kommer tilbake
    h.style.removeProperty('transition');
  }
  var relockT;
  window.addEventListener('resize', function () {
    clearTimeout(relockT);
    relockT = setTimeout(function () {
      locked.forEach(function (h) { h.style.whiteSpace = ''; lockLines(h); });
    }, 150);
  });

  // Når en overskrift har nådd vekten sin: merk den, så vekt-endringer etterpå (scroll) ikke glattes av overgangen
  document.addEventListener('transitionend', function (e) {
    if (e.propertyName === 'font-weight' && e.target.classList && e.target.classList.contains('ll-h')) e.target.classList.add('ll-h-done');
  });
  var lateObserver;
  // Forsidens «Planlegg ditt besøk →» bygges om til samme komponent som «Se alle …»-lenkene (hvit utgave på video)
  var LONG_ARROW = '<svg class="arrow__animation" viewBox="0 0 31 12" fill="none" aria-hidden="true"><path d="M0 5.33333L28.4167 5.33333L23.25 0L25.1875 0L31 6L25.1875 12H23.25L28.4167 6.66667L0 6.66667L0 5.33333Z" fill="currentColor"/></svg>';
  function convertLinks() {
    document.querySelectorAll('.block-banner__item-text a').forEach(function (a) {
      if (a.__llc || a.classList.contains('button')) return;
      a.__llc = 1;
      var text = a.textContent.trim();
      a.className += ' button button--theme-arrow__inverted button--size-compact button--font-weight-medium';
      a.innerHTML = '<span class="button__text"></span><span class="button--theme-arrow__inverted">' + LONG_ARROW + '</span>';
      a.firstChild.textContent = text;
    });
    // Hover/fokus på hero-tittelen gir knappen under hover-tilstand
    document.querySelectorAll('.block-banner__item').forEach(function (item) {
      var title = item.querySelector('h1 a'), btn = item.querySelector('.block-banner__item-text a');
      if (!title || !btn || title.__llh) return;
      title.__llh = 1;
      var on = function () { btn.classList.add('ll-hover'); }, off = function () { btn.classList.remove('ll-hover'); };
      title.addEventListener('mouseenter', on); title.addEventListener('mouseleave', off);
      title.addEventListener('focus', on); title.addEventListener('blur', off);
    });
  }
  document.addEventListener('DOMContentLoaded', function () { hydrated.then(convertLinks); });
  function setupReveal() {
    convertLinks();
    var logo = document.querySelector('.header__logo');
    if (logo) html.style.setProperty('--ll-logo-bg', bgOf(logo));
    setupWipe();
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
      var pending = els.filter(onScreenX).filter(function (e) { return !e.matches(NO_WAIT_SEL); }).some(function (e) {
        if (e.tagName === 'IMG' && !e.complete) return true;
        return [].some.call(e.querySelectorAll('img'), function (i) { return !i.complete; });
      });
      if (!pending || performance.now() - start > READY_TIMEOUT) cb();
      else setTimeout(check, 100);
    })();
  }
  // Neste ledige tidspunkt i køen (ms fra nå), og flytt køen et steg fram
  function slot(step) {
    var now = performance.now();
    var at = Math.min(Math.max(now, nextSlot), now + MAX_DELAY);
    nextSlot = at + step;
    return Math.round(at - now);
  }
  // Det som står i kø (ikke startet ennå). Ligger ingenting av det på skjermen lenger (man har scrollet
  // forbi), skal nytt innhold ikke vente bak det.
  var queued = [];
  function skipStaleQueue() {
    var now = performance.now();
    queued = queued.filter(function (q) { return q.at > now; });
    var visible = queued.some(function (q) {
      return q.nodes.some(function (n) { var r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; });
    });
    if (!visible) { queued = []; nextSlot = Math.min(nextSlot, now); }
  }
  function reveal(nodes, delay) {
    if (delay > 0) queued.push({ nodes: nodes, at: performance.now() + delay });
    nodes.forEach(function (n) { n.style.transitionDelay = delay + 'ms'; });
    // en frame så .ll-row sin startposisjon er på plass før overgangen
    requestAnimationFrame(function () { nodes.forEach(function (n) { n.classList.add('ll-in'); }); });
  }
  function show(els) {
    var step = num('--ll-step'), rowStep = num('--ll-row-step');
    var isRow = els.length > 1;
    // Kort på samme rad: ett og ett, venstre først
    if (isRow) els = els.slice().sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
    var isTitle = false;
    els.forEach(function (el, i) {
      var hs = [].slice.call(el.querySelectorAll('.ll-h'));
      if (el.classList.contains('ll-h')) hs.push(el);
      if (isRow) el.classList.add('ll-row');
      if (el.__llWords) {
        // Avsnitt: hver linje får sitt eget steg
        el.classList.add('ll-in');
        linesOf(el.__llWords).forEach(function (line) { reveal(line, slot(step)); });
        return;
      }
      var d = slot(isRow && i < els.length - 1 ? rowStep : step);
      reveal([el].concat(hs), d);
      // Etter sidetittelen: lengre pause, så tittelen rekker å komme i gang før ingressen
      if (el.tagName === 'H1' || el.querySelector('h1')) {
        isTitle = true;
        nextSlot = Math.max(nextSlot, performance.now() + d + AFTER_TITLE);
      }
    });
    if (isTitle) {
      var after = [].filter.call(document.querySelectorAll('.ll-after'), function (a) { return !a.__lls; });
      after.forEach(function (a) { a.__lls = 1; });
      if (after.length) show(after);
    }
  }
  /* Mørk bakgrunn ovenfra: mørke flater i første skjermbilde (header og blokker i main, ikke footer) fylles
     ovenfra og ned av én felles linje (--ll-wipe, 0 → 100vh), så de glir over i hverandre som én flate.
     Bare bakgrunnen animeres; etterpå får elementene tilbake sin egen bakgrunn. */
  var wipeEls = [];
  function isDark(c) {
    var m = c.match(/[\d.]+/g);
    if (!m || (m.length > 3 && +m[3] === 0)) return false;
    return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255 < 0.35;
  }
  function setupWipe() {
    if (!html.classList.contains('ll-wipe-on')) return;
    // .site-layout: utstillingssiden setter sort bakgrunn der (bak den gjennomsiktige sticky-headeren)
    var cands = [].slice.call(document.querySelectorAll('.site-layout, header.header, main, main > *, main > * > *, main > * > * > *, main > * > * > * > *'));
    cands.forEach(function (el) {
      var r = el.getBoundingClientRect(), c = getComputedStyle(el).backgroundColor;
      if (r.height < 40 || r.top >= window.innerHeight || !isDark(c)) return;
      el.style.setProperty('--ll-wipe-c', c);
      el.style.setProperty('--ll-top', Math.round(r.top) + 'px');
      el.classList.add('ll-wipe');
      wipeEls.push(el);
    });
    // Bilde/video-bakgrunner (forsidevideoen): klippes ovenfra og ned med samme linje – eller, med «Stort
    // bilde/video», kommer inn med ramme + zoom (.ll-hero-frame på wrapperen)
    document.querySelectorAll('.block-banner__background').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.height < 40 || r.top >= window.innerHeight) return;
      // Logoen ligger på video: ikke «spis» formen med en strek i bakgrunnsfarge, bare tone inn
      var lr = document.querySelector('.header__logo');
      lr = lr && lr.getBoundingClientRect();
      if (lr && lr.top >= r.top && lr.bottom <= r.bottom) html.classList.add('ll-logo-nostroke');
      var wrap = el.querySelector('.block-banner__background-wrapper');
      if (html.classList.contains('ll-hero-img') && wrap && !heroFrame) { heroFrame = wrap; wrap.classList.add('ll-hero-frame'); return; }
      el.style.setProperty('--ll-top', Math.round(r.top) + 'px');
      el.style.setProperty('--ll-wipe-under', bgOf(el.parentElement && el.parentElement.parentElement || document.body));
      el.classList.add('ll-wipe-media');
      wipeEls.push(el);
    });
  }
  // Logoen animeres først når bakgrunnen bak den er på plass (wipe-linjen har passert bunnen av logoen)
  function logoWhenReady() {
    var logo = document.querySelector('.header__logo');
    var under = logo && wipeEls.length && wipeEls.some(function (el) {
      var r = el.getBoundingClientRect(), l = logo.getBoundingClientRect();
      return r.top <= l.top && r.bottom >= l.bottom;
    });
    if (!under) { html.classList.add('ll-logo-go'); return; }
    var target = logo.getBoundingClientRect().bottom;
    (function check() {
      var w = parseFloat(getComputedStyle(html).getPropertyValue('--ll-wipe')) || 0;
      if (w >= target || !html.classList.contains('ll-wipe-run')) html.classList.add('ll-logo-go');
      else setTimeout(check, 50); // ikke hver frame – lesingen tvinger fram stilberegning
    })();
  }
  // Forsidevideo med ramme: logoen venter til rammen har vokst forbi den
  var heroFrame = null;
  function logoWhenFrame() {
    var logo = document.querySelector('.header__logo'), t0 = performance.now();
    (function check() {
      var f = heroFrame.getBoundingClientRect(), l = logo ? logo.getBoundingClientRect() : f;
      if ((f.left <= l.left && f.top <= l.top) || performance.now() - t0 > 3000) html.classList.add('ll-logo-go');
      else setTimeout(check, 50);
    })();
  }
  function startWipe() {
    if (heroFrame) requestAnimationFrame(function () { html.classList.add('ll-hero-go'); logoWhenFrame(); });
    if (!wipeEls.length) { if (!heroFrame) html.classList.add('ll-logo-go'); return; }
    requestAnimationFrame(logoWhenReady);
    html.addEventListener('animationend', function end(e) {
      if (e.target !== html || e.animationName !== 'll-wipe') return;
      html.removeEventListener('animationend', end);
      wipeEls.forEach(function (el) { el.classList.remove('ll-wipe', 'll-wipe-media'); });
      html.classList.remove('ll-wipe-run');
      html.classList.add('ll-logo-go');
    });
    html.classList.add('ll-wipe-run');
  }
  function startReveal() {
    startWipe();
    nextSlot = performance.now() + num('--ll-start'); // logoen først, så innholdet
    revealStarted = true;
    showMenu();
    var els = document.querySelectorAll('.ll-r:not(.header__nav-item):not(.ll-after)');
    io = 'IntersectionObserver' in window && new IntersectionObserver(function (entries) {
      skipStaleQueue();
      entries.filter(function (e) { return e.isIntersecting; })
        .map(function (e) { return e.target; })
        .sort(function (a, b) {
          var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          return (ra.top - rb.top) || (ra.left - rb.left);
        })
        .forEach(function (el) {
          if (el.__lls) return;
          // Spredte liste-rader: hele blokken etter hverandre (de nederste ligger ofte utenfor en
          // klippende forelder til de har glidd på plass, så observeren ville aldri sett dem)
          if (el.matches(SPREAD_SEL)) {
            var rows = [].filter.call(el.parentElement.children, function (c) { return c.__llr && !c.__lls && c.matches(SPREAD_SEL); });
            rows.forEach(function (g) { g.__lls = 1; io.unobserve(g); });
            rows.forEach(function (g) { show([g]); });
            return;
          }
          var group = rowOf(el);
          group.forEach(function (g) { g.__lls = 1; io.unobserve(g); });
          whenReady(group, function () { show(group); });
        });
    }, { rootMargin: '0px 0px -5% 0px' });
    if (!io) { els.forEach(function (el) { show([el]); }); return; }
    els.forEach(function (el) { io.observe(el); });
  }

  var MEDIA_WAIT = 2500;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function inFirstView(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && r.width > 0; }
  function once(el, evs) { return new Promise(function (r) { evs.forEach(function (e) { el.addEventListener(e, r, { once: true }); }); }); }
  function mediaReady() {
    var vids = [].filter.call(document.querySelectorAll('main video'), inFirstView).map(function (v) {
      return v.readyState >= 3 ? 1 : once(v, ['canplay', 'error']);
    });
    var imgs = [].filter.call(document.querySelectorAll('main img'), inFirstView).map(function (i) {
      return i.complete ? (i.decode ? i.decode().catch(function () {}) : 1) : once(i, ['load', 'error']);
    });
    return Promise.all(vids.concat(imgs));
  }
  if (loader === 'title' || loader === 'reveal') {
    // Ikke vent på alle bildene: vis siden når HTML-en er klar og den variable fonten er lastet.
    // reveal: vent også på video og bilder i første skjermbilde (maks MEDIA_WAIT), så animasjonene
    // ikke konkurrerer med lasting og dekoding.
    document.addEventListener('DOMContentLoaded', function () {
      var f = document.fonts ? document.fonts.load('300 1em "MuseetSansVF-lab"') : Promise.resolve();
      var media = hydrated.then(function () { return Promise.race([mediaReady(), wait(MEDIA_WAIT)]); });
      var ready = loader === 'reveal' ? Promise.all([f, hydrated, media]) : f;
      var timeout = wait(MEDIA_WAIT + 1500);
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

  /* --- utstillingsside: tittel (med stikktittel), nav og logo står stille der de lastes ---
     Når midten av tittelen treffer --ll-sticky-stop % ned på bildet, fader alle raskt ut samtidig over
     --ll-fade-len px scroll (CSS, scroll-drevet; start/slutt regnes ut her). Tittelen slipper uansett
     senest når bunnen av den treffer bunnen av bildet.
     Bilde vokser: fra man begynner å scrolle til bildet når toppen av skjermen, skaleres det opp til det
     dekker hele viewporten. Bildeteksten skyves ned like mye, og plassen er reservert under bildet. */
  var stickyUpdate = function () {};
  var scrollAnims = window.CSS && CSS.supports('animation-timeline: scroll()');
  function setupSticky() {
    var hc = document.querySelector('.event-page .hero__heading-container');
    var media = hc && hc.parentElement.querySelector('.hero__media');
    if (!media) return;
    var parent = hc.parentElement;
    var pic = media.querySelector('.responsive-image__image') || media;
    var hr = hc.getBoundingClientRect();
    var top0 = Math.round(hr.top + window.scrollY);
    var gap = media.getBoundingClientRect().top - hr.bottom;
    // Står der den er når siden er scrollet helt opp (avstanden fra toppen av dokumentet)
    hc.style.setProperty('--ll-sticky-top', top0 + 'px');
    // Headerens egen farge (før den gjøres gjennomsiktig) – tittelens forfedre er gjennomsiktige
    html.style.setProperty('--ll-event-bg', bgOf(document.querySelector('header.header') || hc));
    html.classList.add('ll-event');
    stickyUpdate = function () {
      // Bilde vokser – mål uten skalering (offsetWidth/-Height og forelderens posisjon påvirkes ikke av den)
      var vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var mr = media.getBoundingClientRect();
      var mediaTop = mr.top + window.scrollY, h = pic.offsetHeight;
      var s = Math.max(vw / pic.offsetWidth, vh / h, 1);
      var grow = scrollAnims && html.classList.contains('ll-grow');
      html.style.setProperty('--ll-grow-end', Math.max(1, Math.round(mediaTop)) + 'px');
      html.style.setProperty('--ll-grow-scale', s.toFixed(4));
      html.style.setProperty('--ll-grow-extra', Math.round(h * (s - 1)) + 'px');
      pic.style.transformOrigin = Math.round(vw / 2 - mr.left) + 'px 0';

      // Fade starter når midten av tittelen treffer --ll-sticky-stop % ned på bildet (bildet kan vokse underveis)
      var cs = getComputedStyle(html);
      var len = parseFloat(cs.getPropertyValue('--ll-fade-len')) || 100;
      var stop = (parseFloat(cs.getPropertyValue('--ll-sticky-stop')) || 60) / 100;
      var growEnd = Math.max(1, Math.round(mediaTop));
      var titleMid = top0 + hc.offsetHeight / 2, y = 0;
      for (; y < mediaTop + h * s; y++) {
        var sc = grow ? 1 + (s - 1) * Math.min(1, y / growEnd) : 1;
        if (mediaTop - y + stop * h * sc <= titleMid) break;
      }
      html.style.setProperty('--ll-fade-start', y + 'px');
      html.style.setProperty('--ll-fade-end', Math.round(y + len) + 'px');

      // Sticky slipper når tittelens margin-boks treffer bunnen av forelderen. Stor margin-bottom på tittelen,
      // og bildet trukket like mye opp igjen (oppsettet er uendret), så slippet skjer når bunnen av tittelen
      // treffer bunnen av bildet (ferdig vokst).
      if (!html.classList.contains('ll-sticky')) { hc.style.marginBottom = media.style.marginTop = ''; return; }
      var imgBottom = mediaTop + h * (grow ? s : 1);
      var pr = parent.getBoundingClientRect();
      var bottom = pr.bottom + window.scrollY - parseFloat(getComputedStyle(parent).paddingBottom);
      var mb = Math.max(0, Math.round(bottom - imgBottom));
      hc.style.marginBottom = mb + 'px';
      media.style.marginTop = (gap - mb) + 'px';
    };
    hc.classList.add('ll-sticky-h');
    stickyUpdate();
    if ('ResizeObserver' in window) new ResizeObserver(function () { stickyUpdate(); }).observe(media);
    window.addEventListener('resize', function () { stickyUpdate(); });
  }
  document.addEventListener('DOMContentLoaded', function () { hydrated.then(setupSticky); });

  /* --- knapper med fyll: pil etter teksten ved hover (bredden animeres i CSS) ---
     Bare knapper med tekst og uten eget ikon. */
  // Samme lange pil som «Se alle …»-lenkene (fill: currentColor, så den følger knappens tekstfarge)
  var ARROW_SVG = '<svg viewBox="0 0 31 12" width="32" height="12" fill="none" aria-hidden="true"><path d="M0 5.33333L28.4167 5.33333L23.25 0L25.1875 0L31 6L25.1875 12H23.25L28.4167 6.66667L0 6.66667L0 5.33333Z" fill="currentColor"/></svg>';
  function addArrows(root) {
    if (!root.querySelectorAll) return;
    var list = [].slice.call(root.querySelectorAll('.button'));
    if (root.matches && root.matches('.button')) list.push(root);
    list.forEach(function (b) {
      if (b.__lla || /theme-arrow|icon-only/.test(b.className) || b.querySelector('.button__icon, .icon') || !b.textContent.trim()) return;
      b.__lla = 1;
      // Husk fargene i ro, så hover kan beholde dem
      var cs = getComputedStyle(b);
      b.style.setProperty('--ll-btn-bg', cs.backgroundColor);
      b.style.setProperty('--ll-btn-fg', cs.color);
      b.style.setProperty('--ll-btn-bd', cs.borderTopColor);
      b.style.setProperty('--ll-btn-bb', cs.borderBottomWidth + ' ' + cs.borderBottomStyle + ' ' + cs.borderBottomColor);
      b.classList.add('ll-has-arrow');
      var s = document.createElement('span');
      s.className = 'll-btn-arrow'; s.setAttribute('aria-hidden', 'true'); s.innerHTML = ARROW_SVG;
      b.appendChild(s);
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    hydrated.then(function () {
      addArrows(document);
      new MutationObserver(function (muts) {
        muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) addArrows(n); }); });
      }).observe(document.body, { childList: true, subtree: true });
    });
  });

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
        if (v[2] === '--ll-fade-len' || v[2] === '--ll-sticky-stop') stickyUpdate();
        
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
