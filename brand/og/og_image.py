"""Social preview for the site (og-image.png, 1200x630): name, title, stack, availability and the wolf.

Usage:  python brand/og/og_image.py            -> writes og-image.png at the repo root
        python brand/og/og_image.py out.png    -> writes somewhere else

Fonts: Inter if it is installed, otherwise Segoe UI (Windows), otherwise DejaVu (Linux).
Edit the texts below and run it again; the image keeps the brand palette from brand/README.md.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parents[2]
LOBO = RAIZ / "brand/mascot/poses/lobo_explica.png"

W, H = 1200, 630
NAVY_0, NAVY, NAVY_2 = (7, 24, 38), (11, 34, 51), (18, 58, 90)   # #071826 #0B2233 #123A5A
VERDE, VERDE_OSC, CIAN = (34, 197, 94), (21, 128, 61), (34, 211, 238)  # #22C55E #15803D #22D3EE
BLANCO, GRIS, CHIP = (245, 250, 255), (159, 182, 200), (14, 44, 68)

NOMBRE = "Juan Berrio"
TITULO = "Data & Analytics Engineer"
STACK = "Python · SQL · DuckDB · Power BI · Cloudflare"
DISPONIBLE = "Open to remote Data & Analytics roles"
PIE = "juanberrio0399.github.io  ·  Bogotá, Colombia (Remote · GMT-5)"

FUENTES = {
    "bold": ["Inter-Bold.ttf", "Inter_18pt-Bold.ttf", "segoeuib.ttf", "DejaVuSans-Bold.ttf"],
    "semi": ["Inter-SemiBold.ttf", "Inter_18pt-SemiBold.ttf", "seguisb.ttf", "DejaVuSans-Bold.ttf"],
    "reg": ["Inter-Regular.ttf", "Inter_18pt-Regular.ttf", "segoeui.ttf", "DejaVuSans.ttf"],
    "mono": ["JetBrainsMono-Regular.ttf", "consola.ttf", "DejaVuSansMono.ttf"],
}
CARPETAS = [Path("C:/Windows/Fonts"), Path.home() / "AppData/Local/Microsoft/Windows/Fonts",
            Path("/usr/share/fonts/truetype/dejavu"), Path("/usr/share/fonts/truetype/inter")]


def fuente(tipo, tam):
    for nombre in FUENTES[tipo]:
        for c in CARPETAS:
            if (c / nombre).exists():
                return ImageFont.truetype(str(c / nombre), tam)
    return ImageFont.load_default(tam)


def fondo():
    # Diagonal navy gradient, built small and scaled up so it stays smooth and light.
    g = Image.new("RGB", (120, 63))
    px = g.load()
    for y in range(63):
        for x in range(120):
            t = (x / 119 + y / 62) / 2
            a, b, u = (NAVY_0, NAVY, t / 0.6) if t < 0.6 else (NAVY, NAVY_2, (t - 0.6) / 0.4)
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * u) for i in range(3))
    im = g.resize((W, H), Image.BICUBIC).convert("RGBA")
    rejilla = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(rejilla)
    for x in range(0, W, 40):
        d.line([(x, 0), (x, H)], fill=(*BLANCO, 10))
    for y in range(0, H, 40):
        d.line([(0, y), (W, y)], fill=(*BLANCO, 10))
    return Image.alpha_composite(im, rejilla)


def barra_acento(im, x, y, w, h):
    # Green -> cyan bar, same accent gradient as the README banners.
    g = Image.new("RGBA", (w, h))
    px = g.load()
    for i in range(w):
        t = i / max(w - 1, 1)
        a, b, u = (VERDE_OSC, VERDE, t / 0.55) if t < 0.55 else (VERDE, CIAN, (t - 0.55) / 0.45)
        col = tuple(round(a[k] + (b[k] - a[k]) * u) for k in range(3))
        for j in range(h):
            px[i, j] = (*col, 255)
    im.alpha_composite(g, (x, y))


def lobo(im, alto=540):
    lb = Image.open(LOBO).convert("RGBA")
    lb = lb.crop(lb.getbbox())
    lb = lb.resize((round(lb.width * alto / lb.height), alto), Image.LANCZOS)
    x, y = W - lb.width - 48, H - alto - 20
    halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cx, cy, r = x + lb.width // 2, y + alto // 2, 250
    ImageDraw.Draw(halo).ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*CIAN, 70))
    im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(90)))
    im.alpha_composite(lb, (x, y))
    return x


def generar(salida):
    im = fondo()
    limite = lobo(im) - 30  # nothing on the left side may cross into the wolf
    d = ImageDraw.Draw(im)
    x = 80

    # Availability chip
    f_chip = fuente("semi", 24)
    tw = d.textlength(DISPONIBLE, font=f_chip)
    cw, ch, cy = int(tw + 76), 48, 78
    d.rounded_rectangle([x, cy, x + cw, cy + ch], radius=24, fill=CHIP, outline=(*CIAN, 140), width=2)
    d.ellipse([x + 22, cy + 17, x + 36, cy + 31], fill=VERDE)
    d.text((x + 50, cy + ch / 2), DISPONIBLE, font=f_chip, fill=BLANCO, anchor="lm")

    # Name and title
    f_nom = fuente("bold", 92)
    d.text((x - 4, 170), NOMBRE, font=f_nom, fill=BLANCO)
    tam = 54
    while d.textlength(TITULO, font=fuente("semi", tam)) > limite - x and tam > 30:
        tam -= 2
    d.text((x, 292), TITULO, font=fuente("semi", tam), fill=VERDE)
    barra_acento(im, x, 382, 120, 6)

    # Stack and footer
    f_mono = fuente("mono", 27)
    d.text((x, 418), STACK, font=f_mono, fill=(207, 250, 254))
    d.text((x, H - 78), PIE, font=fuente("reg", 24), fill=GRIS)

    anchos = [d.textlength(STACK, font=f_mono), d.textlength(PIE, font=fuente("reg", 24)), cw]
    if x + max(anchos) > limite:
        print(f"aviso: un texto llega a x={x + max(anchos):.0f} y el lobo empieza en {limite + 30}")

    im = im.convert("RGB")
    im.save(salida, optimize=True)
    if Path(salida).stat().st_size > 150 * 1024:  # social previews should stay light: fall back to 256 colors
        im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG) \
            .save(salida, optimize=True)
    print(f"{salida}  ({Path(salida).stat().st_size // 1024} KB)")


if __name__ == "__main__":
    generar(sys.argv[1] if len(sys.argv) > 1 else RAIZ / "og-image.png")
