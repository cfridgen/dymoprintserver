#!/usr/bin/env python3
import base64
import io
import json
import math
import sys
from datetime import datetime

import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageOps
from barcode import get_barcode_class
from barcode.writer import ImageWriter
import pdf417gen
from pystrich.datamatrix import DataMatrixEncoder

DOTS_PER_MM = 7.09
CANVAS_HEIGHT = 64

FONT_MAP = {
    "sans": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "sans-bold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "serif": "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "serif-bold": "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    "mono": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "mono-bold": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
}


def to_px(mm):
    return max(1, int(round(float(mm) * DOTS_PER_MM)))


def pct_to_px(value, total):
    return int(round((float(value) / 100.0) * total))


def load_font(family, size):
    family = family or "sans-bold"
    path = FONT_MAP.get(family, FONT_MAP["sans-bold"])
    try:
        return ImageFont.truetype(path, size=max(1, int(size)))
    except OSError:
        return ImageFont.load_default()


def measure_text(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def fit_text_font(draw, lines, family, target_size, box_w, box_h, padding, min_size=4):
    size = max(min_size, int(target_size))
    while size >= min_size:
        font = load_font(family, size)
        spacing = max(1, int(size * 0.08))
        max_w = 0
        total_h = 0

        for line in lines:
            tw, th = measure_text(draw, line, font)
            max_w = max(max_w, tw)
            total_h += th

        total_h += max(0, len(lines) - 1) * spacing
        if max_w <= max(1, box_w - 2 * padding - 6) and total_h <= max(1, box_h - 2 * padding - 2):
            return font, spacing, max_w, total_h

        size -= 1

    font = load_font(family, min_size)
    spacing = max(1, int(min_size * 0.08))
    max_w = 0
    total_h = 0
    for line in lines:
        tw, th = measure_text(draw, line, font)
        max_w = max(max_w, tw)
        total_h += th
    total_h += max(0, len(lines) - 1) * spacing
    return font, spacing, max_w, total_h


def fit_image(img, max_w, max_h):
    img = img.convert("1")
    w, h = img.size
    scale = min(max_w / max(1, w), max_h / max(1, h), 1.0)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    if (nw, nh) != (w, h):
        img = img.resize((nw, nh), Image.Resampling.NEAREST)
    return img


def resolve_dynamic_text(obj):
    kind = obj.get("type")
    if kind == "date":
        return datetime.now().strftime(obj.get("format") or "%d.%m.%Y")
    if kind == "time":
        return datetime.now().strftime(obj.get("format") or "%H:%M")
    if kind == "datetime":
        return datetime.now().strftime(obj.get("format") or "%d.%m.%Y %H:%M")
    if kind == "counter":
        start = int(obj.get("start", 1))
        step = int(obj.get("step", 1))
        current = int(obj.get("current", start))
        end = obj.get("end")
        if end is not None and current > int(end):
            current = int(end)
        width = int(obj.get("pad", 0))
        prefix = obj.get("prefix", "")
        suffix = obj.get("suffix", "")
        value = str(current).zfill(width) if width > 0 else str(current)
        return f"{prefix}{value}{suffix}"
    return obj.get("text", "")


def draw_border(draw, box, width=1, radius=0, fill=None):
    x, y, w, h = box
    x2 = x + w
    y2 = y + h
    if fill is not None:
        if radius > 0:
            draw.rounded_rectangle((x, y, x2, y2), radius=radius, outline=0, fill=fill, width=width)
        else:
            draw.rectangle((x, y, x2, y2), outline=0, fill=fill, width=width)
    else:
        if radius > 0:
            draw.rounded_rectangle((x, y, x2, y2), radius=radius, outline=0, width=width)
        else:
            draw.rectangle((x, y, x2, y2), outline=0, width=width)


def draw_shape(draw, obj, width, height):
    x = pct_to_px(obj.get("x", 0), width)
    y = pct_to_px(obj.get("y", 0), height)
    w = max(1, pct_to_px(obj.get("w", 10), width))
    h = max(1, pct_to_px(obj.get("h", 10), height))
    stroke = int(obj.get("strokeWidth", 1))
    filled = bool(obj.get("filled", False))
    fill = 0 if filled else None
    shape = obj.get("shape", "rect")

    if shape == "rect":
        draw_border(draw, (x, y, w, h), width=stroke, fill=fill)
    elif shape == "roundrect":
        draw_border(draw, (x, y, w, h), width=stroke, radius=min(w, h) // 6, fill=fill)
    elif shape == "line":
        draw.line((x, y, x + w, y + h), fill=0, width=stroke)
    elif shape == "circle":
        draw.ellipse((x, y, x + w, y + h), outline=0, fill=fill, width=stroke)


def draw_text_object(draw, canvas, obj, width, height):
    x = pct_to_px(obj.get("x", 0), width)
    y = pct_to_px(obj.get("y", 0), height)
    w = max(1, pct_to_px(obj.get("w", 20), width))
    h = max(1, pct_to_px(obj.get("h", 20), height))
    padding = int(obj.get("padding", 2))
    border = bool(obj.get("border", False))
    invert = bool(obj.get("invert", False))
    underline = bool(obj.get("underline", False))
    align = obj.get("align", "center")
    family = obj.get("fontFamily", "sans-bold")
    size = int(obj.get("fontSize", 0) or 0)
    auto_fit = bool(obj.get("autoFit", size <= 0))
    lines = [line for line in resolve_dynamic_text(obj).split("\n") if line.strip()] or [" "]
    single_line_fill_ratio = float(obj.get("singleLineFillRatio", 0) or 0)
    desired_single_line_h = None
    if len(lines) == 1 and single_line_fill_ratio > 0:
        desired_single_line_h = min(
            max(1, int(round(height * single_line_fill_ratio))),
            max(1, h - 2 * padding),
        )

    if auto_fit:
        target_size = int(obj.get("targetFontSize", 42) or 42)
        if len(lines) == 1:
            # For single-line labels, prefer using almost the full box height.
            target_size = max(target_size, int((h - 2 * padding) * 2.2))
        font, spacing, _, total_h = fit_text_font(draw, lines, family, target_size, w, h, padding)
    else:
        font = load_font(family, size)
        spacing = max(1, int(size * 0.08))
        total_h = 0
        for line in lines:
            _, th = measure_text(draw, line, font)
            total_h += th
        total_h += max(0, len(lines) - 1) * spacing

    if invert:
        draw_border(draw, (x, y, w, h), width=1, fill=0)
    if border and not invert:
        draw_border(draw, (x, y, w, h), width=int(obj.get("borderWidth", 1)))

    metrics = []
    for line in lines:
        tw, th = measure_text(draw, line, font)
        metrics.append((line, tw, th))

    if desired_single_line_h is not None and len(metrics) == 1:
        line, tw, th = metrics[0]
        if th > 0 and th < desired_single_line_h:
            total_h = desired_single_line_h

    origin_y = y + max(padding, (h - total_h) // 2)
    text_fill = 1 if invert else 0
    for line, tw, th in metrics:
        if align == "left":
            origin_x = x + padding
        elif align == "right":
            origin_x = x + w - tw - padding
        else:
            origin_x = x + max(padding, (w - tw) // 2)

        render_h = th
        if desired_single_line_h is not None and len(metrics) == 1 and th > 0 and desired_single_line_h > th:
            bbox = draw.textbbox((0, 0), line, font=font)
            bbox_w = max(1, bbox[2] - bbox[0])
            bbox_h = max(1, bbox[3] - bbox[1])
            mask = Image.new("L", (bbox_w, bbox_h), 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.text((-bbox[0], -bbox[1]), line, fill=255, font=font)
            stretched_mask = mask.resize((bbox_w, desired_single_line_h), Image.Resampling.BICUBIC)
            stretch_x = x + max(padding, (w - bbox_w) // 2) if align == "center" else origin_x
            if align == "right":
                stretch_x = x + w - bbox_w - padding
            canvas.paste(text_fill, (stretch_x, origin_y), stretched_mask)
            render_h = desired_single_line_h
        else:
            draw.text((origin_x, origin_y), line, fill=text_fill, font=font)

        if underline:
            uy = origin_y + render_h + 1
            draw.line((origin_x, uy, origin_x + tw, uy), fill=text_fill, width=1)
        origin_y += render_h + spacing


def build_vcard_payload(value):
    if isinstance(value, dict):
        first = value.get("firstName", "")
        last = value.get("lastName", "")
        name = value.get("name") or " ".join(part for part in [first, last] if part).strip()
        org = value.get("org", "")
        title = value.get("title", "")
        phone = value.get("phone", "")
        email = value.get("email", "")
        url = value.get("url", "")
        address = value.get("address", "")
        lines = [
            "BEGIN:VCARD",
            "VERSION:3.0",
            f"FN:{name}",
            f"N:{last};{first};;;",
        ]
        if org:
            lines.append(f"ORG:{org}")
        if title:
            lines.append(f"TITLE:{title}")
        if phone:
            lines.append(f"TEL:{phone}")
        if email:
            lines.append(f"EMAIL:{email}")
        if url:
            lines.append(f"URL:{url}")
        if address:
            lines.append(f"ADR:;;{address};;;;")
        lines.append("END:VCARD")
        return "\n".join(lines)
    return str(value)


def build_barcode(value, symbology, show_text=False):
    symbology = (symbology or "code128").lower()
    if symbology == "pdf417":
        codes = pdf417gen.encode(str(value), columns=4, security_level=2)
        return pdf417gen.render_image(codes, scale=1, ratio=2, padding=2, fg_color="#000", bg_color="#fff").convert("1")

    if symbology == "datamatrix":
        encoder = DataMatrixEncoder(str(value))
        return Image.open(io.BytesIO(encoder.get_imagedata())).convert("1")

    name_map = {
        "code128": "code128",
        "code39": "code39",
        "ean13": "ean13",
        "ean8": "ean8",
        "upca": "upc",
        "upce": "upca",
        "itf": "itf",
        "codabar": "codabar",
    }
    barcode_name = name_map.get(symbology, "code128")
    klass = get_barcode_class(barcode_name)
    output = io.BytesIO()
    code = klass(str(value), writer=ImageWriter())
    code.write(
        output,
        options={
            "module_width": 0.18,
            "module_height": 28,
            "quiet_zone": 1.0,
            "font_size": 8 if show_text else 0,
            "text_distance": 1,
            "write_text": bool(show_text),
        },
    )
    output.seek(0)
    return Image.open(output).convert("1")


def build_qr_image(value, mode):
    payload = value
    mode = (mode or "text").lower()
    if mode == "url":
        payload = str(payload)
    elif mode == "phone":
        payload = f"tel:{payload}"
    elif mode == "email":
        payload = f"mailto:{payload}"
    elif mode == "sms":
        payload = f"SMSTO:{payload}"
    elif mode == "vcard":
        payload = build_vcard_payload(payload)
    else:
        payload = str(payload)
    qr = qrcode.QRCode(border=1, box_size=4)
    qr.add_data(payload)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("1")


def decode_image_source(source):
    if not source:
        return None
    if source.startswith("data:image"):
        _, encoded = source.split(",", 1)
        raw = base64.b64decode(encoded)
        return Image.open(io.BytesIO(raw)).convert("1")
    return Image.open(source).convert("1")


def draw_image_object(canvas, obj, width, height):
    img = decode_image_source(obj.get("data") or obj.get("src"))
    if img is None:
        return
    x = pct_to_px(obj.get("x", 0), width)
    y = pct_to_px(obj.get("y", 0), height)
    w = max(1, pct_to_px(obj.get("w", 20), width))
    h = max(1, pct_to_px(obj.get("h", 20), height))
    img = fit_image(img, w, h)
    canvas.paste(img, (x + (w - img.width) // 2, y + (h - img.height) // 2))


def draw_code_object(canvas, draw, obj, width, height):
    kind = obj.get("type")
    x = pct_to_px(obj.get("x", 0), width)
    y = pct_to_px(obj.get("y", 0), height)
    w = max(1, pct_to_px(obj.get("w", 20), width))
    h = max(1, pct_to_px(obj.get("h", 20), height))

    if kind == "barcode":
        img = build_barcode(obj.get("value", ""), obj.get("symbology", "code128"), bool(obj.get("showText", False)))
    else:
        img = build_qr_image(obj.get("value", ""), obj.get("mode", "text"))

    img = fit_image(img, w, h)
    canvas.paste(img, (x + (w - img.width) // 2, y + (h - img.height) // 2))

    label = obj.get("label")
    if label:
        draw_text_object(draw, canvas, {
            "type": "text",
            "text": label,
            "x": obj.get("x", 0),
            "y": obj.get("y", 0) + obj.get("h", 20) - 18,
            "w": obj.get("w", 20),
            "h": 18,
            "fontSize": 10,
            "fontFamily": "sans",
            "align": "center",
        }, width, height)


def apply_template_background(draw, template, width, height):
    template = (template or "blank").lower()
    if template == "warning":
        draw_border(draw, (0, 0, width - 1, height - 1), width=2)
        draw.rectangle((0, 0, width - 1, 15), outline=0, fill=0)
    elif template == "badge":
        draw_border(draw, (0, 0, width - 1, height - 1), width=2, radius=8)
        draw.rectangle((0, 0, width - 1, 12), outline=0, fill=0)
    elif template == "inventory":
        draw_border(draw, (0, 0, width - 1, height - 1), width=1)
        draw.line((0, 14, width - 1, 14), fill=0, width=1)
    elif template == "cable":
        draw.rounded_rectangle((0, 6, width - 1, height - 7), radius=10, outline=0, width=2)


def main():
    if len(sys.argv) < 5:
        print("Usage: render_composed_label.py <output.png> <payload_json> <content_mm> <tape_mm> [post_feed_mm]")
        return 1

    out_path = sys.argv[1]
    payload = json.loads(sys.argv[2])
    content_mm = float(sys.argv[3])
    post_feed_mm = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    content_width = to_px(content_mm)
    post_feed_width = to_px(post_feed_mm) if post_feed_mm > 0 else 0
    height = CANVAS_HEIGHT

    content_canvas = Image.new("1", (content_width, height), 1)
    content_draw = ImageDraw.Draw(content_canvas)
    apply_template_background(content_draw, payload.get("template"), content_width, height)

    for obj in payload.get("objects", []):
        kind = obj.get("type")
        if kind in {"text", "date", "time", "datetime", "counter"}:
            draw_text_object(content_draw, content_canvas, obj, content_width, height)
        elif kind == "shape":
            draw_shape(content_draw, obj, content_width, height)
        elif kind == "image":
            draw_image_object(content_canvas, obj, content_width, height)
        elif kind in {"barcode", "qr"}:
            draw_code_object(content_canvas, content_draw, obj, content_width, height)

    if post_feed_width > 0:
        # Prepend blank area so physical cut happens after content on printers
        # that interpret image direction opposite to the UI layout.
        canvas = Image.new("1", (content_width + post_feed_width, height), 1)
        canvas.paste(content_canvas, (post_feed_width, 0))
    else:
        canvas = content_canvas

    canvas.save(out_path, format="PNG")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
