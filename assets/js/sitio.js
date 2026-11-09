// Arma cada página a partir de data/contenido.json (o del borrador de Emilia).
// Todo el texto se inserta con textContent: el contenido puede venir de un archivo
// importado, así que nunca se interpreta como HTML.
import { cargarContenido, aplicarTema } from "./contenido.js";

// ---------- Utilidades ----------
function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === false || valor == null) continue;
    if (clave === "class") el.className = valor;
    else if (clave.startsWith("on")) el.addEventListener(clave.slice(2), valor);
    else el.setAttribute(clave, valor === true ? "" : valor);
  }
  for (const hijo of hijos.flat()) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

/** Lo que va entre [corchetes] es algo que Emilia tiene que completar: se resalta. */
function t(texto, etiqueta = "span", atributos = {}) {
  const partes = (texto ?? "").toString().split(/(\[[^\]]+\])/).filter(Boolean);
  return h(etiqueta, atributos, partes.map((parte) =>
    parte.startsWith("[") && parte.endsWith("]") ? h("span", { class: "pendiente" }, parte) : parte));
}

function srcSeguro(src) {
  if (typeof src !== "string" || !src) return "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(src)) return src;
  if (/^https:\/\//i.test(src)) return src;
  if (/^[\w./-]+$/.test(src) && !src.includes("..")) return src;
  return "";
}

function foto(src, alt, textoFalta) {
  const seguro = srcSeguro(src);
  return h("div", { class: "marco" },
    seguro ? h("img", { src: seguro, alt, loading: "lazy" }) : h("div", { class: "falta-foto" }, textoFalta));
}

function soloDigitos(valor) { return (valor ?? "").replace(/\D/g, ""); }

function enlaceWhatsapp(numero, mensaje) {
  const digitos = soloDigitos(numero);
  if (!digitos) return null;
  return `https://wa.me/${digitos}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

function usuarioInstagram(valor) {
  return (valor ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[^\w.]/g, "");
}

function precioTexto(p) {
  if (!p.precio) return "Consultar precio";
  const numero = Number(String(p.precio).replace(/\./g, "").replace(",", "."));
  const valor = Number.isFinite(numero) ? numero.toLocaleString("es-AR") : p.precio;
  return `${p.moneda || ""} ${valor}`.trim();
}

function seccion(clase, ...hijos) {
  return h("section", { class: `seccion ${clase || ""}` }, h("div", { class: "contenedor" }, ...hijos));
}

// ---------- Encabezado y pie ----------
const PAGINAS = [
  ["index.html", "Inicio"],
  ["propiedades.html", "Propiedades"],
  ["sobre-mi.html", "Sobre mí"],
];

function encabezado(d, paginaActual) {
  const menu = h("nav", { class: "menu", id: "menu", "aria-label": "Principal" },
    PAGINAS.map(([href, nombre]) => h("a", { href, "aria-current": href === paginaActual ? "page" : null }, nombre)),
    h("a", { href: "tasacion.html", class: "boton chico" }, "Pedí tu tasación"));
  const boton = h("button", { class: "menu-boton", "aria-expanded": "false", "aria-controls": "menu",
    onclick: (e) => { const abierto = menu.classList.toggle("abierto"); e.currentTarget.setAttribute("aria-expanded", String(abierto)); } }, "Menú");
  const logo = srcSeguro(d.marca.logo);
  return h("header", { class: "encabezado" }, h("div", { class: "contenedor" },
    h("a", { href: "index.html", class: "marca" },
      logo ? h("img", { src: logo, alt: "" }) : null,
      h("span", {}, h("span", { class: "marca-nombre" }, d.marca.nombre), h("span", { class: "marca-bajada" }, d.marca.bajada))),
    boton, menu));
}

function pie(d) {
  const c = d.contacto;
  const wa = enlaceWhatsapp(c.whatsapp);
  const ig = usuarioInstagram(c.instagram);
  const contacto = h("ul", {},
    wa ? h("li", {}, h("a", { href: wa, target: "_blank", rel: "noopener" }, "WhatsApp")) : h("li", {}, t("[Completar: WhatsApp]")),
    c.email ? h("li", {}, h("a", { href: `mailto:${c.email}` }, c.email)) : h("li", {}, t("[Completar: email]")),
    ig ? h("li", {}, h("a", { href: `https://instagram.com/${ig}`, target: "_blank", rel: "noopener" }, `@${ig}`)) : h("li", {}, t("[Completar: Instagram]")),
    c.horario ? h("li", {}, t(c.horario)) : null);
  const legal = [`© ${new Date().getFullYear()} ${d.marca.nombre}`];
  if (d.matricula?.mostrar && d.matricula.texto) legal.push(d.matricula.texto);
  return h("footer", { class: "pie oscuro" }, h("div", { class: "contenedor" },
    h("div", {}, h("span", { class: "marca-nombre" }, d.marca.nombre), h("p", { style: "margin-top:12px" }, d.contacto.zonaTexto)),
    h("div", {}, h("h3", {}, "Páginas"), h("ul", {}, PAGINAS.map(([href, nombre]) => h("li", {}, h("a", { href }, nombre))),
      h("li", {}, h("a", { href: "tasacion.html" }, "Pedí tu tasación")))),
    h("div", {}, h("h3", {}, "Contacto"), contacto),
    h("p", { class: "legal" }, legal.join(" · "))));
}

