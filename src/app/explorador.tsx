"use client";

// Portada de FanBase: buscador, filtros y tarjetas de conciertos, arte y
// cultura, y bares. Diseño basado en la maqueta diseno/fanbase_0_1.html.

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import type { EventoEncontrado } from "@/lib/eventos";
import type { Bar } from "@/lib/bares";
import { DIAS_SEMANA, diaSemanaDe, nombreDia, type DiaSemana } from "@/lib/dias";
import { CATEGORIA_MUSICA, type TipoEvento } from "@/lib/categorias";
import { formatearFecha, hoyEnChile, normalizar, proximoFinDeSemana, sumarDias } from "@/lib/fechas";
import { imagenOptimizable } from "@/lib/imagenes";
import { calzaPrecio, hayRango, sectorEnRango, type RangoPrecio } from "@/lib/precios";
import { ORDEN_REGIONES, ubicarComuna } from "@/lib/regiones";

type Vista = "todo" | "conciertos" | "bares";
type FiltroFecha = "todo" | "hoy" | "semana" | "finde";
type Seleccion = { tipo: "evento"; item: EventoEncontrado; funciones: EventoEncontrado[] } | { tipo: "bar"; item: Bar } | null;

const VISTAS: { id: Vista; nombre: string }[] = [
  { id: "todo", nombre: "Inicio" },
  { id: "conciertos", nombre: "Conciertos" },
  { id: "bares", nombre: "Bares" },
];

const TIPOS: { id: TipoEvento; nombre: string }[] = [
  { id: "musica", nombre: "Música" },
  { id: "otros", nombre: "No música" },
  { id: "todos", nombre: "Todo" },
];

const FILTROS_FECHA: { id: FiltroFecha; nombre: string }[] = [
  { id: "todo", nombre: "Todo" },
  { id: "hoy", nombre: "Hoy" },
  { id: "semana", nombre: "Esta semana" },
  { id: "finde", nombre: "Fin de semana" },
];

const pesos = (n: number) => `$${n.toLocaleString("es-CL")}`;

// Precio "desde" para mostrar: el base si lo tenemos, si no el total con cargo.
const precioDesde = (e: EventoEncontrado) => e.precios.baseDesde ?? e.precios.totalDesde;

// Rangos rápidos del filtro de precio (precio base, sin cargo por servicio).
const RANGOS: { id: string; nombre: string; rango: RangoPrecio }[] = [
  { id: "", nombre: "Cualquier precio", rango: {} },
  { id: "hasta10", nombre: "Hasta $10.000", rango: { max: 10_000 } },
  { id: "10a30", nombre: "$10.000 – $30.000", rango: { min: 10_000, max: 30_000 } },
  { id: "30a60", nombre: "$30.000 – $60.000", rango: { min: 30_000, max: 60_000 } },
  { id: "mas60", nombre: "Más de $60.000", rango: { min: 60_000 } },
  { id: "otro", nombre: "Elegir rango…", rango: {} },
];

// "15.000" o "15000" → 15000; vacío → sin límite.
const leerMonto = (texto: string) => {
  const n = Number(texto.replace(/\D/g, ""));
  return texto.trim() && Number.isFinite(n) ? n : undefined;
};

function textoPrecio(e: EventoEncontrado) {
  const precio = precioDesde(e);
  if (precio === 0) return "Entrada liberada";
  return precio != null ? `Desde ${pesos(precio)}` : `Precio en ${e.fuente.nombre}`;
}

// "sáb 17 oct · 21:00", o "9 oct al 29 nov" para exposiciones y temporadas.
function textoFecha(e: EventoEncontrado) {
  if (!e.fecha) return "Fecha por confirmar";
  const fechas = e.fechaFin ? `${formatearFecha(e.fecha)} al ${formatearFecha(e.fechaFin)}` : formatearFecha(e.fecha);
  return [fechas, e.hora].filter(Boolean).join(" · ");
}

