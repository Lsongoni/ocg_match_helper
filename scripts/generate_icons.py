"""Generate the committed PWA PNG icons from the four-point star mark.

Mirrors public/icons/favicon.svg so the installed icon and the browser tab
share one identity. Run with: python scripts/generate_icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / "public" / "icons"
root.mkdir(parents=True, exist_ok=True)

TOP = (32, 100, 71)
BOTTOM = (12, 38, 26)
MARK_TOP = (186, 240, 204)
MARK_BOTTOM = (104, 196, 141)
ACCENT = (146, 216, 172)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def star_points(cx, cy, outer, waist):
    """Four-point star: rays along the axes, shoulders pulled to `waist`."""
    tips = [(cx, cy - outer), (cx + outer, cy), (cx, cy + outer), (cx - outer, cy)]
    points = []
    for index, tip in enumerate(tips):
        points.append(tip)
        nxt = tips[(index + 1) % 4]
        corner_x = (tip[0] + nxt[0]) / 2
        corner_y = (tip[1] + nxt[1]) / 2
        points.append((cx + (corner_x - cx) * waist, cy + (corner_y - cy) * waist))
    return points


def build(size, *, rounded):
    scale = 4  # supersample for smooth edges
    s = size * scale
    image = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    # Diagonal background gradient.
    gradient = Image.new("RGBA", (s, s))
    gdraw = ImageDraw.Draw(gradient)
    for y in range(s):
        gdraw.line([(0, y), (s, y)], fill=lerp(TOP, BOTTOM, (y / max(1, s - 1)) ** 0.85) + (255,))

    mask = Image.new("L", (s, s), 0)
    mdraw = ImageDraw.Draw(mask)
    if rounded:
        mdraw.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.219), fill=255)
    else:
        mdraw.rectangle([0, 0, s - 1, s - 1], fill=255)
    image.paste(gradient, (0, 0), mask)

    draw = ImageDraw.Draw(image)

    star_y = s * 0.5
    outer = s * 0.30

    # Orbit ring centred on the star: reads as the pairings circle, not a mouth.
    orbit = s * 0.395
    draw.ellipse(
        [s / 2 - orbit, star_y - orbit, s / 2 + orbit, star_y + orbit],
        outline=ACCENT + (70,), width=max(1, int(s * 0.010)),
    )

    # Diagonal compass ticks on the orbit.
    for dx, dy, r in ((1, 1, 0.030), (-1, 1, 0.021), (1, -1, 0.021), (-1, -1, 0.016)):
        cx = s / 2 + dx * orbit * 0.707
        cy = star_y + dy * orbit * 0.707
        rr = s * r
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=ACCENT + (150,))

    # Core star with a vertical gradient fill.
    points = star_points(s / 2, star_y, outer, 0.42)
    star_mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(star_mask).polygon(points, fill=255)
    star_fill = Image.new("RGBA", (s, s))
    sdraw = ImageDraw.Draw(star_fill)
    top_y, bot_y = star_y - outer, star_y + outer
    for y in range(s):
        t = (y - top_y) / max(1, bot_y - top_y)
        sdraw.line([(0, y), (s, y)], fill=lerp(MARK_TOP, MARK_BOTTOM, min(1, max(0, t))) + (255,))
    image.paste(star_fill, (0, 0), star_mask)

    # Core ring.
    ring = s * 0.050
    ring_width = max(2, int(s * 0.019))
    draw.ellipse(
        [s / 2 - ring, star_y - ring, s / 2 + ring, star_y + ring],
        outline=BOTTOM + (190,), width=ring_width,
    )
    inner = s * 0.021
    draw.ellipse(
        [s / 2 - inner, star_y - inner, s / 2 + inner, star_y + inner],
        fill=(240, 253, 245, 255),
    )

    # Counter dots: one strong, one faint.
    dot = s * 0.046
    draw.ellipse(
        [s * 0.755 - dot, s * 0.245 - dot, s * 0.755 + dot, s * 0.245 + dot],
        fill=ACCENT + (205,),
    )
    small = s * 0.026
    draw.ellipse(
        [s * 0.245 - small, s * 0.245 - small, s * 0.245 + small, s * 0.245 + small],
        fill=ACCENT + (100,),
    )

    return image.resize((size, size), Image.LANCZOS)


for name, size, rounded in (
    ("icon-192.png", 192, True),
    ("icon-512.png", 512, True),
    ("apple-touch-icon.png", 180, False),
):
    build(size, rounded=rounded).save(root / name, optimize=True)
    print(f"wrote {name}")
