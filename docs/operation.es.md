# Decisiones y operación

[English](operation.md) · Volver al [README](../README.es.md)

## Decisiones y límites

- **Sin framework y sin paso de build.** El sitio son unos cientos de líneas de HTML. Un bundler traería una cadena de herramientas que mantener y toda una familia de fallas de despliegue a cambio de nada. Además deja a Pages en *deploy from branch*, así que un sitio "compilado" no se puede desfasar del código.
- **CSP en una etiqueta meta.** Es más débil que un header (no admite `frame-ancestors` ni endpoint de reportes), pero es lo único que permite Pages y aun así bloquea scripts inline, hosts inesperados y envíos de formularios. Agregar un recurso externo implica editar la política en cada página.
- **El motor carga con la primera consulta, no con la página.** El playground está para probarlo, no para descargarlo. Diferir los 7 MB es lo que mantiene su puntaje de rendimiento en Lighthouse cerca del de la página principal.
- **El motor está fijado y con verificación de integridad en vez de alojado completo.** Los `.wasm` pesan demasiado para tenerlos en Git en un sitio de Pages; los hashes dan la misma garantía sin el peso. Solo se versiona la API en JS, que es pequeña.
- **El snapshot son datos versionados, no una llamada a una API en vivo.** El playground muestra lo que hay en el repo. No llama a GitHub en tiempo de ejecución, así que funciona sin conexión una vez el motor queda en caché y no puede filtrar un token.
- **Lo que no es.** No tiene backend, base de datos, analítica, cookies ni formularios, y nada de lo que escribe el visitante sale del navegador. Tampoco es un servicio de SQL general: el dataset es fijo, de unos 28 KB, y vive en la memoria del visitante.

## Lo que corre solo

| Qué | Cuándo | Dónde queda el resultado |
|---|---|---|
| Lighthouse CI | cada PR, cada push a `main`, ejecución manual | El check `lighthouse` y un reporte HTML subido (almacenamiento público temporal) |
| OpenSSF Scorecard | martes 06:17 UTC, pushes a `main`, PRs que tocan `.github/**` | SARIF en la pestaña Security y la insignia del README |
| Dependabot | martes, un PR agrupado | Un PR `ci:` que mueve los SHA fijados de las actions y sus comentarios de versión |
| GitHub Pages | cada push a `main` | <https://juanberrio0399.github.io> |

`main` está protegida: un PR no se puede mergear hasta que pase el check `lighthouse`, y la rama tiene que estar al día.

## Cuando algo falla

- **Lighthouse en rojo.** Accesibilidad, buenas prácticas y SEO fallan por debajo de 0,9; rendimiento solo avisa. Abre el reporte enlazado en el log del job, ahí dice qué auditoría falló. Los umbrales y las URL auditadas están en `.lighthouserc.json`.
- **El playground deja de cargar.** Casi siempre es el motor fijado: si jsDelivr sirve un archivo cuyo hash no coincide con el mapa `SRI`, la descarga falla y la página muestra el mensaje de "integrity check". Vuelve a correr el script de vendor para la versión fijada y compara los hashes antes de cambiarlos.
- **Baja el Scorecard.** El puntaje reacciona a actions sin fijar, bloques `permissions` faltantes y dependencias viejas. La entrada SARIF en la pestaña Security señala el archivo y la línea.

## Lo que falta

- El snapshot se actualiza a mano. Hasta que `build_data.py` corra programado (#42) los datos envejecen; la tabla `snapshot` está para que el visitante vea qué tan viejos son.
- El DNS y la configuración de seguridad se manejan desde la interfaz de GitHub. Pasarlos a Terraform es el siguiente paso, y la única razón por la que valdría la pena un workflow de despliegue.
- Las ideas abiertas están como issues, por ejemplo la Speculation Rules API (#34) y un playground más grande con attach remoto (#36).
