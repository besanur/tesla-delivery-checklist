# Tesla Model Y Juniper – Delivery Checkliste

Eine offline-fähige, werbefreie Checkliste für die Fahrzeugabholung (Delivery Day) des Tesla Model Y Juniper. Läuft komplett im Browser – **kein Backend, kein Tracking**. Dein Fortschritt wird nur lokal in deinem Browser (`localStorage`) gespeichert.

👉 **[Live-Demo öffnen](https://besanur.github.io/tesla-delivery-checklist)** *(Link nach GitHub-Pages-Setup eintragen)*

## Funktionen

- ✅ Ausklappbare Checklisten-Kategorien mit Fortschrittsanzeige
- 🗒️ Pro Prüfpunkt ein Kommentarfeld und ein Foto (Kamera oder Galerie), über einen eigenen Detail-Button erreichbar
- 🚗 Mehrere Checklisten parallel verwalten (z.B. für mehrere Fahrzeuge)
- 💾 Automatisches Speichern im Browser (kein Account, keine Cloud)
- 📄 Ein-Klick-PDF-Export inkl. Kommentaren und Foto-Thumbnails (via lokal vendortem [jsPDF](https://github.com/parallax/jsPDF))
- 📱 Für Smartphone/Tablet optimiert, Light-/Dark-Mode
- 📶 Installierbare PWA, läuft komplett offline (Service Worker)
- 🔓 Open Source, keine Laufzeit-Abhängigkeiten zu externen Servern

## Lokal starten

Da keine Build-Tools benötigt werden, reicht ein einfacher statischer Server:

```bash
npx serve .
# oder
python3 -m http.server 8080
```

Dann `index.html` im Browser öffnen.

## Auf GitHub Pages hosten

1. Repo auf GitHub erstellen und Inhalt pushen.
2. In den Repo-Einstellungen unter **Pages** die Source auf den `main`-Branch (Root) stellen.
3. Die Seite ist danach unter `https://<username>.github.io/<repo>/` erreichbar.

## Offline-Nutzung & Service-Worker-Updates

Die App registriert einen Service Worker (`sw.js`), der alle Kern-Dateien cached — danach läuft sie auch ganz ohne Internetverbindung (wichtig z.B. bei schlechtem Netz direkt im Tesla Center).

**Wichtig beim Deployen einer neuen Version:** In `sw.js` die Konstante `CACHE_NAME` hochzählen (z.B. `tesla-checklist-v1` → `tesla-checklist-v2`). Ohne diese Änderung laden Nutzer mit bereits installierter App weiterhin die alte, gecachte Version.

## Daten & Datenschutz

Alle Eingaben (Checkboxen, Notizen, Fahrzeugdaten) werden ausschließlich im `localStorage` deines Browsers gespeichert – es gibt keinen Server, keine Analyse-Skripte und keine Cookies. Löschst du den Browser-Speicher oder wechselst du das Gerät, ist der Stand weg (PDF-Export vorher empfohlen).

## Checkliste anpassen

Alle Prüfpunkte stehen in [`checklist-data.js`](checklist-data.js) als einfaches JavaScript-Objekt – Abschnitte und Punkte lassen sich dort frei ergänzen oder entfernen, ohne den Rest des Codes anzufassen.

## Lizenz

MIT – siehe [LICENSE](LICENSE). Nutzung auf eigene Gefahr; dies ist keine offizielle Tesla-Checkliste.
