'use strict';

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

// Kandidatenliste: erst explizit gesetzter Pfad, dann lokale/dev und Container-Defaults.
const DYMOPRINT_CANDIDATES = [
  process.env.DYMOPRINT_BIN,
  path.join(process.cwd(), '.venv', 'bin', 'dymoprint'),
  '/opt/dymo-venv/bin/dymoprint',
  'dymoprint',
].filter(Boolean);

const PYTHON_CANDIDATES = [
  process.env.DYMO_PYTHON_BIN,
  path.join(process.cwd(), '.venv', 'bin', 'python'),
  '/opt/dymo-venv/bin/python',
  'python3',
].filter(Boolean);

const RULER_SCRIPT = path.join(process.cwd(), 'scripts', 'generate_ruler_label.py');
const COMPOSED_LABEL_SCRIPT = path.join(process.cwd(), 'scripts', 'render_composed_label.py');
const TAPE_SIZE = process.env.DYMO_TAPE_SIZE || '12';
const LEADING_BLANK_MM = Number(process.env.DYMO_LEADING_BLANK_MM || '12');
const TOTAL_LABEL_MM = Number(process.env.DYMO_TOTAL_LABEL_MM || '40');
const CONTENT_LABEL_MM = Math.max(10, TOTAL_LABEL_MM - LEADING_BLANK_MM);
const POST_FEED_MM = Math.max(0, Number(process.env.DYMO_POST_FEED_MM || '20'));

function execFileAsync(bin, args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr, bin });
        return;
      }
      resolve({ stdout, stderr, bin });
    });
  });
}

/**
 * Führt dymoprint mit den angegebenen Argumenten aus.
 * Gibt Promise<{ stdout, stderr }> zurück.
 */
async function runDymoprint(args) {
  let lastErr = null;

  for (const bin of DYMOPRINT_CANDIDATES) {
    try {
      const result = await execFileAsync(bin, args, 15000);
      return { stdout: result.stdout, stderr: result.stderr, binary: result.bin };
    } catch (failed) {
      lastErr = failed;
      const code = failed && failed.error ? failed.error.code : '';
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        continue;
      }
      throw new Error(failed.stderr || failed.error.message);
    }
  }

  if (lastErr && lastErr.error) {
    throw new Error(
      'dymoprint nicht gefunden. Fuehre zuerst "npm run setup:local" aus oder setze DYMOPRINT_BIN auf ein gueltiges Binary.'
    );
  }

  throw new Error('dymoprint konnte nicht gestartet werden.');
}

async function runPython(args) {
  let lastErr = null;
  for (const bin of PYTHON_CANDIDATES) {
    try {
      const result = await execFileAsync(bin, args, 20000);
      return result;
    } catch (failed) {
      lastErr = failed;
      const code = failed && failed.error ? failed.error.code : '';
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        continue;
      }
      throw new Error(failed.stderr || failed.error.message);
    }
  }

  throw new Error(
    (lastErr && lastErr.error && lastErr.error.message) ||
      'python nicht gefunden. Fuer Massband-Test bitte setup:local erneut ausfuehren.'
  );
}

/**
 * Druckt ein einfaches Textetikett.
 * @param {string} text  - Labeltext (Zeilenumbruch mit \n)
 * @param {object} opts  - { tapeSize, fontSize }
 */
async function printText(text, opts = {}) {
  const tapeSize = opts.tapeSize || TAPE_SIZE;
  return printComposition(
    {
      template: opts.template || 'blank',
      objects: [
        {
          type: 'text',
          text,
          x: 4,
          y: 12,
          w: 92,
          h: 62,
          fontFamily: opts.fontFamily || 'sans-bold',
          fontSize: opts.fontSize || 18,
          align: opts.align || 'center',
          border: Boolean(opts.frame),
          underline: Boolean(opts.underline),
        },
      ],
    },
    tapeSize
  );
}

/**
 * Druckt ein Label mit QR-Code + optionalem Text.
 * @param {string} qrContent - Inhalt des QR-Codes
 * @param {string} [label]   - Text unter dem QR-Code (optional)
 * @param {object} opts      - { tapeSize }
 */
