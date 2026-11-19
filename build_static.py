#!/usr/bin/env python3
"""
Bygger en statisk kopi av loader-laben for GitHub Pages.

  python3 build_static.py --base /nam-test --out _site

GitHub Pages kan ikke kjøre serve.py, så dette skriptet gjør det serveren ellers gjør, én gang:
  - kopierer ./www.nasjonalmuseet.no til --out
  - henter sidene som lenkes fra /lab/ fra nasjonalmuseet.no (loader-lab inn, sporing ut)
  - laster ned JS/CSS/fonter som disse sidene trenger, men som ikke finnes lokalt
  - skriver om stier så alt virker under --base (f.eks. /nam-test på brukernavn.github.io/nam-test/)
  - sider og filer som ikke er med i kopien, peker til www.nasjonalmuseet.no
  - kunstverk-bildene (/_ms01/) hentes direkte fra ms01.nasjonalmuseet.no

Det som ikke virker statisk: ?delay= og ?imgdelay= (gjøres av serveren) og /api/-kall som
nasjonalmuseet.no ikke tillater fra et annet domene.
"""
import argparse, os, posixpath, re, shutil, sys, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import serve  # gjenbruker localize(), STRIP og SSL-oppsettet

SRC = serve.ROOT
# Sidene som lenkes fra /lab/index.html og hentes live fra nasjonalmuseet.no
LIVE_PAGES = [
    "/",
    "/samlingen/objekt/NG.M.01387",
    "/utstillinger-og-arrangementer/nasjonalmuseet/utstillinger/2027/frida-kahlo.-mellom-verdener/",
]
LOCAL_PAGES = ["/samlingen/", "/lab/", "/lab/global-block/"]
PAGES = {p.rstrip("/") or "/" for p in LIVE_PAGES + LOCAL_PAGES}
DOWNLOAD_EXT = (".js", ".css", ".woff2", ".woff", ".ttf", ".eot", ".json", ".svg")
# Strenger i JS som er stier (andre strenger som starter med / røres ikke)
JS_PREFIXES = ("dist", "Resources", "api", "samlingen", "lab", "loader-lab", "cdn-cgi", "_ms01")
UPSTREAM_PREFIXES = ("cdn-cgi", "globalassets", "contentassets", "Resources")
# API-svar som lagres som statiske filer. Uten userinfo sender samlingen-siden deg til /logout,
# fordi nasjonalmuseet.no ikke svarer på API-kall fra et annet domene (CORS).
API_STUBS = {"/api/authentication/userinfo/": b'{"id":null,"roles":null,"at":null}'}

BASE = OUT = None
fetched = set()


def fetch(path):
    req = urllib.request.Request(serve.UPSTREAM + path, headers={"User-Agent": "Mozilla/5.0 local-test"})
    with urllib.request.urlopen(req, timeout=60, context=serve.UPSTREAM_SSL_CONTEXT) as r:
        return r.read()


def out_file(path):
    return os.path.join(OUT, urllib.parse.unquote(path).lstrip("/"))


def download(path):
    """Henter en fil fra nasjonalmuseet.no til OUT, og det CSS-filen selv peker på."""
    if path in fetched or os.path.isfile(out_file(path)):
        return
    fetched.add(path)
    try:
        body = fetch(path)
    except Exception as e:
        print(f"  ! klarte ikke hente {path}: {e}")
        return
    os.makedirs(os.path.dirname(out_file(path)), exist_ok=True)
    open(out_file(path), "wb").write(body)
    print(f"  + {path}")
    if path.endswith(".css"):
        for ref in re.findall(rb'url\(["\']?([^)"\']+)', body):
            ref = ref.decode()
            if ref.startswith(("data:", "http", "#")):
                continue
            ref = ref.split("?")[0].split("#")[0]
            download(posixpath.normpath(posixpath.join(posixpath.dirname(path), ref)))


def map_path(ref, download_missing=True):
    """Root-relativ sti -> sti under BASE hvis den finnes i kopien, ellers nasjonalmuseet.no."""
    if BASE and ref.startswith(BASE + "/"):  # allerede skrevet om
        return ref
    if ref.startswith("/_ms01/"):
        return serve.MS01 + ref[len("/_ms01"):]
    path, sep, rest = ref.partition("?") if "?" in ref else ref.partition("#")
    page = path.rstrip("/") or "/"
    if page in PAGES:
        return BASE + (page if page == "/" else page + "/") + sep + rest
    if os.path.exists(out_file(path)):
        return BASE + ref
    if download_missing and path.lower().endswith(DOWNLOAD_EXT) and not path.startswith(("/api/", "/Resources/")):
        download(path)
        if os.path.isfile(out_file(path)):
            return BASE + ref
    return serve.UPSTREAM + ref


