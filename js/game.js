/**
 * game.js — Reglas del juego (sin tocar el DOM).
 *
 * Todas las acciones devuelven { ok:boolean, mensaje:string, subioNivel?:number }
 * para que la UI muestre el resultado. Reciben `ahora` (ms) como parámetro opcional,
 * lo que permite probar la lógica simulando el paso del tiempo.
 */
(function (global) {
  'use strict';
  const Conuco = (global.Conuco = global.Conuco || {});
  const C = Conuco.CONFIG;
  const POR_ID = Conuco.CULTIVOS_POR_ID;
  const S = Conuco.State;

  const ok = (mensaje, extra) => ({ ok: true, mensaje, ...extra });
  const fallo = (mensaje) => ({ ok: false, mensaje });
  const bs = (n) => 'Bs ' + Math.floor(n).toLocaleString('es-VE');

  // ---------- Personaje ----------

  function elegirAvatar(etnia, nombre) {
    if (!Conuco.ETNIAS.some((e) => e.id === etnia)) return fallo('Elige un personaje.');
    const limpio = S.limpiarNombre(nombre);
    S.mutar((e) => {
      e.jugador.etnia = etnia;
      e.jugador.nombre = limpio;
    });
    return ok(`¡Bienvenido${limpio ? ', ' + limpio : ''}! Toca una parcela para empezar a sembrar.`);
  }

  /** Guarda dónde quedó el jugador (sin redibujar los paneles). */
  function guardarPosicion(tx, ty) {
    S.mutar((e) => { e.jugador.tx = tx; e.jugador.ty = ty; }, { silencioso: true });
  }

  // ---------- Nivel y experiencia ----------

  const nivelDeXp = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / C.XP_BASE)) + 1;
  const xpDeNivel = (nivel) => C.XP_BASE * (nivel - 1) * (nivel - 1);

  function progresoNivel(xp) {
    const nivel = nivelDeXp(xp);
    const base = xpDeNivel(nivel);
    const necesario = xpDeNivel(nivel + 1) - base;
    const actual = xp - base;
    return { nivel, actual, necesario, pct: Math.min(1, actual / necesario) };
  }

  /** Suma xp al estado `s` (dentro de mutar). Devuelve el nuevo nivel si subió, o 0. */
  function agregarXp(s, cantidad) {
    const antes = nivelDeXp(s.xp);
    s.xp += cantidad;
    const despues = nivelDeXp(s.xp);
    return despues > antes ? despues : 0;
  }

  // ---------- Parcelas ----------

  /**
   * Estado calculado de una parcela en el instante `ahora`.
   * Es la pieza que hace funcionar el tiempo offline: solo depende de timestamps.
   */
  function estadoParcela(p, ahora = Date.now()) {
    if (!p.desbloqueada) return { tipo: 'bloqueada' };
    if (!p.cultivo) return { tipo: 'vacia' };
    const cultivo = POR_ID[p.cultivo];
    const transcurrido = Math.max(0, ahora - p.plantadoEn);
    const pct = Math.min(1, transcurrido / cultivo.tiempoMs);
    return {
      tipo: pct >= 1 ? 'lista' : 'creciendo',
      pct,
      restanteMs: Math.max(0, cultivo.tiempoMs - transcurrido),
      cultivo,
    };
  }

  function costoParcela(s = S.get()) {
    const compradas = s.parcelas.filter((p) => p.desbloqueada).length - C.PARCELAS_INICIALES;
    return Math.round(C.COSTO_PARCELA_BASE * Math.pow(C.COSTO_PARCELA_FACTOR, Math.max(0, compradas)));
  }

  function contarListas(ahora = Date.now()) {
    return S.get().parcelas.filter((p) => estadoParcela(p, ahora).tipo === 'lista').length;
  }

  const indiceValido = (i) => Number.isInteger(i) && i >= 0 && i < C.TOTAL_PARCELAS;

  function comprarParcela(idx) {
    const s = S.get();
    if (!indiceValido(idx) || s.parcelas[idx].desbloqueada) return fallo('Esa parcela ya es tuya.');
    const costo = costoParcela(s);
    if (s.dinero < costo) return fallo(`Te faltan ${bs(costo - s.dinero)} para esta parcela.`);
    S.mutar((e) => {
      e.dinero -= costo;
      e.parcelas[idx].desbloqueada = true;
    });
    return ok(`¡Nueva parcela desbloqueada por ${bs(costo)}!`);
  }

  // ---------- Sembrar y cosechar ----------

  function plantar(idx, cultivoId, ahora = Date.now()) {
    const s = S.get();
    const cultivo = POR_ID[cultivoId];
    if (!cultivo) return fallo('Elige una semilla primero.');
    if (!indiceValido(idx) || estadoParcela(s.parcelas[idx], ahora).tipo !== 'vacia') {
      return fallo('Esa parcela no está disponible para sembrar.');
    }
    if (nivelDeXp(s.xp) < cultivo.nivelReq) return fallo(`${cultivo.nombre} requiere nivel ${cultivo.nivelReq}.`);
    if ((s.semillas[cultivoId] || 0) < 1) return fallo(`No tienes semillas de ${cultivo.nombre}. Cómpralas en la tienda.`);

    S.mutar((e) => {
      e.semillas[cultivoId] -= 1;
      if (e.semillas[cultivoId] <= 0) delete e.semillas[cultivoId];
      e.parcelas[idx].cultivo = cultivoId;
      e.parcelas[idx].plantadoEn = ahora;
    });
    return ok(`Sembraste ${cultivo.nombre} ${cultivo.emoji}`);
  }

  /** Cosecha una parcela sobre el estado `s` (se usa dentro de mutar). */
  function cosecharEn(s, idx, ahora) {
    const p = s.parcelas[idx];
    const cultivo = POR_ID[p.cultivo];
    p.cultivo = null;
    p.plantadoEn = 0;
    s.cosechas[cultivo.id] = (s.cosechas[cultivo.id] || 0) + cultivo.rendimiento;
    s.estadisticas.cosechadas += cultivo.rendimiento;
    return { cultivo, subioNivel: agregarXp(s, cultivo.xp) };
  }

  function cosechar(idx, ahora = Date.now()) {
    const s = S.get();
    if (!indiceValido(idx) || estadoParcela(s.parcelas[idx], ahora).tipo !== 'lista') {
      return fallo('Todavía no está lista.');
    }
    let res;
    S.mutar((e) => { res = cosecharEn(e, idx, ahora); });
    const { cultivo, subioNivel } = res;
    let msg = `+${cultivo.rendimiento} ${cultivo.nombre} ${cultivo.emoji}  (+${cultivo.xp} XP)`;
    if (subioNivel) msg += `  ¡Nivel ${subioNivel}!`;
    return ok(msg, { subioNivel });
  }

  function cosecharTodo(ahora = Date.now()) {
    const s = S.get();
    const listas = s.parcelas
      .map((p, i) => (estadoParcela(p, ahora).tipo === 'lista' ? i : -1))
      .filter((i) => i >= 0);
    if (!listas.length) return fallo('No hay nada listo para cosechar.');

    let xpTotal = 0;
    let nivelNuevo = 0;
    const resumen = {};
    S.mutar((e) => {
      for (const i of listas) {
        const { cultivo, subioNivel } = cosecharEn(e, i, ahora);
        resumen[cultivo.emoji] = (resumen[cultivo.emoji] || 0) + cultivo.rendimiento;
        xpTotal += cultivo.xp;
        if (subioNivel) nivelNuevo = subioNivel;
      }
    });
    const detalle = Object.entries(resumen).map(([emoji, n]) => `${n}${emoji}`).join(' ');
    let msg = `Cosechaste ${detalle}  (+${xpTotal} XP)`;
    if (nivelNuevo) msg += `  ¡Nivel ${nivelNuevo}!`;
    return ok(msg, { subioNivel: nivelNuevo });
  }

  // ---------- Mercado ----------

  function comprarSemillas(cultivoId, cantidad = 1) {
    const s = S.get();
    const cultivo = POR_ID[cultivoId];
    cantidad = Math.floor(cantidad);
    if (!cultivo || cantidad < 1) return fallo('Compra no válida.');
    if (nivelDeXp(s.xp) < cultivo.nivelReq) return fallo(`${cultivo.nombre} se desbloquea en el nivel ${cultivo.nivelReq}.`);
    const total = cultivo.costoSemilla * cantidad;
    if (s.dinero < total) return fallo(`Te faltan ${bs(total - s.dinero)}.`);
    S.mutar((e) => {
      e.dinero -= total;
      e.semillas[cultivoId] = (e.semillas[cultivoId] || 0) + cantidad;
    });
    return ok(`Compraste ${cantidad} semilla(s) de ${cultivo.nombre} por ${bs(total)}`);
  }

  /** @param {number|'todo'} cantidad */
  function vender(cultivoId, cantidad = 1) {
    const s = S.get();
    const cultivo = POR_ID[cultivoId];
    if (!cultivo) return fallo('Producto no válido.');
    const tengo = s.cosechas[cultivoId] || 0;
    const n = cantidad === 'todo' ? tengo : Math.min(tengo, Math.floor(cantidad));
    if (n < 1) return fallo(`No tienes ${cultivo.nombre} para vender.`);

    const ingreso = n * cultivo.precioVenta;
    const xp = Math.max(1, Math.floor(ingreso / 10)); // +1 XP por cada 10 Bs vendidos
    let subioNivel = 0;
    S.mutar((e) => {
      e.cosechas[cultivoId] -= n;
      if (e.cosechas[cultivoId] <= 0) delete e.cosechas[cultivoId];
      e.dinero += ingreso;
      e.estadisticas.vendidas += n;
      e.estadisticas.ganado += ingreso;
      subioNivel = agregarXp(e, xp);
    });
    let msg = `Vendiste ${n} ${cultivo.nombre} ${cultivo.emoji} por ${bs(ingreso)}  (+${xp} XP)`;
    if (subioNivel) msg += `  ¡Nivel ${subioNivel}!`;
    return ok(msg, { subioNivel });
  }

  function venderTodo() {
    const s = S.get();
    const ids = Object.keys(s.cosechas);
    if (!ids.length) return fallo('No tienes cosecha para vender.');
    let ingreso = 0;
    let subioNivel = 0;
    S.mutar((e) => {
      for (const id of ids) {
        const n = e.cosechas[id];
        ingreso += n * POR_ID[id].precioVenta;
        e.estadisticas.vendidas += n;
        delete e.cosechas[id];
      }
      e.dinero += ingreso;
      e.estadisticas.ganado += ingreso;
      subioNivel = agregarXp(e, Math.max(1, Math.floor(ingreso / 10)));
    });
    let msg = `Vendiste toda la cosecha por ${bs(ingreso)}`;
    if (subioNivel) msg += `  ¡Nivel ${subioNivel}!`;
    return ok(msg, { subioNivel });
  }

  Conuco.Game = {
    elegirAvatar, guardarPosicion,
    nivelDeXp, xpDeNivel, progresoNivel,
    estadoParcela, costoParcela, contarListas,
    comprarParcela, plantar, cosechar, cosecharTodo,
    comprarSemillas, vender, venderTodo,
  };
})(typeof window !== 'undefined' ? window : globalThis);
