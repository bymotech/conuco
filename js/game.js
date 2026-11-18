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
  const M = Conuco.MAPA;
  const PPT = C.PARCELAS_POR_TERRENO;

  const ok = (mensaje, extra) => ({ ok: true, mensaje, ...extra });
  const fallo = (mensaje) => ({ ok: false, mensaje });
  const bs = (n) => 'Bs ' + Math.floor(n).toLocaleString('es-VE');

  // ---------- Personaje y zona ----------

  /** Configuración inicial: personaje, nombre y zona. La primera vez regala semillas de la zona. */
  function configurarPartida(etnia, nombre, zona) {
    if (!Conuco.ETNIAS.some((e) => e.id === etnia)) return fallo('Elige un personaje.');
    if (!Conuco.ZONAS_POR_ID[zona]) return fallo('Elige una zona.');
    const limpio = S.limpiarNombre(nombre);
    S.mutar((e) => {
      const primeraVez = !e.zona;
      e.jugador.etnia = etnia;
      e.jugador.nombre = limpio;
      e.zona = zona;
      if (primeraVez) {
        Conuco.cultivosDeZona(zona).slice(0, C.SEMILLAS_INICIALES.length).forEach((c, k) => {
          e.semillas[c.id] = (e.semillas[c.id] || 0) + C.SEMILLAS_INICIALES[k];
        });
      }
    });
    const z = Conuco.ZONAS_POR_ID[zona];
    return ok(`¡Bienvenido${limpio ? ', ' + limpio : ''} a ${z.nombre}! ${z.emoji}`);
  }

  /** Cambia solo el personaje y el nombre (la zona se mantiene). */
  function elegirAvatar(etnia, nombre) {
    if (!Conuco.ETNIAS.some((e) => e.id === etnia)) return fallo('Elige un personaje.');
    const limpio = S.limpiarNombre(nombre);
    S.mutar((e) => {
      e.jugador.etnia = etnia;
      e.jugador.nombre = limpio;
    });
    return ok(`¡Listo${limpio ? ', ' + limpio : ''}!`);
  }

  /** Rubros que se venden en la tienda de la zona del jugador. */
  const cultivosDisponibles = (s = S.get()) => Conuco.cultivosDeZona(s.zona);

  function terminarTutorial() {
    S.mutar((e) => { e.tutorial.hecho = true; });
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

  /** Precio de la próxima parcela suelta del terreno inicial. */
  function costoParcela(s = S.get()) {
    const abiertas = s.parcelas.slice(0, PPT).filter((p) => p.desbloqueada).length;
    return Math.round(C.COSTO_PARCELA_BASE * Math.pow(C.COSTO_PARCELA_FACTOR, Math.max(0, abiertas - C.PARCELAS_INICIALES)));
  }

  function contarListas(ahora = Date.now()) {
    return S.get().parcelas.filter((p) => estadoParcela(p, ahora).tipo === 'lista').length;
  }

  const indiceValido = (i) => Number.isInteger(i) && i >= 0 && i < S.get().parcelas.length;

  function comprarParcela(idx) {
    const s = S.get();
    if (!indiceValido(idx) || s.parcelas[idx].desbloqueada) return fallo('Esa parcela ya es tuya.');
    if (idx >= PPT) return fallo('Primero compra ese terreno.');
    const costo = costoParcela(s);
    if (s.dinero < costo) return fallo(`Te faltan ${bs(costo - s.dinero)} para esta parcela.`);
    S.mutar((e) => {
      e.dinero -= costo;
      e.parcelas[idx].desbloqueada = true;
    });
    return ok(`¡Nueva parcela desbloqueada por ${bs(costo)}!`);
  }

  // ---------- Construir: parcelas extra y graneros ----------

  const RAZONES = {
    fuera: 'Ahí no cabe: se sale del mapa.',
    terreno: 'Ese terreno todavía no es tuyo.',
    ocupado: 'Ese espacio está ocupado (árbol, edificio o parcela).',
    agua: 'No se puede construir sobre el agua.',
    camino: 'El granero no puede ir sobre el camino.',
    bloquea: 'Ahí el granero cerraría el paso a otra parte del conuco.',
    animal: 'Hay un animal ahí. Espera a que se mueva 🐄',
    jugador: 'Tu personaje está parado ahí. Muévelo un poco.',
  };
  const textoRazon = (r) => RAZONES[r] || 'No se puede construir ahí.';

  const parcelasExtra = (s = S.get()) => Math.max(0, s.parcelas.length - Conuco.TOTAL_PARCELAS);

  function costoParcelaExtra(s = S.get()) {
    return Math.round(C.COSTO_PARCELA_EXTRA_BASE * Math.pow(C.COSTO_PARCELA_EXTRA_FACTOR, parcelasExtra(s)));
  }

  function costoGranero(s = S.get()) {
    return Math.round(C.COSTO_GRANERO_BASE * Math.pow(C.COSTO_GRANERO_FACTOR, s.graneros.length));
  }

  /**
   * Pone una parcela nueva de 2x2 con su esquina de arriba en (x, y).
   * evitar: casillas donde ahora hay animales o está el jugador.
   */
  function comprarParcelaEn(x, y, evitar) {
    const s = S.get();
    const costo = costoParcelaExtra(s);
    if (s.dinero < costo) return fallo(`Te faltan ${bs(costo - s.dinero)} para una parcela nueva.`);
    const lugar = Conuco.Iso.puedeColocar('parcela', x, y, evitar);
    if (!lugar.ok) return fallo(textoRazon(lugar.razon));
    S.mutar((e) => {
      e.dinero -= costo;
      e.parcelas.push({ desbloqueada: true, cultivo: null, plantadoEn: 0, x, y });
    });
    return ok(`¡Parcela nueva por ${bs(costo)}! 🌱`, { indice: S.get().parcelas.length - 1 });
  }

  function comprarGranero(x, y, evitar) {
    const s = S.get();
    if (s.graneros.length >= C.MAX_GRANEROS) return fallo(`Ya tienes el máximo de ${C.MAX_GRANEROS} graneros.`);
    const costo = costoGranero(s);
    if (s.dinero < costo) return fallo(`Te faltan ${bs(costo - s.dinero)} para un granero.`);
    const lugar = Conuco.Iso.puedeColocar('granero', x, y, evitar);
    if (!lugar.ok) return fallo(textoRazon(lugar.razon));
    S.mutar((e) => {
      e.dinero -= costo;
      e.graneros.push({ x, y });
    });
    return ok(`¡Granero construido por ${bs(costo)}! Ahora guardas ${capacidadSemillas()} semillas 📦`);
  }

  // ---------- Almacén de semillas ----------

  /** Tope de semillas: sube con el nivel y con cada granero. */
  function capacidadSemillas(s = S.get()) {
    return C.ALMACEN_BASE + C.ALMACEN_POR_NIVEL * (nivelDeXp(s.xp) - 1) + C.ALMACEN_POR_GRANERO * s.graneros.length;
  }

  const semillasGuardadas = (s = S.get()) => Object.values(s.semillas).reduce((a, b) => a + b, 0);

  /** Cuántas semillas más caben. */
  const espacioSemillas = (s = S.get()) => Math.max(0, capacidadSemillas(s) - semillasGuardadas(s));

  // ---------- Terrenos ----------

  function costoTerreno(s = S.get()) {
    const comprados = s.terrenos.filter(Boolean).length - 1;
    return Math.round(C.COSTO_TERRENO_BASE * Math.pow(C.COSTO_TERRENO_FACTOR, comprados));
  }

  /** Un terreno se puede comprar si toca (por un lado, no por la esquina) uno que ya es tuyo. */
  function terrenoVecino(s, t) {
    const L = M.TERRENOS_LADO, x = t % L, y = Math.floor(t / L);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < L && ny < L && s.terrenos[ny * L + nx];
    });
  }

  /** ¿Se puede comprar? → { ok, costo, razon: 'tuyo'|'lejos'|'dinero'|null } */
  function puedeComprarTerreno(t, s = S.get()) {
    const costo = costoTerreno(s);
    if (!Number.isInteger(t) || t < 0 || t >= s.terrenos.length || s.terrenos[t]) return { ok: false, costo, razon: 'tuyo' };
    if (!terrenoVecino(s, t)) return { ok: false, costo, razon: 'lejos' };
    if (s.dinero < costo) return { ok: false, costo, razon: 'dinero' };
    return { ok: true, costo, razon: null };
  }

  function comprarTerreno(t) {
    const s = S.get();
    const p = puedeComprarTerreno(t, s);
    if (p.razon === 'tuyo') return fallo('Ese terreno ya es tuyo.');
    if (p.razon === 'lejos') return fallo('Primero compra un terreno vecino a este.');
    if (p.razon === 'dinero') return fallo(`Te faltan ${bs(p.costo - s.dinero)} para este terreno.`);
    S.mutar((e) => {
      e.dinero -= p.costo;
      e.terrenos[t] = true;
      e.parcelas.forEach((q, i) => { if (i >= PPT && Conuco.terrenoDeParcela(i) === t) q.desbloqueada = true; });
    });
    return ok(`¡Terreno comprado por ${bs(p.costo)}! Trae ${PPT} parcelas nuevas.`, { terreno: t });
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
      e.estadisticas.sembradas += 1;
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
    const libre = espacioSemillas(s);
    if (cantidad > libre) {
      return fallo(libre
        ? `Solo te caben ${libre} semilla(s) más (almacén ${semillasGuardadas(s)}/${capacidadSemillas(s)}). Construye un granero 📦`
        : `Tu almacén está lleno (${capacidadSemillas(s)} semillas). Construye un granero 📦 o sube de nivel.`);
    }
    const total = cultivo.costoSemilla * cantidad;
    if (s.dinero < total) return fallo(`Te faltan ${bs(total - s.dinero)}.`);
    S.mutar((e) => {
      e.dinero -= total;
      e.semillas[cultivoId] = (e.semillas[cultivoId] || 0) + cantidad;
      e.estadisticas.semillasCompradas += cantidad;
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
    configurarPartida, elegirAvatar, guardarPosicion, cultivosDisponibles, terminarTutorial,
    costoTerreno, puedeComprarTerreno, comprarTerreno,
    costoParcelaExtra, costoGranero, comprarParcelaEn, comprarGranero, textoRazon,
    capacidadSemillas, semillasGuardadas, espacioSemillas,
    nivelDeXp, xpDeNivel, progresoNivel,
    estadoParcela, costoParcela, contarListas,
    comprarParcela, plantar, cosechar, cosecharTodo,
    comprarSemillas, vender, venderTodo,
  };
})(typeof window !== 'undefined' ? window : globalThis);
