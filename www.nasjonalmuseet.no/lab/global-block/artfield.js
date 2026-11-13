/* Kunstverk-flate – se artfield.css.
   ArtField.mount(root, { layout: 'scatter' | 'strip', info: bool, api: bool, base: '/lab/global-block/' })
   - scatter: to rader rundt en tekst i midten (Figma «Global Block», 1608 × 900). --u = flatens høyde / 900.
   - strip:   én rad (Figma samlingstopp, 298 høy). --u = flatens bredde / 1608.
   Første skjermbilde er Figma-oppsettet. Etter det fylles flere kolonner med verk fra samlingen (API) – eller
   Figma-verkene om igjen – og flaten går i ring, så verkene gjentas i stedet for å være uendelige. */
(function () {
  var STEP = 343; // avstand mellom kolonnene i Figma

  // Figma-verkene (x, y, h i Figma-piksler; alle 200 brede). De to med inventarnummer er slått opp i samlingen.
  var KNOWN = {
    'NMK.2020.0391': { title: 'Hus for en ung kvinne VI', artist: 'Beate Hølmebakk', url: '/samlingen/objekt/NMK.2020.0391' },
    'MS-02579-1988': { title: 'Vintersol', artist: 'Gunnar S. Gundersen', url: '/samlingen/objekt/MS-02579-1988' }
  };
  var SCATTER = [
    { img: '111252', x: -168, y: 187, h: 165 }, { img: '115722', x: 175, y: 123, h: 293 },
    { img: 'NMK.2020.0391', x: 518, y: 93, h: 130 }, { img: 'MS-02579-1988', x: 861, y: 38, h: 298 },
    { img: '113130', x: 1204, y: 184, h: 168 }, { img: '104555', x: 1547, y: 138, h: 263 },
    { img: '113126', x: -49, y: 552, h: 208 }, { img: '19729', x: 291, y: 656, h: 170 },
    { img: '64930', x: 631, y: 543, h: 229 }, { img: '61717', x: 971, y: 674, h: 134 },
    { img: '06830', x: 1311, y: 505, h: 301 }
  ];
  var STRIP = [
    { img: '111252', x: 0, y: 33, h: 165 }, { img: '115722', x: 343, y: 3, h: 293 },
    { img: 'NMK.2020.0391', x: 686, y: 133, h: 130 }, { img: 'MS-02579-1988', x: 1029, y: 0, h: 298 },
    { img: '113130', x: 1372, y: 33, h: 168 }, { img: '104555', x: 1715, y: 18, h: 263 }
  ];

  function rnd(i) { var x = Math.sin(i * 9301 + 49297) * 233280; return x - Math.floor(x); } // fast «tilfeldig»
  function mod(a, n) { return ((a % n) + n) % n; }

  // Verk fra samlingen: bilde fra ms01 (IIIF), tittel og kunstner
  var apiCache = null;
  function loadApi() {
    if (apiCache) return apiCache;
    var queries = ['', 'munch', 'landskap'];
    apiCache = Promise.all(queries.map(function (q) {
      return fetch('/api/collectionsearch/search?lang=no&query=' + encodeURIComponent(q))
        .then(function (r) { return r.json(); }).catch(function () { return null; });
    })).then(function (res) {
      var seen = {}, out = [];
      res.forEach(function (d) {
        ((d && d.list && d.list.items) || []).forEach(function (it) {
          var m = it.media, im = m && m.images && m.images[0];
          if (!im || seen[it.key]) return;
          seen[it.key] = 1;
          var w = +im.dimensions.width, h = +im.dimensions.height;
          out.push({
            src: m.iiifImageUrlTemplate.replace('{0}', im.originalFile).replace('{1}', '400').replace('{2}', ''),
            ratio: h / w, title: it.heading, artist: it.subHeading, url: it.url
          });
        });
      });
      return out;
    });
    return apiCache;
  }

  function mount(root, opts) {
    opts = opts || {};
    var layout = opts.layout || 'scatter', base = opts.base || '/lab/global-block/';
    var field = document.createElement('div');
    field.className = 'af__field';
    root.insertBefore(field, root.firstChild);
    root.classList.add('af');

    var figma = (layout === 'strip' ? STRIP : SCATTER).map(function (a) {
      var k = KNOWN[a.img] || {};
      return { src: base + 'img/' + a.img + '.jpg', x: a.x, y: a.y, h: a.h, title: k.title, artist: k.artist, url: k.url || '/samlingen/' };
    });
    var pool = figma.map(function (f) { return { src: f.src, ratio: f.h / 200, title: f.title, artist: f.artist, url: f.url }; });
    // strip: Figma-rutenettet (1915 bredt) er sentrert i rammen på 1608, så første verk står 153 til venstre
    var slots = [], L = 0, u = 1, offset = layout === 'strip' ? -153 : 0;

    function makeEl(s, i) {
      var el = document.createElement('div');
      el.className = 'af__item';
      el.style.cssText = '--h:' + s.h + ';--i:' + (s.order == null ? 0 : s.order) +
        ';--dur:' + (7 + (i * 1.7) % 5).toFixed(1) + 's;--delay:-' + (i * 1.3 % 6).toFixed(1) + 's';
      var title = s.title || 'Tittel på verket', artist = s.artist || 'Kunstnernavn';
      el.innerHTML = '<div class="af__drift"><a class="af__link" href="' + s.url + '" aria-label="' +
        (s.title ? title + ', ' + artist : 'Se samlingen') + '" draggable="false"><img class="af__img" src="' + s.src +
        '" alt="" draggable="false"' + (s.order == null ? ' loading="lazy"' : '') + '></a>' +
        (opts.info ? '<div class="af__info"><b>' + title + '</b>' + artist + '</div>' : '') + '</div>';
      s.el = el;
      // Dybde: høye verk ligger «nærmere» og flytter seg mer med musa
      s.depth = 0.35 + Math.min(1, Math.max(0, (s.h - 130) / 170)) * 0.65;
      field.appendChild(el);
    }

    // Bygg kolonnene: Figma-oppsettet først, så flere kolonner til flaten er bred nok (og alle verk i bassenget
    // er med). Deretter går den i ring.
    function build() {
      slots.forEach(function (s, i) { if (i >= figma.length) s.el.remove(); });
      slots = slots.slice(0, figma.length);
      if (!slots.length) {
        var order = figma.map(function (f, i) { return i; }).sort(function (a, b) { return (figma[a].y - figma[b].y) || (figma[a].x - figma[b].x); });
        figma.forEach(function (f, i) { var s = Object.assign({}, f, { order: order.indexOf(i) }); slots.push(s); makeEl(s, i); });
      }
      var viewUnits = root.clientWidth / u;
      var firstCol = layout === 'strip' ? 6 : 5;   // scatter: nederste rad har en ledig kolonne 5
      var extra = layout === 'strip' ? pool.length : pool.length; // minst alle verk i bassenget én gang
      var gen = [], c = firstCol, k = 0;
      function need() { return (c + 1) * STEP < viewUnits + 3 * STEP || k < extra; }
      while (need()) {
        var rows = layout === 'strip' ? ['strip'] : (c === 5 ? ['bottom'] : ['top', 'bottom']);
        rows.forEach(function (row) {
          // ikke ett verk for mye i siste kolonne (da ville første verk havnet rett ved siden av seg selv i ringen)
          if (k >= extra && (c + 1) * STEP >= viewUnits + 3 * STEP) return;
          var p = pool[k % pool.length], h = Math.round(Math.min(300, Math.max(130, 200 * p.ratio)));
          var y = row === 'strip' ? Math.round(rnd(k + 1) * (298 - h))
                : row === 'top' ? Math.round(30 + rnd(k + 1) * (430 - 30 - h))
                : Math.round(500 + rnd(k + 1) * (830 - 500 - h));
          var x = (row === 'bottom' ? -49 : layout === 'strip' ? 0 : -168) + STEP * c;
          gen.push({ src: p.src, title: p.title, artist: p.artist, url: p.url, x: x, y: y, h: h });
          k++;
        });
        c++;
      }
      gen.forEach(function (s, i) { slots.push(s); makeEl(s, figma.length + i); });
      L = c * STEP;
      render();
    }

    function measure() {
      u = layout === 'strip' ? root.clientWidth / 1608 : root.clientHeight / 900;
      root.style.setProperty('--u', u + 'px');
    }

    // Musepeker og dra/sveip
    var mx = 0, my = 0, tx = 0, ty = 0, vel = 0, dragging = false, down = null, moved = false, lastX = 0, lastT = 0, raf = 0;
    var MOUSE = 36, left = layout === 'strip' ? -STEP : -STEP - 168;
    function render() {
      slots.forEach(function (s) {
        var x = mod(s.x + offset - left, L) + left;
        s.el.style.translate = ((x * u) + mx * s.depth).toFixed(1) + 'px ' + ((s.y * u) + my * s.depth).toFixed(1) + 'px';
      });
    }
    function loop() {
      raf = 0;
      var nx = -tx * MOUSE, ny = -ty * MOUSE * 0.6, busy = false;
      mx += (nx - mx) * 0.06; my += (ny - my) * 0.06;
      if (Math.abs(nx - mx) > 0.05 || Math.abs(ny - my) > 0.05) busy = true;
      if (!dragging && Math.abs(vel) > 0.02) { offset += vel; vel *= 0.94; busy = true; }
      render();
      if (busy || dragging) raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    root.addEventListener('pointermove', function (e) {
      var r = root.getBoundingClientRect();
      if (!reduce) { tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2; }
      if (down) {
        var dx = e.clientX - down.x;
        if (!dragging && Math.abs(dx) > 6) { dragging = moved = true; root.classList.add('is-dragging'); root.setPointerCapture(e.pointerId); }
        if (dragging) {
          var now = performance.now(), step = (e.clientX - lastX) / u;
          offset += step; vel = step / Math.max(1, (now - lastT) / 16.7);
          lastX = e.clientX; lastT = now;
        }
      }
      kick();
    });
    root.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.af__text a, .af__text button, .af__text input')) return;
      down = { x: e.clientX }; lastX = e.clientX; lastT = performance.now(); moved = false; vel = 0;
    });
    function up() {
      down = null;
      if (dragging) { dragging = false; root.classList.remove('is-dragging'); kick(); }
    }
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    root.addEventListener('pointerleave', function () { tx = ty = 0; kick(); });
    // Et dra skal ikke også bli et klikk på verket
    root.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    // Sidelengs scroll på styreflate
    root.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault(); offset -= e.deltaX / u; vel = 0; kick();
    }, { passive: false });

    measure();
    // scatter: Figma-rammen (1608 bred) sentreres i flaten – på en lavere flate (forsiden) er det plass til flere kolonner
    if (layout === 'scatter') offset = (root.clientWidth / u - 1608) / 2;
    build();
    window.addEventListener('resize', function () { measure(); build(); });

    // Innlasting når flaten kommer til syne og Figma-bildene er lastet (maks 1,5 s)
    var imgs = slots.slice(0, figma.length).map(function (s) { return s.el.querySelector('img'); });
    var loaded = Promise.all(imgs.map(function (im) { return im.complete ? 1 : new Promise(function (r) { im.onload = im.onerror = r; }); }));
    var shown = new Promise(function (r) {
      if (!('IntersectionObserver' in window)) return r();
      var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); r(); } }, { rootMargin: '0px 0px -15% 0px' });
      io.observe(root);
    });
    Promise.all([shown, Promise.race([loaded, new Promise(function (r) { setTimeout(r, 1500); })])]).then(function () {
      requestAnimationFrame(function () { root.classList.add('is-in'); });
    });

    // Flere verk fra samlingen
    if (opts.api !== false) loadApi().then(function (items) { if (items.length) { pool = items; build(); } });
  }

  window.ArtField = { mount: mount };
})();
