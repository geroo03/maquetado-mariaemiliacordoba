# Maquetado web de Emilia Córdoba

Maquetado editable del sitio, basado en el diseño de Figma. Es una versión de trabajo: Emilia carga sus datos, textos, colores y fotos, y después se arma la versión de producción para el dominio propio.

Está marcado con `noindex` para que Google no lo indexe mientras tenga datos de ejemplo.

## Páginas

| Archivo | Qué es |
|---|---|
| `index.html` | Inicio |
| `propiedades.html` | Listado con filtros (admite `?operacion=Alquiler`, etc.) |
| `propiedad.html?id=…` | Detalle de una propiedad |
| `sobre-mi.html` | Sobre Emilia, zonas y forma de trabajo |
| `tasacion.html` | Formulario de tasación (abre WhatsApp con los datos) |
| `gracias.html` | Confirmación |
| `editar.html` | **Panel para Emilia** |

## Cómo edita Emilia

1. Entra a `editar.html`.
2. Cambia colores (paletas o selector), letras, datos de contacto, textos, propiedades, fotos, opiniones y preguntas. Ve los cambios al instante en la vista previa (compu o celular).
3. Los cambios quedan como **borrador en su navegador** (nadie más los ve).
4. En la pestaña **Guardar** toca **Publicar en el sitio** (necesita la clave de publicación) o descarga `contenido.json` y se lo manda a Sebastián.

### Clave de publicación (token de GitHub)

El botón "Publicar" sube `data/contenido.json` a `main` con la API de GitHub, desde el navegador. Para eso usa un token que **nunca** va en el código ni en el repo: Emilia lo pega en el editor y, si quiere, queda guardado solo en su navegador.

Cómo crearlo (lo hace el dueño del repo): GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
- Repository access: **Only select repositories** → `maquetado-mariaemiliacordoba`.
- Permissions → Repository permissions → **Contents: Read and write** (nada más).
- Expiration: la más corta que sea cómoda (por ejemplo 90 días).

Riesgos: quien tenga el token puede cambiar archivos de este repo (no de otros). Si se pierde o se filtra, revocarlo en la misma pantalla. Cada publicación queda como un commit, así que cualquier cambio se puede deshacer.

Alternativa sin token en el navegador: Decap CMS con login de GitHub (OAuth). Requiere una app OAuth y un pequeño servidor intermedio (por ejemplo, un Worker gratis de Cloudflare), y Emilia necesitaría cuenta de GitHub con acceso al repo.

Lo que está entre `[corchetes]` aparece resaltado en amarillo: falta completarlo.

## Producción (build)

Lo que se publica no son los archivos tal cual, sino la carpeta `dist/` que arma `npm run build`:

- Cada página sale **con el contenido ya escrito en el HTML** (Google y las vistas previas de WhatsApp lo ven sin JavaScript). El build usa el mismo `assets/js/sitio.js` que el navegador, sobre jsdom: no hay dos versiones del diseño.
- Cada propiedad tiene su página (`propiedad-<id>.html`) con título, descripción y foto para compartir. `propiedad.html?id=…` sigue funcionando.
- Las fotos que vienen dentro del JSON se guardan como archivos en `assets/img/subidas/`.
- Genera `sitemap.xml`, `robots.txt`, `404.html` y, si hay dominio, `CNAME`.
- En el navegador `sitio.js` vuelve a armar la página igual (filtros, formulario y borrador de Emilia siguen andando).

`sitio.config.json`:

| Campo | Para qué |
|---|---|
| `urlProvisoria` | URL de GitHub Pages mientras no haya dominio. |
| `dominio` | Ej. `emiliacordoba.com.ar`. Si está, se usa para links y se crea `CNAME`. Además hay que cargar el DNS (ver abajo). |
| `indexar` | `false` = todo con `noindex` y `robots.txt` bloqueando. Pasarlo a `true` **solo** con la lista "Antes de pasar a producción" completa. |

Probar en local: `npm install`, `npm run build` y `cd dist && python3 -m http.server`.

Publicación: `.github/workflows/publicar.yml` corre el build en cada push a `main` (también cuando Emilia toca "Publicar") y sube `dist/` a Pages. Requiere **Settings → Pages → Source: GitHub Actions**.

Dominio propio (cuando NIC Argentina lo apruebe): poner `dominio` en `sitio.config.json`, en Settings → Pages → Custom domain el mismo dominio, y en el DNS del dominio los registros que indica GitHub (A/AAAA al apex y CNAME de `www` a `geroo03.github.io`). Activar "Enforce HTTPS" cuando GitHub emita el certificado.

## Cómo publica Sebastián

Si Emilia usa "Publicar", no hay que hacer nada. Si manda el archivo:

1. Reemplazar `data/contenido.json` por el archivo que mandó Emilia.
2. Commit y push a `main`. El workflow arma `dist/` y GitHub Pages actualiza el sitio en un par de minutos.

Las fotos que sube Emilia vienen dentro del JSON (achicadas a 1400 px, JPEG). El build las pasa a archivos para el HTML, pero el JSON sigue pesado: con muchas propiedades conviene que el editor suba cada foto como archivo aparte.

## Cómo funciona

- HTML, CSS y JavaScript sin dependencias ni paso de build.
- Todo el contenido sale de `data/contenido.json`; las páginas se arman con `assets/js/sitio.js`.
- Los colores son 5 variables CSS (`--fondo`, `--superficie`, `--texto`, `--acento`, `--oscuro`); el resto se deriva con `color-mix`. El color del texto sobre el acento se elige solo por contraste.
- El texto se inserta siempre con `textContent` (nunca como HTML) y las URLs de imágenes se filtran, porque el JSON puede venir de un archivo importado.
- El formulario de tasación no guarda datos en ningún servidor: arma un mensaje y abre WhatsApp al número cargado.

Para probar en local: `python3 -m http.server` en esta carpeta y abrir `http://localhost:8000`.

## Antes de pasar a producción

- [ ] Matrícula confirmada (Córdoba, Ley 9445, y CABA por separado). Hasta entonces no usar "inmobiliaria", "corredora" ni "matriculada".
- [ ] Fotos reales de Emilia.
- [ ] Propiedades reales con autorización del dueño (borrar las de ejemplo).
- [ ] Opiniones solo reales y con permiso.
- [ ] Respuestas de preguntas frecuentes (honorarios, exclusividad, portales).
- [ ] Política de privacidad para el formulario.
- [ ] Conectar el dominio (`dominio` en `sitio.config.json`) y pasar `indexar` a `true`.
- [x] `editar.html` queda en el sitio con `noindex`, sin links y bloqueado en `robots.txt`; publicar igual exige la clave.
