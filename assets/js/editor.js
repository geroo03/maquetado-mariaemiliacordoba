// Panel "Editar mi sitio".
// Guarda los cambios como borrador en este navegador (localStorage). Para publicarlos,
// Emilia usa el botón "Publicar" (sube data/contenido.json al repo con su token,
// ver github.js) o descarga el archivo y se lo manda a Sebastián.
import { PALETAS, LETRAS, contraste, leerBorrador, guardarBorrador, borrarBorrador, cargarPublicado } from "./contenido.js";
import { REPO, leerToken, guardarToken, publicar } from "./github.js";

let datos = null;

// ---------- Utilidades ----------
function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === false || valor == null) continue;
    if (clave === "class") el.className = valor;
    else if (clave.startsWith("on")) el.addEventListener(clave.slice(2), valor);
    else if (clave === "value") el.value = valor;
    else if (clave === "checked") el.checked = valor;
    else el.setAttribute(clave, valor === true ? "" : valor);
  }
  for (const hijo of hijos.flat()) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

function leer(ruta, base = datos) {
  return ruta.split(".").reduce((obj, clave) => (obj == null ? undefined : obj[clave]), base);
}

function escribir(ruta, valor, base = datos) {
  const claves = ruta.split(".");
  const ultima = claves.pop();
  const destino = claves.reduce((obj, clave) => (obj[clave] ??= {}), base);
  destino[ultima] = valor;
}

const estado = document.getElementById("estado");
let temporizador = null;

function cambio({ refrescar = true } = {}) {
  clearTimeout(temporizador);
  estado.textContent = "Guardando…";
  temporizador = setTimeout(() => {
    try {
      guardarBorrador(datos);
      const kb = Math.round(JSON.stringify(datos).length / 1024);
      estado.textContent = `Borrador guardado en esta compu (${kb} KB).${kb > 3500 ? " Ojo: muchas fotos, puede llenarse." : ""}`;
    } catch (error) {
      estado.textContent = "No se pudo guardar: probablemente hay demasiadas fotos o fotos muy pesadas. Quitá alguna.";
      console.error(error);
    }
    if (refrescar) refrescarVista();
  }, 500);
}

// ---------- Campos ----------
function campoTexto(base, ruta, etiqueta, { ayuda, multilinea = false, tipo = "text", placeholder } = {}) {
  const control = multilinea
    ? h("textarea", { value: leer(ruta, base) ?? "", placeholder })
    : h("input", { type: tipo, value: leer(ruta, base) ?? "", placeholder });
  control.addEventListener("input", () => { escribir(ruta, control.value, base); cambio(); });
  return h("label", { class: "c" }, h("span", {}, etiqueta), control, ayuda ? h("small", {}, ayuda) : null);
}

function campoSelect(base, ruta, etiqueta, opciones) {
  const control = h("select", {}, opciones.map((o) => h("option", { value: o }, o)));
  control.value = leer(ruta, base) ?? opciones[0];
  control.addEventListener("change", () => { escribir(ruta, control.value, base); cambio(); });
  return h("label", { class: "c" }, h("span", {}, etiqueta), control);
}

function campoCheck(base, ruta, etiqueta, alCambiar) {
  const control = h("input", { type: "checkbox", checked: Boolean(leer(ruta, base)) });
  control.addEventListener("change", () => { escribir(ruta, control.checked, base); cambio(); alCambiar?.(); });
  return h("label", { class: "c-check" }, control, etiqueta);
}

function campoLineas(base, ruta, etiqueta, ayuda) {
  const control = h("textarea", { value: (leer(ruta, base) ?? []).join("\n") });
  control.addEventListener("input", () => {
    escribir(ruta, control.value.split("\n").map((x) => x.trim()).filter(Boolean), base);
    cambio();
  });
  return h("label", { class: "c" }, h("span", {}, etiqueta), control, h("small", {}, ayuda ?? "Uno por renglón."));
}

