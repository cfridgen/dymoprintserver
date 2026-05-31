FROM node:20-bookworm-slim

# System-Abhängigkeiten: Python, libusb, Bildverarbeitung für dymoprint
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    libusb-1.0-0 \
    libjpeg-dev \
    libpng-dev \
    libfreetype6-dev \
    libfontconfig1 \
    usbutils \
    && rm -rf /var/lib/apt/lists/*

# Python venv anlegen und dymoprint installieren
RUN python3 -m venv /opt/dymo-venv \
    && /opt/dymo-venv/bin/pip install --no-cache-dir \
        dymoprint==2.3.0 \
        Pillow \
        qrcode

ENV PATH="/opt/dymo-venv/bin:$PATH"

# udev-Regel für Dymo LabelManager PnP (USB 0x0922)
# Im Container nicht nötig, aber als Doku hinterlegt

WORKDIR /app

# Node-Abhängigkeiten zuerst (Cache-optimiert)
COPY package*.json ./
RUN npm ci --only=production

# Anwendungscode kopieren
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3000

CMD ["node", "src/index.js"]
