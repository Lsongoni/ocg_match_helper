"""Generate the committed PWA PNG icons from the small OCG mark."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


root = Path(__file__).resolve().parents[1] / "public" / "icons"
root.mkdir(parents=True, exist_ok=True)
fonts = [
    Path("C:/Windows/Fonts/segoeuib.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
]
font_path = next((path for path in fonts if path.exists()), None)

for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
    image = Image.new("RGB", (size, size), "#214d38")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(font_path), int(size * 0.25)) if font_path else ImageFont.load_default()
    draw.text((size / 2, size * 0.49), "OCG", fill="white", font=font, anchor="mm")
    width = max(3, round(size * 0.03))
    draw.line((size * 0.19, size * 0.73, size * 0.81, size * 0.73), fill="#76c48c", width=width)
    dot = size * 0.045
    draw.ellipse((size * 0.79 - dot, size * 0.22 - dot, size * 0.79 + dot, size * 0.22 + dot), fill="#76c48c")
    image.save(root / name, optimize=True)
