# Kit de marca

Colores, tipografía y la mascota que uso en este sitio y en LinkedIn. [English version](README.md).

## Colores

| Rol | Nombre | HEX |
|---|---|---|
| Fondo | Navy | `#0B2233` → `#123A5A` |
| Firma | Verde | `#15803D` (claro `#22C55E`) |
| Acento | Cian | `#22D3EE` |
| Texto sobre claro | Tinta | `#0E1B24` |
| Texto sobre oscuro | Blanco | `#F5FAFF` |
| Texto secundario | Gris | `#9FB6C8` |

Pelaje de la mascota: `#2C62A0` (oscuro `#173B63`), máscara `#E9F1F8`, interior de la oreja `#1FB6CF`.

Dos estilos, según el tema: verde sobre fondo claro para contenido de analistas (SQL, Power BI, Excel); navy con cian para cloud e ingeniería de datos.

## Tipografía

- Títulos y texto: Inter en la web, Segoe UI en Windows.
- Código y datos: JetBrains Mono o Consolas.

## Firma

Cada pieza termina con la misma línea:

```
Juan Berrio
Cloud & Data Engineer                         juanberrio0399.github.io
```

## Mascota

Un lobo con hoodie y audífonos al cuello. Es un personaje 3D completo, construido en Blender desde un script, con cuerpo que camina, saluda y parpadea.

| Archivo | Qué es |
|---|---|
| `mascot/renders/lobo_avatar.png` | Cara, 1600 × 1600. Foto de perfil. |
| `mascot/renders/lobo_cuerpo.png` | Cuerpo entero, 1600 × 2000. Publicación vertical. |
| `mascot/renders/lobo_tres_cuartos.png` | Vista de tres cuartos, 1600 × 2000. |
| `mascot/renders/lobo_banner.png` | 3168 × 792 (4:1). Portada de LinkedIn, con el lobo a la derecha. |
| `mascot/lobo.glb` | El modelo 3D con articulaciones con nombre, listo para animar. |
| `mascot/lobo-2d.svg` | Versión plana para tamaños pequeños. |
| `mascot/viewer.html` | Abre el modelo en el navegador: clic en el piso y camina hasta ahí. |
| `mascot/source/build_wolf.py` | Reconstruye el modelo y los renders. |

Para reconstruir (Blender 4.2 LTS):

```bash
blender --background --python brand/mascot/source/build_wolf.py -- <carpeta de salida> render final
```

Para verlo caminar, sirve el repo en local y abre `brand/mascot/viewer.html`.

## Reglas de uso

- Mantener los colores del lobo; no recolorearlo ni estirarlo.
- Dejar espacio libre alrededor, más o menos el ancho de una oreja.
- Sobre fondo claro, usar los renders con su propio fondo oscuro o el SVG plano.
