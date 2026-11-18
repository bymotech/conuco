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
    const L = Iso.limites;
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

  function ajustarTamano() {
    const r = caja.getBoundingClientRect();
    if (!r.width || !r.height) return;
    w = r.width; h = r.height;
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const L = Iso.limites;
    const encaja = Math.min(w / (L.maxX - L.minX), h / (L.maxY - L.minY));
    zoomMin = encaja * 0.9;
    if (primerAjuste) { // en pantallas chicas arranca más cerca y centrado en el jugador
      cam.zoom = Math.max(encaja, w < 600 ? 0.62 : 0);
      primerAjuste = false;
      centrar();
    }
    cam.zoom = clamp(cam.zoom, zoomMin, ZOOM_MAX);
    limitarCamara();
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
      cb.abrirPanel(p.ed.accion === 'semillas' ? 'semillas' : 'cosecha');
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
        cb.toast('No tienes semillas. Cómpralas en la pestaña Semillas.', 'error');
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

  function alClick(sx, sy) {
    const estado = S.get();
    if (!estado.jugador.etnia) return;
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
    if (!Iso.esCaminable(tx, ty)) return;
    const ruta = Iso.buscarCamino(px, py, tx, ty);
    if (!ruta) return cb.toast('No se puede llegar hasta ahí.', 'error');
    marcador = { tx: tx + 0.5, ty: ty + 0.5, t0: Date.now() };
    const idx = Iso.parcelaEnTile(tx, ty);
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
    canvas.style.cursor = parcela >= 0 || Iso.edificioEnPunto(m.x, m.y) ? 'pointer' : 'default';
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
      if (e.pointerType === 'mouse') actualizarHover(p);
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
    seguirConCamara(dt);
    const ahora = Date.now();
    for (let i = particulas.length - 1; i >= 0; i--) if (ahora - particulas[i].t0 > 1400) particulas.splice(i, 1);
    Esc.dibujar(ctx, {
      w, h, dpr, cam, ahora,
      estado: S.get(),
      hover, marcador, particulas,
      seleccion: cb.obtenerSeleccion(),
      avatar: { x: av.x, y: av.y, dir: av.dir, frente: av.frente, caminando: av.caminando, salto: av.salto },
    });
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

  /** Vuelve a poner al jugador en la entrada (al reiniciar la partida). */
  function reubicar() {
    av.x = M.SPAWN.x + 0.5; av.y = M.SPAWN.y + 0.5;
    av.ruta = []; av.pend = null; av.caminando = false;
    centrar();
  }

  /** Posición en pantalla (px dentro del lienzo) de una casilla; sirve para pruebas y tutoriales. */
  function pantallaDeTile(tx, ty) {
    const p = Iso.aPantalla(tx, ty);
    return { x: (p.x - cam.x) * cam.zoom + w / 2, y: (p.y - cam.y) * cam.zoom + h / 2 };
  }

  Conuco.Mapa = { iniciar, reubicar, pantallaDeTile };
})(typeof window !== 'undefined' ? window : globalThis);