const esMusica = (e: EventoEncontrado) => e.categoria === CATEGORIA_MUSICA;

// Las funciones de un mismo evento (misma página y nombre) van en una sola
// tarjeta; los eventos ya vienen ordenados por fecha, así que la primera es la próxima.
function agruparFunciones(eventos: EventoEncontrado[]): EventoEncontrado[][] {
  const grupos = new Map<string, EventoEncontrado[]>();
  for (const e of eventos) {
    const clave = `${e.fuente.id}|${e.url}|${e.nombre}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), e]);
  }
  return [...grupos.values()];
}

const resultados = (n: number) => `${n} resultado${n === 1 ? "" : "s"}`;

const ordenAlfabetico = (lista: (string | null | undefined)[]) =>
  [...new Set(lista)].filter((x): x is string => Boolean(x)).sort((a, b) => a.localeCompare(b, "es"));

export function Explorador({ eventos, bares }: { eventos: EventoEncontrado[]; bares: Bar[] }) {
  const [vista, setVista] = useState<Vista>("todo");
  const [tipo, setTipo] = useState<TipoEvento>("todos");
  const [texto, setTexto] = useState("");
  // Un género de música ("Rock") o una categoría de cultura ("Teatro").
  const [genero, setGenero] = useState("");
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");
  const [soloGratis, setSoloGratis] = useState(false);
  const [rangoId, setRangoId] = useState("");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");
  // "Solo gratis" manda sobre el rango de precio.
  const rangoPrecio: RangoPrecio = soloGratis
    ? {}
    : rangoId === "otro"
      ? { min: leerMonto(montoMin), max: leerMonto(montoMax) }
      : (RANGOS.find((r) => r.id === rangoId)?.rango ?? {});
  // La fecha de hoy se toma al elegir el filtro (no al dibujar la página), así
  // la página se puede generar de antemano en el servidor.
  const [filtroFecha, setFiltroFecha] = useState<{ id: FiltroFecha; hoy: string }>({ id: "todo", hoy: "" });
  const [seleccion, setSeleccion] = useState<Seleccion>(null);

  const generosMusica = useMemo(
    () => ordenAlfabetico([...eventos.filter(esMusica).map((e) => e.genero), ...bares.map((b) => b.genero)]),
    [eventos, bares],
  );
  const categoriasCultura = useMemo(
    () => ordenAlfabetico(eventos.filter((e) => !esMusica(e)).map((e) => e.categoria)),
    [eventos],
  );
  // Comuna y región de cada lugar (eventos y bares), con el nombre de comuna unificado.
  const lugares = useMemo(
    () => [...eventos.map((e) => ({ comuna: e.recinto?.comuna ?? null, region: e.recinto?.region ?? null })), ...bares.map((b) => ubicarComuna(b.comuna))],
    [eventos, bares],
  );
  // Solo las regiones que tienen algo, de norte a sur.
  const regiones = useMemo(() => ORDEN_REGIONES.filter((r) => lugares.some((l) => l.region === r)), [lugares]);
  // Las comunas de la región elegida (o todas).
  const comunas = useMemo(
    () => ordenAlfabetico(lugares.filter((l) => !region || l.region === region).map((l) => l.comuna)),
    [lugares, region],
  );

  const busqueda = normalizar(texto);

  const eventosFiltrados = eventos.filter((e) => {
    const contenido = [e.nombre, e.artista, e.genero, e.categoria, e.descripcion, e.recinto?.nombre, e.recinto?.comuna].filter(Boolean).join(" ");
    if (busqueda && !normalizar(contenido).includes(busqueda)) return false;
    if (genero && e.genero !== genero && e.categoria !== genero) return false;
    if (region && e.recinto?.region !== region) return false;
    if (comuna && e.recinto?.comuna !== comuna) return false;
    if (soloGratis && precioDesde(e) !== 0) return false;
    if (!calzaPrecio(e.sectores, e.precios, rangoPrecio)) return false;

    const { id, hoy } = filtroFecha;
    if (id === "todo" || !e.fecha) return id === "todo";
    const rango =
      id === "hoy" ? { desde: hoy, hasta: hoy } :
      id === "semana" ? { desde: hoy, hasta: sumarDias(hoy, 7) } :
      proximoFinDeSemana(hoy);
    // Los eventos de varios días (exposiciones, ferias) cuentan si se cruzan con el rango.
    return e.fecha <= rango.hasta && (e.fechaFin ?? e.fecha) >= rango.desde;
  });
  const conciertos = agruparFunciones(eventosFiltrados.filter(esMusica));
  const cultura = agruparFunciones(eventosFiltrados.filter((e) => !esMusica(e)));

  const baresFiltrados = bares.filter((b) => {
    const contenido = [b.nombre, b.comuna, b.genero, b.descripcion, ...b.programacion.map((s) => s.evento)].filter(Boolean).join(" ");
    if (busqueda && !normalizar(contenido).includes(busqueda)) return false;
    if (genero && b.genero !== genero) return false;
    const lugar = ubicarComuna(b.comuna);
    if (region && lugar.region !== region) return false;
    if (comuna && lugar.comuna !== comuna) return false;
    if (soloGratis && !b.entradaLiberada) return false;
    // Los bares no publican precios: con un rango elegido solo quedan los de entrada liberada (si el rango parte en $0).
    if (hayRango(rangoPrecio) && !(b.entradaLiberada && !rangoPrecio.min)) return false;

    // La programación de los bares es semanal: se compara por día de la semana.
    const { id, hoy } = filtroFecha;
    if (id === "hoy") return b.programacion.some((s) => s.dia === diaSemanaDe(hoy));
    if (id === "finde") return b.programacion.some((s) => ["viernes", "sabado", "domingo"].includes(s.dia));
    if (id === "semana") return b.programacion.length > 0;
    return true;
  });
  const hayEjemplos = baresFiltrados.some((b) => b.esEjemplo);

  // Al cambiar cualquier filtro, las secciones vuelven a mostrar solo las primeras tarjetas.
  const claveFiltros = [tipo, texto, genero, region, comuna, soloGratis, rangoId, montoMin, montoMax, filtroFecha.id].join("|");
  const hayFiltros = vista !== "todo" || claveFiltros !== ["todos", "", "", "", "", false, "", "", "", "todo"].join("|");

  // Vuelve todo a como estaba al abrir la página, para empezar una búsqueda nueva.
  function limpiarFiltros() {
    setVista("todo");
    setTipo("todos");
    setTexto("");
    setGenero("");
    setRegion("");
    setComuna("");
    setSoloGratis(false);
    setRangoId("");
    setMontoMin("");
    setMontoMax("");
    setFiltroFecha({ id: "todo", hoy: "" });
  }

  function cambiarRegion(nueva: string) {
    setRegion(nueva);
    // Si la comuna elegida no es de la nueva región, se suelta.
    if (comuna && nueva && !lugares.some((l) => l.comuna === comuna && l.region === nueva)) setComuna("");
  }

  const verMusica = tipo !== "otros";
  const verCultura = tipo !== "musica" && vista === "todo";

  function cambiarVista(nueva: Vista) {
    setVista(nueva);
    // Conciertos y Bares son música: si estaba en "No música", se pasa a "Todo".
    if (nueva !== "todo" && tipo === "otros") setTipo("todos");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cambiarTipo(nuevo: TipoEvento) {
    setTipo(nuevo);
    if (nuevo === "otros") setVista("todo");
    // El género elegido puede no existir en el nuevo tipo.
    const sigueValido = !genero || (nuevo !== "otros" && generosMusica.includes(genero)) || (nuevo !== "musica" && categoriasCultura.includes(genero));
    if (!sigueValido) setGenero("");
  }

  return (
    <>
      <header>
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark">F</div>
            <div>
              FANBASE
              <small>Música en vivo, simple.</small>
            </div>
          </div>
          <nav className="nav">
            {VISTAS.map((v) => (
              <button key={v.id} className={vista === v.id ? "active" : ""} onClick={() => cambiarVista(v.id)}>
                {v.nombre}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="app">
        <section className="hero">
          <div>
            <div className="eyebrow">Fanbase 0.1</div>
            <h1>Encuentra dónde escuchar música en vivo.</h1>
            <p>Busca conciertos, bares y shows por artista, género, comuna o fecha. Sin perfil, sin match y sin vueltas.</p>
          </div>
          <div className="hero-stat">
            <div className="big">{eventos.length}</div>
            <div className="muted">próximos eventos, de Puntoticket y la Agenda Cultural de Las Condes</div>
          </div>
        </section>

        <section className="search-panel">
          <div className="panel-top">
            <div className="segmented" role="radiogroup" aria-label="Tipo de evento">
              {TIPOS.map((t) => (
                <button key={t.id} role="radio" aria-checked={tipo === t.id} className={tipo === t.id ? "active" : ""} onClick={() => cambiarTipo(t.id)}>
                  {t.nombre}
                </button>
              ))}
            </div>
            <button className="limpiar" onClick={limpiarFiltros} disabled={!hayFiltros}>
              ✕ Limpiar filtros
            </button>
          </div>

          <label className="searchbox">
            <span aria-hidden>⌕</span>
            <input
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              placeholder="Artista, obra, género o recinto..."
              aria-label="Buscar"
            />
          </label>

          {/* Orden de los filtros: región → comuna → género → precio; abajo, fecha y "Solo gratis". Todos se combinan. */}
          <div className="filter-row">
            <select className="filter-select" value={region} onChange={(ev) => cambiarRegion(ev.target.value)} aria-label="Región">
              <option value="">Todas las regiones</option>
              {regiones.map((r) => <option key={r} value={r}>{r === "Metropolitana" ? "Región Metropolitana" : r}</option>)}
            </select>
            <select className="filter-select" value={comuna} onChange={(ev) => setComuna(ev.target.value)} aria-label="Comuna">
              <option value="">{region ? `Todas las comunas (${comunas.length})` : "Todas las comunas"}</option>
              {comunas.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="filter-select" value={genero} onChange={(ev) => setGenero(ev.target.value)} aria-label="Género o categoría">
              <option value="">{tipo === "otros" ? "Todas las categorías" : "Todos los géneros"}</option>
              {tipo !== "otros" && (
                <optgroup label="Música">
                  {generosMusica.map((g) => <option key={g} value={g}>{g}</option>)}
                </optgroup>
              )}
              {tipo !== "musica" && (
                <optgroup label="Arte y cultura">
                  {categoriasCultura.map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              )}
            </select>
            <select
              className="filter-select"
              value={soloGratis ? "" : rangoId}
              onChange={(ev) => setRangoId(ev.target.value)}
              disabled={soloGratis}
              title={soloGratis ? "Desactiva «Solo gratis» para elegir un rango de precio" : undefined}
              aria-label="Precio"
            >
              {RANGOS.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          {rangoId === "otro" && !soloGratis && (
            <div className="rango-personalizado">
              <label>Desde $<input inputMode="numeric" value={montoMin} onChange={(ev) => setMontoMin(ev.target.value)} placeholder="0" /></label>
              <label>Hasta $<input inputMode="numeric" value={montoMax} onChange={(ev) => setMontoMax(ev.target.value)} placeholder="sin límite" /></label>
            </div>
          )}

          <div className="quick-filters">
            {FILTROS_FECHA.map((f) => (
              <button
                key={f.id}
                className={`chip ${filtroFecha.id === f.id ? "active" : ""}`}
                onClick={() => setFiltroFecha({ id: f.id, hoy: hoyEnChile() })}
              >
                {f.nombre}
              </button>
            ))}
            <span className="separador" aria-hidden />
            <button className={`chip chip-gratis ${soloGratis ? "active" : ""}`} aria-pressed={soloGratis} onClick={() => setSoloGratis((v) => !v)}>
              {soloGratis ? "✓ " : ""}Solo gratis
            </button>
          </div>
        </section>

        {verMusica && vista !== "bares" && (
          <SeccionEventos
            key={`conciertos-${claveFiltros}`}
            titulo="Conciertos"
            subtitulo="Shows, tributos y eventos musicales."
            vacio="No hay conciertos que coincidan con esos filtros."
            grupos={conciertos}
            onAbrir={(f) => setSeleccion({ tipo: "evento", item: f[0], funciones: f })}
          />
        )}

        {verCultura && (
          <SeccionEventos
            key={`cultura-${claveFiltros}`}
            titulo="Arte y cultura"
            subtitulo="Teatro, exposiciones, cine, humor, ferias y más."
            vacio="No hay actividades que coincidan con esos filtros."
            grupos={cultura}
            onAbrir={(f) => setSeleccion({ tipo: "evento", item: f[0], funciones: f })}
          />
        )}

        {verMusica && vista !== "conciertos" && (
          <section>
            <div className="section-head">
              <div>
                <h2>Bares y música en vivo</h2>
                <p>Locales con programación musical.{hayEjemplos && <> <span className="demo-tag">Datos de ejemplo</span></>}</p>
              </div>
              <div className="count">{resultados(baresFiltrados.length)}</div>
            </div>
            <div className="grid">
              {baresFiltrados.length ? (
                baresFiltrados.map((b) => (
                  <TarjetaBar key={b.id} bar={b} onAbrir={() => setSeleccion({ tipo: "bar", item: b })} />
                ))
              ) : (
                <div className="empty">No hay bares que coincidan con esos filtros.</div>
              )}
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        {VISTAS.map((v) => (
          <button key={v.id} className={`ghost ${vista === v.id ? "active" : ""}`} onClick={() => cambiarVista(v.id)}>
            {v.nombre}
          </button>
        ))}
      </nav>

      {seleccion && (
        <Modal
          titulo={seleccion.tipo === "bar" ? "Bar" : esMusica(seleccion.item) ? "Concierto" : seleccion.item.categoria}
          onCerrar={() => setSeleccion(null)}
        >
          {seleccion.tipo === "evento" ? <DetalleEvento funciones={seleccion.funciones} rango={rangoPrecio} /> : <DetalleBar bar={seleccion.item} />}
        </Modal>
      )}
    </>
  );
}

const POR_PAGINA = 24;

// Una sección de tarjetas con "Ver más": con cientos de eventos, dibujarlos
// todos de una vez hace lenta la página en el celular.
function SeccionEventos({ titulo, subtitulo, vacio, grupos, onAbrir }: {
  titulo: string;
  subtitulo: string;
  vacio: string;
  grupos: EventoEncontrado[][];
  onAbrir: (funciones: EventoEncontrado[]) => void;
}) {
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const restantes = grupos.length - visibles;
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>{titulo}</h2>
          <p>{subtitulo}</p>
        </div>
        <div className="count">{resultados(grupos.length)}</div>
      </div>
      <div className="grid">
        {grupos.length ? (
          grupos.slice(0, visibles).map((f) => <TarjetaEvento key={f[0].id} funciones={f} onAbrir={() => onAbrir(f)} />)
        ) : (
          <div className="empty">{vacio}</div>
        )}
      </div>
      {restantes > 0 && (
        <div className="ver-mas">
          <button className="ghost" onClick={() => setVisibles((v) => v + POR_PAGINA)}>
            Ver más ({restantes} {restantes === 1 ? "restante" : "restantes"})
          </button>
        </div>
      )}
    </section>
  );
}

function Portada({ imagen, etiqueta, variante }: { imagen?: string | null; etiqueta: string | null; variante?: "bar" }) {
  return (
    <div className={`cover ${variante ?? ""}`}>
      {imagen && <Image src={imagen} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 380px" className="cover-img" unoptimized={!imagenOptimizable(imagen)} />}
      {etiqueta && <span className="tag">{etiqueta}</span>}
    </div>
  );
}

function TarjetaEvento({ funciones, onAbrir }: { funciones: EventoEncontrado[]; onAbrir: () => void }) {
  const e = funciones[0];
  const mas = funciones.length - 1;
  const musica = esMusica(e);
  return (
    <article className="card">
      <Portada imagen={e.imagen} etiqueta={musica ? e.genero : e.categoria} />
      <div className="card-body">
        <h3>{e.nombre}</h3>
        <div className="meta">
          {e.recinto && <span>{[e.recinto.nombre, e.recinto.comuna].filter(Boolean).join(" · ")}</span>}
          <span>{textoFecha(e)}{mas > 0 && <span className="mas-funciones"> · +{mas} {mas === 1 ? "función" : "funciones"} más</span>}</span>
          <span>{textoPrecio(e)}</span>
        </div>
        <div className="pill-row">
          <span className="pill">{musica ? (e.genero ?? CATEGORIA_MUSICA) : e.categoria}</span>
          {e.agotado ? (
            <span className="pill pill-danger">Agotado</span>
          ) : precioDesde(e) === 0 ? (
            <span className="pill pill-free">Gratis</span>
          ) : (
            <span className="pill">Ticket requerido</span>
          )}
        </div>
        <div className="card-actions">
          <button className="primary" onClick={onAbrir}>{musica ? "Ver evento" : "Ver actividad"}</button>
        </div>
      </div>
    </article>
  );
}

// Fecha de hoy en Chile, solo en el navegador (en el servidor es null): así la
// página se puede generar de antemano y el "hoy" se calcula al abrirla.
const sinSuscripcion = () => () => {};
function useHoy(): string | null {
  return useSyncExternalStore(sinSuscripcion, hoyEnChile, () => null);
}

// El show de hoy, o si no hay, el próximo de la semana.
function proximoShow(b: Bar, hoy: string | null) {
  if (!hoy || b.programacion.length === 0) return null;
  const desde = DIAS_SEMANA.indexOf(diaSemanaDe(hoy));
  const distancia = (dia: DiaSemana) => (DIAS_SEMANA.indexOf(dia) - desde + 7) % 7;
  const show = [...b.programacion].sort((x, y) => distancia(x.dia) - distancia(y.dia))[0];
  return { ...show, esHoy: distancia(show.dia) === 0 };
}

function TarjetaBar({ bar: b, onAbrir }: { bar: Bar; onAbrir: () => void }) {
  const show = proximoShow(b, useHoy());
  return (
    <article className="card">
      <Portada etiqueta={b.genero} variante="bar" />
      <div className="card-body">
        <h3>{b.nombre}</h3>
        <div className="meta">
          <span>{b.comuna} · {b.nivelPrecio}</span>
          {show ? (
            <span>{show.esHoy ? "Hoy" : nombreDia(show.dia)}: {show.evento} · {show.hora}</span>
          ) : (
            <span>{b.programacion.map((s) => nombreDia(s.dia)).filter((d, i, a) => a.indexOf(d) === i).join(" · ") || "Sin programación cargada"}</span>
          )}
        </div>
        <div className="pill-row">
          <span className="pill">{b.genero}</span>
          <span className="pill">{b.entradaLiberada ? "Entrada liberada" : "Música en vivo"}</span>
          {b.esEjemplo && <span className="pill pill-demo">Ejemplo</span>}
        </div>
        <div className="card-actions">
          <button className="primary" onClick={onAbrir}>Ver bar</button>
        </div>
      </div>
    </article>
  );
}

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const alPresionar = (ev: KeyboardEvent) => ev.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  return (
    <div className="modal" onClick={(ev) => ev.target === ev.currentTarget && onCerrar()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-top">
          <div className="eyebrow">{titulo}</div>
          <button className="close" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}

function enlaceMapa(recinto: NonNullable<EventoEncontrado["recinto"]>) {
  const { nombre, comuna, direccion, latitud, longitud } = recinto;
  const consulta = latitud != null && longitud != null
    ? `${latitud},${longitud}`
    : [direccion ?? nombre, comuna, "Chile"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}

// Texto del botón principal según adónde lleva el link.
function textoBoton(e: EventoEncontrado) {
  if (e.url.includes("#")) return "Ver en la agenda ↗"; // sin link de entradas: lleva a la agenda
  return precioDesde(e) === 0 ? "Reservar entrada ↗" : "Comprar entradas ↗";
}

function DetalleEvento({ funciones, rango }: { funciones: EventoEncontrado[]; rango: RangoPrecio }) {
  // Cada función puede tener otros precios o disponibilidad: se muestra la elegida.
  const [elegida, setElegida] = useState(0);
  const e = funciones[elegida] ?? funciones[0];
  const [subtitulo, ...parrafos] = e.descripcion?.split("\n\n") ?? [];
  return (
    <>
      <h2>{e.nombre}</h2>
      {e.artista && e.artista !== e.nombre && !e.nombre.includes(e.artista) && <p className="muted">{e.artista}</p>}
      {subtitulo && <p className="muted">{subtitulo}</p>}
      <div className="detail-grid">
        <div className="detail-box"><small>Fecha</small><strong>{textoFecha(e)}</strong></div>
        <div className="detail-box"><small>Lugar</small><strong>{e.recinto?.nombre ?? "Por confirmar"}</strong></div>
        <div className="detail-box"><small>Comuna</small><strong>{e.recinto?.comuna ?? "—"}</strong></div>
        <div className="detail-box"><small>Precio</small><strong>{textoPrecio(e)}</strong></div>
      </div>
      {funciones.length > 1 && (
        <div className="funciones">
          <h3>Funciones ({funciones.length})</h3>
          <div className="funciones-lista">
            {funciones.map((f, k) => (
              <button key={f.id} className={`chip ${k === elegida ? "active" : ""}`} onClick={() => setElegida(k)}>
                {textoFecha(f)}{f.agotado ? " · agotada" : ""}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="pill-row">
        <span className="pill">{esMusica(e) ? (e.genero ?? CATEGORIA_MUSICA) : e.categoria}</span>
        {e.agotado && <span className="pill pill-danger">Agotado</span>}
        <span className="pill">Fuente: {e.fuente.nombre}</span>
      </div>

      {parrafos.length > 0 && (
        <div className="descripcion">
          {parrafos.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}

      {e.sectores.length > 0 && (
        <div className="schedule">
          <h3>Precios</h3>
          {hayRango(rango) && (
            <p className="muted nota-rango">
              Marcadas: las entradas disponibles dentro de tu rango de precio.
              {e.sectores.every((s) => s.agotado == null) && ` ${e.fuente.nombre} no publica cuáles quedan disponibles.`}
            </p>
          )}
          {e.sectores.map((s) => (
            <div key={s.nombre} className={`schedule-row ${hayRango(rango) && sectorEnRango(s, rango, "base") ? "en-rango" : ""}`}>
              <span>
                <strong>{s.nombre}</strong>
                {s.agotado && <span className="pill pill-danger pill-sector">Agotado</span>}
                {s.cargo != null && <><br /><span className="muted">+ {pesos(s.cargo)} cargo por servicio</span></>}
              </span>
              <strong>{s.precio != null ? pesos(s.precio) : s.total != null ? `${pesos(s.total)} total` : "—"}</strong>
            </div>
          ))}
        </div>
      )}
      {e.sectores.length === 0 && e.preciosEnImagen && (
        <p className="muted">
          {e.fuente.nombre} publica los precios de este evento como imagen:{" "}
          <a href={e.preciosEnImagen} target="_blank" rel="noopener noreferrer">ver tabla de precios ↗</a>
        </p>
      )}

      {e.tambienEn.length > 0 && (
        <p className="muted tambien-en">
          También a la venta en:{" "}
          {e.tambienEn.map((o, i) => (
            <span key={o.url}>
              {i > 0 && ", "}
              <a href={o.url} target="_blank" rel="noopener noreferrer">{o.fuente} ↗</a>
            </span>
          ))}
        </p>
      )}
      <div className="detail-actions">
        <a className="primary" href={e.url} target="_blank" rel="noopener noreferrer">{textoBoton(e)}</a>
        {e.recinto && (
          <a className="ghost" href={enlaceMapa(e.recinto)} target="_blank" rel="noopener noreferrer">Cómo llegar</a>
        )}
      </div>
      {e.actualizado && (
        <div className="notice">
          Información revisada el{" "}
          {new Date(e.actualizado).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "long", timeStyle: "short" })}{" "}
          en {e.fuente.nombre}. Confirma precios, disponibilidad y horarios en {e.fuente.nombre} antes de ir.
        </div>
      )}
    </>
  );
}

// "@labatuta" o "labatuta" → https://www.instagram.com/labatuta; un link completo se respeta.
const enlaceInstagram = (ig: string) =>
  ig.startsWith("http") ? ig : `https://www.instagram.com/${ig.replace(/^@/, "")}`;

function DetalleBar({ bar: b }: { bar: Bar }) {
  const hoy = useHoy();
  const diaHoy = hoy && diaSemanaDe(hoy);
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.direccion ?? b.nombre, b.comuna, "Chile"].join(", "))}`;
  return (
    <>
      <h2>{b.nombre}</h2>
      {b.descripcion && <p className="muted">{b.descripcion}</p>}
      <div className="detail-grid">
        <div className="detail-box"><small>Comuna</small><strong>{b.comuna}</strong></div>
        <div className="detail-box"><small>Estilo</small><strong>{b.genero}</strong></div>
        <div className="detail-box"><small>Precio</small><strong>{b.nivelPrecio}</strong></div>
        <div className="detail-box"><small>Entrada</small><strong>{b.entradaLiberada ? "Liberada" : "Consultar en el local"}</strong></div>
      </div>
      {b.direccion && <p className="muted">{b.direccion}</p>}
      <div className="schedule">
        <h3>Programación semanal</h3>
        {b.programacion.length === 0 && <p className="muted">Este bar todavía no tiene programación cargada.</p>}
        {b.programacion.map((s, i) => (
          <div key={i} className="schedule-row">
            <span>
              <strong>{nombreDia(s.dia)}{s.dia === diaHoy && <span className="hoy-tag">Hoy</span>}</strong>
              <br /><span className="muted">{s.evento}</span>
            </span>
            <strong>{s.hora}</strong>
          </div>
        ))}
      </div>
      <div className="detail-actions">
        <a className="primary" href={mapa} target="_blank" rel="noopener noreferrer">Cómo llegar</a>
        {b.instagram && <a className="ghost" href={enlaceInstagram(b.instagram)} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}
        {b.sitioWeb && <a className="ghost" href={b.sitioWeb} target="_blank" rel="noopener noreferrer">Sitio web ↗</a>}
      </div>
      {b.esEjemplo && (
        <div className="notice">
          Dato de ejemplo: este bar y su programación son ficticios mientras cargamos bares reales.
        </div>
      )}
    </>
  );
}
