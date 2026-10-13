"""Regenerate public/favicon/* (an open book on a blue tile). Needs Pillow."""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "favicon"
BLUE = "#2456c9"
WHITE = "#ffffff"
SIZE = 1024  # drawn large, then downsampled

# Left page and its text lines, on a 1024 grid; the right side is mirrored.
PAGE = [(488, 318), (176, 258), (176, 706), (488, 766)]
LINES = [((236, 388 + i * 92), (428, 425 + i * 92)) for i in range(3)]


def mirror(points):
    return [(SIZE - x, y) for x, y in points]


def draw() -> Image.Image:
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    d.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=200, fill=BLUE)
    for flip in (lambda p: p, mirror):
        d.polygon(flip(PAGE), fill=WHITE)
        for line in LINES:
            d.line(flip(list(line)), fill=BLUE, width=36)
    return image


def svg() -> str:
    def points(ps):
        return " ".join(f"{x},{y}" for x, y in ps)

    parts = [f'<rect width="{SIZE}" height="{SIZE}" rx="200" fill="{BLUE}"/>']
    for flip in (lambda p: p, mirror):
        parts.append(f'<polygon points="{points(flip(PAGE))}" fill="{WHITE}"/>')
        for line in LINES:
            (x1, y1), (x2, y2) = flip(list(line))
            parts.append(
                f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{BLUE}" stroke-width="36"/>'
            )
    body = "\n  ".join(parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">\n  {body}\n</svg>\n'
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    master = draw()
    sizes = {
        "favicon-16x16.png": 16,
        "favicon-32x32.png": 32,
        "apple-touch-icon.png": 180,
        "android-chrome-192x192.png": 192,
        "android-chrome-512x512.png": 512,
    }
    for name, size in sizes.items():
        icon = master.resize((size, size), Image.LANCZOS)
        if name.startswith("apple"):
            # iOS fills transparent corners with black, so give it a full tile.
            tile = Image.new("RGBA", icon.size, BLUE)
            tile.alpha_composite(icon)
            icon = tile.convert("RGB")
        icon.save(OUT / name)
    master.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    (OUT / "favicon.svg").write_text(svg())


if __name__ == "__main__":
    main()
