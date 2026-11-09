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

## Cómo publica Sebastián

Si Emilia usa "Publicar", no hay que hacer nada. Si manda el archivo:

1. Reemplazar `data/contenido.json` por el archivo que mandó Emilia.
2. Commit y push a `main`. GitHub Pages (publicación desde la rama `main`) actualiza el sitio en un par de minutos.

Las fotos que sube Emilia vienen dentro del JSON (achicadas a 1400 px, JPEG). Para producción conviene sacarlas a archivos en `assets/img/` y referenciarlas por ruta.

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
- [ ] Quitar `noindex`, conectar el dominio y sacar `editar.html` del sitio público.