function botonWhatsappFlotante(d) {
  const wa = enlaceWhatsapp(d.contacto.whatsapp, "Hola Emilia, te escribo desde tu web.");
  if (!wa) return null;
  return h("a", { class: "whatsapp-flotante", href: wa, target: "_blank", rel: "noopener", "aria-label": "Escribir por WhatsApp" },
    h("span", { "aria-hidden": "true", style: "font-size:24px" }, "✆"));
}

// ---------- Bloques reutilizables ----------
function tarjetaPropiedad(p) {
  const href = `propiedad.html?id=${encodeURIComponent(p.id)}`;
  const datos = [
    p.superficie && `${p.superficie} m²`,
    p.ambientes && `${p.ambientes} amb.`,
    p.dormitorios && p.dormitorios !== "0" && `${p.dormitorios} dorm.`,
    p.banos && `${p.banos} baño${p.banos === "1" ? "" : "s"}`,
  ].filter(Boolean);
  const marco = foto(p.fotos?.[0], p.titulo, "Foto de la propiedad");
  marco.append(h("span", { class: "chapa" }, p.operacion));
  if (p.ejemplo) marco.append(h("span", { class: "chapa ejemplo" }, "Ejemplo"));
  return h("a", { class: "tarjeta", href }, marco,
    h("div", { class: "tarjeta-cuerpo" },
      h("div", { class: "lugar" }, t([p.barrio, p.ciudad].filter(Boolean).join(", "))),
      h("h3", {}, p.titulo),
      h("div", { class: "precio" }, precioTexto(p))),
    h("div", { class: "datos-propiedad" }, datos.map((x) => h("span", {}, x))));
}

function bloqueTestimonios(d) {
  if (!d.testimonios?.length) return null;
  return seccion("", h("span", { class: "antetitulo" }, "Lo que dicen"),
    h("h2", { class: "titulo-seccion", style: "margin-bottom:48px" }, "Personas con las que trabajé"),
    h("div", { class: "testimonios" }, d.testimonios.map((x) =>
      h("figure", { class: "testimonio" }, h("blockquote", {}, `“${x.texto}”`), h("figcaption", {}, [x.nombre, x.detalle].filter(Boolean).join(" · "))))));
}

function bloquePreguntas(d) {
  if (!d.preguntas?.items?.length) return null;
  return seccion("", h("div", { class: "cabeza-seccion" }, h("h2", { class: "titulo-seccion" }, d.preguntas.titulo)),
    h("div", { class: "preguntas" }, d.preguntas.items.map((x) =>
      h("details", {}, h("summary", {}, x.pregunta), t(x.respuesta, "p")))));
}

