// Genera la versión de producción en dist/.
//
// Cada página se arma acá, con el mismo assets/js/sitio.js que usa el navegador
// (sobre un DOM de jsdom), y se guarda con el contenido ya escrito en el HTML.
// Así Google y las vistas previas de WhatsApp/Instagram ven textos, títulos y
// fotos sin ejecutar JavaScript. En el navegador, sitio.js vuelve a armar la
// página igual (para los filtros, el formulario y el borrador de Emilia).
//
// Uso: npm run build   (lee sitio.config.json y data/contenido.json)

import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { archivoPropiedad } from "../assets/js/contenido.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(RAIZ, "dist");
const SITIO_JS = pathToFileURL(join(RAIZ, "assets/js/sitio.js")).href;

// Lo que no se publica: herramientas de desarrollo y documentación interna.
const NO_PUBLICAR = new Set([".git", ".github", "node_modules", "dist", "scripts", "package.json", "package-lock.json", "sitio.config.json", "README.md", ".gitignore"]);

const PAGINAS = [
  { archivo: "index.html", titulo: null },
  { archivo: "propiedades.html", titulo: "Propiedades en venta y alquiler" },
  { archivo: "sobre-mi.html", titulo: "Sobre mí" },
  { archivo: "tasacion.html", titulo: "Pedí tu tasación" },
  { archivo: "gracias.html", titulo: "Gracias", privada: true },
  { archivo: "propiedad.html", titulo: "Propiedad", privada: true },
  { archivo: "404.html", titulo: "Página no encontrada", privada: true },
];

// ---------- Configuración ----------
function leerConfig(crudo) {
  const dominio = typeof crudo.dominio === "string" ? crudo.dominio.trim().toLowerCase() : "";
  if (dominio && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dominio)) throw new Error(`sitio.config.json: dominio inválido "${crudo.dominio}"`);
  const url = dominio ? `https://${dominio}/` : String(crudo.urlProvisoria ?? "");
  if (!/^https:\/\/[^\s]+\/$/.test(url)) throw new Error("sitio.config.json: falta dominio o urlProvisoria (https://…/ con barra final)");
  if (typeof crudo.indexar !== "boolean") throw new Error("sitio.config.json: indexar tiene que ser true o false");
  return { dominio, url, indexar: crudo.indexar };
}

// ---------- Fotos ----------
// Las fotos que sube Emilia vienen dentro del JSON como data:URI. En el HTML
// generado se reemplazan por archivos, para no meter megas de texto en cada página.
const fotosEscritas = new Map();

async function aArchivo(src) {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(src ?? "");
  if (!m) return src;
  if (fotosEscritas.has(src)) return fotosEscritas.get(src);
  const bytes = Buffer.from(m[2], "base64");
  const ext = m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
  const ruta = `assets/img/subidas/${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${ext}`;
  await mkdir(join(DIST, "assets/img/subidas"), { recursive: true });
  await writeFile(join(DIST, ruta), bytes);
  fotosEscritas.set(src, ruta);
  return ruta;
}

// ---------- Armado de una página ----------
function absoluta(config, ruta) {
  return new URL(ruta, config.url).href;
}

function resumen(texto, largo = 155) {
  const limpio = String(texto ?? "").replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
  return limpio.length > largo ? `${limpio.slice(0, largo - 1).trimEnd()}…` : limpio;
}

let corrida = 0;

