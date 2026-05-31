#!/usr/bin/env python3
import io
import json
import sys

import qrcode
from PIL import Image, ImageDraw, ImageFont
from barcode import Code128
from barcode.writer import ImageWriter


def to_px(mm):
    return max(1, int(round(float(mm) * 7.09)))


def fit_paste(canvas, img, x, y, max_w, max_h):
    img = img.convert("1")
    w, h = img.size
    scale = min(max_w / max(1, w), max_h / max(1, h), 1.0)
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    if (nw, nh) != (w, h):
      img = img.resize((nw, nh), Image.Resampling.NEAREST)
    canvas.paste(img, (x + (max_w - nw) // 2, y + (max_h - nh) // 2))


def load_font(size):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_text(canvas, text):
    draw = ImageDraw.Draw(canvas)

    lines = [line for line in str(text).split("\n") if line.strip()]
    if not lines:
        lines = [" "]

    # Ziel: deutlich mehr vertikale Flaeche ausnutzen (ca. 90%).
    target_h = int(canvas.height * 0.90)
    best_font = load_font(12)
    best_metrics = None

    for size in range(40, 9, -1):
        font = load_font(size)
        metrics = []
        max_w = 0
        total_h = 0

        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font)
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            max_w = max(max_w, w)
            metrics.append((line, w, h))
            total_h += h

        total_h += max(0, len(lines) - 1) * int(size * 0.10)

        if max_w <= canvas.width - 4 and total_h <= target_h:
            best_font = font
            best_metrics = metrics
            break

    if best_metrics is None:
        best_metrics = []
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=best_font)
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            best_metrics.append((line, w, h))

    spacing = int(getattr(best_font, "size", 12) * 0.10)
    total_h = sum(h for _, _, h in best_metrics) + max(0, len(best_metrics) - 1) * spacing
    y = max(0, (canvas.height - total_h) // 2)

    for line, tw, th in best_metrics:
        x = max(0, (canvas.width - tw) // 2)
        draw.text((x, y), line, fill=0, font=best_font)
        y += th + spacing


def draw_qr(canvas, qr_content, label):
    qr = qrcode.QRCode(border=1, box_size=2)
    qr.add_data(qr_content)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("1")

    label_h = 12 if label else 0
    fit_paste(canvas, qr_img, 0, 0, canvas.width, canvas.height - label_h)

    if label:
        draw = ImageDraw.Draw(canvas)
        font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), label, font=font)
        tw = bbox[2] - bbox[0]
        draw.text((max(0, (canvas.width - tw) // 2), canvas.height - 11), label, fill=0, font=font)


def draw_barcode(canvas, value, label):
    buf = io.BytesIO()
    code = Code128(value, writer=ImageWriter())
    code.write(
        buf,
        options={
            "module_width": 0.18,
            "module_height": 28,
            "quiet_zone": 1.0,
            "font_size": 0,
            "write_text": False,
        },
    )
    buf.seek(0)
    bar_img = Image.open(buf).convert("1")

    label_h = 12 if label else 0
    fit_paste(canvas, bar_img, 0, 0, canvas.width, canvas.height - label_h)

    if label:
        draw = ImageDraw.Draw(canvas)
        font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), label, font=font)
        tw = bbox[2] - bbox[0]
        draw.text((max(0, (canvas.width - tw) // 2), canvas.height - 11), label, fill=0, font=font)


def main():
    if len(sys.argv) < 6:
        print("Usage: generate_fixed_label.py <output.png> <mode> <payload_json> <content_mm> <tape_mm>")
        return 1

    out_path = sys.argv[1]
    mode = sys.argv[2]
    payload = json.loads(sys.argv[3])
    content_mm = float(sys.argv[4])

    width = to_px(content_mm)
    height = 64
    canvas = Image.new("1", (width, height), 1)

    if mode == "text":
        draw_text(canvas, payload.get("text", ""))
    elif mode == "qr":
        draw_qr(canvas, payload.get("qrContent", ""), payload.get("label", ""))
    elif mode == "barcode":
        draw_barcode(canvas, payload.get("barcodeValue", ""), payload.get("label", ""))
    else:
        print(f"Unsupported mode: {mode}")
        return 2

    canvas.save(out_path, format="PNG")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
