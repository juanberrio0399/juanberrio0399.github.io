"""README header for each repo: the wolf (pose "explica") floating next to the repo name. Animated SVG, wolf embedded.

Usage:  python readme_banner.py "Name" "Tagline" "Chip1|Chip2|Chip3" docs/banner.svg
        or a whole list at once:  python readme_banner.py --all out_dir [list.txt]   (default: repos.txt, public repos)
"""
import base64, io, sys, html
from pathlib import Path
from PIL import Image

LOBO = Path(__file__).resolve().parents[1] / "mascot/poses/lobo_explica.png"

def lobo_b64(alto=330):
    im = Image.open(LOBO).convert("RGBA")
    im = im.crop(im.getbbox())
    w = round(im.width * alto / im.height)
    im = im.resize((w, alto), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "WEBP", quality=88, method=6)
    return w, base64.b64encode(b.getvalue()).decode()

def banner(nombre, lema, chips, salida):
    W, H = 1280, 360
    lw, b64 = lobo_b64()
    lx, ly = W - lw - 70, H - 330 - 8
    e = html.escape
    tam = min(78, int(860 / (0.58 * max(len(nombre), 1))))          # el titulo nunca choca con el lobo
    chips_svg, x = "", 80
    for c in chips:
        if x + 22 + 10.2 * len(c) > 900:          # las que no caben antes del lobo se quedan por fuera
            break
        cw = 22 + 10.2 * len(c)
        chips_svg += (f'<g class="chip" style="animation-delay:{1.2 + 0.15 * chips.index(c):.2f}s"><rect x="{x}" y="262" width="{cw:.0f}" height="34" rx="17" fill="#0E2C44" stroke="#22D3EE" stroke-opacity=".45"/>'
                      f'<text x="{x + cw / 2:.0f}" y="285" text-anchor="middle" font-family="Consolas,monospace" font-size="16" fill="#CFFAFE">{e(c)}</text></g>')
        x += cw + 12
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="{e(nombre)} — {e(lema)}">
<title>{e(nombre)} — {e(lema)}</title>
<style>
 @keyframes flota {{ 0%,100% {{ transform: translateY(0) }} 50% {{ transform: translateY(-9px) }} }}
 @keyframes halo {{ 0%,100% {{ opacity:.55; transform: scale(1) }} 50% {{ opacity:.9; transform: scale(1.08) }} }}
 @keyframes entra {{ from {{ opacity:0; transform: translateX(-24px) }} to {{ opacity:1; transform: none }} }}
 @keyframes escribe {{ from {{ width:0 }} to {{ width:{W}px }} }}
 @keyframes cursor {{ 50% {{ opacity:0 }} }}
 @keyframes barre {{ from {{ transform: translateX(-400px) }} to {{ transform: translateX({W + 400}px) }} }}
 @keyframes pulso {{ 0%,100% {{ r:3 ; opacity:.9 }} 50% {{ r:6; opacity:.3 }} }}
 .lobo {{ animation: flota 4s ease-in-out infinite; }}
 .halo {{ transform-origin: {lx + lw / 2:.0f}px {ly + 150}px; animation: halo 4s ease-in-out infinite; }}
 .t1 {{ animation: entra .8s ease-out both; }}
 .t2 {{ animation: entra .8s ease-out .35s both; }}
 .lema {{ animation: escribe 2.2s steps(60) .7s both; }}
 .chip {{ animation: entra .6s ease-out both; }}
 .brillo {{ animation: barre 7s linear 2s infinite; }}
 .vivo {{ animation: pulso 1.6s ease-in-out infinite; }}
</style>
<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#071826"/><stop offset=".6" stop-color="#0B2233"/><stop offset="1" stop-color="#123A5A"/></linearGradient>
 <linearGradient id="ac" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#15803D"/><stop offset=".55" stop-color="#22C55E"/><stop offset="1" stop-color="#22D3EE"/></linearGradient>
 <linearGradient id="br" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
 <radialGradient id="hl"><stop offset="0" stop-color="#22D3EE" stop-opacity=".55"/><stop offset=".5" stop-color="#15803D" stop-opacity=".18"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/></radialGradient>
 <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#F5FAFF" stroke-opacity=".05"/></pattern>
 <clipPath id="r"><rect width="{W}" height="{H}" rx="22"/></clipPath>
 <clipPath id="tx"><rect x="0" y="0" width="{W}" height="{H}"/></clipPath>
</defs>
<g clip-path="url(#r)">
 <rect width="{W}" height="{H}" fill="url(#bg)"/>
 <rect width="{W}" height="{H}" fill="url(#grid)"/>
 <rect class="brillo" x="0" y="0" width="300" height="{H}" fill="url(#br)" transform="skewX(-18)"/>
 <ellipse class="halo" cx="{lx + lw / 2:.0f}" cy="{ly + 150}" rx="230" ry="190" fill="url(#hl)"/>
 <ellipse cx="{lx + lw / 2:.0f}" cy="{H - 14}" rx="120" ry="10" fill="#000" opacity=".35"/>
 <g class="lobo"><image x="{lx}" y="{ly}" width="{lw}" height="330" xlink:href="data:image/webp;base64,{b64}"/></g>
 <rect x="80" y="74" width="64" height="6" rx="3" fill="url(#ac)" class="t1"/>
 <text class="t1" x="78" y="160" font-family="'Segoe UI',Inter,Arial,sans-serif" font-weight="800" font-size="{tam}" fill="#F5FAFF" letter-spacing="-1">{e(nombre)}</text>
 <text class="t2" x="80" y="214" font-family="'Segoe UI',Inter,Arial,sans-serif" font-size="27" fill="#BFD7EA">{e(lema)}</text>
 {chips_svg}
 <circle class="vivo" cx="{W - 40}" cy="34" r="4" fill="#22C55E"/>
</g>
</svg>'''
    Path(salida).write_text(svg, encoding="utf-8")
    print(salida, len(svg) // 1024, "KB")

if __name__ == "__main__":
    if sys.argv[1] == "--all":          # repos.txt: repo|Name|Tagline|chip|chip...
        out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
        lista = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(__file__).parent / "repos.txt"
        for line in lista.read_text(encoding="utf-8").splitlines():
            if line.strip():
                repo, name, tagline, *chips = line.split("|")
                banner(name, tagline, chips, out / f"{repo}.svg")
    else:
        banner(sys.argv[1], sys.argv[2], sys.argv[3].split("|"), sys.argv[4])
