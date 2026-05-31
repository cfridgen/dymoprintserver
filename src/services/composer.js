'use strict';

const TEMPLATE_OPTIONS = [
  { id: 'blank', name: 'Blank', description: 'Freies Standard-Layout' },
  { id: 'warning', name: 'Warning', description: 'Kräftiger Kopfbereich für Warnhinweise' },
  { id: 'badge', name: 'Badge', description: 'Rundes Badge-Layout für Namen oder Rollen' },
  { id: 'inventory', name: 'Inventory', description: 'Klare Struktur für Lager- und Asset-Labels' },
  { id: 'cable', name: 'Cable', description: 'Schmale Kabel- oder Patch-Bezeichner' },
  { id: 'address', name: 'Address', description: 'Adress- oder Kontaktetikett mit Zusatzcode' },
];

function getTemplateOptions() {
  return TEMPLATE_OPTIONS;
}

function centeredText(text, overrides = {}) {
  return {
    type: 'text',
    text,
    x: 4,
    y: 12,
    w: 92,
    h: 62,
    fontFamily: 'sans-bold',
    fontSize: 18,
    align: 'center',
    ...overrides,
  };
}

function templateBase(template) {
  const objects = [];

  if (template === 'warning') {
    objects.push(
      { type: 'text', text: 'WARNUNG', x: 4, y: 1, w: 92, h: 18, fontFamily: 'sans-bold', fontSize: 12, invert: true, align: 'center' },
      { type: 'shape', shape: 'rect', x: 2, y: 22, w: 96, h: 74, strokeWidth: 2 }
    );
  }

  if (template === 'badge') {
    objects.push(
      { type: 'text', text: 'BADGE', x: 8, y: 0, w: 84, h: 18, fontFamily: 'sans-bold', fontSize: 10, invert: true, align: 'center' }
    );
  }

  if (template === 'inventory') {
    objects.push(
      { type: 'text', text: 'ASSET', x: 4, y: 0, w: 40, h: 18, fontFamily: 'sans-bold', fontSize: 10, align: 'left' },
      { type: 'shape', shape: 'line', x: 2, y: 20, w: 96, h: 0, strokeWidth: 1 }
    );
  }

  if (template === 'cable') {
    objects.push(
      { type: 'shape', shape: 'roundrect', x: 1, y: 8, w: 98, h: 82, strokeWidth: 2 },
      { type: 'shape', shape: 'line', x: 14, y: 8, w: 0, h: 82, strokeWidth: 1 },
      { type: 'shape', shape: 'line', x: 86, y: 8, w: 0, h: 82, strokeWidth: 1 }
    );
  }

  if (template === 'address') {
    objects.push(
      { type: 'shape', shape: 'rect', x: 2, y: 6, w: 96, h: 84, strokeWidth: 1 }
    );
  }

  return { template, objects };
}

function buildTextPayload(text, options = {}) {
  const template = options.template || 'blank';
  const payload = templateBase(template);
  payload.objects.push(
    centeredText(text, {
      fontFamily: options.fontFamily || 'sans-bold',
      fontSize: options.fontSize || 18,
      border: Boolean(options.frame),
      underline: Boolean(options.underline),
      align: options.align || 'center',
      y: template === 'warning' ? 28 : 12,
      h: template === 'warning' ? 56 : 62,
    })
  );
  return payload;
}

function buildQRPayload(qrContent, label = '', options = {}) {
  const template = options.template || 'blank';
  const payload = templateBase(template);
  payload.objects.push({ type: 'qr', x: 4, y: 6, w: 32, h: 88, value: qrContent, mode: options.qrMode || 'text' });
  payload.objects.push(centeredText(label || qrContent, { x: 40, y: 12, w: 56, h: 64, align: 'left', fontFamily: 'sans-bold', fontSize: 12 }));
  return payload;
}

function buildBarcodePayload(barcodeValue, label = '', options = {}) {
  const template = options.template || 'inventory';
  const payload = templateBase(template);
  payload.objects.push({
    type: 'barcode',
    x: 4,
    y: 26,
    w: 92,
    h: 44,
    value: barcodeValue,
    symbology: options.symbology || 'code128',
    showText: Boolean(options.showText),
  });
  payload.objects.push(centeredText(label || barcodeValue, { y: 72, h: 18, fontFamily: 'sans', fontSize: 10 }));
  return payload;
}

function addOptionalDesignerObjects(payload, form = {}) {
  if (form.text) {
    payload.objects.push({
      type: 'text',
      text: form.text,
      x: 6,
      y: form.template === 'warning' ? 24 : 10,
      w: form.barcodeValue || form.qrValue ? 52 : 88,
      h: 38,
      fontFamily: form.fontFamily || 'sans-bold',
      fontSize: Number(form.fontSize) || 16,
      align: form.align || 'left',
      border: Boolean(form.frame),
      underline: Boolean(form.underline),
    });
  }

  if (form.dynamicType && form.dynamicType !== 'none') {
    const dynamic = {
      type: form.dynamicType,
      format: form.dynamicFormat,
      start: Number(form.counterStart) || 1,
      step: Number(form.counterStep) || 1,
      end: form.counterEnd === '' || form.counterEnd == null ? undefined : Number(form.counterEnd),
      current: Number(form.counterCurrent) || Number(form.counterStart) || 1,
      prefix: form.counterPrefix || '',
      suffix: form.counterSuffix || '',
      pad: Number(form.counterPad) || 0,
      x: 6,
      y: 54,
      w: 44,
      h: 18,
      fontFamily: form.fontFamily || 'sans',
      fontSize: 10,
      align: 'left',
    };
    payload.objects.push(dynamic);
  }

  if (form.shape && form.shape !== 'none') {
    payload.objects.push({
      type: 'shape',
      shape: form.shape,
      x: 4,
      y: 8,
      w: 92,
      h: 80,
      strokeWidth: Number(form.shapeStrokeWidth) || 1,
      filled: Boolean(form.shapeFilled),
    });
  }

  if (form.barcodeValue) {
    payload.objects.push({
      type: 'barcode',
      x: 56,
      y: 12,
      w: 38,
      h: 34,
      value: form.barcodeValue,
      symbology: form.barcodeType || 'code128',
      showText: Boolean(form.barcodeShowText),
    });
    if (form.barcodeLabel) {
      payload.objects.push({
        type: 'text',
        text: form.barcodeLabel,
        x: 56,
        y: 48,
        w: 38,
        h: 12,
        fontFamily: 'sans',
        fontSize: 9,
        align: 'center',
      });
    }
  }

  if (form.qrValue) {
    payload.objects.push({
      type: 'qr',
      x: form.barcodeValue ? 56 : 60,
      y: form.barcodeValue ? 60 : 12,
      w: form.barcodeValue ? 18 : 30,
      h: form.barcodeValue ? 28 : 46,
      value: form.qrValue,
      mode: form.qrMode || 'text',
    });
  }

  if (form.imageData) {
    payload.objects.push({
      type: 'image',
      x: 78,
      y: 58,
      w: 16,
      h: 24,
      data: form.imageData,
    });
  }

  return payload;
}

function buildDesignerPayload(form = {}) {
  const template = form.template || 'blank';
  const payload = templateBase(template);
  return addOptionalDesignerObjects(payload, form);
}

module.exports = {
  getTemplateOptions,
  buildTextPayload,
  buildQRPayload,
  buildBarcodePayload,
  buildDesignerPayload,
};