async function printQR(qrContent, label, opts = {}) {
  const tapeSize = opts.tapeSize || TAPE_SIZE;
  return printComposition(
    {
      template: opts.template || 'blank',
      objects: [
        { type: 'qr', x: 4, y: 6, w: 32, h: 88, value: qrContent, mode: opts.qrMode || 'text' },
        {
          type: 'text',
          text: label || qrContent,
          x: 40,
          y: 12,
          w: 56,
          h: 64,
          fontFamily: 'sans-bold',
          fontSize: 12,
          align: 'left',
        },
      ],
    },
    tapeSize
  );
}

/**
 * Druckt ein Label mit Barcode (Code128) + optionalem Text.
 * @param {string} barcodeValue - Barcode-Inhalt
 * @param {string} [label]      - Text unter dem Barcode (optional)
 * @param {object} opts         - { tapeSize }
 */
async function printBarcode(barcodeValue, label, opts = {}) {
  const tapeSize = opts.tapeSize || TAPE_SIZE;
  return printComposition(
    {
      template: opts.template || 'inventory',
      objects: [
        {
          type: 'barcode',
          x: 4,
          y: 26,
          w: 92,
          h: 44,
          value: barcodeValue,
          symbology: opts.symbology || 'code128',
          showText: Boolean(opts.showText),
        },
        {
          type: 'text',
          text: label || barcodeValue,
          x: 4,
          y: 72,
          w: 92,
          h: 18,
          fontFamily: 'sans',
          fontSize: 10,
          align: 'center',
        },
      ],
    },
    tapeSize
  );
}

async function printComposition(payload, tapeSize = TAPE_SIZE) {
  const tempFile = path.join(os.tmpdir(), `dymo-compose-${Date.now()}.png`);

  try {
    await runPython([
      COMPOSED_LABEL_SCRIPT,
      tempFile,
      JSON.stringify(payload),
      String(CONTENT_LABEL_MM),
      String(tapeSize),
      String(POST_FEED_MM),
    ]);

    return await runDymoprint(['-t', String(tapeSize), '-m', '0', '-p', tempFile, '']);
  } finally {
    await fs.unlink(tempFile).catch(() => {});
  }
}

async function renderCompositionPreview(payload, tapeSize = TAPE_SIZE) {
  const tempFile = path.join(os.tmpdir(), `dymo-preview-${Date.now()}.png`);

  await runPython([
    COMPOSED_LABEL_SCRIPT,
    tempFile,
    JSON.stringify(payload),
    String(CONTENT_LABEL_MM),
    String(tapeSize),
    '0',
  ]);

  return tempFile;
}

/**
 * Druckt ein Massband-Testlabel mit mm-Strichen und cm-Zahlen.
 * @param {object} opts - { tapeSize, lengthMm }
 */
async function printRulerTest(opts = {}) {
  const tapeSize = opts.tapeSize || TAPE_SIZE;
  const lengthMm = Number.isFinite(Number(opts.lengthMm)) ? Number(opts.lengthMm) : 90;

  const tempFile = path.join(os.tmpdir(), `dymo-ruler-${Date.now()}.png`);

  try {
    await runPython([RULER_SCRIPT, tempFile, String(lengthMm)]);
    return await runDymoprint(['-t', String(tapeSize), '-m', '0', '-p', tempFile, '']);
  } finally {
    await fs.unlink(tempFile).catch(() => {});
  }
}

/**
 * Prüft ob dymoprint verfügbar ist und gibt die Version zurück.
 */
async function getStatus() {
  let lastErr = null;

  for (const bin of DYMOPRINT_CANDIDATES) {
    try {
      const result = await execFileAsync(bin, ['--version'], 5000);
      return {
        available: true,
        version: result.stdout.trim() || result.stderr.trim(),
        binary: result.bin,
      };
    } catch (failed) {
      lastErr = failed;
      const code = failed && failed.error ? failed.error.code : '';
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        continue;
      }
      return { available: false, error: failed.stderr || failed.error.message };
    }
  }

  return {
    available: false,
    error: 'dymoprint nicht gefunden (lokal: .venv/bin/dymoprint oder systemweit).',
    detail: lastErr && lastErr.error ? lastErr.error.message : undefined,
  };
}

module.exports = { printText, printQR, printBarcode, printComposition, renderCompositionPreview, printRulerTest, getStatus };
