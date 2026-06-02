'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const dymo = require('../services/dymo');
const composer = require('../services/composer');
const batch = require('../services/batch');

const router = express.Router();

// --- Hilfsfunktion: Validierungsfehler zurückgeben ---
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  return null;
}

// --- GET /api/status ---
router.get('/status', async (req, res) => {
  try {
    const status = await dymo.getStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/templates', (req, res) => {
  res.json({ success: true, templates: composer.getTemplateOptions() });
});

router.post(
  '/import/parse-table',
  body('fileName').isString().notEmpty().withMessage('fileName fehlt'),
  body('fileData').isString().notEmpty().withMessage('fileData fehlt'),
  async (req, res) => {
    const validErr = handleValidation(req, res);
    if (validErr !== null) return;

    try {
      const parsed = batch.parseTableFile(req.body.fileName, req.body.fileData);
      res.json({ success: true, ...parsed });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// --- POST /api/print/test-short ---
// Sehr kurzer Testdruck, um Bandverbrauch minimal zu halten.
router.post('/print/test-short', async (req, res) => {
  try {
    const tapeSize = Number(req.body && req.body.tapeSize) || 12;
    // Massband-Test: mm-Striche + cm-Zahlen, auf ca. 90 mm Laenge.
    await dymo.printRulerTest({ tapeSize, lengthMm: 90 });
    res.json({ success: true, message: 'Massband-Testlabel (90 mm) gedruckt' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- POST /api/print/text ---
// Body: { text: "Zeile 1\nZeile 2", tapeSize: 12, fontSize: null }
router.post(
  '/print/text',
  body('text').isString().notEmpty().withMessage('text darf nicht leer sein'),
  body('tapeSize').optional().isInt({ min: 6, max: 24 }),
  body('fontSize').optional().isInt({ min: 6, max: 32 }),
  async (req, res) => {
    const validErr = handleValidation(req, res);
    if (validErr !== null) return;

    try {
      const { text, tapeSize, fontSize, fontFamily, align, frame, underline, template } = req.body;
      await dymo.printComposition(
        composer.buildTextPayload(text, { tapeSize, fontSize, fontFamily, align, frame, underline, template }),
        tapeSize
      );
      res.json({ success: true, message: 'Label gedruckt' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/preview/text',
  body('text').isString().notEmpty().withMessage('text darf nicht leer sein'),
  body('tapeSize').optional().isInt({ min: 6, max: 24 }),
  async (req, res) => {
    const validErr = handleValidation(req, res);
    if (validErr !== null) return;

    try {
      const { text, tapeSize, fontSize, fontFamily, align, frame, underline, template } = req.body;
      const payload = composer.buildTextPayload(text, {
        tapeSize,
        fontSize,
        fontFamily,
        align,
        frame,
        underline,
        template,
      });
      const previewPath = await dymo.renderCompositionPreview(payload, tapeSize);
      res.sendFile(previewPath, (err) => {
        const fs = require('fs');
        fs.unlink(previewPath, () => {});
        if (err) {
          console.error(err);
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// --- POST /api/print/qr ---
// Body: { qrContent: "https://...", label: "Optionaler Text", tapeSize: 12 }
router.post(
  '/print/qr',
  body('qrContent').isString().notEmpty().withMessage('qrContent darf nicht leer sein'),
  body('label').optional().isString(),
  body('tapeSize').optional().isInt({ min: 6, max: 24 }),
  async (req, res) => {
    const validErr = handleValidation(req, res);
    if (validErr !== null) return;

    try {
      const { qrContent, label, tapeSize, template, qrMode } = req.body;
      await dymo.printComposition(
        composer.buildQRPayload(qrContent, label, { tapeSize, template, qrMode }),
        tapeSize
      );
      res.json({ success: true, message: 'QR-Label gedruckt' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// --- POST /api/print/barcode ---
// Body: { barcodeValue: "123456", label: "Optionaler Text", tapeSize: 12 }
router.post(
  '/print/barcode',
  body('barcodeValue').isString().notEmpty().withMessage('barcodeValue darf nicht leer sein'),
  body('label').optional().isString(),
  body('tapeSize').optional().isInt({ min: 6, max: 24 }),
  async (req, res) => {
    const validErr = handleValidation(req, res);
    if (validErr !== null) return;

    try {
      const { barcodeValue, label, tapeSize, symbology, showText, template } = req.body;
      await dymo.printComposition(
        composer.buildBarcodePayload(barcodeValue, label, { tapeSize, symbology, showText, template }),
        tapeSize
      );
      res.json({ success: true, message: 'Barcode-Label gedruckt' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/print/compose',
  body('payload').isObject().withMessage('payload muss ein Objekt sein'),
  body('payload.objects').isArray({ min: 1 }).withMessage('payload.objects muss mindestens ein Element enthalten'),
  body('tapeSize').optional().isInt({ min: 6, max: 24 }),
  async (req, res) => {
    const validErr = handleValidation(req, res);
    if (validErr !== null) return;

    try {
      const { payload, tapeSize } = req.body;
      await dymo.printComposition(payload, tapeSize);
      res.json({ success: true, message: 'Kompositions-Label gedruckt' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/print/designer',
  body('template').optional().isString(),
  body('text').optional().isString(),
  body('dynamicType').optional().isString(),
  body('barcodeType').optional().isString(),
  body('barcodeValue').optional().isString(),
  body('qrValue').optional().isString(),
  body('tapeSize').optional().isInt({ min: 6, max: 24 }),
  async (req, res) => {
    const validErr = handleValidation(req, res);
    if (validErr !== null) return;

    try {
      const { tapeSize } = req.body;
      const payload = composer.buildDesignerPayload(req.body);
      await dymo.printComposition(payload, tapeSize);
      res.json({ success: true, message: 'Designer-Label gedruckt', payload });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/print/counter-series',
  body('text').optional().isString(),
  body('start').isInt(),
  body('step').optional().isInt(),
  body('end').isInt(),
  body('tapeSize').optional().isInt({ min: 6, max: 24 }),
  async (req, res) => {
    const validErr = handleValidation(req, res);
    if (validErr !== null) return;

    try {
      const { start, step = 1, end, tapeSize } = req.body;
      let printed = 0;

      for (let current = Number(start); current <= Number(end); current += Number(step)) {
        const payload = composer.buildDesignerPayload({
          ...req.body,
          dynamicType: 'counter',
          counterStart: start,
          counterStep: step,
          counterEnd: end,
          counterCurrent: current,
        });
        await dymo.printComposition(payload, tapeSize);
        printed += 1;
      }

      res.json({ success: true, message: `${printed} Serienlabels gedruckt` });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/print/batch',
  body('rows').isArray({ min: 1 }).withMessage('rows muss mindestens eine Zeile enthalten'),
  body('mapping').isObject().withMessage('mapping muss ein Objekt sein'),
  body('defaults').isObject().withMessage('defaults muss ein Objekt sein'),
  body('tapeSize').optional().isInt({ min: 6, max: 24 }),
  async (req, res) => {
    const validErr = handleValidation(req, res);
    if (validErr !== null) return;

    try {
      const tapeSize = Number(req.body.tapeSize) || undefined;
      let printed = 0;

      for (const row of req.body.rows) {
        const payload = batch.buildPayloadFromRow(row, {
          mapping: req.body.mapping,
          defaults: req.body.defaults,
        });
        await dymo.printComposition(payload, tapeSize);
        printed += 1;
      }

      res.json({ success: true, message: `${printed} Batch-Labels gedruckt`, printed });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

module.exports = router;
