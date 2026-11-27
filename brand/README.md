# Brand kit

Colours, type and the mascot I use on this site and on LinkedIn. [Versión en español](README.es.md).

## Colours

| Role | Name | HEX |
|---|---|---|
| Background | Navy | `#0B2233` → `#123A5A` |
| Signature | Green | `#15803D` (light `#22C55E`) |
| Accent | Cyan | `#22D3EE` |
| Text on light | Ink | `#0E1B24` |
| Text on dark | White | `#F5FAFF` |
| Secondary text | Grey | `#9FB6C8` |

Mascot fur: `#2C62A0` (dark `#173B63`), mask `#E9F1F8`, inner ear `#1FB6CF`. Hoodie: signature green, `#0E5A2B` as the base so it renders as `#15803D` under light; collar and soles in `#E9F1F8`.

Two looks, picked by topic: green on a light background for analyst content (SQL, Power BI, Excel); navy with cyan for cloud and data engineering.

## Type

- Headings and body: Inter on the web, Segoe UI on Windows.
- Code and data: JetBrains Mono or Consolas.

## Signature

Every piece ends with the same line:

```
Juan Berrio
Data & Analytics Engineer                     juanberrio0399.github.io
```

## Mascot

A wolf in a green hoodie with headphones around the neck. It is a full 3D character, built in Blender from a script, with a body that walks, waves and blinks.

| File | What it is |
|---|---|
| `mascot/renders/lobo_avatar.png` | Face, 1600 × 1600. Profile picture. |
| `mascot/renders/lobo_cuerpo.png` | Full body, 1600 × 2000. Vertical post. |
| `mascot/renders/lobo_tres_cuartos.png` | Three-quarter view, 1600 × 2000. |
| `mascot/renders/lobo_banner.png` | 3168 × 792 (4:1). LinkedIn cover, wolf on the right. |
| `mascot/poses/lobo_saludo.png` | Waving. 1600 × 2000, transparent background. |
| `mascot/poses/lobo_explica.png` | Pointing to one side, for a table or a headline. Transparent. |
| `mascot/poses/lobo_celebra.png` | Fists up. Transparent. |
| `mascot/poses/lobo_camina.png` | Walking. Transparent. |
| `mascot/lobo.glb` | The 3D model with named joints, ready to animate. |
| `mascot/lobo-2d.svg` | Flat version for small sizes. |
| `mascot/viewer.html` | Opens the model in the browser: click the floor and it walks there. |
| `mascot/source/build_wolf.py` | Rebuilds the model and the renders. |

To rebuild (Blender 4.2 LTS):

```bash
blender --background --python brand/mascot/source/build_wolf.py -- <output folder> render final
blender --background --python brand/mascot/source/build_wolf.py -- <output folder> render solo_none poses verde sinexport
```

The first line writes the model and the four renders; the second writes the poses.

To see it walk, serve the repo locally and open `brand/mascot/viewer.html`.

## README headers

Every repo opens with the same animated header: the wolf floating next to the repo name, tagline and stack. Generator and the list of repos in [`readme-banners/`](readme-banners/): `python readme_banner.py --all out` rebuilds them all; copy each one to the repo's `docs/banner.svg`.

## Social preview

`og-image.png` (1200×630, the picture LinkedIn and WhatsApp show for a link to the site) comes from [`og/og_image.py`](og/og_image.py). Change the texts at the top of the script and run `python brand/og/og_image.py` from the repo root.

## Rules of use

- Keep the wolf's colours; do not recolour or stretch it.
- Leave clear space around it, about the width of one ear.
- On a light background use the poses (transparent), the renders with their own dark backdrop, or the flat SVG.
- On a green background the hoodie blends in: prefer white or navy behind the wolf.