const HEX = /^#[0-9a-fA-F]{6}$/;
function campoColor(ruta, etiqueta, ayuda) {
  const valor = leer(ruta);
  const selector = h("input", { type: "color", value: valor, "aria-label": etiqueta });
  const texto = h("input", { type: "text", value: valor, "aria-label": `${etiqueta} (código)`, maxlength: 7 });
  const aplicar = (v) => {
    if (!HEX.test(v)) return;
    escribir(ruta, v.toUpperCase());
    datos.tema.paleta = "propia";
    selector.value = v; texto.value = v.toUpperCase();
    revisarContraste();
    cambio();
  };
  selector.addEventListener("input", () => aplicar(selector.value));
  texto.addEventListener("change", () => aplicar(texto.value.trim()));
  return h("div", { class: "c" }, h("span", {}, etiqueta), h("div", { class: "c-color" }, selector, texto), h("small", {}, ayuda));
}

// Las fotos se achican antes de guardarlas para que entren en el navegador.
function achicarImagen(archivo, ladoMaximo = 1400) {
  return new Promise((resolver, rechazar) => {
    if (!archivo.type.startsWith("image/")) return rechazar(new Error("El archivo no es una imagen"));
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      const escala = Math.min(1, ladoMaximo / Math.max(img.width, img.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.round(img.width * escala);
      lienzo.height = Math.round(img.height * escala);
      lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      resolver(lienzo.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}

function campoImagenes(base, ruta, etiqueta, { multiple = false, ayuda } = {}) {
  const contenedor = h("div", { class: "c" });
  const dibujar = () => {
    const valor = leer(ruta, base);
    const lista = multiple ? (valor ?? []) : (valor ? [valor] : []);
    const entrada = h("input", { type: "file", accept: "image/*", multiple });
    entrada.addEventListener("change", async () => {
      estado.textContent = "Procesando fotos…";
      try {
        const nuevas = await Promise.all([...entrada.files].map((f) => achicarImagen(f)));
        escribir(ruta, multiple ? [...lista, ...nuevas] : nuevas[0], base);
        cambio();
      } catch (error) {
        estado.textContent = error.message;
      }
      dibujar();
    });
    contenedor.replaceChildren(
      h("span", {}, etiqueta),
      lista.length ? h("div", { class: "imagenes" }, lista.map((src, n) => h("figure", {},
        h("img", { src, alt: "" }),
        h("button", { type: "button", onclick: () => {
          escribir(ruta, multiple ? lista.filter((_, i) => i !== n) : "", base);
          cambio(); dibujar();
        } }, "Quitar")))) : null,
      entrada,
      h("small", {}, ayuda ?? (multiple ? "Podés elegir varias. La primera es la de portada." : "")));
  };
  dibujar();
  return contenedor;
}

/** Lista editable de elementos (propiedades, preguntas, etc.). */
function lista(ruta, { titulo, nuevo, campos, abrirNuevo = true }) {
  const contenedor = h("div");
  const dibujar = (abrir = -1) => {
    const items = leer(ruta) ?? [];
    contenedor.replaceChildren(
      ...items.map((item, n) => {
        const mover = (d) => { const j = n + d; if (j < 0 || j >= items.length) return; [items[n], items[j]] = [items[j], items[n]]; cambio(); dibujar(j); };
        return h("details", { class: "item", open: n === abrir },
          h("summary", {}, titulo(item, n)),
          h("div", { class: "item-cuerpo" }, campos(item),
            h("div", { class: "acciones" },
              h("button", { class: "b", type: "button", onclick: () => mover(-1) }, "↑ Subir"),
              h("button", { class: "b", type: "button", onclick: () => mover(1) }, "↓ Bajar"),
              h("button", { class: "b peligro", type: "button", onclick: () => {
                if (!confirm("¿Borrar este elemento?")) return;
                items.splice(n, 1); cambio(); dibujar();
              } }, "Borrar"))));
      }),
      h("button", { class: "b principal", type: "button", onclick: () => {
        items.push(nuevo()); escribir(ruta, items); cambio(); dibujar(abrirNuevo ? items.length - 1 : -1);
      } }, "+ Agregar"));
  };
  dibujar();
  return contenedor;
}

// ---------- Contraste ----------
const avisoContraste = h("div");
function revisarContraste() {
  const c = datos.tema.colores;
  const problemas = [];
  if (contraste(c.texto, c.fondo) < 4.5) problemas.push("el texto no se lee bien sobre el fondo");
  if (contraste(c.texto, c.superficie) < 4.5) problemas.push("el texto no se lee bien sobre las tarjetas");
  if (contraste(c.acento, c.fondo) < 3) problemas.push("el color de acento se pierde sobre el fondo");
  avisoContraste.replaceChildren(problemas.length
    ? h("p", { class: "aviso error" }, `Ojo: ${problemas.join(", ")}. Probá un color más oscuro o más claro.`)
    : "");
}

// ---------- Pestañas ----------
const PESTANAS = {
  "Colores": () => {
    const c = datos.tema.colores;
    const botones = Object.entries(PALETAS).map(([clave, p]) => h("button", {
      class: "paleta", type: "button", "aria-pressed": String(datos.tema.paleta === clave),
      onclick: () => { datos.tema.paleta = clave; Object.assign(c, p.colores); cambio(); mostrar("Colores"); },
    }, h("div", { class: "muestras" }, ["fondo", "superficie", "texto", "acento", "oscuro"].map((k) => h("span", { style: `background:${p.colores[k]}` }))), p.nombre));
    revisarContraste();
    const letra = h("select", {}, Object.entries(LETRAS).map(([k, l]) => h("option", { value: k }, l.nombre)));
    letra.value = datos.tema.letra ?? "editorial";
    letra.addEventListener("change", () => { datos.tema.letra = letra.value; cambio(); });
    return [
      h("h2", {}, "Elegí una paleta"),
      h("p", { class: "ayuda" }, "Tocá una para probarla. Después podés ajustar cada color abajo."),
      h("div", { class: "paletas" }, botones),
      h("h2", {}, "Ajustar colores"),
      avisoContraste,
      campoColor("tema.colores.fondo", "Fondo", "El color general de la página."),
      campoColor("tema.colores.superficie", "Tarjetas y formularios", "Un poco más claro que el fondo."),
      campoColor("tema.colores.texto", "Texto", "Tiene que leerse bien sobre el fondo."),
      campoColor("tema.colores.acento", "Acento", "Botones, números y detalles."),
      campoColor("tema.colores.oscuro", "Bloques oscuros y pie", "El final de la página."),
      h("h2", {}, "Letra"),
      h("label", { class: "c" }, h("span", {}, "Combinación de letras"), letra),
    ];
  },

  "Mis datos": () => {
    const matricula = h("div");
    const dibujarMatricula = () => matricula.replaceChildren(datos.matricula.mostrar
      ? campoTexto(datos, "matricula.texto", "Texto de la matrícula", { placeholder: "Ej.: CPI Córdoba Mat. N° …" }) : "");
    dibujarMatricula();
    return [
      h("h2", {}, "Marca"),
      campoTexto(datos, "marca.nombre", "Nombre"),
      campoTexto(datos, "marca.bajada", "Bajada debajo del nombre"),
      campoImagenes(datos, "marca.logo", "Logo (opcional)"),
      h("h2", {}, "Contacto"),
      campoTexto(datos, "contacto.whatsapp", "WhatsApp", { tipo: "tel", placeholder: "54 9 351 …", ayuda: "Con código de país y de área, sin 0 ni 15. Ej.: 54 9 351 1234567." }),
      campoTexto(datos, "contacto.email", "Email", { tipo: "email" }),
      campoTexto(datos, "contacto.instagram", "Instagram", { placeholder: "@usuario" }),
      campoTexto(datos, "contacto.horario", "Horario de atención"),
      campoTexto(datos, "contacto.zonaTexto", "Zonas (texto corto)"),
      h("h2", {}, "Matrícula"),
      h("p", { class: "aviso" }, "Activalo solo con la matrícula vigente y su número real. Sin matrícula no conviene usar las palabras “inmobiliaria”, “corredora” ni “matriculada” (Ley 9445 de Córdoba)."),
      campoCheck(datos, "matricula.mostrar", "Mostrar matrícula en el sitio", dibujarMatricula),
      matricula,
    ];
  },

  "Inicio": () => [
    h("p", { class: "ayuda" }, "Lo que aparezca entre [corchetes] se ve resaltado en amarillo: es lo que falta completar."),
    h("h2", {}, "Portada"),
    campoTexto(datos, "inicio.etiqueta", "Texto chico de arriba"),
    campoTexto(datos, "inicio.titulo", "Título"),
    campoTexto(datos, "inicio.tituloDestacado", "Segunda línea del título (en color)"),
    campoTexto(datos, "inicio.texto", "Texto", { multilinea: true }),
    campoTexto(datos, "inicio.botonPrincipal", "Botón principal"),
    campoTexto(datos, "inicio.botonSecundario", "Botón secundario"),
    campoImagenes(datos, "inicio.foto", "Tu foto de portada", { ayuda: "Una foto tuya real, vertical, con buena luz." }),
    campoTexto(datos, "inicio.notaFoto", "Frase sobre la foto"),
    h("h2", {}, "Qué hago con tu propiedad"),
    campoTexto(datos, "servicios.titulo", "Título"),
    campoTexto(datos, "servicios.texto", "Texto", { multilinea: true }),
    lista("servicios.items", { titulo: (x) => x.titulo || "Sin título", nuevo: () => ({ titulo: "", texto: "" }),
      campos: (x) => [campoTexto(x, "titulo", "Título"), campoTexto(x, "texto", "Texto", { multilinea: true })] }),
    h("h2", {}, "Cómo trabajo (pasos)"),
    campoTexto(datos, "pasos.titulo", "Título"),
    lista("pasos.items", { titulo: (x, n) => `${n + 1}. ${x.titulo || "Sin título"}`, nuevo: () => ({ titulo: "", texto: "" }),
      campos: (x) => [campoTexto(x, "titulo", "Título"), campoTexto(x, "texto", "Texto", { multilinea: true })] }),
    h("h2", {}, "Bloque final"),
    campoTexto(datos, "cierre.titulo", "Título"),
    campoTexto(datos, "cierre.texto", "Texto", { multilinea: true }),
  ],

  "Sobre mí": () => [
    campoTexto(datos, "sobreMi.titulo", "Título"),
    campoTexto(datos, "sobreMi.subtitulo", "Subtítulo"),
    campoImagenes(datos, "sobreMi.foto", "Tu foto"),
    campoLineas(datos, "sobreMi.historia", "Tu historia", "Un párrafo por renglón."),
    h("h2", {}, "Cómo soy para trabajar"),
    lista("sobreMi.valores", { titulo: (x) => x.titulo || "Sin título", nuevo: () => ({ titulo: "", texto: "" }),
      campos: (x) => [campoTexto(x, "titulo", "Título"), campoTexto(x, "texto", "Texto", { multilinea: true })] }),
    h("h2", {}, "Dónde trabajo"),
    campoTexto(datos, "zonas.titulo", "Título"),
    lista("zonas.items", { titulo: (x) => x.nombre || "Sin nombre", nuevo: () => ({ nombre: "", texto: "" }),
      campos: (x) => [campoTexto(x, "nombre", "Zona"), campoTexto(x, "texto", "Barrios o detalle", { multilinea: true })] }),
  ],

  "Propiedades": () => [
    h("p", { class: "ayuda" }, "Cargá solo propiedades reales que tengas autorizadas. Las marcadas como “ejemplo” muestran un cartel amarillo."),
    lista("propiedades", {
      titulo: (p) => `${p.ejemplo ? "[Ejemplo] " : ""}${p.titulo || "Sin título"}`,
      nuevo: () => ({ id: `p-${Date.now().toString(36)}`, ejemplo: false, destacada: true, titulo: "", operacion: "Venta", tipo: "Departamento",
        ciudad: "Córdoba", barrio: "", direccion: "", precio: "", moneda: "USD", superficie: "", ambientes: "", dormitorios: "", banos: "", cocheras: "",
        descripcion: "", caracteristicas: [], fotos: [] }),
      campos: (p) => [
        campoTexto(p, "titulo", "Título"),
        campoSelect(p, "operacion", "Operación", ["Venta", "Alquiler", "Alquiler temporario"]),
        campoSelect(p, "tipo", "Tipo", ["Departamento", "Casa", "PH", "Terreno", "Local", "Oficina", "Cochera", "Otro"]),
        campoTexto(p, "ciudad", "Ciudad"),
        campoTexto(p, "barrio", "Barrio"),
        campoTexto(p, "precio", "Precio", { ayuda: "Solo el número. Vacío muestra “Consultar precio”." }),
        campoSelect(p, "moneda", "Moneda", ["USD", "ARS"]),
        campoTexto(p, "superficie", "Superficie (m²)"),
        campoTexto(p, "ambientes", "Ambientes"),
        campoTexto(p, "dormitorios", "Dormitorios"),
        campoTexto(p, "banos", "Baños"),
        campoTexto(p, "cocheras", "Cocheras"),
        campoTexto(p, "descripcion", "Descripción", { multilinea: true }),
        campoLineas(p, "caracteristicas", "Características", "Una por renglón: Balcón, Pileta…"),
        campoImagenes(p, "fotos", "Fotos", { multiple: true }),
        campoCheck(p, "destacada", "Mostrar en la página de inicio"),
        campoCheck(p, "ejemplo", "Es de ejemplo (no es real)"),
      ],
    }),
  ],

  "Opiniones": () => [
    h("p", { class: "aviso" }, "Solo opiniones reales, de clientes que te dieron permiso para publicarlas. Si no hay ninguna, la sección no aparece."),
    lista("testimonios", { titulo: (x) => x.nombre || "Sin nombre", nuevo: () => ({ nombre: "", detalle: "", texto: "" }),
      campos: (x) => [campoTexto(x, "nombre", "Nombre (como quiera aparecer)"), campoTexto(x, "detalle", "Detalle", { placeholder: "Ej.: vendió en Alta Córdoba" }),
        campoTexto(x, "texto", "Lo que dijo", { multilinea: true })] }),
  ],

  "Preguntas": () => [
    campoTexto(datos, "preguntas.titulo", "Título"),
    lista("preguntas.items", { titulo: (x) => x.pregunta || "Sin pregunta", nuevo: () => ({ pregunta: "", respuesta: "" }),
      campos: (x) => [campoTexto(x, "pregunta", "Pregunta"), campoTexto(x, "respuesta", "Respuesta", { multilinea: true })] }),
    h("h2", {}, "Página de tasación"),
    campoTexto(datos, "tasacion.titulo", "Título"),
    campoTexto(datos, "tasacion.texto", "Texto", { multilinea: true }),
    campoLineas(datos, "tasacion.puntos", "Puntos a destacar"),
    campoTexto(datos, "tasacion.aviso", "Aviso debajo del botón"),
  ],

  "Guardar": () => {
    const archivo = h("input", { type: "file", accept: "application/json,.json" });
    archivo.addEventListener("change", async () => {
      try {
        const nuevo = JSON.parse(await archivo.files[0].text());
        if (typeof nuevo !== "object" || !nuevo.tema || !nuevo.marca || !Array.isArray(nuevo.propiedades)) throw new Error("formato");
        datos = nuevo; cambio(); mostrar("Colores");
        estado.textContent = "Archivo cargado.";
      } catch {
        estado.textContent = "Ese archivo no es un contenido.json válido.";
      }
    });
    return [
      h("h2", {}, "Tus cambios"),
      h("p", { class: "ayuda" }, "Todo lo que cambiás se guarda solo en este navegador. Nadie más lo ve hasta que lo publicás."),
      ...bloquePublicar(),
      h("h2", {}, "Descargar el archivo"),
      h("p", { class: "ayuda" }, "Otra opción: bajá “contenido.json” con todos tus textos, colores y fotos y mandáselo a Sebastián."),
      h("button", { class: "b", type: "button", onclick: descargar }, "Descargar contenido.json"),
      h("h2", {}, "Abrir un archivo"),
      h("p", { class: "ayuda" }, "Si tenés un contenido.json guardado (por ejemplo, desde otra compu), cargalo acá."),
      archivo,
      h("h2", {}, "Empezar de nuevo"),
      h("p", { class: "ayuda" }, "Borra tu borrador y vuelve a lo que está publicado."),
      h("button", { class: "b peligro", type: "button", onclick: async () => {
        if (!confirm("Se pierden los cambios que no descargaste. ¿Seguir?")) return;
        borrarBorrador(); datos = await cargarPublicado(); refrescarVista(); mostrar("Colores");
        estado.textContent = "Volviste a la versión publicada.";
      } }, "Descartar mi borrador"),
    ];
  },
};

function bloquePublicar() {
  const token = h("input", { type: "password", autocomplete: "off", spellcheck: "false", value: leerToken(), placeholder: "github_pat_…" });
  const recordar = h("input", { type: "checkbox", checked: Boolean(leerToken()) });
  const resultado = h("p", { class: "ayuda", role: "status" });
  const boton = h("button", { class: "b principal", type: "button" }, "Publicar en el sitio");
  boton.addEventListener("click", async () => {
    const valor = token.value.trim();
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]+$/.test(valor)) {
      resultado.textContent = "Pegá la clave de publicación que te pasó Sebastián (empieza con github_pat_).";
      return;
    }
    if (!confirm("Tus cambios van a quedar publicados en el sitio. ¿Seguir?")) return;
    guardarToken(recordar.checked ? valor : "");
    boton.disabled = true;
    resultado.textContent = "Publicando…";
    try {
      await publicar(datos, valor);
      resultado.replaceChildren("Listo. El sitio se actualiza en 1 o 2 minutos. ",
        h("a", { href: "index.html", target: "_blank", rel: "noopener" }, "Ver el sitio"));
    } catch (error) {
      resultado.textContent = error.message || "No se pudo publicar. Revisá tu conexión.";
    } finally {
      boton.disabled = false;
    }
  });
  return [
    h("h2", {}, "Publicar"),
    h("p", { class: "ayuda" }, `Guarda tus cambios directo en el sitio (repositorio ${REPO.duenio}/${REPO.nombre}).`),
    h("label", { class: "c" }, h("span", {}, "Clave de publicación"), token,
      h("small", {}, "Te la pasa Sebastián. No la compartas: con ella se puede cambiar el sitio.")),
    h("label", { class: "c-check" }, recordar, "Recordarla en esta compu"),
    h("p", { class: "ayuda" }, "Si usás una compu compartida, dejá esto destildado."),
    boton,
    resultado,
  ];
}

function descargar() {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const enlace = h("a", { href: url, download: "contenido.json" });
  document.body.append(enlace); enlace.click(); enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const pestanas = document.getElementById("pestanas");
const formulario = document.getElementById("formulario");

function mostrar(nombre) {
  for (const b of pestanas.children) b.setAttribute("aria-selected", String(b.textContent === nombre));
  formulario.replaceChildren(...PESTANAS[nombre]());
  formulario.scrollTop = 0;
}

// ---------- Vista previa ----------
const vista = document.getElementById("vista");
const selectorPagina = document.getElementById("pagina");
const abrir = document.getElementById("abrir");

function refrescarVista() {
  const y = vista.contentWindow?.scrollY ?? 0;
  vista.onload = () => vista.contentWindow.scrollTo(0, y);
  vista.src = selectorPagina.value;
}
selectorPagina.addEventListener("change", () => { abrir.href = selectorPagina.value; vista.onload = null; vista.src = selectorPagina.value; });
for (const boton of document.querySelectorAll(".tamanos button")) {
  boton.addEventListener("click", () => {
    vista.style.width = boton.dataset.ancho;
    for (const b of document.querySelectorAll(".tamanos button")) b.setAttribute("aria-pressed", String(b === boton));
  });
}

// ---------- Inicio ----------
async function iniciar() {
  try {
    const borrador = leerBorrador();
    datos = borrador ?? await cargarPublicado();
    estado.textContent = borrador ? "Seguís con tu borrador guardado en esta compu." : "Mostrando lo publicado. Tus cambios se guardan solos.";
    for (const nombre of Object.keys(PESTANAS)) {
      pestanas.append(h("button", { type: "button", role: "tab", onclick: () => mostrar(nombre) }, nombre));
    }
    mostrar("Colores");
  } catch (error) {
    console.error(error);
    estado.textContent = "No se pudo cargar el contenido. Recargá la página.";
  }
}

iniciar();
