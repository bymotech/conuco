/**
 * iso.js — Geometría isométrica, disposición del mapa y búsqueda de caminos.
 * No dibuja nada ni toca el DOM, así que se puede probar en Node.
 *
 * Coordenadas:
 *  - "tile" (tx, ty): casillas del mapa. La casilla (i, j) ocupa [i, i+1) x [j, j+1).
 *  - "pantalla" (x, y): píxeles del mundo, ya proyectados.
 *      x = (tx - ty) * TILE_W/2      y = (tx + ty) * TILE_H/2
 *  Hacia la derecha-abajo crece tx; hacia la izquierda-abajo crece ty.
 *  El vértice de arriba del mapa es (0,0); el de abajo es (ANCHO, ALTO).
 */
(function (global) {
  'use strict';
  const Conuco = (global.Conuco = global.Conuco || {});
  const M = Conuco.MAPA;
  const HW = M.TILE_W / 2;
  const HH = M.TILE_H / 2;

  const aPantalla = (tx, ty) => ({ x: (tx - ty) * HW, y: (tx + ty) * HH });
  const aTile = (x, y) => ({ tx: (x / HW + y / HH) / 2, ty: (y / HH - x / HW) / 2 });

  /** Número pseudoaleatorio estable en [0,1) para una casilla (para variar el pasto, etc.). */
  function hash(x, y, k = 0) {
    const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
    return s - Math.floor(s);
  }

  // ---------- Decorado (edificios y árboles) ----------
  // x,y = casilla de la esquina de arriba; w = ancho en casillas (eje tx); d = fondo (eje ty).
  // alto = altura visual en píxeles (para saber dónde se puede tocar).

  const EDIFICIOS = [
    { id: 'casa',     tipo: 'casa',     x: 0,  y: 0,  w: 2, d: 2, alto: 84 },
    { id: 'churuata', tipo: 'churuata', x: 15, y: 1,  w: 2, d: 2, alto: 82, accion: 'semillas', etiqueta: '🌱 Semillas' },
    { id: 'puesto',   tipo: 'puesto',   x: 0,  y: 13, w: 1, d: 2, alto: 60, accion: 'mercado',  etiqueta: '🧺 Mercado' },
  ];

  const ARBOLES = [
    ['palma', 0, 4], ['palma', 0, 8], ['palma', 1, 10], ['palma', 4, 0], ['palma', 7, 0],
    ['palma', 11, 0], ['palma', 16, 5], ['palma', 16, 9], ['palma', 15, 12], ['palma', 13, 16],
    ['palma', 3, 16], ['palma', 5, 15],
    ['mango', 1, 6], ['mango', 15, 7], ['mango', 15, 14], ['mango', 1, 16],
    ['araguaney', 9, 0], ['araguaney', 16, 3], ['araguaney', 12, 16], ['araguaney', 0, 11],
  ].map(([tipo, x, y]) => ({ tipo, x, y, w: 1, d: 1 }));

  // Casillas bloqueadas por el decorado
  const bloqueado = new Uint8Array(M.ANCHO * M.ALTO);
  for (const o of [...EDIFICIOS, ...ARBOLES]) {
    for (let j = o.y; j < o.y + o.d; j++) {
      for (let i = o.x; i < o.x + o.w; i++) bloqueado[j * M.ANCHO + i] = 1;
    }
  }

  const dentro = (tx, ty) => tx >= 0 && ty >= 0 && tx < M.ANCHO && ty < M.ALTO;
  const esCaminable = (tx, ty) => dentro(tx, ty) && !bloqueado[ty * M.ANCHO + tx];

  // ---------- Parcelas ----------

  const PASO = M.PARCELA_TAM + M.PARCELA_SEP;
  const INVERSO = []; // posición en el bloque 4x4 -> índice lógico
  M.ORDEN_PARCELAS.forEach((pos, i) => { INVERSO[pos] = i; });

  /** Casilla de la esquina de arriba de la parcela lógica `i`. */
  function parcelaOrigen(i) {
    const pos = M.ORDEN_PARCELAS[i];
    const fila = Math.floor(pos / M.PARCELA_COLS);
    const col = pos % M.PARCELA_COLS;
    return { x: M.PARCELA_X0 + col * PASO, y: M.PARCELA_Y0 + fila * PASO };
  }

  /** Índice lógico de la parcela que cubre la casilla, o -1. */
  function parcelaEnTile(tx, ty) {
    const lx = tx - M.PARCELA_X0;
    const ly = ty - M.PARCELA_Y0;
    if (lx < 0 || ly < 0) return -1;
    const col = Math.floor(lx / PASO);
    const fila = Math.floor(ly / PASO);
    if (col >= M.PARCELA_COLS || fila >= M.PARCELA_COLS) return -1;
    if (lx - col * PASO >= M.PARCELA_TAM || ly - fila * PASO >= M.PARCELA_TAM) return -1;
    const i = INVERSO[fila * M.PARCELA_COLS + col];
    return i === undefined ? -1 : i;
  }

  /** Tipo de suelo de una casilla: 'parcela' | 'camino' | 'pasto'. */
  function tipoSuelo(tx, ty) {
    if (parcelaEnTile(tx, ty) >= 0) return 'parcela';
    const ini = M.PARCELA_X0;
    const fin = M.PARCELA_X0 + M.PARCELA_COLS * PASO - M.PARCELA_SEP - 1;
    // Bloque de parcelas + el camino que lo rodea (un anillo de 1 casilla)
    if (tx >= ini - 1 && tx <= fin + 1 && ty >= ini - 1 && ty <= fin + 1) return 'camino';
    // Camino de entrada hacia el punto de aparición
    if (tx === M.SPAWN.x && ty > fin + 1) return 'camino';
    return 'pasto';
  }

  // ---------- Búsqueda de caminos (A*) ----------

  const N = M.ANCHO * M.ALTO;
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
    const padre = new Int16Array(N).fill(-1);
    const cerrado = new Uint8Array(N);
    const inicio = sy * M.ANCHO + sx;
    g[inicio] = 0;
    const abiertos = [inicio];

    while (abiertos.length) {
      // nodo abierto con menor f = g + h (el mapa es chico: búsqueda lineal basta)
      let mejor = 0;
      let fMejor = Infinity;
      for (let k = 0; k < abiertos.length; k++) {
        const n = abiertos[k];
        const f = g[n] + heur(n % M.ANCHO, Math.floor(n / M.ANCHO));
        if (f < fMejor) { fMejor = f; mejor = k; }
      }
      const actual = abiertos.splice(mejor, 1)[0];
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
          abiertos.push(nid);
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
    for (const o of EDIFICIOS) {
      if (!o.accion) continue;
      const izq = (o.x - (o.y + o.d)) * HW;
      const der = (o.x + o.w - o.y) * HW;
      const arriba = (o.x + o.y) * HH - o.alto;
      const abajo = (o.x + o.w + o.y + o.d) * HH;
      if (x >= izq && x <= der && y >= arriba && y <= abajo) return o;
    }
    return null;
  }

  /** Límites del mundo en píxeles (incluye margen para árboles y edificios altos). */
  const limites = {
    minX: -M.ALTO * HW - 60,
    maxX: M.ANCHO * HW + 60,
    minY: -130,
    maxY: (M.ANCHO + M.ALTO) * HH + 70,
  };

  Conuco.Iso = {
    HW, HH, aPantalla, aTile, hash, dentro,
    EDIFICIOS, ARBOLES, esCaminable, tipoSuelo,
    parcelaOrigen, parcelaEnTile,
    buscarCamino, caminoHastaEdificio, edificioEnPunto, limites,
  };
})(typeof window !== 'undefined' ? window : globalThis);
