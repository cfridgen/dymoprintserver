# Changelog

## 1.5.0-dev.0 - Unreleased

### Added
- Generic compose API for multi-object labels via `/api/print/compose`
- Advanced browser designer with templates, fonts, frames, shapes, image upload, QR modes, and multiple barcode types
- Dynamic text objects for date, time, datetime, and counters
- Built-in templates: blank, warning, badge, inventory, cable, address
- Counter series endpoint for automated sequential labels
- CSV/XLSX parse endpoint and batch printing flow with column mapping
- Advanced code support for PDF417, DataMatrix, UPC-E, and QR vCard payloads

### Changed
- Text, QR, and barcode routes now use the shared composition pipeline
- Label rendering upgraded from single-purpose layouts to a reusable object renderer

## 1.0.1 - 2026-05-31

### Changed
- README with real UI screenshots
- package metadata links fixed to the published GitHub repository
- release packaging cleanup for initial public publication

## 1.0.0 - 2026-05-31

### Added
- Local-first DYMO LabelManager PnP print server
- REST API endpoints for text, QR, barcode, and ruler test labels
- Browser UI with status check and test print actions
- Fixed-length label rendering pipeline with calibration-aware layout
- USB setup guidance and local setup automation
- Project standards: CI, issue templates, PR template, contribution docs, security policy, code of conduct, MIT license
