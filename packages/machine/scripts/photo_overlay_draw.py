"""Draws the output of photo-overlay.ts over the photograph it was projected into.

    python3 photo_overlay_draw.py <photo.jpg> <overlay.json> <out.jpg>
        [--crop x0,y0,x1,y1] [--scale s] [--only group,group] [--not group,group]
        [--width px] [--silhouette] [--ticks]

--crop is in pixels of the photograph, --scale enlarges or reduces the result, --only and --not
choose groups (rim, wall, floor.x, floor.y, tines, shelf, holder, tray, arm, extra, ...).
--silhouette draws each wire as the two edges of its projected thickness instead of its centre
line (to compare wire diameters). --ticks marks every 100 px of the photograph on the border.
See the head of photo-overlay.ts for the frame and the camera.
"""

import json
import math
import sys

from PIL import Image, ImageDraw

COLOURS = {
    "rim": (255, 60, 60),
    "wall": (255, 150, 0),
    "floor.x": (0, 255, 255),
    "floor.y": (255, 0, 255),
    "tines": (255, 255, 0),
    "shelf": (80, 255, 80),
    "holder": (80, 255, 80),
    "tray": (120, 160, 255),
    "arm": (255, 255, 255),
    "extra": (0, 255, 0),
    "extra2": (255, 0, 255),
}


def option(name, default=None):
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]
    return default


def main():
    photo, overlay, out = sys.argv[1:4]
    crop = option("--crop")
    scale = float(option("--scale", "1"))
    only = option("--only")
    without = option("--not")
    width = int(option("--width", "2"))
    silhouette = "--silhouette" in sys.argv
    data = json.load(open(overlay))
    im = Image.open(photo).convert("RGB")
    x0, y0, x1, y1 = (0, 0, im.width, im.height)
    if crop:
        x0, y0, x1, y1 = [int(v) for v in crop.split(",")]
        im = im.crop((x0, y0, x1, y1))
    if scale != 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    f = data["camera"]["focalPx"]
    to = lambda p: ((p[0] - x0) * scale, (p[1] - y0) * scale)
    for s in data["segments"]:
        g = s["group"]
        if only and g not in only.split(","):
            continue
        if without and g in without.split(","):
            continue
        colour = COLOURS.get(g, (255, 255, 255))
        a, b = s["pa"], s["pb"]
        if max(abs(a[0]), abs(a[1]), abs(b[0]), abs(b[1])) > 1e5:
            continue
        if silhouette and s["radiusMm"] > 0:
            dx, dy = b[0] - a[0], b[1] - a[1]
            n = math.hypot(dx, dy)
            if n < 1e-6:
                continue
            nx, ny = -dy / n, dx / n
            ra, rb = f * s["radiusMm"] / s["da"], f * s["radiusMm"] / s["db"]
            for sign in (-1, 1):
                d.line(
                    [to((a[0] + sign * nx * ra, a[1] + sign * ny * ra)),
                     to((b[0] + sign * nx * rb, b[1] + sign * ny * rb))],
                    fill=colour, width=1)
        else:
            d.line([to(a), to(b)], fill=colour, width=width)
    if "--ticks" in sys.argv:
        for X in range((x0 // 100 + 1) * 100, x1, 100):
            px = (X - x0) * scale
            d.line([(px, 0), (px, 12)], fill=(255, 255, 0), width=2)
            d.text((px + 2, 12), str(X), fill=(255, 255, 0))
        for Y in range((y0 // 100 + 1) * 100, y1, 100):
            py = (Y - y0) * scale
            d.line([(0, py), (12, py)], fill=(255, 255, 0), width=2)
            d.text((14, py - 5), str(Y), fill=(255, 255, 0))
    im.save(out, quality=90)


main()