function bloqueCierre(d) {
  return h("section", { class: "seccion oscuro cierre" }, h("div", { class: "contenedor" },
    h("div", {}, h("h2", { class: "titulo-seccion" }, d.cierre.titulo), t(d.cierre.texto, "p", { class: "bajada-seccion" })),
    h("div", { class: "botones" }, h("a", { class: "boton", href: "tasacion.html" }, "Pedí tu tasación"),
      enlaceWhatsapp(d.contacto.whatsapp) ? h("a", { class: "boton secundario", href: enlaceWhatsapp(d.contacto.whatsapp), target: "_blank", rel: "noopener" }, "Escribime por WhatsApp") : null)));
}

// ---------- Páginas ----------
function paginaInicio(d) {
  const i = d.inicio;
  const fotoHero = h("div", { class: "hero-foto" }, foto(i.foto, `Foto de ${d.marca.nombre}`, "Foto de Emilia (cargala desde el editor)"),
    i.notaFoto ? t(i.notaFoto, "p", { class: "nota-foto" }) : null);
  const destacadas = d.propiedades.filter((p) => p.destacada).slice(0, 6);
  return [
    h("section", { class: "hero" }, h("div", { class: "contenedor" },
      h("div", {},
        h("p", { class: "coordenadas" }, i.etiqueta),
        h("h1", {}, i.titulo, " ", h("em", {}, i.tituloDestacado)),
        t(i.texto, "p", { class: "texto" }),
        h("div", { class: "botones" },
          h("a", { class: "boton", href: "tasacion.html" }, i.botonPrincipal),
          h("a", { class: "boton secundario", href: "propiedades.html" }, i.botonSecundario))),
      fotoHero)),
    seccion("", h("div", { class: "cabeza-seccion" }, h("h2", { class: "titulo-seccion" }, d.servicios.titulo), t(d.servicios.texto, "p", { class: "bajada-seccion" })),
      h("ol", { class: "lista-numerada" }, d.servicios.items.map((x) => h("li", {}, h("div", {}, h("h3", {}, x.titulo), t(x.texto, "p")))))),
    seccion("", h("div", { class: "pasos" },
      h("div", {}, h("span", { class: "antetitulo" }, "Paso a paso"), h("h2", { class: "titulo-seccion" }, d.pasos.titulo)),
      h("ol", {}, d.pasos.items.map((x, n) => h("li", {}, h("span", { class: "num" }, n + 1), h("div", {}, h("h3", {}, x.titulo), t(x.texto, "p"))))))),
    destacadas.length ? seccion("", h("div", { class: "cabeza-seccion" },
        h("h2", { class: "titulo-seccion" }, "Propiedades"),
        h("div", { style: "justify-self:end" }, h("a", { class: "boton secundario", href: "propiedades.html" }, "Ver todas"))),
      h("div", { class: "grilla-propiedades" }, destacadas.map(tarjetaPropiedad))) : null,
    seccion("", h("div", { class: "sobre" },
      foto(d.sobreMi.foto, `Foto de ${d.marca.nombre}`, "Foto de Emilia"),
      h("div", {}, h("span", { class: "antetitulo" }, "Quién soy"), h("h2", { class: "titulo-seccion" }, d.sobreMi.titulo),
        t(d.sobreMi.subtitulo, "p", { class: "subtitulo" }), t(d.sobreMi.historia?.[0], "p"),
        h("a", { class: "boton secundario", href: "sobre-mi.html" }, "Conocé cómo trabajo")))),
    bloqueTestimonios(d),
    bloquePreguntas(d),
    bloqueCierre(d),
  ];
}

