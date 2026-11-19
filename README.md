<div align="center">
  <h1>Programa por programa · 29N</h1>
  <p><strong>Compara propuestas. Consulta las fuentes. Saca tus propias conclusiones.</strong></p>
  <p><img src="public/og-programa-29n.png" width="720" alt="Programa por programa · Elecciones generales del 29 de noviembre de 2026. Dos papeletas con casillas."></p>
  <p>
    <a href="https://programa-por-programa-29n.cozarkd.chatgpt.site/">Abrir el cuestionario</a> ·
    <a href="#arranque-local">Arranque local</a> ·
    <a href="#fuentes-y-método">Fuentes y método</a>
  </p>
</div>

Programa por programa es un cuestionario para comparar tus respuestas con medidas concretas de los programas electorales del 29N. Puedes elegir una circunscripción o consultar el conjunto de España, y abrir la fuente de cada coincidencia o discrepancia.

## Arranque local

Necesitas **Node.js 22.23.4 o posterior** y **pnpm 12.21.0** (la versión fijada en `package.json`). Desde la raíz del repositorio:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Abre [localhost:4321](http://localhost:4321).

| Comando | Qué hace |
| --- | --- |
| `pnpm build` | Genera el sitio estático en `dist/`. |
| `pnpm preview` | Sirve localmente la última compilación. |
| `pnpm test` | Compila y comprueba el HTML, el módulo del cuestionario, la política de seguridad y la imagen social. |

Para publicar la web, configura `pnpm build` como comando de compilación y `dist/` como directorio de salida. No hace falta un servidor Node.js en producción. Si cambia el dominio público, actualiza `site` en [`astro.config.mjs`](astro.config.mjs) para que la URL canónica y la vista previa social apunten al sitio correcto.

## Fuentes y método

- **Qué cuenta:** se comparan solo las respuestas «A favor» o «En contra» para las que el programa recoge una posición clara. Las omitidas no cuentan.
- **Cómo se lee el resultado:** 3 coincidencias de 4 respuestas comparables dan un 75 %. Sin respuestas comparables se muestra «Sin puntuación». El sondeo citado en la web solo determina el orden inicial, no el porcentaje.
- **Cómo revisar una comparación:** el detalle del resultado incluye la referencia al documento electoral. La web indica el corte documental utilizado: **19 de noviembre de 2026**.

> **Privacidad:** las respuestas y los resultados se quedan en la pestaña. El cuestionario no usa analítica, cookies ni almacenamiento persistente.

## Mapa del repositorio

Astro genera el HTML y prepara los recursos. El cuestionario sigue funcionando con JavaScript en el navegador, sin API ni base de datos.

| Ruta | Contenido |
| --- | --- |
| [`src/pages/index.astro`](src/pages/index.astro) y [`src/layouts/BaseLayout.astro`](src/layouts/BaseLayout.astro) | Portada, secciones informativas y metadatos. |
| [`src/scripts/cuestionario.js`](src/scripts/cuestionario.js) | Navegación, catálogo, cálculo y detalle de los resultados. |
| [`src/data/candidaturas.js`](src/data/candidaturas.js) | Candidaturas por circunscripción y referencia al BOE. |
| [`src/data/programas.js`](src/data/programas.js) | Medidas, posiciones y referencias a los programas electorales. |
| [`src/styles/estilos.css`](src/styles/estilos.css) y [`public/`](public/) | Estilos globales e imagen para compartir la web. |

Si propones corregir una medida o una candidatura, indica la fuente y, cuando sea posible, la página o el apartado pertinente. Así se puede comprobar el cambio sin reconstruir toda la comparación.
