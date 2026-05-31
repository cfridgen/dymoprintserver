'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const dymo = require('../services/dymo');

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
      const { text, tapeSize, fontSize } = req.body;
      await dymo.printText(text, { tapeSize, fontSize });
      res.json({ success: true, message: 'Label gedruckt' });
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
      const { qrContent, label, tapeSize } = req.body;
      await dymo.printQR(qrContent, label, { tapeSize });
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
      const { barcodeValue, label, tapeSize } = req.body;
      await dymo.printBarcode(barcodeValue, label, { tapeSize });
      res.json({ success: true, message: 'Barcode-Label gedruckt' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

module.exports = router;
