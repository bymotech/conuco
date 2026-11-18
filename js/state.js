/**
 * state.js — Estado global del jugador + persistencia en localStorage.
 *
 * Forma del estado (v3):
 * {
 *   version, creadoEn, ultimaVez,        // marcas de tiempo (ms epoch)
 *   dinero, xp,
 *   zona: 'llanos' | ... | null,         // null = aún no termina la configuración inicial
 *   terrenos: [bool x 9],                // terrenos comprados (por filas; el 4 es el inicial)
 *   semillas: { maiz: 3, ... },          // inventario de semillas
 *   cosechas: { maiz: 6, ... },          // cosecha lista para vender
 *   parcelas: [ { desbloqueada, cultivo, plantadoEn }, ... ]  // 81 fijas (9 por terreno)
 *            + las que pone el jugador: { desbloqueada: true, cultivo, plantadoEn, x, y }
 *   graneros: [ { x, y }, ... ],         // graneros construidos (2x2 casillas, amplían el almacén)
 *   jugador: { etnia, nombre, tx, ty },
 *   tutorial: { hecho },                 // la guía de los primeros pasos ya terminó
 *   estadisticas: { sembradas, cosechadas, vendidas, ganado, semillasCompradas }
 * }
 *
 * Idea clave del "tiempo offline": NO se guarda "progreso", solo el instante en
 * que se sembró (plantadoEn). El progreso siempre se calcula como (ahora - plantadoEn),
 * así que el cultivo sigue creciendo aunque se cierre el navegador.
 */
