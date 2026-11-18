/**
 * mapa.js — Controla el mapa: cámara (arrastrar y zoom), toques, el muñeco que camina
 * hasta donde tocas, y las acciones que ocurren al llegar (sembrar, cosechar, comprar...).
 *
 * El dibujo en sí está en escena.js; la lógica del juego en game.js.
 */
(function (global) {
  'use strict';
  const Conuco = global.Conuco;
  const M = Conuco.MAPA;
  const Iso = Conuco.Iso;
  const Esc = Conuco.Escena;
  const G = Conuco.Game;
  const S = Conuco.State;

  const ZOOM_MAX = 2.4;

  let canvas, ctx, caja;
  let cb = {};                 // funciones que entrega la UI: obtenerSeleccion, mostrar, toast, abrirPanel
  let w = 0, h = 0, dpr = 1;
  let zoomMin = 0.3;
  const cam = { x: 0, y: 0, zoom: 1 };   // (x,y) = punto del mundo que está en el centro de la pantalla
  const av = { x: M.SPAWN.x + 0.5, y: M.SPAWN.y + 0.5, ruta: [], pend: null, dir: 1, frente: true, caminando: false, salto: 0 };
  let hover = null, marcador = null, seguir = false, ultimoMs = 0, primerAjuste = true;
  const particulas = [];
  const punteros = new Map();  // dedos / ratón activos
  let arrastre = null;         // { x, y, movio }
  let distPinch = 0;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const aMundo = (sx, sy) => ({ x: (sx - w / 2) / cam.zoom + cam.x, y: (sy - h / 2) / cam.zoom + cam.y });

  function fmtDuracion(ms) {
    const t = Math.round(ms / 1000);
    return t < 60 ? t + ' s' : Math.floor(t / 60) + ' min' + (t % 60 ? ' ' + (t % 60) + ' s' : '');
  }

  // ---------- Cámara ----------

  /** Mantiene el mundo dentro de la pantalla; si cabe entero, lo centra. */
  function limitarCamara() {
    const L = Iso.limites();
    const mx = w / (2 * cam.zoom), my = h / (2 * cam.zoom);
    cam.x = L.maxX - L.minX <= 2 * mx ? (L.minX + L.maxX) / 2 : clamp(cam.x, L.minX + mx, L.maxX - mx);
    cam.y = L.maxY - L.minY <= 2 * my ? (L.minY + L.maxY) / 2 : clamp(cam.y, L.minY + my, L.maxY - my);
  }

  function centrar() {
    const p = Iso.aPantalla(av.x, av.y);
    cam.x = p.x; cam.y = p.y - 30;
    limitarCamara();
  }

  function zoomEn(sx, sy, factor) {
    const antes = aMundo(sx, sy);
    cam.zoom = clamp(cam.zoom * factor, zoomMin, ZOOM_MAX);
    const desp = aMundo(sx, sy);
    cam.x += antes.x - desp.x; cam.y += antes.y - desp.y;
    limitarCamara();
  }

  /** Zoom para ver el terreno inicial completo. */
  function zoomInicial() {
    const ancho = M.TERRENO * M.TILE_W + 120, alto = M.TERRENO * M.TILE_H + 200;
    return clamp(Math.min(w / ancho, h / alto), 0.5, 1.1);
  }

  function ajustarTamano() {
    const r = caja.getBoundingClientRect();
    if (!r.width || !r.height) return;
    w = r.width; h = r.height;
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const L = Iso.limites();
    zoomMin = Math.min(w / (L.maxX - L.minX), h / (L.maxY - L.minY)) * 0.95;
    if (primerAjuste) {
      cam.zoom = zoomInicial();
      primerAjuste = false;
      centrar();
    }
    cam.zoom = clamp(cam.zoom, zoomMin, ZOOM_MAX);
    limitarCamara();
  }

  // ---------- Animales ----------

  const fauna = [];
  const aves = [];
  let zonaFauna = null;
  let firmaFauna = null;
  const VEL_ANIMAL = { cangrejo: 1.3, gallina: 0.9, iguana: 0.8, chiguire: 0.6 };
  const PASTAN = new Set(['vaca', 'caballo', 'oveja', 'chivo', 'burro', 'chiguire', 'cochino', 'gallina', 'corocora']);

  /** Pone 2 o 3 animales de la zona en cada terreno y unas aves volando. */
  function iniciarFauna() {
    const zona = Iso.mapa().zona;
    zonaFauna = zona.id;
    fauna.length = 0; aves.length = 0;
    const n = M.TERRENOS_LADO * M.TERRENOS_LADO;
    for (let k = 0; k < n; k++) {
      const libres = Iso.casillasFauna(k);
      const cuantos = 2 + (Iso.hash(k, 1, 7) > 0.5 ? 1 : 0);
      for (let j = 0; j < cuantos && libres.length; j++) {
        const c = libres[Math.floor(Iso.hash(k, j, 3) * libres.length)];
        const tipo = zona.animales[Math.floor(Iso.hash(k, j, 5) * zona.animales.length)];
        fauna.push({ tipo, k, libres, x: c.tx + 0.5, y: c.ty + 0.5, dest: null, espera: Iso.hash(k, j, 9) * 4, dir: 1, caminando: false, comiendo: false, sem: Iso.hash(k, j, 11) });
      }
    }
    const tiposAve = zona.aves || [];
    for (let j = 0; j < 4 && tiposAve.length; j++) {
      aves.push({
        tipo: tiposAve[j % tiposAve.length],
        cx: 6 + Iso.hash(j, 2, 1) * (M.ANCHO - 12), cy: 6 + Iso.hash(j, 3, 1) * (M.ALTO - 12),
        r: 4 + Iso.hash(j, 4, 1) * 5, a: Iso.hash(j, 5, 1) * 6.28, vel: (0.12 + Iso.hash(j, 6, 1) * 0.1) * (j % 2 ? 1 : -1),
        alto: 110 + Iso.hash(j, 7, 1) * 70, sem: Iso.hash(j, 8, 1), x: 0, y: 0, dir: 1,
      });
    }
  }

  function actualizarFauna(dt) {
    if (zonaFauna !== Iso.mapa().zona.id) iniciarFauna();
    const firma = Iso.firmaConstrucciones();
    if (firma !== firmaFauna) { // se construyó algo: los animales ya no pisan ahí
      firmaFauna = firma;
      for (const a of fauna) { a.libres = Iso.casillasFauna(a.k); a.dest = null; }
    }
    for (const a of fauna) {
      if (a.espera > 0) { a.espera -= dt; continue; }
      if (!a.dest) {
        const cerca = a.libres.filter((c) => Math.abs(c.tx + 0.5 - a.x) <= 3 && Math.abs(c.ty + 0.5 - a.y) <= 3);
        const c = cerca[Math.floor(Math.random() * cerca.length)];
        if (!c) { a.espera = 3; continue; }
        a.dest = { x: c.tx + 0.5, y: c.ty + 0.5 };
        a.comiendo = false;
      }
      const dx = a.dest.x - a.x, dy = a.dest.y - a.y, d = Math.hypot(dx, dy);
      const paso = (VEL_ANIMAL[a.tipo] || 0.7) * dt;
      a.caminando = true;
      if (Math.abs(dx - dy) > 0.02) a.dir = dx - dy > 0 ? 1 : -1;
      if (d <= paso) {
        a.x = a.dest.x; a.y = a.dest.y; a.dest = null; a.caminando = false;
        a.espera = 2 + Math.random() * 5;
        a.comiendo = PASTAN.has(a.tipo) && Math.random() < 0.6;
      } else { a.x += (dx / d) * paso; a.y += (dy / d) * paso; }
    }
    for (const b of aves) {
      b.a += b.vel * dt;
      const nx = b.cx + Math.cos(b.a) * b.r, ny = b.cy + Math.sin(b.a) * b.r;
      const sx = (nx - ny) - (b.x - b.y);
      if (Math.abs(sx) > 1e-4) b.dir = sx > 0 ? 1 : -1;
      b.x = nx; b.y = ny;
    }
  }

  // ---------- Partículas ----------

  function particula(texto, tx, ty) {
    const p = Iso.aPantalla(tx, ty);
    particulas.push({ texto, x: p.x, y: p.y - 26, t0: Date.now() });
  }

  // ---------- Jugador ----------

  function ir(ruta, pend) {
    av.ruta = ruta;
    av.pend = pend;
    seguir = true;
    if (!ruta.length) llegar();
  }

  function llegar() {
    av.caminando = false;
    G.guardarPosicion(av.x, av.y);
    ejecutarPendiente();
  }

  /** Lo que ocurre cuando el jugador llega al destino que tocaste. */
  function ejecutarPendiente() {
    const p = av.pend;
    av.pend = null;
    if (!p) return;

    if (p.tipo === 'edificio') {
      // en el mercado, si traes cosecha se abre directo en "Vender"
      if (p.ed.accion === 'mercado') cb.abrirPanel('mercado', Object.keys(S.get().cosechas).length ? 'vender' : 'comprar');
      else cb.abrirPanel('granero');
      return;
    }

    const estado = S.get();
    const parcela = estado.parcelas[p.idx];
    const ahora = Date.now();
    const info = G.estadoParcela(parcela, ahora);
    const o = Iso.parcelaOrigen(p.idx);
    const cx = o.x + M.PARCELA_TAM / 2, cy = o.y + M.PARCELA_TAM / 2;
    let res = null;

    if (info.tipo === 'bloqueada') {
      res = G.comprarParcela(p.idx);
      if (res.ok) particula('🔓 ¡Tuya!', cx, cy);
    } else if (info.tipo === 'lista') {
      res = G.cosechar(p.idx, ahora);
      if (res.ok) particula(`+${info.cultivo.rendimiento} ${info.cultivo.emoji}`, cx, cy);
    } else if (info.tipo === 'creciendo') {
      cb.toast(`${info.cultivo.nombre} ${info.cultivo.emoji}: faltan ${fmtDuracion(info.restanteMs)}`);
    } else {
      const sel = cb.obtenerSeleccion();
      if (!sel) {
        cb.toast('No tienes semillas. Cómpralas en el 🧺 Mercado.', 'error');
      } else {
        res = G.plantar(p.idx, sel, ahora);
        if (res.ok) particula('🌱', cx, cy);
      }
    }
    if (res) {
      cb.mostrar(res);
      if (res.ok) av.salto = 1;
    }
  }

  function actualizarJugador(dt) {
    if (av.salto > 0) av.salto = Math.max(0, av.salto - dt * 2.8);
    if (!av.ruta.length) return;
    av.caminando = true;
    const d = av.ruta[0];
    const dx = d.tx + 0.5 - av.x, dy = d.ty + 0.5 - av.y;
    const dist = Math.hypot(dx, dy);
    const paso = M.VELOCIDAD * dt;
    // hacia dónde mira en pantalla (proyección isométrica)
    const sx = dx - dy, sy = dx + dy;
    if (Math.abs(sx) > 0.05) av.dir = sx > 0 ? 1 : -1;
    if (Math.abs(sy) > 0.05) av.frente = sy > 0;
    if (dist <= paso) {
      av.x = d.tx + 0.5; av.y = d.ty + 0.5;
      av.ruta.shift();
      if (!av.ruta.length) llegar();
    } else {
      av.x += (dx / dist) * paso; av.y += (dy / dist) * paso;
    }
  }

  function seguirConCamara(dt) {
    if (!seguir || !av.caminando || punteros.size) return;
    const p = Iso.aPantalla(av.x, av.y);
    const k = Math.min(1, dt * 4);
    cam.x += (p.x - cam.x) * k;
    cam.y += (p.y - 30 - cam.y) * k;
    limitarCamara();
  }

  // ---------- Toques ----------

  // ---------- Modo construir ----------

  let construir = null; // { tipo: 'parcela'|'granero', x, y, valido, fijo }

  /** Casillas que no se pueden tapar ahora mismo: el jugador y los animales. */
  function ocupadasAhora() {
    const res = [{ tx: Math.floor(av.x), ty: Math.floor(av.y), quien: 'jugador' }];
    for (const a of av.ruta) res.push({ tx: a.tx, ty: a.ty, quien: 'jugador' });
    for (const a of fauna) {
      res.push({ tx: Math.floor(a.x), ty: Math.floor(a.y), quien: 'animal' });
      if (a.dest) res.push({ tx: Math.floor(a.dest.x), ty: Math.floor(a.dest.y), quien: 'animal' });
    }
    return res;
  }

  /** Esquina de arriba del bloque de 2x2 centrado en un punto de la pantalla. */
  function origenEn(sx, sy) {
    const m = aMundo(sx, sy);
    const t = Iso.aTile(m.x, m.y);
    return { x: Math.round(t.tx - 1), y: Math.round(t.ty - 1) };
  }

  function apuntarConstruccion(sx, sy) {
    if (!construir || construir.fijo) return;
    const o = origenEn(sx, sy);
    construir.x = o.x; construir.y = o.y;
    construir.valido = Iso.puedeColocar(construir.tipo, o.x, o.y, ocupadasAhora()).ok;
  }

  /** Entra (tipo) o sale (null) del modo construir. */
  function modoConstruir(tipo) {
    construir = tipo ? { tipo, x: null, y: null, valido: false, fijo: false } : null;
    if (construir) { // al empezar, la vista previa aparece en el centro de la pantalla
      apuntarConstruccion(w / 2, h / 2);
    }
    canvas.style.cursor = construir ? 'crosshair' : 'default';
  }

  /** Tras la confirmación: suelta la vista previa (o la deja si se canceló). */
  function soltarConstruccion() { if (construir) construir.fijo = false; }

  function clickConstruir(sx, sy) {
    const o = origenEn(sx, sy);
    const lugar = Iso.puedeColocar(construir.tipo, o.x, o.y, ocupadasAhora());
    construir.x = o.x; construir.y = o.y; construir.valido = lugar.ok;
    if (!lugar.ok) return cb.toast(G.textoRazon(lugar.razon), 'error');
    construir.fijo = true;
    cb.confirmarConstruccion(construir.tipo, o.x, o.y, ocupadasAhora());
  }

  function alClick(sx, sy) {
    const estado = S.get();
    if (!estado.jugador.etnia || !estado.zona) return;
    if (construir) return clickConstruir(sx, sy);
    const m = aMundo(sx, sy);
    const px = Math.floor(av.x), py = Math.floor(av.y);

    const ed = Iso.edificioEnPunto(m.x, m.y);
    if (ed) {
      const ruta = Iso.caminoHastaEdificio(px, py, ed);
      if (!ruta) return cb.toast('No se puede llegar hasta ahí.', 'error');
      return ir(ruta, { tipo: 'edificio', ed });
    }

    const t = Iso.aTile(m.x, m.y);
    const tx = Math.floor(t.tx), ty = Math.floor(t.ty);
    if (!Iso.dentro(tx, ty)) return;
    const terreno = Iso.terrenoDe(tx, ty);
    if (!Iso.terrenoComprado(terreno)) return cb.comprarTerreno(terreno);

    const idx = Iso.parcelaEnTile(tx, ty);
    if (idx >= 0 && !estado.parcelas[idx].desbloqueada) {
      const costo = G.costoParcela(estado);
      if (estado.dinero < costo) {
        return cb.toast(`Esta parcela cuesta Bs ${costo.toLocaleString('es-VE')}. Te faltan Bs ${(costo - estado.dinero).toLocaleString('es-VE')}.`, 'error');
      }
    }
    if (!Iso.esCaminable(tx, ty)) return;
    const ruta = Iso.buscarCamino(px, py, tx, ty);
    if (!ruta) return cb.toast('No se puede llegar hasta ahí.', 'error');
    marcador = { tx: tx + 0.5, ty: ty + 0.5, t0: Date.now() };
    ir(ruta, idx >= 0 ? { tipo: 'parcela', idx } : null);
  }

  function posicion(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function actualizarHover(p) {
    const m = aMundo(p.x, p.y);
    const t = Iso.aTile(m.x, m.y);
    const tx = Math.floor(t.tx), ty = Math.floor(t.ty);
    if (!Iso.dentro(tx, ty)) { hover = null; canvas.style.cursor = 'default'; return; }
    const parcela = Iso.parcelaEnTile(tx, ty);
    hover = { tx, ty, parcela };
    canvas.style.cursor = construir ? 'crosshair' : parcela >= 0 || Iso.edificioEnPunto(m.x, m.y) ? 'pointer' : 'default';
  }

  function distancia() {
    const [a, b] = [...punteros.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function alBajar(e) {
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    const p = posicion(e);
    punteros.set(e.pointerId, p);
    if (punteros.size === 1) {
      arrastre = { x: p.x, y: p.y, movio: false };
    } else if (punteros.size === 2) {
      if (arrastre) arrastre.movio = true;
      distPinch = distancia();
    }
  }

  function alMover(e) {
    const p = posicion(e);
    if (!punteros.has(e.pointerId)) {
      if (e.pointerType === 'mouse') { actualizarHover(p); apuntarConstruccion(p.x, p.y); }
      return;
    }
    const previo = punteros.get(e.pointerId);
    punteros.set(e.pointerId, p);
    if (punteros.size === 2) { // pellizco = zoom
      const d = distancia();
      const [a, b] = [...punteros.values()];
      if (distPinch) zoomEn((a.x + b.x) / 2, (a.y + b.y) / 2, d / distPinch);
      distPinch = d;
      seguir = false;
      return;
    }
    if (!arrastre) return;
    if (!arrastre.movio && Math.hypot(p.x - arrastre.x, p.y - arrastre.y) > 6) arrastre.movio = true;
    if (arrastre.movio) { // arrastrar = mover la cámara
      cam.x -= (p.x - previo.x) / cam.zoom;
      cam.y -= (p.y - previo.y) / cam.zoom;
      seguir = false;
      hover = null;
      limitarCamara();
      canvas.classList.add('arrastrando');
    }
  }

  function alSoltar(e) {
    const p = posicion(e);
    const eraToque = e.type === 'pointerup' && arrastre && !arrastre.movio && punteros.size === 1;
    punteros.delete(e.pointerId);
    if (punteros.size < 2) distPinch = 0;
    if (!punteros.size) { arrastre = null; canvas.classList.remove('arrastrando'); }
    if (eraToque) alClick(p.x, p.y);
  }

  // ---------- Bucle de dibujo ----------

  function cuadro(ms) {
    global.requestAnimationFrame(cuadro);
    if (global.document.hidden || !w) return;
    const dt = Math.min(0.05, Math.max(0, (ms - ultimoMs) / 1000));
    ultimoMs = ms;
    actualizarJugador(dt);
    actualizarFauna(dt);
    seguirConCamara(dt);
    const ahora = Date.now();
    for (let i = particulas.length - 1; i >= 0; i--) if (ahora - particulas[i].t0 > 1400) particulas.splice(i, 1);
    Esc.dibujar(ctx, {
      w, h, dpr, cam, ahora,
      estado: S.get(),
      hover, marcador, particulas,
      seleccion: cb.obtenerSeleccion(),
      avatar: { x: av.x, y: av.y, dir: av.dir, frente: av.frente, caminando: av.caminando, salto: av.salto },
      fauna, aves, construir,
    });
    if (cb.alCuadro) cb.alCuadro();
  }

  // ---------- API ----------

  function iniciar(opciones) {
    cb = opciones;
    canvas = global.document.getElementById('mapa');
    caja = canvas.parentElement;
    ctx = canvas.getContext('2d');

    const j = S.get().jugador;
    const tx = Math.floor(j.tx), ty = Math.floor(j.ty);
    if (Iso.esCaminable(tx, ty)) { av.x = tx + 0.5; av.y = ty + 0.5; }

    ajustarTamano();
    if (global.ResizeObserver) new global.ResizeObserver(ajustarTamano).observe(caja);
    else global.addEventListener('resize', ajustarTamano);

    canvas.addEventListener('pointerdown', alBajar);
    canvas.addEventListener('pointermove', alMover);
    canvas.addEventListener('pointerup', alSoltar);
    canvas.addEventListener('pointercancel', alSoltar);
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hover = null; canvas.style.cursor = 'default'; } });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = posicion(e);
      zoomEn(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    const boton = (id, fn) => { const b = global.document.getElementById(id); if (b) b.addEventListener('click', fn); };
    boton('zoom-mas', () => zoomEn(w / 2, h / 2, 1.25));
    boton('zoom-menos', () => zoomEn(w / 2, h / 2, 0.8));
    boton('zoom-centrar', () => { centrar(); seguir = true; });

    global.requestAnimationFrame(cuadro);
  }

  /** Vuelve a poner al jugador en la entrada y encuadra el terreno inicial (nueva partida o zona). */
  function reubicar() {
    av.x = M.SPAWN.x + 0.5; av.y = M.SPAWN.y + 0.5;
    av.ruta = []; av.pend = null; av.caminando = false;
    primerAjuste = true;
    ajustarTamano();
  }

  /** Lleva la cámara (sin el jugador) a una casilla. */
  function mirarA(tx, ty) {
    const p = Iso.aPantalla(tx, ty);
    cam.x = p.x; cam.y = p.y;
    seguir = false;
    limitarCamara();
  }

  /** Posición en pantalla (px dentro del lienzo) de una casilla; sirve para pruebas y tutoriales. */
  function pantallaDeTile(tx, ty) {
    const p = Iso.aPantalla(tx, ty);
    return { x: (p.x - cam.x) * cam.zoom + w / 2, y: (p.y - cam.y) * cam.zoom + h / 2 };
  }

  Conuco.Mapa = { iniciar, reubicar, pantallaDeTile, mirarA, particula, modoConstruir, soltarConstruccion,
    construyendo: () => (construir ? construir.tipo : null), posicionJugador: () => ({ x: av.x, y: av.y }) };
})(typeof window !== 'undefined' ? window : globalThis);
