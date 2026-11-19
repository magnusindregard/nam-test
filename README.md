# Lokal testkopi – Nasjonalmuseet /samlingen/

Kun til lokal testing av loading-animasjoner. Kopi av www.nasjonalmuseet.no/samlingen/ (hentet 2026-11-03),
uten cookie-banner, Google Tag Manager, HubSpot og Sentry.

## Start
    python3 serve.py
Åpne http://localhost:8000/lab/ – lenker til forside, samlingen og en objektside

### Sertifikatfeil på macOS

Hvis en underside viser `502` og `CERTIFICATE_VERIFY_FAILED`, er det Python som
ikke får kontrollert sertifikatet til nasjonalmuseet.no. Lokale filer kan fortsatt virke.
Serveren bruker macOS' sertifikatfil (`/etc/ssl/cert.pem`) automatisk dersom Pythons
standardlager er tomt. HTTPS-sertifikater og vertsnavn blir fortsatt kontrollert.

For å rette sertifikatoppsettet for andre Python-programmer også, kan du kjøre
`Install Certificates.command` i Python-mappen under Programmer (for eksempel
`/Applications/Python 3.11/Install Certificates.command`). Start serveren på nytt etterpå.
Egne sertifikatlagre angitt med `SSL_CERT_FILE` eller `SSL_CERT_DIR` overstyres ikke.

## Loader lab
Panelet nede til høyre bytter animasjon og forsinkelse. Du kan også bruke URL-parametre:
- `?loader=spinner|dots|bar|fade|curtain|none` – side-loader
- `?img=fade|blur|skeleton|none` – effekt når bildene lastes
- `?min=800` – minimum visningstid for loaderen (ms)
- `?delay=1500` – kunstig forsinkelse på alle filer (ms)
- `?imgdelay=3000` – kunstig forsinkelse bare på bilder (ms)

Eller ved oppstart: `python3 serve.py --delay 800 --img-delay 3000`

Undersider (temaer, verk, historier …) hentes live fra nasjonalmuseet.no når du klikker deg videre.
Serveren legger inn loader-lab, fjerner sporing og skriver om lenkene så du blir på localhost.

Egne animasjoner skrives i `www.nasjonalmuseet.no/loader-lab/loader.css` og `loader.js`.
API-kall (/api/...) og kunstverk-bilder (ms01) hentes live fra nasjonalmuseet.no via serveren, så du må være på nett.