(function (global) {
  'use strict';
  const Conuco = (global.Conuco = global.Conuco || {});
  const C = Conuco.CONFIG;
  const M = Conuco.MAPA;
  const POR_ID = Conuco.CULTIVOS_POR_ID;
  const TOTAL = Conuco.TOTAL_PARCELAS;
  const NT = M.TERRENOS_LADO * M.TERRENOS_LADO;

  let estado = null;
  let timerGuardado = null;
  let persistente = true; // false si localStorage no está disponible (modo privado, etc.)
  const oyentes = new Set();

  // ---------- Construcción y validación ----------

  function parcelaNueva(desbloqueada) {
    return { desbloqueada: !!desbloqueada, cultivo: null, plantadoEn: 0 };
  }

  function crearEstadoInicial() {
    const ahora = Date.now();
    const parcelas = [];
    for (let i = 0; i < TOTAL; i++) parcelas.push(parcelaNueva(i < C.PARCELAS_INICIALES));
    const terrenos = [];
    for (let k = 0; k < NT; k++) terrenos.push(k === M.TERRENO_INICIAL);
    return {
      version: C.SAVE_VERSION,
      creadoEn: ahora,
      ultimaVez: ahora,
      dinero: C.DINERO_INICIAL,
      xp: 0,
      zona: null,
      terrenos,
      semillas: {},
      cosechas: {},
      parcelas,
      graneros: [],
      estadisticas: { sembradas: 0, cosechadas: 0, vendidas: 0, ganado: 0, semillasCompradas: 0 },
      // etnia null = todavía no ha elegido personaje (se muestra la configuración inicial)
      jugador: { etnia: null, nombre: '', tx: M.SPAWN.x + 0.5, ty: M.SPAWN.y + 0.5 },
      tutorial: { hecho: false },
    };
  }

  /** Nombre del jugador: sin caracteres de control ni < >, máximo 16 letras. */
  function limpiarNombre(valor) {
    return String(valor == null ? '' : valor).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  }

  function numero(valor, defecto, minimo = 0) {
    const n = Number(valor);
    return Number.isFinite(n) && n >= minimo ? n : defecto;
  }

  /** Solo deja ids de cultivos conocidos y cantidades enteras >= 0. */
  function inventarioValido(obj) {
    const limpio = {};
    if (obj && typeof obj === 'object') {
      for (const id of Object.keys(POR_ID)) {
        const n = Math.floor(numero(obj[id], 0));
        if (n > 0) limpio[id] = n;
      }
    }
    return limpio;
  }

  /** Convierte lo leído del disco en un estado seguro (tolera datos viejos o manipulados). */
  function sanear(crudo) {
    const base = crearEstadoInicial();
    if (!crudo || typeof crudo !== 'object') return base;
    const ahora = Date.now();

    base.creadoEn = numero(crudo.creadoEn, base.creadoEn);
    base.ultimaVez = numero(crudo.ultimaVez, ahora);
    base.dinero = Math.floor(numero(crudo.dinero, base.dinero));
    base.xp = Math.floor(numero(crudo.xp, 0));
    base.semillas = inventarioValido(crudo.semillas);
    base.cosechas = inventarioValido(crudo.cosechas);

    const e = crudo.estadisticas || {};
    for (const k of Object.keys(base.estadisticas)) base.estadisticas[k] = Math.floor(numero(e[k], 0));

    const viejo = numero(crudo.version, 1) < 3; // partidas del mapa chico (16 parcelas)
    base.zona = Conuco.ZONAS_POR_ID[crudo.zona] ? crudo.zona : null;

    // Terrenos comprados (el inicial siempre)
    if (!viejo && Array.isArray(crudo.terrenos)) {
      for (let k = 0; k < NT; k++) base.terrenos[k] = k === M.TERRENO_INICIAL || crudo.terrenos[k] === true;
    }

    // Jugador (las partidas v1 no lo tienen: quedan sin personaje y se les pide elegir uno)
    const j = crudo.jugador && typeof crudo.jugador === 'object' ? crudo.jugador : {};
    base.jugador.etnia = Conuco.ETNIAS.some((x) => x.id === j.etnia) ? j.etnia : null;
    base.jugador.nombre = limpiarNombre(j.nombre);
    if (!viejo) {
      base.jugador.tx = Math.min(M.ANCHO - 0.5, numero(j.tx, base.jugador.tx));
      base.jugador.ty = Math.min(M.ALTO - 0.5, numero(j.ty, base.jugador.ty));
    }

    // Guía: terminada si ya la cerró o si es una partida vieja con avances
    const tu = crudo.tutorial && typeof crudo.tutorial === 'object' ? crudo.tutorial : {};
    base.tutorial.hecho = tu.hecho === true || (viejo && base.xp > 0);

    if (Array.isArray(crudo.parcelas)) {
      const limite = viejo ? Math.min(crudo.parcelas.length, 64) : TOTAL;
      for (let i = 0; i < limite; i++) {
        const p = crudo.parcelas[i];
        if (!p || typeof p !== 'object') continue;
        const cultivo = POR_ID[p.cultivo] ? p.cultivo : null;
        if (viejo && i >= C.PARCELAS_POR_TERRENO) {
          // El terreno inicial tiene 9 parcelas: las que sobran se devuelven en dinero y semillas.
          if (p.desbloqueada) base.dinero += 150;
          if (cultivo) base.semillas[cultivo] = (base.semillas[cultivo] || 0) + 1;
          continue;
        }
        let plantadoEn = cultivo ? numero(p.plantadoEn, ahora) : 0;
        // Si el reloj del dispositivo se movió hacia atrás, no dejamos siembras "del futuro".
        if (plantadoEn > ahora + 60 * 1000) plantadoEn = ahora;
        base.parcelas[i] = { desbloqueada: !!p.desbloqueada, cultivo, plantadoEn };
      }
    }
    // Parcelas y graneros puestos por el jugador (posición en casillas, dentro del mapa)
    const posValida = (o) => o && Number.isInteger(o.x) && Number.isInteger(o.y) && o.x >= 0 && o.y >= 0 && o.x <= M.ANCHO - 2 && o.y <= M.ALTO - 2;
    if (!viejo && Array.isArray(crudo.parcelas)) {
      for (const p of crudo.parcelas.slice(TOTAL, TOTAL + 200)) {
        if (!posValida(p)) continue;
        const cultivo = POR_ID[p.cultivo] ? p.cultivo : null;
        let plantadoEn = cultivo ? numero(p.plantadoEn, ahora) : 0;
        if (plantadoEn > ahora + 60 * 1000) plantadoEn = ahora;
        base.parcelas.push({ desbloqueada: true, cultivo, plantadoEn, x: p.x, y: p.y });
      }
    }
    if (Array.isArray(crudo.graneros)) {
      base.graneros = crudo.graneros.filter(posValida).slice(0, C.MAX_GRANEROS).map((g) => ({ x: g.x, y: g.y }));
    }

    // Coherencia: las iniciales siempre abiertas; fuera del terreno inicial, abiertas = terreno comprado
    base.parcelas.forEach((p, i) => {
      if (i < C.PARCELAS_INICIALES) p.desbloqueada = true;
      else if (i >= TOTAL) p.desbloqueada = true;
      else if (i >= C.PARCELAS_POR_TERRENO) p.desbloqueada = base.terrenos[Conuco.terrenoDeParcela(i)];
      if (!p.desbloqueada) { p.cultivo = null; p.plantadoEn = 0; }
    });
    return base;
  }

  // ---------- Persistencia ----------

  /**
   * Carga la partida (o crea una nueva).
   * @returns {{nuevo:boolean, ultimaVezAnterior:number|null}}
   */
  function cargar() {
    let crudo = null;
    try {
      const texto = global.localStorage.getItem(C.SAVE_KEY);
      if (texto) {
        try {
          crudo = JSON.parse(texto);
        } catch (err) {
          // Partida corrupta: se respalda para no perderla y se empieza de cero.
          try { global.localStorage.setItem(C.SAVE_KEY + '_corrupto', texto); } catch (_) { /* nada */ }
        }
      }
    } catch (err) {
      persistente = false;
    }
    const valido = crudo && typeof crudo === 'object';
    const ultimaVezAnterior = valido ? numero(crudo.ultimaVez, null, 0) : null;
    estado = valido ? sanear(crudo) : crearEstadoInicial();
    guardar();
    return { nuevo: !valido, ultimaVezAnterior };
  }

  function guardar() {
    if (!estado) return false;
    if (timerGuardado) { clearTimeout(timerGuardado); timerGuardado = null; }
    estado.ultimaVez = Date.now();
    try {
      global.localStorage.setItem(C.SAVE_KEY, JSON.stringify(estado));
      persistente = true;
      return true;
    } catch (err) {
      persistente = false;
      return false;
    }
  }

  /** Agrupa varios cambios seguidos en un solo guardado. */
  function programarGuardado() {
    if (timerGuardado) return;
    timerGuardado = setTimeout(guardar, 400);
  }

  // ---------- API pública ----------

  function emitir() {
    oyentes.forEach((fn) => {
      try { fn(estado); } catch (err) { console.error(err); }
    });
  }

  /**
   * Única vía para modificar el estado: aplica el cambio, notifica a la UI y guarda.
   * Con { silencioso: true } no redibuja los paneles (para cambios frecuentes como la posición).
   */
  function mutar(fn, opciones) {
    fn(estado);
    if (!opciones || !opciones.silencioso) emitir();
    programarGuardado();
  }

  function suscribir(fn) {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
  }

  function reiniciar() {
    estado = crearEstadoInicial();
    guardar();
    emitir();
  }

  Conuco.State = {
    cargar,
    guardar,
    mutar,
    suscribir,
    reiniciar,
    limpiarNombre,
    get: () => estado,
    esPersistente: () => persistente,
  };
})(typeof window !== 'undefined' ? window : globalThis);
