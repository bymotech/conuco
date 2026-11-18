/**
 * iso.js — Geometría isométrica, disposición del mapa y búsqueda de caminos.
 * No dibuja nada ni toca el DOM, así que se puede probar en Node.
 *
 * Coordenadas:
 *  - "tile" (tx, ty): casillas del mapa. La casilla (i, j) ocupa [i, i+1) x [j, j+1).
 *  - "pantalla" (x, y): píxeles del mundo, ya proyectados.
 *      x = (tx - ty) * TILE_W/2      y = (tx + ty) * TILE_H/2
 *  Hacia la derecha-abajo crece tx; hacia la izquierda-abajo crece ty.
 *
 * El mapa es una cuadrícula de 3x3 terrenos de 12x12 casillas. Cada terreno tiene en el
 * centro un campo de 3x3 parcelas pegadas, rodeado por un camino. Los caminos de los
 * terrenos se unen entre sí por el medio de cada lado.
 *
 * Local de un terreno (0..11):   0 1 | 2 . . . . . . . 9 | 10 11
 *   2..9  = camino alrededor del campo (anillo)      3..8 = campo de parcelas
 *   5..6  = cruce que une con los terrenos vecinos
 */
(function (global) {
  'use strict';
  const Conuco = (global.Conuco = global.Conuco || {});
  const M = Conuco.MAPA;
  const PPT = Conuco.CONFIG.PARCELAS_POR_TERRENO;
  const HW = M.TILE_W / 2;
  const HH = M.TILE_H / 2;
  const T = M.TERRENO;
  const L = M.TERRENOS_LADO;
  const N = M.ANCHO * M.ALTO;

  const aPantalla = (tx, ty) => ({ x: (tx - ty) * HW, y: (tx + ty) * HH });
  const aTile = (x, y) => ({ tx: (x / HW + y / HH) / 2, ty: (y / HH - x / HW) / 2 });

  /** Número pseudoaleatorio estable en [0,1) para una casilla (para variar el pasto, etc.). */
  function hash(x, y, k = 0) {
    const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
    return s - Math.floor(s);
  }

  const dentro = (tx, ty) => tx >= 0 && ty >= 0 && tx < M.ANCHO && ty < M.ALTO;

  // ---------- Terrenos ----------

  const estado = () => (Conuco.State && Conuco.State.get ? Conuco.State.get() : null);
  const zonaActual = () => { const e = estado(); return (e && e.zona) || Conuco.ZONAS[0].id; };
  const terrenoDe = (tx, ty) => Math.floor(ty / T) * L + Math.floor(tx / T);
  const origenTerreno = (t) => ({ x: (t % L) * T, y: Math.floor(t / L) * T });
  function terrenoComprado(t) {
    const e = estado();
    return e && e.terrenos ? !!e.terrenos[t] : t === M.TERRENO_INICIAL;
  }

  // ---------- Parcelas ----------

  const POS_TERRENO = []; // terreno -> posición en ORDEN_TERRENOS
  M.ORDEN_TERRENOS.forEach((t, p) => { POS_TERRENO[t] = p; });
  const INVERSO = [];     // posición en el campo 3x3 -> orden dentro del terreno
  M.ORDEN_PARCELAS.forEach((pos, k) => { INVERSO[pos] = k; });

  const TOTAL = Conuco.TOTAL_PARCELAS;

  /** Casilla de la esquina de arriba de la parcela lógica `i` (fija o puesta por el jugador). */
  function parcelaOrigen(i) {
    if (i >= TOTAL) { const p = estado().parcelas[i]; return { x: p.x, y: p.y }; }
    const o = origenTerreno(Conuco.terrenoDeParcela(i));
    const pos = M.ORDEN_PARCELAS[i % PPT];
    return {
      x: o.x + M.CAMPO_X0 + (pos % M.PARCELAS_LADO) * M.PARCELA_TAM,
      y: o.y + M.CAMPO_Y0 + Math.floor(pos / M.PARCELAS_LADO) * M.PARCELA_TAM,
    };
  }

  /** Índice lógico de la parcela que cubre la casilla, o -1. */
  function parcelaEnTile(tx, ty) {
    if (!dentro(tx, ty)) return -1;
    const extra = dinamico().parcela[ty * M.ANCHO + tx];
    if (extra >= 0) return extra;
    return parcelaFijaEnTile(tx, ty);
  }

  function parcelaFijaEnTile(tx, ty) {
    const t = terrenoDe(tx, ty);
    const o = origenTerreno(t);
    const lx = tx - o.x - M.CAMPO_X0, ly = ty - o.y - M.CAMPO_Y0;
    const lado = M.PARCELAS_LADO * M.PARCELA_TAM;
    if (lx < 0 || ly < 0 || lx >= lado || ly >= lado) return -1;
    const pos = Math.floor(ly / M.PARCELA_TAM) * M.PARCELAS_LADO + Math.floor(lx / M.PARCELA_TAM);
    return POS_TERRENO[t] * PPT + INVERSO[pos];
  }

  /** Terreno de cualquier parcela (fija o puesta por el jugador). */
  const terrenoDeParcela = (i) => {
    if (i < TOTAL) return Conuco.terrenoDeParcela(i);
    const o = parcelaOrigen(i);
    return terrenoDe(o.x, o.y);
  };

  /** Parcelas (índices) de un terreno. */
  const parcelasDeTerreno = (t) => Array.from({ length: PPT }, (_, k) => POS_TERRENO[t] * PPT + k);

  // ---------- Disposición por zona (se calcula una vez por zona) ----------

  const SUELOS = ['pasto', 'camino', 'parcela', 'agua', 'arena'];
  const cache = {};

  function local(tx, ty) {
    const o = origenTerreno(terrenoDe(tx, ty));
    return { lx: tx - o.x, ly: ty - o.y };
  }

  function suelo0(tx, ty, zona) {
    if (parcelaFijaEnTile(tx, ty) >= 0) return 2;
    const { lx, ly } = local(tx, ty);
    const enAnillo = lx >= 2 && lx <= 9 && ly >= 2 && ly <= 9;
    const cruce = (lx === 5 || lx === 6) && (ly < 2 || ly > 9) || (ly === 5 || ly === 6) && (lx < 2 || lx > 9);
    // en los bordes del mapa el cruce no lleva a ninguna parte: no se dibuja
    const borde = tx < 2 || ty < 2 || tx >= M.ANCHO - 2 || ty >= M.ALTO - 2;
    if (zona.mar && (tx === 0 || ty === 0 || tx === M.ANCHO - 1 || ty === M.ALTO - 1)) return 4;
    if (enAnillo || (cruce && !borde)) return 1;
    return 0;
  }

  function construir(zonaId) {
    const zona = Conuco.ZONAS_POR_ID[zonaId] || Conuco.ZONAS[0];
    const suelo = new Uint8Array(N);
    const bloqueado = new Uint8Array(N);
    for (let ty = 0; ty < M.ALTO; ty++) for (let tx = 0; tx < M.ANCHO; tx++) suelo[ty * M.ANCHO + tx] = suelo0(tx, ty, zona);

    // Edificios del terreno inicial. x,y = esquina de arriba; w,d = casillas; alto = px (para tocarlo)
    const o = origenTerreno(M.TERRENO_INICIAL);
    const edificios = [
      { id: 'casa',     tipo: 'casa',     x: o.x + 0,  y: o.y + 0,  w: 2, d: 2, alto: 84 },
      { id: 'churuata', tipo: 'churuata', x: o.x + 10, y: o.y + 0,  w: 2, d: 2, alto: 82, accion: 'semillas', etiqueta: '🌱 Semillas' },
      { id: 'puesto',   tipo: 'puesto',   x: o.x + 0,  y: o.y + 10, w: 1, d: 2, alto: 60, accion: 'mercado',  etiqueta: '🧺 Mercado' },
    ];
    const ocupar = (x, y, w, d) => { for (let j = y; j < y + d; j++) for (let i = x; i < x + w; i++) bloqueado[j * M.ANCHO + i] = 1; };
    edificios.forEach((e) => ocupar(e.x, e.y, e.w, e.d));

    // Lagunas (zonas con agua): 2x2 en una esquina de algunos terrenos
    const lagunas = [];
    if (zona.agua) {
      for (const t of [0, 2, 8]) {
        const q = origenTerreno(t);
        const lg = { x: q.x + 10, y: q.y + 10, w: 2, d: 2 };
        lagunas.push(lg);
        for (let j = lg.y; j < lg.y + 2; j++) for (let i = lg.x; i < lg.x + 2; i++) suelo[j * M.ANCHO + i] = 3;
        ocupar(lg.x, lg.y, 2, 2);
      }
    }

    // Árboles: solo fuera del anillo y de los cruces, lejos de los edificios y del punto de aparición
    const cercaDeEdificio = (tx, ty) => edificios.some((e) => tx >= e.x - 1 && tx <= e.x + e.w && ty >= e.y - 1 && ty <= e.y + e.d);
    const arboles = [];
    const semilla = Conuco.ZONAS.indexOf(zona) + 1;
    for (let ty = 0; ty < M.ALTO; ty++) {
      for (let tx = 0; tx < M.ANCHO; tx++) {
        const id = ty * M.ANCHO + tx;
        if (suelo[id] !== 0 && suelo[id] !== 4) continue;
        const { lx, ly } = local(tx, ty);
        if (lx >= 2 && lx <= 9 && ly >= 2 && ly <= 9) continue;
        if (lx === 5 || lx === 6 || ly === 5 || ly === 6) continue;
        if (bloqueado[id] || cercaDeEdificio(tx, ty)) continue;
        if (Math.abs(tx - M.SPAWN.x) <= 1 && Math.abs(ty - M.SPAWN.y) <= 1) continue;
        if (hash(tx, ty, semilla * 3) < 0.76) continue;
        const tipo = zona.arboles[Math.floor(hash(tx, ty, semilla * 5) * zona.arboles.length)];
        arboles.push({ tipo, x: tx, y: ty, w: 1, d: 1 });
        bloqueado[id] = 1;
      }
    }
    return { zona, suelo, bloqueado, edificios, arboles, lagunas };
  }

  /** Disposición del mapa de la zona actual (o de la indicada). */
  function mapa(zonaId = zonaActual()) {
    return cache[zonaId] || (cache[zonaId] = construir(zonaId));
  }

  // ---------- Lo que construye el jugador (parcelas extra y graneros) ----------

  let dinCache = { clave: null, val: null };

  /** Ocupación de lo que puso el jugador. Se recalcula solo si cambia la partida o la cantidad. */
  function dinamico() {
    const e = estado();
    const clave = e ? e.parcelas.length + ':' + (e.graneros ? e.graneros.length : 0) : '-';
    if (dinCache.e === e && dinCache.clave === clave) return dinCache.val;
    const parcela = new Int16Array(N).fill(-1);
    const granero = new Int8Array(N).fill(-1);
    if (e) {
      for (let i = TOTAL; i < e.parcelas.length; i++) {
        const p = e.parcelas[i];
        for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) if (dentro(p.x + k, p.y + j)) parcela[(p.y + j) * M.ANCHO + p.x + k] = i;
      }
      (e.graneros || []).forEach((g, gi) => {
        for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) if (dentro(g.x + k, g.y + j)) granero[(g.y + j) * M.ANCHO + g.x + k] = gi;
      });
    }
    dinCache = { e, clave, val: { parcela, granero } };
    return dinCache.val;
  }

  /** Graneros como edificios (para dibujarlos, tocarlos y caminar hasta ellos). */
  function graneros() {
    const e = estado();
    return ((e && e.graneros) || []).map((g, i) => ({ id: 'granero' + i, tipo: 'granero', x: g.x, y: g.y, w: 2, d: 2, alto: 92, accion: 'granero' }));
  }

  /** Tipo de suelo de una casilla: 'pasto' | 'camino' | 'parcela' | 'agua' | 'arena'. */
  const tipoSuelo = (tx, ty) => (dentro(tx, ty) ? SUELOS[mapa().suelo[ty * M.ANCHO + tx]] : null);

  /** Se puede pisar: dentro del mapa, sin obstáculo y en un terreno comprado. */
  function esCaminable(tx, ty) {
    if (!dentro(tx, ty)) return false;
    const id = ty * M.ANCHO + tx;
    return !mapa().bloqueado[id] && dinamico().granero[id] < 0 && terrenoComprado(terrenoDe(tx, ty));
  }

  /** Cuántas casillas se alcanzan caminando desde la entrada (opcionalmente con casillas extra bloqueadas). */
  function alcanzables(extraBloq) {
    const visto = new Uint8Array(N);
    const pila = [M.SPAWN.y * M.ANCHO + M.SPAWN.x];
    visto[pila[0]] = 1;
    let n = 0;
    while (pila.length) {
      const c = pila.pop(); n++;
      const cx = c % M.ANCHO, cy = (c - cx) / M.ANCHO;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, id = ny * M.ANCHO + nx;
        if (!esCaminable(nx, ny) || visto[id] || (extraBloq && extraBloq.has(id))) continue;
        visto[id] = 1; pila.push(id);
      }
    }
    return n;
  }

  /**
   * ¿Se puede construir algo de 2x2 con su esquina de arriba en (x, y)?
   * tipo: 'parcela' | 'granero'. evitar: casillas ocupadas ahora (jugador, animales) como [{tx,ty,quien}].
   * @returns {{ok:boolean, razon:string|null}}
   *   razon: 'fuera' | 'terreno' | 'ocupado' | 'agua' | 'camino' | 'bloquea' | 'animal' | 'jugador'
   */
  function puedeColocar(tipo, x, y, evitar = []) {
    const m = mapa(), d = dinamico();
    const ids = [];
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        const tx = x + k, ty = y + j;
        if (!dentro(tx, ty)) return { ok: false, razon: 'fuera' };
        if (!terrenoComprado(terrenoDe(tx, ty))) return { ok: false, razon: 'terreno' };
        const id = ty * M.ANCHO + tx;
        if (m.suelo[id] === 3) return { ok: false, razon: 'agua' };
        if (m.bloqueado[id] || m.suelo[id] === 2 || d.parcela[id] >= 0 || d.granero[id] >= 0) return { ok: false, razon: 'ocupado' };
        if (tipo === 'granero' && m.suelo[id] === 1) return { ok: false, razon: 'camino' };
        ids.push(id);
      }
    }
    for (const a of evitar) {
      if (a.tx >= x && a.tx < x + 2 && a.ty >= y && a.ty < y + 2) return { ok: false, razon: a.quien === 'jugador' ? 'jugador' : 'animal' };
    }
    if (tipo === 'granero') {
      // no puede dejar partes del mapa sin salida
      const conjunto = new Set(ids);
      if (alcanzables(conjunto) !== alcanzables() - ids.length) return { ok: false, razon: 'bloquea' };
    }
    return { ok: true, razon: null };
  }

  /** Casillas de un terreno donde pueden andar los animales (sin parcelas, agua ni obstáculos). */
  function casillasFauna(t) {
    const m = mapa(), d = dinamico();
    const o = origenTerreno(t);
    const res = [];
    for (let j = o.y; j < o.y + T; j++) {
      for (let i = o.x; i < o.x + T; i++) {
        const id = j * M.ANCHO + i;
        if (!m.bloqueado[id] && m.suelo[id] !== 2 && m.suelo[id] !== 3 && d.parcela[id] < 0 && d.granero[id] < 0) res.push({ tx: i, ty: j });
      }
    }
    return res;
  }

  // ---------- Búsqueda de caminos (A*) ----------

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  /**
   * Camino más corto entre dos casillas, con 8 direcciones y sin "cortar esquinas".
   * @returns {{tx:number,ty:number}[]|null} casillas a recorrer (sin incluir la de salida), o null si no hay camino.
   */
  function buscarCamino(sx, sy, gx, gy) {
    if (!esCaminable(gx, gy)) return null;
    if (sx === gx && sy === gy) return [];
    const heur = (x, y) => {
      const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const g = new Float32Array(N).fill(Infinity);
    const padre = new Int32Array(N).fill(-1);
    const cerrado = new Uint8Array(N);
    const inicio = sy * M.ANCHO + sx;
    g[inicio] = 0;
    // montículo binario por f = g + h
    const heap = [];
    const push = (n, f) => {
      heap.push([f, n]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const a = 2 * i + 1, b = a + 1;
          let m = i;
          if (a < heap.length && heap[a][0] < heap[m][0]) m = a;
          if (b < heap.length && heap[b][0] < heap[m][0]) m = b;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top[1];
    };
    push(inicio, heur(sx, sy));

    while (heap.length) {
      const actual = pop();
      if (cerrado[actual]) continue;
      cerrado[actual] = 1;
      const cx = actual % M.ANCHO;
      const cy = Math.floor(actual / M.ANCHO);
      if (cx === gx && cy === gy) {
        const ruta = [];
        for (let n = actual; n !== inicio; n = padre[n]) ruta.push({ tx: n % M.ANCHO, ty: Math.floor(n / M.ANCHO) });
        return ruta.reverse();
      }
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!esCaminable(nx, ny)) continue;
        // En diagonal, las dos casillas laterales también deben estar libres
        if (dx && dy && (!esCaminable(cx + dx, cy) || !esCaminable(cx, cy + dy))) continue;
        const nid = ny * M.ANCHO + nx;
        if (cerrado[nid]) continue;
        const costo = g[actual] + (dx && dy ? 1.414 : 1);
        if (costo < g[nid]) {
          g[nid] = costo;
          padre[nid] = actual;
          push(nid, costo + heur(nx, ny));
        }
      }
    }
    return null;
  }

  /** Casillas libres pegadas al perímetro de un edificio (para ir "hasta la puerta"). */
  function casillasVecinas(o) {
    const res = [];
    for (let j = o.y - 1; j <= o.y + o.d; j++) {
      for (let i = o.x - 1; i <= o.x + o.w; i++) {
        const enHuella = i >= o.x && i < o.x + o.w && j >= o.y && j < o.y + o.d;
        if (!enHuella && esCaminable(i, j)) res.push({ tx: i, ty: j });
      }
    }
    return res;
  }

  /** Camino más corto hasta cualquier casilla vecina del edificio. */
  function caminoHastaEdificio(sx, sy, o) {
    let mejor = null;
    for (const c of casillasVecinas(o)) {
      const ruta = buscarCamino(sx, sy, c.tx, c.ty);
      if (ruta && (!mejor || ruta.length < mejor.length)) mejor = ruta;
    }
    return mejor;
  }

  /** Edificio interactivo bajo un punto del mundo (usa un rectángulo que incluye su altura). */
  function edificioEnPunto(x, y) {
    for (const o of [...mapa().edificios, ...graneros()]) {
      if (!o.accion) continue;
      const izq = (o.x - (o.y + o.d)) * HW;
      const der = (o.x + o.w - o.y) * HW;
      const arriba = (o.x + o.y) * HH - o.alto;
      const abajo = (o.x + o.w + o.y + o.d) * HH;
      if (x >= izq && x <= der && y >= arriba && y <= abajo) return o;
    }
    return null;
  }

  const edificioPorAccion = (accion) => mapa().edificios.find((e) => e.accion === accion);

  /** Límites del mundo en píxeles (incluye margen para árboles, edificios y montañas). */
  function limites() {
    const z = mapa().zona;
    return {
      minX: -M.ALTO * HW - 80,
      maxX: M.ANCHO * HW + 80,
      minY: z.montanas ? -280 : -140,
      maxY: (M.ANCHO + M.ALTO) * HH + 90,
    };
  }

  /** Centro (en casillas) de un terreno. */
  const centroTerreno = (t) => { const o = origenTerreno(t); return { tx: o.x + T / 2, ty: o.y + T / 2 }; };

  Conuco.Iso = {
    HW, HH, aPantalla, aTile, hash, dentro,
    mapa, tipoSuelo, esCaminable, casillasFauna, graneros, puedeColocar, firmaConstrucciones: () => { const e = estado(); return e ? e.parcelas.length + ':' + (e.graneros ? e.graneros.length : 0) : '-'; },
    terrenoDe, origenTerreno, terrenoComprado, centroTerreno, parcelasDeTerreno,
    parcelaOrigen, parcelaEnTile, terrenoDeParcela,
    buscarCamino, caminoHastaEdificio, edificioEnPunto, edificioPorAccion, limites,
  };
})(typeof window !== 'undefined' ? window : globalThis);
