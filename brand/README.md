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

Mascot fur: `#2C62A0` (dark `#173B63`), mask `#E9F1F8`, inner ear `#1FB6CF`.

Two looks, picked by topic: green on a light background for analyst content (SQL, Power BI, Excel); navy with cyan for cloud and data engineering.

## Type

- Headings and body: Inter on the web, Segoe UI on Windows.
- Code and data: JetBrains Mono or Consolas.

## Signature

Every piece ends with the same line:

```
Juan Berrio
Cloud & Data Engineer                         juanberrio0399.github.io
```

## Mascot

A wolf in a hoodie with headphones around the neck. It is a full 3D character, built in Blender from a script, with a body that walks, waves and blinks.

| File | What it is |
|---|---|
| `mascot/renders/lobo_avatar.png` | Face, 1600 × 1600. Profile picture. |
| `mascot/renders/lobo_cuerpo.png` | Full body, 1600 × 2000. Vertical post. |
| `mascot/renders/lobo_tres_cuartos.png` | Three-quarter view, 1600 × 2000. |
| `mascot/renders/lobo_banner.png` | 3168 × 792 (4:1). LinkedIn cover, wolf on the right. |
| `mascot/lobo.glb` | The 3D model with named joints, ready to animate. |
| `mascot/lobo-2d.svg` | Flat version for small sizes. |
| `mascot/viewer.html` | Opens the model in the browser: click the floor and it walks there. |
| `mascot/source/build_wolf.py` | Rebuilds the model and the renders. |

To rebuild (Blender 4.2 LTS):

```bash
blender --background --python brand/mascot/source/build_wolf.py -- <output folder> render final
```

To see it walk, serve the repo locally and open `brand/mascot/viewer.html`.

## Rules of use

- Keep the wolf's colours; do not recolour or stretch it.
- Leave clear space around it, about the width of one ear.
- On a light background use the renders with their own dark backdrop, or the flat SVG.
