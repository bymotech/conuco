/**
 * state.js — Estado global del jugador + persistencia en localStorage.
 *
 * Forma del estado:
 * {
 *   version, creadoEn, ultimaVez,        // marcas de tiempo (ms epoch)
 *   dinero,                              // bolívares
 *   xp,                                  // el nivel se calcula a partir de la xp
 *   semillas: { maiz: 3, ... },          // inventario de semillas
 *   cosechas: { maiz: 6, ... },          // inventario de cosecha lista para vender
 *   parcelas: [ { desbloqueada, cultivo, plantadoEn }, ... ],
 *   estadisticas: { cosechadas, vendidas, ganado }
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
  const POR_ID = Conuco.CULTIVOS_POR_ID;

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
    for (let i = 0; i < C.TOTAL_PARCELAS; i++) parcelas.push(parcelaNueva(i < C.PARCELAS_INICIALES));
    return {
      version: C.SAVE_VERSION,
      creadoEn: ahora,
      ultimaVez: ahora,
      dinero: C.DINERO_INICIAL,
      xp: 0,
      semillas: { ...C.SEMILLAS_INICIALES },
      cosechas: {},
      parcelas,
      estadisticas: { cosechadas: 0, vendidas: 0, ganado: 0 },
    };
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
    base.estadisticas = {
      cosechadas: Math.floor(numero(e.cosechadas, 0)),
      vendidas: Math.floor(numero(e.vendidas, 0)),
      ganado: Math.floor(numero(e.ganado, 0)),
    };

    if (Array.isArray(crudo.parcelas)) {
      for (let i = 0; i < C.TOTAL_PARCELAS; i++) {
        const p = crudo.parcelas[i];
        if (!p || typeof p !== 'object') continue;
        const cultivo = POR_ID[p.cultivo] ? p.cultivo : null;
        let plantadoEn = cultivo ? numero(p.plantadoEn, ahora) : 0;
        // Si el reloj del dispositivo se movió hacia atrás, no dejamos siembras "del futuro".
        if (plantadoEn > ahora + 60 * 1000) plantadoEn = ahora;
        base.parcelas[i] = {
          desbloqueada: i < C.PARCELAS_INICIALES ? true : !!p.desbloqueada,
          cultivo,
          plantadoEn,
        };
      }
    }
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

  /** Única vía para modificar el estado: aplica el cambio, notifica a la UI y guarda. */
  function mutar(fn) {
    fn(estado);
    emitir();
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
    get: () => estado,
    esPersistente: () => persistente,
  };
})(typeof window !== 'undefined' ? window : globalThis);
