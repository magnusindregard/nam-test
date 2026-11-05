# Lokal testkopi – Nasjonalmuseet /samlingen/

Kun til lokal testing av loading-animasjoner. Kopi av www.nasjonalmuseet.no/samlingen/ (hentet 2026-11-03),
uten cookie-banner, Google Tag Manager, HubSpot og Sentry.

## Start
    python3 serve.py
Åpne http://localhost:8000/samlingen/

## Loader lab
Panelet nede til høyre bytter animasjon og forsinkelse. Du kan også bruke URL-parametre:
- `?loader=spinner|dots|bar|fade|curtain|none` – side-loader
- `?img=fade|blur|skeleton|none` – effekt når bildene lastes
- `?min=800` – minimum visningstid for loaderen (ms)
- `?delay=1500` – kunstig forsinkelse på alle filer (ms)
- `?imgdelay=3000` – kunstig forsinkelse bare på bilder (ms)

Eller ved oppstart: `python3 serve.py --delay 800 --img-delay 3000`

Egne animasjoner skrives i `www.nasjonalmuseet.no/loader-lab/loader.css` og `loader.js`.
API-kall (/api/...) og kunstverk-bilder (ms01) hentes live fra nasjonalmuseet.no via serveren, så du må være på nett.
