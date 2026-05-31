'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const printRouter = require('./routes/print');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Statische Dateien (Web-UI)
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- API-Routen ---
app.use('/api', printRouter);

// --- Fallback: alle anderen GET-Anfragen → Web-UI ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// --- Server starten ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dymo LabelManager Server läuft auf Port ${PORT}`);
  console.log(`Web-UI: http://localhost:${PORT}`);
  console.log(`API:    http://localhost:${PORT}/api/status`);
});