function paginaPropiedades(d) {
  const valores = (campo) => [...new Set(d.propiedades.map((p) => p[campo]).filter(Boolean))].sort();
  const select = (nombre, etiqueta, opciones) => h("label", {}, etiqueta,
    h("select", { name: nombre }, h("option", { value: "" }, "Todas"), opciones.map((o) => h("option", { value: o }, o))));
  const grilla = h("div", { class: "grilla-propiedades" });
  const contador = h("p", { class: "migas" });
  const form = h("form", { class: "filtros", "aria-label": "Filtrar propiedades" },
    select("operacion", "Operación", valores("operacion")),
    select("tipo", "Tipo", valores("tipo")),
    select("ciudad", "Ciudad", valores("ciudad")),
    h("label", {}, "Dormitorios", h("select", { name: "dormitorios" }, h("option", { value: "" }, "Todos"), ["1", "2", "3", "4"].map((n) => h("option", { value: n }, `${n}${n === "4" ? " o más" : ""}`)))),
    h("label", {}, "Buscar", h("input", { name: "texto", type: "search", placeholder: "Barrio, palabra…" })),
    h("button", { class: "boton secundario chico", type: "reset" }, "Limpiar"));

  function filtrar() {
    const f = Object.fromEntries(new FormData(form));
    const texto = (f.texto || "").toLowerCase();
    const lista = d.propiedades.filter((p) =>
      (!f.operacion || p.operacion === f.operacion) &&
      (!f.tipo || p.tipo === f.tipo) &&
      (!f.ciudad || p.ciudad === f.ciudad) &&
      (!f.dormitorios || Number(p.dormitorios) >= Number(f.dormitorios)) &&
      (!texto || [p.titulo, p.barrio, p.ciudad, p.descripcion].join(" ").toLowerCase().includes(texto)));
    grilla.replaceChildren(...(lista.length ? lista.map(tarjetaPropiedad)
      : [h("div", { class: "vacio", style: "grid-column:1/-1" }, "No hay propiedades con esos filtros. ",
          enlaceWhatsapp(d.contacto.whatsapp) ? h("a", { href: enlaceWhatsapp(d.contacto.whatsapp, "Hola Emilia, estoy buscando una propiedad."), target: "_blank", rel: "noopener" }, "Contame qué buscás por WhatsApp.") : null)]));
    contador.textContent = `${lista.length} de ${d.propiedades.length} propiedades`;
  }
  form.addEventListener("input", filtrar);
  form.addEventListener("reset", () => setTimeout(filtrar));
  form.addEventListener("submit", (e) => e.preventDefault());
  // Permite enlazar filtros, por ejemplo propiedades.html?operacion=Alquiler
  for (const [k, v] of new URLSearchParams(location.search)) if (form.elements[k]) form.elements[k].value = v;
  filtrar();

  return [
    seccion("", h("span", { class: "antetitulo" }, d.contacto.zonaTexto),
      h("h1", { class: "titulo-seccion", style: "margin-bottom:40px" }, "Propiedades en venta y alquiler"),
      form, contador, grilla),
    bloqueCierre(d),
  ];
}

function paginaPropiedad(d) {
  const id = new URLSearchParams(location.search).get("id");
  const p = d.propiedades.find((x) => x.id === id);
  if (!p) {
    return [seccion("", h("h1", { class: "titulo-seccion" }, "No encontramos esa propiedad"),
      h("p", { class: "bajada-seccion" }, "Puede que ya no esté publicada."), h("a", { class: "boton", href: "propiedades.html" }, "Ver propiedades"))];
  }
  document.title = `${p.titulo} · ${d.marca.nombre}`;
  const fotos = (p.fotos || []).map(srcSeguro).filter(Boolean);
  const principal = foto(fotos[0], p.titulo, "Fotos de la propiedad");
  principal.classList.add("principal");
  const miniaturas = fotos.length > 1 ? h("div", { class: "miniaturas" }, fotos.map((src, n) =>
    h("button", { type: "button", "aria-label": `Foto ${n + 1}`, "aria-current": n === 0 ? "true" : "false",
      onclick: (e) => {
        principal.querySelector("img").src = src;
        e.currentTarget.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", String(b === e.currentTarget)));
      } }, h("img", { src, alt: "" })))) : null;
  const ficha = [["Operación", p.operacion], ["Tipo", p.tipo], ["Superficie", p.superficie && `${p.superficie} m²`],
    ["Ambientes", p.ambientes], ["Dormitorios", p.dormitorios], ["Baños", p.banos], ["Cocheras", p.cocheras]]
    .filter(([, v]) => v !== "" && v != null);
  const wa = enlaceWhatsapp(d.contacto.whatsapp, `Hola Emilia, me interesa "${p.titulo}" (${location.href}).`);
  return [
    seccion("",
      h("p", { class: "migas" }, h("a", { href: "propiedades.html" }, "Propiedades"), " / ", p.titulo),
      p.ejemplo ? h("p", { class: "alerta" }, "Esta es una propiedad de ejemplo. Reemplazala por una real desde el editor.") : null,
      h("div", { class: "detalle" },
        h("div", { class: "galeria" }, principal, miniaturas,
          h("div", { style: "margin-top:40px" }, h("h2", { style: "font-size:30px;margin-bottom:16px" }, "Descripción"),
            t(p.descripcion, "p"),
            p.caracteristicas?.length ? h("ul", { class: "caracteristicas" }, p.caracteristicas.map((c) => h("li", {}, c))) : null)),
        h("aside", { class: "ficha" },
          h("div", { class: "lugar migas", style: "margin:0" }, t([p.barrio, p.ciudad].filter(Boolean).join(", "))),
          h("h1", {}, p.titulo),
          h("div", { class: "precio" }, precioTexto(p)),
          h("dl", {}, ficha.map(([k, v]) => [h("div", {}, h("dt", {}, k), h("dd", {}, v))])),
          wa ? h("a", { class: "boton", href: wa, target: "_blank", rel: "noopener", style: "width:100%" }, "Consultar por WhatsApp")
             : h("p", { class: "alerta" }, "Falta cargar el WhatsApp en el editor.")))),
  ];
}