async function armar({ fuente, destino, contenido, config, titulo, descripcion, imagen, propiedadId, privada, tipoOg = "website" }) {
  const html = await readFile(join(RAIZ, fuente), "utf8");
  const dom = new JSDOM(html, { url: absoluta(config, destino) });
  const { window } = dom;
  const doc = window.document;

  doc.body.dataset.estatico = "si";
  if (propiedadId) doc.body.dataset.id = propiedadId;
  if (titulo) doc.title = `${contenido.marca.nombre} · ${titulo}`;
  else doc.title = `${contenido.marca.nombre} · ${contenido.marca.bajada}`;

  // sitio.js usa los globales del navegador: se los damos desde jsdom.
  const globales = {
    window, document: doc, location: window.location, Node: window.Node, FormData: window.FormData,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async () => ({ ok: true, status: 200, json: async () => structuredClone(contenido) }),
  };
  for (const [clave, valor] of Object.entries(globales)) Object.defineProperty(globalThis, clave, { value: valor, configurable: true, writable: true });

  // Cada import con otra query es un módulo nuevo: sitio.js corre de cero para esta página.
  const modulo = await import(`${SITIO_JS}?pagina=${++corrida}`);
  await modulo.listo;
  if (!doc.querySelector("#app main")) throw new Error(`${destino}: sitio.js no pudo armar la página`);

  // El aviso de "necesita JavaScript" ya no aplica: el contenido está en el HTML.
  doc.querySelectorAll("noscript").forEach((n) => n.remove());

  for (const img of doc.querySelectorAll("img[src^='data:']")) img.setAttribute("src", await aArchivo(img.getAttribute("src")));

  const cabeza = doc.head;
  const meta = (atributos) => {
    const el = doc.createElement("meta");
    for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
    cabeza.append(el);
  };
  const robots = doc.querySelector('meta[name="robots"]');
  if (config.indexar && !privada) robots?.remove();
  else if (robots) robots.setAttribute("content", "noindex");
  else meta({ name: "robots", content: "noindex" });

  const descripcionFinal = resumen(descripcion) || doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  doc.querySelector('meta[name="description"]')?.setAttribute("content", descripcionFinal);

  const canonica = doc.createElement("link");
  canonica.rel = "canonical";
  canonica.href = absoluta(config, destino === "index.html" ? "./" : destino);
  cabeza.append(canonica);

  meta({ property: "og:type", content: tipoOg });
  meta({ property: "og:locale", content: "es_AR" });
  meta({ property: "og:site_name", content: contenido.marca.nombre });
  meta({ property: "og:title", content: doc.title });
  meta({ property: "og:description", content: descripcionFinal });
  meta({ property: "og:url", content: canonica.href });
  const rutaImagen = await aArchivo(imagen);
  if (rutaImagen && /^[\w./-]+$/.test(rutaImagen)) {
    meta({ property: "og:image", content: absoluta(config, rutaImagen) });
    meta({ name: "twitter:card", content: "summary_large_image" });
  }

  // El 404 se sirve en cualquier ruta: las rutas relativas tienen que partir de la raíz del sitio.
  if (destino === "404.html") {
    const base = doc.createElement("base");
    base.href = config.url;
    cabeza.prepend(base);
  }

  await writeFile(join(DIST, destino), dom.serialize());
  window.close();
}

// ---------- Principal ----------
async function main() {
  const config = leerConfig(JSON.parse(await readFile(join(RAIZ, "sitio.config.json"), "utf8")));
  const contenido = JSON.parse(await readFile(join(RAIZ, "data/contenido.json"), "utf8"));

  await rm(DIST, { recursive: true, force: true });
  for (const entrada of await readdir(RAIZ)) {
    if (!NO_PUBLICAR.has(entrada)) await cp(join(RAIZ, entrada), join(DIST, entrada), { recursive: true });
  }

  const imagenGeneral = contenido.inicio?.foto || contenido.sobreMi?.foto;
  for (const pagina of PAGINAS) {
    await armar({ fuente: pagina.archivo, destino: pagina.archivo, contenido, config, titulo: pagina.titulo, privada: pagina.privada, imagen: imagenGeneral,
      descripcion: pagina.archivo === "sobre-mi.html" ? contenido.sobreMi?.subtitulo : pagina.archivo === "tasacion.html" ? contenido.tasacion?.texto : null });
  }

  // Una página por propiedad, con el mismo nombre de archivo que usan los links de sitio.js.
  const publicas = [];
  for (const p of contenido.propiedades ?? []) {
    const destino = archivoPropiedad(p.id);
    if (!destino) { console.warn(`Propiedad sin página propia (id con caracteres raros): ${p.id}`); continue; }
    await armar({ fuente: "propiedad.html", destino, contenido, config, titulo: p.titulo, propiedadId: p.id, privada: p.ejemplo,
      descripcion: p.descripcion, imagen: p.fotos?.[0] || imagenGeneral, tipoOg: "article" });
    if (!p.ejemplo) publicas.push(destino);
  }

  const urls = ["./", "propiedades.html", "sobre-mi.html", "tasacion.html", ...publicas].map((r) => `  <url><loc>${absoluta(config, r)}</loc></url>`);
  await writeFile(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
  await writeFile(join(DIST, "robots.txt"), config.indexar
    ? `User-agent: *\nDisallow: /editar.html\nSitemap: ${absoluta(config, "sitemap.xml")}\n`
    : "# Sitio en preparación: no indexar todavía (sitio.config.json → indexar).\nUser-agent: *\nDisallow: /\n");
  if (config.dominio) await writeFile(join(DIST, "CNAME"), `${config.dominio}\n`);

  console.log(`Listo: dist/ con ${publicas.length} propiedades publicadas y ${fotosEscritas.size} fotos extraídas. Indexar: ${config.indexar ? "sí" : "no"}. URL: ${config.url}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
