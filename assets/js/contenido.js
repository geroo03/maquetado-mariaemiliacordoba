// Carga del contenido y del tema. Lo usan tanto las páginas como el editor.

export const CLAVE_BORRADOR = "emiliacordoba-borrador-v1";

export const PALETAS = {
  sierra:  { nombre: "Sierra (terracota)", colores: { fondo: "#F3EEE5", superficie: "#FFFCF6", texto: "#24201B", acento: "#A9502B", oscuro: "#2A2722" } },
  canada:  { nombre: "Cañada (verde)",     colores: { fondo: "#EEF0E9", superficie: "#FBFCF8", texto: "#1E2520", acento: "#3E6A4C", oscuro: "#1C2820" } },
  tinta:   { nombre: "Tinta (azul)",       colores: { fondo: "#F7F6F2", superficie: "#FFFFFF", texto: "#16181D", acento: "#2D4A8A", oscuro: "#14171D" } },
  figma:   { nombre: "Figma original (negro y dorado)", colores: { fondo: "#F7F4EE", superficie: "#FFFFFF", texto: "#1A1A1A", acento: "#B8914A", oscuro: "#0E0E10" } },
};

export const LETRAS = {
  editorial: { nombre: "Editorial (Newsreader + Work Sans)", titulos: "Newsreader", texto: "Work Sans",
    url: "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&family=Work+Sans:wght@400;500;600&display=swap" },
  clasica:   { nombre: "Clásica (Playfair + Plus Jakarta)", titulos: "Playfair Display", texto: "Plus Jakarta Sans",
    url: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" },
  moderna:   { nombre: "Moderna (Fraunces + Inter Tight)", titulos: "Fraunces", texto: "Inter Tight",
    url: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;1,9..144,400&family=Inter+Tight:wght@400;500;600&display=swap" },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export function leerBorrador() {
  try {
    const crudo = localStorage.getItem(CLAVE_BORRADOR);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

export function guardarBorrador(datos) {
  localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(datos));
}

export function borrarBorrador() {
  try { localStorage.removeItem(CLAVE_BORRADOR); } catch { /* sin almacenamiento */ }
}

export async function cargarPublicado() {
  const respuesta = await fetch("data/contenido.json", { cache: "no-cache" });
  if (!respuesta.ok) throw new Error(`No se pudo leer el contenido (${respuesta.status})`);
  return respuesta.json();
}

/** Devuelve el borrador local si existe; si no, lo publicado. */
export async function cargarContenido() {
  const borrador = leerBorrador();
  if (borrador) return { datos: borrador, esBorrador: true };
  return { datos: await cargarPublicado(), esBorrador: false };
}

// --- Contraste (WCAG) para elegir texto blanco o negro sobre el acento ---
function luminancia(hex) {
  const canal = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

export function contraste(a, b) {
  if (!HEX.test(a) || !HEX.test(b)) return 1;
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function textoSobre(color) {
  return contraste(color, "#FFFFFF") >= contraste(color, "#111111") ? "#FFFFFF" : "#111111";
}

export function aplicarTema(tema) {
  const raiz = document.documentElement.style;
  const colores = tema?.colores ?? {};
  for (const nombre of ["fondo", "superficie", "texto", "acento", "oscuro"]) {
    if (HEX.test(colores[nombre] ?? "")) raiz.setProperty(`--${nombre}`, colores[nombre]);
  }
  if (HEX.test(colores.acento ?? "")) raiz.setProperty("--sobre-acento", textoSobre(colores.acento));
  if (HEX.test(colores.oscuro ?? "")) raiz.setProperty("--sobre-oscuro", textoSobre(colores.oscuro) === "#FFFFFF" ? "#F5F0E8" : "#111111");

  const letra = LETRAS[tema?.letra] ?? LETRAS.editorial;
  raiz.setProperty("--letra-titulos", `"${letra.titulos}", Georgia, serif`);
  raiz.setProperty("--letra-texto", `"${letra.texto}", system-ui, sans-serif`);
  let enlace = document.getElementById("fuentes");
  if (!enlace) {
    enlace = document.createElement("link");
    enlace.id = "fuentes";
    enlace.rel = "stylesheet";
    document.head.append(enlace);
  }
  if (enlace.href !== letra.url) enlace.href = letra.url;
}