function paginaSobreMi(d) {
  const s = d.sobreMi;
  return [
    seccion("", h("div", { class: "sobre" },
      foto(s.foto, `Foto de ${d.marca.nombre}`, "Foto de Emilia (cargala desde el editor)"),
      h("div", {}, h("span", { class: "antetitulo" }, "Sobre mí"), h("h1", { class: "titulo-seccion" }, s.titulo),
        t(s.subtitulo, "p", { class: "subtitulo" }),
        (s.historia || []).map((parrafo) => t(parrafo, "p")),
        d.matricula?.mostrar && d.matricula.texto ? h("p", { class: "migas" }, d.matricula.texto) : null,
        h("div", { class: "valores" }, (s.valores || []).map((v) => h("div", {}, h("h3", {}, v.titulo), t(v.texto, "p"))))))),
    d.zonas?.items?.length ? seccion("", h("h2", { class: "titulo-seccion", style: "margin-bottom:48px" }, d.zonas.titulo),
      h("div", { class: "zonas" }, d.zonas.items.map((z) => h("div", { class: "zona" }, h("h3", {}, z.nombre), t(z.texto, "p"))))) : null,
    seccion("", h("div", { class: "pasos" },
      h("div", {}, h("span", { class: "antetitulo" }, "Paso a paso"), h("h2", { class: "titulo-seccion" }, d.pasos.titulo)),
      h("ol", {}, d.pasos.items.map((x, n) => h("li", {}, h("span", { class: "num" }, n + 1), h("div", {}, h("h3", {}, x.titulo), t(x.texto, "p"))))))),
    bloqueTestimonios(d),
    bloqueCierre(d),
  ];
}

function campo(nombre, etiqueta, control, { opcional = false, error = "Completá este dato." } = {}) {
  control.name = nombre;
  control.id = `f-${nombre}`;
  if (!opcional) control.required = true;
  return h("label", { class: "campo", for: control.id },
    h("span", {}, etiqueta, opcional ? h("span", { class: "opcional" }, " (opcional)") : null),
    control, h("span", { class: "error", role: "alert" }, error));
}