def rewrite_html(html):
    html = html.replace("/_ms01/", serve.MS01 + "/")
    attr = r'((?:src|href|action|content|poster|data-[\w-]+)=")(/(?!/)[^"]*)(")'
    html = re.sub(attr, lambda m: m.group(1) + map_path(m.group(2)) + m.group(3), html)
    html = re.sub(r'((?:srcset)=")([^"]*)(")', lambda m: m.group(1) + re.sub(
        r'(^|,\s*)(/(?!/)\S+)', lambda n: n.group(1) + map_path(n.group(2)), m.group(2)) + m.group(3), html)
    html = rewrite_css(html)
    # Sidedata som Vue rendrer i nettleseren (JSON i inline-skript): alle strenger som er stier
    html = re.sub(r'(["\']|&quot;)(/[A-Za-z_][^"\'&<>\s\\]*)(?=["\'\\]|&quot;)',
                  lambda m: m.group(1) + map_path(m.group(2)), html)
    # Bilder og filer som bare finnes på nasjonalmuseet.no, også midt i srcset og escapet HTML
    html = re.sub(r'(?<=[\s,("\'=;])/(?=(?:%s)/)' % "|".join(UPSTREAM_PREFIXES), serve.UPSTREAM + "/", html)
    return rewrite_js(html)


def rewrite_css(css):
    return re.sub(r'url\((["\']?)(/(?!/)[^)"\']+)', lambda m: "url(" + m.group(1) + map_path(m.group(2)), css)


def rewrite_js(js):
    pat = r'(["\'`]|&quot;)(/(?:%s)(?:[/?#][^"\'`&<>\s]*)?)(?=["\'`]|&quot;)' % "|".join(map(re.escape, JS_PREFIXES))
    js = re.sub(pat, lambda m: m.group(1) + map_path(m.group(2)), js)
    # location.pathname uten BASE, så sjekker som pathname === '/' fortsatt stemmer
    return js.replace("location.pathname", "location.pathname.replace(%r,'')" % ("/" + BASE.strip("/"))) if BASE else js


def main():
    global BASE, OUT
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="", help="stien siden ligger under, f.eks. /nam-test")
    ap.add_argument("--out", default="_site")
    a = ap.parse_args()
    BASE, OUT = "/" + a.base.strip("/") if a.base.strip("/") else "", os.path.abspath(a.out)

    shutil.rmtree(OUT, ignore_errors=True)
    shutil.copytree(SRC, OUT, ignore=shutil.ignore_patterns("*.bak", ".DS_Store"))

    print("Henter sider fra nasjonalmuseet.no")
    for p in LIVE_PAGES:
        print(" ", p)
        html = serve.localize(fetch(p))
        dest = out_file(p.rstrip("/") + "/index.html")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, "wb").write(html)

    for p, body in API_STUBS.items():
        dest = out_file(p + "index.html")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, "wb").write(body)

    print("Skriver om stier")
    html_files, js_files = [], []
    for d, _, files in os.walk(OUT):
        for f in files:
            (html_files if f.endswith(".html") else js_files if f.endswith(".js") else []).append(os.path.join(d, f))
    for f in html_files:  # først HTML, så filer som lastes ned er med når JS skrives om
        rel = "/" + os.path.relpath(f, OUT).replace(os.sep, "/")
        html = open(f, "rb").read()
        if rel == "/samlingen/index.html":
            html = serve.localize(html)  # som serve.py gjør for lokale sider utenfor /lab/
        open(f, "w", encoding="utf-8").write(rewrite_html(html.decode("utf-8")))
    done = set()
    while True:  # gjentas til ingen nye JS/CSS-filer er lastet ned underveis
        todo = [os.path.join(d, f) for d, _, files in os.walk(OUT) for f in files
                if f.endswith((".js", ".css")) and os.path.join(d, f) not in done]
        if not todo:
            break
        for p in todo:
            done.add(p)
            text = open(p, encoding="utf-8").read()
            open(p, "w", encoding="utf-8").write((rewrite_js if p.endswith(".js") else rewrite_css)(text))

    open(os.path.join(OUT, ".nojekyll"), "w").close()
    print(f"Ferdig: {OUT}  (base {BASE or '/'})")


if __name__ == "__main__":
    main()
