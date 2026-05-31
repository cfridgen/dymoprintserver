# dymoprintserver

Local-first Druckserver fuer DYMO LabelManager PnP auf Linux.

Features:
- REST API fuer Text-, QR-, Barcode-, Compose- und Batch-Labels
- Web UI mit Designer, Templates, Automationsfeldern und Batch-Import
- Fixe Label-Gesamtlaenge (40 mm) fuer stabile Handhabung
- Kalibrierung fuer gemessenen 12-mm-Vorlauf bei DYMO PnP
- Massband-Testdruck (90 mm) zur Kalibrierung
- Fonts, Rahmen, Formen, Bilder, Datum/Uhrzeit und Counter-Objekte
- Mehrere Barcode-Typen: Code128, Code39, EAN-8, EAN-13, UPC-A, UPC-E, ITF, Codabar, PDF417, DataMatrix
- QR-Modi: Text, URL, Telefon, E-Mail, SMS, vCard
- Visuelle Templates: Blank, Warning, Badge, Inventory, Cable, Address
- Batch-Import fuer CSV/XLSX mit Spalten-Mapping im Browser und per API

## Screenshots

Text-Ansicht:
![Text UI](docs/screenshots/ui-text.png)

QR-Ansicht:
![QR UI](docs/screenshots/ui-qr.png)

Barcode-Ansicht:
![Barcode UI](docs/screenshots/ui-barcode.png)

## Schnellstart (Endanwender)

Voraussetzungen:
- Linux
- USB angeschlossener DYMO LabelManager PnP
- Node.js 18+
- Python 3

Installation und Start:
1. npm install
2. npm run setup:local
3. npm run start:local
4. Browser oeffnen: http://localhost:3000

## USB Rechte (einmalig)

1. Regel anlegen:
   sudo tee /etc/udev/rules.d/99-dymo-labelmanager.rules >/dev/null <<'EOF'
   SUBSYSTEM=="usb", ATTR{idVendor}=="0922", MODE="0666", GROUP="plugdev"
   EOF
2. Regeln neu laden:
   sudo udevadm control --reload-rules
   sudo udevadm trigger
3. Drucker kurz abziehen und wieder anstecken

Pruefen:
- lsusb | grep -i dymo

## Wichtige Kalibrierungsregel

Fuer diesen Drucker gilt gemessen:
- Vor dem eigentlichen Inhalt bleiben etwa 12 mm leer (mechanischer Vorlauf)
- Danach beginnt erst der sichtbare Inhalt

Die Anwendung beruecksichtigt das bereits in der fixen Label-Logik.

## API

GET /api/status
- Prueft dymoprint Verfuegbarkeit

GET /api/templates
- Liefert die verfuegbaren Label-Vorlagen fuer UI und API-Clients

POST /api/print/text
Beispiel Body:
{
  "text": "Zeile 1\nZeile 2\nZeile 3",
  "tapeSize": 12,
  "template": "warning",
  "fontFamily": "sans-bold",
  "fontSize": 18,
  "frame": true,
  "underline": false,
  "align": "center"
}

POST /api/print/qr
Beispiel Body:
{
  "qrContent": "https://example.com",
  "label": "optional",
  "qrMode": "url",
  "template": "badge",
  "tapeSize": 12
}

POST /api/print/barcode
Beispiel Body:
{
  "barcodeValue": "123456789",
  "label": "optional",
  "symbology": "code39",
  "showText": true,
  "template": "inventory",
  "tapeSize": 12
}

POST /api/print/compose
Beispiel Body:
{
  "tapeSize": 12,
  "payload": {
    "template": "warning",
    "objects": [
      {
        "type": "text",
        "text": "TEST\n2026",
        "x": 6,
        "y": 28,
        "w": 44,
        "h": 44,
        "fontFamily": "sans-bold",
        "fontSize": 15,
        "align": "left",
        "border": true
      },
      {
        "type": "datetime",
        "format": "%d.%m.%Y %H:%M",
        "x": 6,
        "y": 72,
        "w": 44,
        "h": 14,
        "fontFamily": "sans",
        "fontSize": 9,
        "align": "left"
      },
      {
        "type": "barcode",
        "value": "12345678",
        "symbology": "code128",
        "x": 56,
        "y": 28,
        "w": 38,
        "h": 22
      }
    ]
  }
}

POST /api/print/designer
- Nimmt denselben erweiterten Funktionssatz wie die Web-UI an

POST /api/print/counter-series
- Druckt eine Counter-Serie von `start` bis `end` mit `step`

POST /api/import/parse-table
- Liest CSV/XLSX-Dateien ein und liefert Spalten, Preview und Zeilen fuer den Batchdruck

POST /api/print/batch
Beispiel Body:
{
  "tapeSize": 12,
  "rows": [
    { "name": "Asset A", "sku": "123456", "url": "https://example.com/a" }
  ],
  "mapping": {
    "text": "name",
    "barcodeValue": "sku",
    "qrValue": "url"
  },
  "defaults": {
    "template": "inventory",
    "barcodeType": "pdf417",
    "qrMode": "url",
    "fontFamily": "sans-bold",
    "fontSize": 14
  }
}

POST /api/print/test-short
- Druckt ein Massband-Testlabel (90 mm)

## Entwicklerdokumentation

Projektstruktur:
- src/index.js: Express Server
- src/routes/print.js: API Endpunkte inklusive Designer, Compose, Counter und Batch
- src/services/dymo.js: Druck-Integration und generischer Compose-Druck
- src/services/composer.js: Template- und Payload-Aufbau fuer den 1.5-Designer
- src/services/batch.js: CSV/XLSX-Parsing und Row-to-Label-Mapping fuer Batchdruck
- scripts/render_composed_label.py: Generischer Renderer fuer Text, Codes, Bilder, Shapes und dynamische Felder
- scripts/generate_ruler_label.py: Rendering fuer Massband-Testdruck
- public/index.html: Web UI

Lokaler Dev-Loop:
1. npm install
2. npm run setup:local
3. npm run start:local
4. API testen mit curl oder Web UI

## Docker und Portainer

Vorbereitete Compose-Dateien:
- docker-compose.yml (lokal)
- docker-compose.test.yml (Port 8201)
- docker-compose.prod.yml (Port 8200)

Hinweis: Deployment nur nach expliziter Freigabe.

## Qualitaet und GitHub Standards

Enthaelt:
- MIT Lizenz
- Contributing Guide
- Security Policy
- Code of Conduct
- GitHub CI Workflow
- Issue Templates und PR Template

## Lizenz

MIT. Siehe LICENSE.
