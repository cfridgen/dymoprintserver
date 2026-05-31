#!/usr/bin/env python3
import sys
from PIL import Image, ImageDraw, ImageFont


def main():
    if len(sys.argv) < 3:
        print("Usage: generate_ruler_label.py <output.png> <length_mm>")
        return 1

    out_path = sys.argv[1]
    length_mm = float(sys.argv[2])

    # LabelManager PnP effective horizontal density is roughly 7.09 dots/mm.
    dots_per_mm = 7.09
    width = max(120, int(round(length_mm * dots_per_mm)))
    height = 64

    img = Image.new("1", (width, height), 1)
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()

    baseline_y = height - 8
    draw.line((0, baseline_y, width - 1, baseline_y), fill=0, width=1)

    max_mm = int(round(length_mm))
    for mm in range(0, max_mm + 1):
        x = int(round(mm * dots_per_mm))
        if x >= width:
            break

        if mm % 10 == 0:
            tick_len = 14
        elif mm % 5 == 0:
            tick_len = 9
        else:
            tick_len = 5

        draw.line((x, baseline_y, x, baseline_y - tick_len), fill=0, width=1)

        if mm % 10 == 0 and mm > 0:
            cm = str(mm // 10)
            draw.text((x + 1, 2), cm, fill=0, font=font)

    draw.text((2, 2), "cm", fill=0, font=font)

    img.save(out_path, format="PNG")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
