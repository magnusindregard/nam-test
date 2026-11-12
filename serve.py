#!/usr/bin/env python3
"""
Lokal testserver for Nasjonalmuseet /samlingen/ – for å teste loading-animasjoner.

  python3 serve.py                       # http://localhost:8000/samlingen/
  python3 serve.py --delay 800           # alle forespørsler venter 800 ms
  python3 serve.py --img-delay 3000      # bare bilder venter 3 s (fint for skeletons)
  python3 serve.py --port 8080

Filer som finnes lokalt serveres fra ./www.nasjonalmuseet.no.
Alt annet (/api/..., bilder som mangler) videresendes til www.nasjonalmuseet.no,
og /_ms01/... videresendes til ms01.nasjonalmuseet.no (kunstverk-bildene).
Forsinkelse kan også styres per sidevisning med ?delay=ms&imgdelay=ms i URL-en
(lagres i en cookie så den gjelder for alle filene siden laster).
"""
import argparse, http.server, mimetypes, os, re, socketserver, time, urllib.request, urllib.parse
from http.cookies import SimpleCookie

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "www.nasjonalmuseet.no")
UPSTREAM = "https://www.nasjonalmuseet.no"
MS01 = "https://ms01.nasjonalmuseet.no"
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg")
ARGS = None
PAGE_CACHE = {}  # undersider hentet fra nasjonalmuseet.no, så hver lasting tar like lang tid
PAGE_TTL = 600   # sekunder – nasjonalmuseet.no publiserer nye bygg, og gammel HTML peker da på filer som er borte

LOADER_TAGS = b'<link rel="stylesheet" href="/loader-lab/loader.css">\n<script src="/loader-lab/loader.js"></script>\n'
STRIP = [  # det samme som ble fjernet fra den lokale kopien av /samlingen/
    rb'<script id="CookieConsent".*?</script>',
    rb'<script[^>]*>\(function\(w,d,s,l,i\).*?</script>',
    rb'<script[^>]*id="hs-script-loader".*?</script>',
    rb'window\.museet\.sentryDsn\s*=\s*"[^"]*";',
]


def localize(html):
    """Gjør en side fra nasjonalmuseet.no klar for lokal testing: loader-lab inn, sporing ut,
    og lenker til nasjonalmuseet.no peker hit, så man kan klikke seg videre til undersider."""
    if b"/loader-lab/loader.js" not in html:
        html = re.sub(rb'(<head[^>]*>)', lambda m: m.group(1) + b"\n" + LOADER_TAGS, html, count=1)
    for pat in STRIP:
        html = re.sub(pat, b"", html, flags=re.S)
    return (html.replace(b"https://www.nasjonalmuseet.no/", b"/")
                .replace(b"https:\\/\\/www.nasjonalmuseet.no\\/", b"\\/"))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        print("  " + fmt % args)

    def _delays(self):
        q = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        c = SimpleCookie(self.headers.get("Cookie", ""))
        def pick(name, default):
            if name in q:
                return int(q[name][0] or 0), True
            if "ll_" + name in c:
                return int(c["ll_" + name].value or 0), False
            return default, False
        d, d_set = pick("delay", ARGS.delay)
        i, i_set = pick("imgdelay", ARGS.img_delay)
        self._set_cookies = [(k, v) for k, v, s in (("delay", d, d_set), ("imgdelay", i, i_set)) if s]
        return d, i

    def _is_image(self):
        p = urllib.parse.urlsplit(self.path).path.lower()
        return p.startswith("/_ms01/") or "/cdn-cgi/image/" in p or p.endswith(IMG_EXT)

    def end_headers(self):
        for k, v in getattr(self, "_set_cookies", []):
            self.send_header("Set-Cookie", f"ll_{k}={v}; Path=/")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        delay, img_delay = self._delays()
        wait = img_delay if self._is_image() and img_delay else delay
        p0 = urllib.parse.urlsplit(self.path).path
        is_doc = p0.endswith("/") or p0.endswith(".html")
        if wait and not is_doc:  # selve HTML-en kommer straks, så loaderen vises med en gang
            time.sleep(wait / 1000)

        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if path == "/lab":
            self.send_response(302)
            self.send_header("Location", "/lab/")
            self.end_headers()
            return
        local = os.path.join(ROOT, path.lstrip("/"))
        if os.path.isdir(local):
            local = os.path.join(local, "index.html")
        is_lab = path.startswith("/lab/")  # testindeksen serveres som den er, uten loader-lab
        if local.endswith(".html") and os.path.isfile(local) and not img_delay and not is_lab:
            # Uten bildeforsinkelse: la nettleseren hente kunstverk-bildene direkte fra ms01,
            # så de ikke opptar tilkoblingene til denne serveren (det holdt igjen JS-filene).
            body = localize(open(local, "rb").read()).replace(b'/_ms01/', MS01.encode() + b'/')
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if os.path.isfile(local) and not path.startswith("/_ms01/"):
            # strip query so SimpleHTTPRequestHandler finds the file
            self.path = urllib.parse.quote(path)
            return super().do_GET()
        self._proxy()

    def _proxy(self):
        if self.path.startswith("/_ms01/"):
            url = MS01 + self.path[len("/_ms01"):]
        else:
            # Undersider: hent uten loader-lab-parametrene, og cache HTML-en
            parts = urllib.parse.urlsplit(self.path)
            q = [(k, v) for k, v in urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
                 if k not in ("loader", "img", "min", "hover", "menu", "sticky", "grow", "arrowbtn", "parallax", "wipe", "btnarrow", "listw", "menuwipe", "heroimg", "lockup", "delay", "imgdelay", "headline")]
            url = UPSTREAM + parts.path + ("?" + urllib.parse.urlencode(q) if q else "")
        if url in PAGE_CACHE and time.time() - PAGE_CACHE[url][2] < PAGE_TTL:
            ctype, body, _ = PAGE_CACHE[url]
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 local-test",
                                                       "Accept": self.headers.get("Accept", "*/*")})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
                ctype = r.headers.get("Content-Type", mimetypes.guess_type(url)[0] or "application/octet-stream")
                if ctype.startswith("text/html"):
                    body = localize(body)
                    PAGE_CACHE[url] = (ctype, body, time.time())
                self.send_response(r.status)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as e:
            self.send_error(e.code)
        except Exception as e:
            self.send_error(502, str(e))


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--delay", type=int, default=0, help="ms forsinkelse på alle forespørsler")
    ap.add_argument("--img-delay", type=int, default=0, help="ms forsinkelse på bilder")
    ARGS = ap.parse_args()
    print(f"Serverer på http://localhost:{ARGS.port}/lab/  (delay={ARGS.delay}ms, img-delay={ARGS.img_delay}ms)")
    print("Prøv f.eks. http://localhost:%d/samlingen/?loader=bar&imgdelay=2000" % ARGS.port)
    Server(("", ARGS.port), Handler).serve_forever()