function paginaTasacion(d) {
  const x = d.tasacion;
  const numero = soloDigitos(d.contacto.whatsapp);
  const form = h("form", { class: "formulario", novalidate: true },
    h("h2", {}, "Tus datos"),
    numero ? null : h("p", { class: "alerta" }, "Falta cargar el WhatsApp de Emilia en el editor: sin eso el formulario no puede enviarse."),
    campo("nombre", "Nombre", h("input", { autocomplete: "name" })),
    h("div", { class: "fila" },
      campo("ciudad", "Ciudad", h("select", {}, ["Córdoba", "Buenos Aires", "Otra"].map((c) => h("option", {}, c)))),
      campo("tipo", "Tipo de propiedad", h("select", {}, ["Departamento", "Casa", "PH", "Terreno", "Local u oficina", "Otro"].map((c) => h("option", {}, c))))),
    campo("barrio", "Barrio o dirección", h("input", { autocomplete: "street-address" })),
    h("div", { class: "fila" },
      campo("telefono", "Tu teléfono", h("input", { type: "tel", autocomplete: "tel", inputmode: "tel" }), { error: "Poné un teléfono válido." }),
      campo("email", "Email", h("input", { type: "email", autocomplete: "email" }), { opcional: true, error: "Revisá el email." })),
    campo("comentario", "Comentario", h("textarea", { placeholder: "Estado, metros aproximados, si tenés apuro…" }), { opcional: true }),
    h("button", { class: "boton", type: "submit", style: "width:100%", disabled: !numero }, "Enviar por WhatsApp"),
    h("p", { class: "aviso" }, x.aviso));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let valido = true;
    for (const control of form.querySelectorAll("input, select, textarea")) {
      let ok = control.checkValidity() && (!control.required || control.value.trim() !== "");
      if (control.name === "telefono") ok = ok && soloDigitos(control.value).length >= 8;
      control.closest(".campo").classList.toggle("invalido", !ok);
      if (!ok && valido) { control.focus(); valido = false; }
    }
    if (!valido) return;
    const f = Object.fromEntries(new FormData(form));
    const mensaje = [
      "Hola Emilia, quiero tasar mi propiedad.",
      `Nombre: ${f.nombre}`, `Propiedad: ${f.tipo} en ${f.barrio}, ${f.ciudad}`,
      `Teléfono: ${f.telefono}`, f.email && `Email: ${f.email}`, f.comentario && `Comentario: ${f.comentario}`,
    ].filter(Boolean).join("\n");
    window.open(enlaceWhatsapp(numero, mensaje), "_blank", "noopener");
    location.href = "gracias.html";
  });

  return [
    seccion("", h("div", { class: "tasacion" },
      h("div", {}, h("span", { class: "antetitulo" }, "Tasación"), h("h1", {}, x.titulo),
        t(x.texto, "p", { class: "bajada-seccion", style: "font-size:19px" }),
        h("ul", {}, x.puntos.map((pt) => t(pt, "li")))),
      form)),
    bloquePreguntas(d),
  ];
}

function paginaGracias(d) {
  return [seccion("", h("span", { class: "antetitulo" }, "Listo"),
    h("h1", { class: "titulo-seccion" }, "Gracias por escribirme"),
    h("p", { class: "bajada-seccion" }, "Se abrió WhatsApp con tus datos. Si no se envió, mandalo desde ahí y te respondo apenas lo vea."),
    h("div", { class: "botones", style: "margin-top:32px" }, h("a", { class: "boton", href: "propiedades.html" }, "Ver propiedades"), h("a", { class: "boton secundario", href: "index.html" }, "Volver al inicio")))];
}

const RENDER = { inicio: paginaInicio, propiedades: paginaPropiedades, propiedad: paginaPropiedad, "sobre-mi": paginaSobreMi, tasacion: paginaTasacion, gracias: paginaGracias };
const ARCHIVO = { inicio: "index.html", propiedades: "propiedades.html", "sobre-mi": "sobre-mi.html" };

async function iniciar() {
  const pagina = document.body.dataset.pagina;
  const raiz = document.getElementById("app");
  try {
    const { datos, esBorrador } = await cargarContenido();
    aplicarTema(datos.tema);
    const enEditor = window.self !== window.top;
    raiz.replaceChildren(
      esBorrador && !enEditor ? h("div", { class: "aviso-borrador" }, "Estás viendo tu borrador (solo se ve en esta compu). ", h("a", { href: "editar.html" }, "Seguir editando")) : "",
      encabezado(datos, ARCHIVO[pagina]),
      h("main", {}, RENDER[pagina](datos)),
      pie(datos),
      botonWhatsappFlotante(datos) ?? "");
    if (pagina !== "propiedad") document.title = `${datos.marca.nombre} · ${document.title}`;
  } catch (error) {
    console.error(error);
    raiz.replaceChildren(h("p", { class: "cargando" }, "No se pudo cargar la página. Probá recargar."));
  }
}

iniciar();
