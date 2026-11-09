// Publica data/contenido.json en el repositorio usando la API de contenidos de GitHub.
// Se usa un token "fine-grained" limitado a este único repositorio con permiso
// Contents: read and write. El token queda solo en el navegador de quien publica:
// nunca se sube al repositorio.

export const REPO = { duenio: "geroo03", nombre: "maquetado-mariaemiliacordoba", rama: "main", ruta: "data/contenido.json" };

const CLAVE_TOKEN = "emiliacordoba-token-github";

export function leerToken() {
  try { return localStorage.getItem(CLAVE_TOKEN) ?? ""; } catch { return ""; }
}

export function guardarToken(token) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch { /* sin almacenamiento: se pide el token cada vez */ }
}

// btoa solo acepta Latin-1: se codifica a UTF-8 primero (acentos, ñ) y en bloques
// para no pasar el límite de argumentos con archivos grandes (fotos).
function aBase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

const URL_ARCHIVO = `https://api.github.com/repos/${REPO.duenio}/${REPO.nombre}/contents/${REPO.ruta}`;

function encabezados(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
}

function mensajeError(status) {
  if (status === 401) return "El token no es válido o venció. Pedile uno nuevo a Sebastián.";
  if (status === 403 || status === 404) return "El token no tiene permiso para escribir en este repositorio.";
  if (status === 409 || status === 422) return "Hubo un conflicto con otro cambio. Probá publicar de nuevo.";
  return `GitHub respondió con un error (${status}). Probá de nuevo en un rato.`;
}

async function shaActual(token) {
  const r = await fetch(`${URL_ARCHIVO}?ref=${REPO.rama}`, { headers: encabezados(token), cache: "no-store" });
  if (r.status === 404) return null; // el archivo todavía no existe
  if (!r.ok) throw new Error(mensajeError(r.status));
  const cuerpo = await r.json();
  return typeof cuerpo.sha === "string" ? cuerpo.sha : null;
}

/** Sube el contenido. Si alguien cambió el archivo mientras tanto, reintenta una vez con la versión nueva. */
export async function publicar(datos, token) {
  const contenido = aBase64(JSON.stringify(datos, null, 2) + "\n");
  for (let intento = 0; intento < 2; intento++) {
    const sha = await shaActual(token);
    const r = await fetch(URL_ARCHIVO, {
      method: "PUT",
      headers: { ...encabezados(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `contenido: cambios desde el editor (${new Date().toLocaleString("es-AR")})`,
        content: contenido,
        branch: REPO.rama,
        ...(sha ? { sha } : {}),
      }),
    });
    if (r.ok) {
      const cuerpo = await r.json();
      return { commit: cuerpo?.commit?.html_url ?? "" };
    }
    if (r.status !== 409 || intento === 1) throw new Error(mensajeError(r.status));
  }
  throw new Error(mensajeError(409));
}
