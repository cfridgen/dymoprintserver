'use strict';

const XLSX = require('xlsx');
const composer = require('./composer');

function decodeFileData(fileData) {
  const [, base64Payload] = String(fileData || '').split(',', 2);
  const encoded = base64Payload || fileData;
  if (!encoded) {
    throw new Error('fileData fehlt');
  }
  return Buffer.from(encoded, 'base64');
}

function parseTableFile(fileName, fileData) {
  const buffer = decodeFileData(fileData);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Keine Tabellenblaetter gefunden');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    fileName,
    sheetName: firstSheetName,
    columns,
    rows,
    previewRows: rows.slice(0, 5),
    rowCount: rows.length,
  };
}

function normalizeValue(value) {
  if (value == null) return undefined;
  const stringValue = String(value).trim();
  return stringValue === '' ? undefined : stringValue;
}

function pickMappedValue(row, mapping, targetKey) {
  const sourceKey = mapping && mapping[targetKey];
  if (!sourceKey) return undefined;
  return normalizeValue(row[sourceKey]);
}

function buildPayloadFromRow(row, options = {}) {
  const mapping = options.mapping || {};
  const defaults = options.defaults || {};

  const form = {
    template: defaults.template || 'blank',
    text: pickMappedValue(row, mapping, 'text') || defaults.text,
    fontFamily: defaults.fontFamily || 'sans-bold',
    fontSize: Number(defaults.fontSize) || 16,
    align: defaults.align || 'left',
    frame: Boolean(defaults.frame),
    underline: Boolean(defaults.underline),
    dynamicType: defaults.dynamicType || 'none',
    dynamicFormat: defaults.dynamicFormat,
    counterPrefix: defaults.counterPrefix,
    counterSuffix: defaults.counterSuffix,
    counterPad: Number(defaults.counterPad) || 0,
    counterStart: Number(defaults.counterStart) || 1,
    counterStep: Number(defaults.counterStep) || 1,
    counterEnd: defaults.counterEnd,
    counterCurrent: defaults.counterCurrent,
    shape: defaults.shape || 'none',
    shapeStrokeWidth: Number(defaults.shapeStrokeWidth) || 1,
    shapeFilled: Boolean(defaults.shapeFilled),
    barcodeType: defaults.barcodeType || 'code128',
    barcodeValue: pickMappedValue(row, mapping, 'barcodeValue') || defaults.barcodeValue,
    barcodeLabel: pickMappedValue(row, mapping, 'barcodeLabel') || defaults.barcodeLabel,
    barcodeShowText: Boolean(defaults.barcodeShowText),
    qrMode: defaults.qrMode || 'text',
    qrValue: pickMappedValue(row, mapping, 'qrValue') || defaults.qrValue,
    imageData: defaults.imageData,
  };

  const perRowDynamicType = pickMappedValue(row, mapping, 'dynamicType');
  if (perRowDynamicType) {
    form.dynamicType = perRowDynamicType;
  }

  const counterCurrent = pickMappedValue(row, mapping, 'counterCurrent');
  if (counterCurrent) {
    form.dynamicType = 'counter';
    form.counterCurrent = Number(counterCurrent);
  }

  const dynamicLiteral = pickMappedValue(row, mapping, 'dynamicLiteral');
  if (dynamicLiteral) {
    form.dynamicType = 'text';
    form.text = [form.text, dynamicLiteral].filter(Boolean).join('\n');
  }

  return composer.buildDesignerPayload(form);
}

module.exports = {
  parseTableFile,
  buildPayloadFromRow,
};
