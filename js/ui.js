/**
 * ui.js — Interfaz: dibuja el estado y traduce toques/clics en acciones del juego.
 *
 * - La cuadrícula se crea UNA vez y se actualiza en sitio cada segundo (así los toques
 *   en móvil nunca se pierden por reconstruir el DOM a mitad de un toque).
 * - Las listas (semillas, cosecha) se redibujan solo cuando cambia el estado.
 * - Todo el texto que entra en innerHTML viene de config.js (nunca del usuario).
 */
(function (global) {
  'use strict';
  const Conuco = global.Conuco;
  const { CULTIVOS, CULTIVOS_POR_ID: POR_ID, CONFIG: C } = Conuco;
  const S = Conuco.State;
  const G = Conuco.Game;

  const ETAPAS = ['🌱', '🌿', '🪴']; // brote -> planta -> planta crecida

  // ---------- Formato ----------
  const fmtBs = (n) => 'Bs ' + Math.floor(n).toLocaleString('es-VE');

  function fmtDuracion(ms) {
    const t = Math.round(ms / 1000);
    if (t < 60) return t + ' s';
    const m = Math.floor(t / 60);
    return m + ' min' + (t % 60 ? ' ' + (t % 60) + ' s' : '');
  }

  function fmtReloj(ms) {
    const t = Math.ceil(ms / 1000);
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }

  // ---------- Estado de la interfaz (no se guarda) ----------
  let seleccion = null;       // id de la semilla elegida
  let tabActiva = 'semillas';
  let el = {};                // referencias al DOM
  let parcelaEls = [];

  const $ = (id) => document.getElementById(id);
  const setTexto = (nodo, t) => { if (nodo.textContent !== t) nodo.textContent = t; };
  const setClase = (nodo, c) => { if (nodo.className !== c) nodo.className = c; };

  // ---------- Avisos (toasts) ----------
  function toast(mensaje, tipo = 'info') {
    const t = document.createElement('div');
    t.className = 'toast ' + tipo;
    t.textContent = mensaje;
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('fuera'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  function mostrar(res) {
    if (!res) return;
    toast(res.mensaje, res.ok ? (res.subioNivel ? 'nivel' : 'ok') : 'error');
  }

  // ---------- Cabecera ----------
  function renderCabecera() {
    const s = S.get();
    const p = G.progresoNivel(s.xp);
    setTexto(el.dinero, Math.floor(s.dinero).toLocaleString('es-VE'));
    setTexto(el.nivel, String(p.nivel));
    el.xpBarra.style.width = Math.round(p.pct * 100) + '%';
    setTexto(el.xpTexto, `${p.actual} / ${p.necesario} XP`);
  }

  // ---------- Cuadrícula ----------
  function crearGrid() {
    el.grid.innerHTML = '';
    parcelaEls = [];
    for (let i = 0; i < C.TOTAL_PARCELAS; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'parcela';
      b.dataset.idx = i;
      b.innerHTML = '<span class="p-emoji"></span><span class="p-label"></span><span class="p-bar"><i></i></span>';
      el.grid.appendChild(b);
      parcelaEls.push({
        btn: b,
        emoji: b.children[0],
        label: b.children[1],
        barra: b.children[2].firstChild,
      });
    }
  }

  /** Se llama cada segundo y tras cada cambio. Solo toca el DOM si algo cambió. */
  function actualizarGrid() {
    const s = S.get();
    const ahora = Date.now();
    s.parcelas.forEach((p, i) => {
      const n = parcelaEls[i];
      const info = G.estadoParcela(p, ahora);
      let emoji = '', label = '', pct = 0, aria = '';

      if (info.tipo === 'bloqueada') {
        emoji = '🔒'; label = fmtBs(G.costoParcela(s)); aria = `Parcela bloqueada, cuesta ${label}`;
      } else if (info.tipo === 'vacia') {
        label = 'Sembrar'; aria = 'Parcela vacía';
      } else if (info.tipo === 'lista') {
        emoji = info.cultivo.emoji; label = '¡Lista!'; pct = 100; aria = `${info.cultivo.nombre} lista para cosechar`;
      } else {
        emoji = ETAPAS[Math.min(2, Math.floor(info.pct * 3))];
        label = fmtReloj(info.restanteMs); pct = info.pct * 100;
        aria = `${info.cultivo.nombre} creciendo, faltan ${fmtDuracion(info.restanteMs)}`;
      }
      setClase(n.btn, 'parcela ' + info.tipo);
      setTexto(n.emoji, emoji);
      setTexto(n.label, label);
      n.barra.style.width = pct.toFixed(1) + '%';
      if (n.btn.getAttribute('aria-label') !== aria) n.btn.setAttribute('aria-label', aria);
    });
    el.btnCosecharTodo.disabled = G.contarListas(ahora) === 0;
  }

  // ---------- Selector de semillas ----------
  function renderSeedbar() {
    const s = S.get();
    const nivel = G.nivelDeXp(s.xp);
    // Si no hay selección válida, elige la primera semilla disponible.
    if (!seleccion || !POR_ID[seleccion] || POR_ID[seleccion].nivelReq > nivel) {
      const primera = CULTIVOS.find((c) => c.nivelReq <= nivel && (s.semillas[c.id] || 0) > 0);
      seleccion = primera ? primera.id : null;
    }
    el.seedbar.innerHTML = CULTIVOS.map((c) => {
      const n = s.semillas[c.id] || 0;
      const bloq = c.nivelReq > nivel;
      const cls = ['chip', c.id === seleccion ? 'sel' : '', n === 0 ? 'sin' : '', bloq ? 'nivel-bloq' : ''].join(' ').trim();
      const texto = bloq ? `🔒 Nv ${c.nivelReq}` : `×${n}`;
      return `<button type="button" class="${cls}" data-id="${c.id}" aria-pressed="${c.id === seleccion}">${c.emoji} <b>${texto}</b></button>`;
    }).join('');
  }

  // ---------- Panel: tienda de semillas ----------
  function renderSemillas() {
    const s = S.get();
    const nivel = G.nivelDeXp(s.xp);
    el.panelSemillas.innerHTML = CULTIVOS.map((c) => {
      const bloq = c.nivelReq > nivel;
      const tengo = s.semillas[c.id] || 0;
      const det = bloq
        ? `Se desbloquea en el nivel ${c.nivelReq}`
        : `Crece en ${fmtDuracion(c.tiempoMs)} · da ${c.rendimiento} · vende a ${fmtBs(c.precioVenta)} c/u<br>Tienes ${tengo} semilla(s)`;
      const acciones = bloq ? '' : `
        <div class="acciones">
          <button class="btn" type="button" data-accion="comprar" data-id="${c.id}" data-n="1" ${s.dinero < c.costoSemilla ? 'disabled' : ''}>${fmtBs(c.costoSemilla)} · ×1</button>
          <button class="btn" type="button" data-accion="comprar" data-id="${c.id}" data-n="5" ${s.dinero < c.costoSemilla * 5 ? 'disabled' : ''}>${fmtBs(c.costoSemilla * 5)} · ×5</button>
        </div>`;
      return `<div class="fila ${bloq ? 'bloq' : ''}">
        <span class="em">${bloq ? '🔒' : c.emoji}</span>
        <div><div class="nombre">${c.nombre}</div><div class="det">${det}</div></div>
        ${acciones}
      </div>`;
    }).join('');
  }

  // ---------- Panel: inventario de cosecha y venta ----------
  function renderCosecha() {
    const s = S.get();
    const filas = CULTIVOS.filter((c) => (s.cosechas[c.id] || 0) > 0);
    if (!filas.length) {
      el.panelCosecha.innerHTML = '<div class="vacio">🧺 Aún no tienes cosecha.<br>Siembra, espera y cosecha para vender aquí.</div>';
      return;
    }
    let total = 0;
    const html = filas.map((c) => {
      const n = s.cosechas[c.id];
      total += n * c.precioVenta;
      return `<div class="fila">
        <span class="em">${c.emoji}</span>
        <div><div class="nombre">${c.nombre} ×${n}</div><div class="det">${fmtBs(c.precioVenta)} c/u · total ${fmtBs(n * c.precioVenta)}</div></div>
        <div class="acciones">
          <button class="btn" type="button" data-accion="vender" data-id="${c.id}" data-n="1">Vender 1</button>
          <button class="btn btn-venta" type="button" data-accion="vender" data-id="${c.id}" data-n="todo">Vender todo</button>
        </div>
      </div>`;
    }).join('');
    el.panelCosecha.innerHTML = html +
      `<button class="btn btn-primary total" type="button" data-accion="vender-todo">💰 Vender toda la cosecha (${fmtBs(total)})</button>`;
  }

  function cambiarTab(nombre) {
    tabActiva = nombre;
    const sem = nombre === 'semillas';
    el.panelSemillas.hidden = !sem;
    el.panelCosecha.hidden = sem;
    el.tabSemillas.classList.toggle('activa', sem);
    el.tabCosecha.classList.toggle('activa', !sem);
    el.tabSemillas.setAttribute('aria-selected', String(sem));
    el.tabCosecha.setAttribute('aria-selected', String(!sem));
  }

  // ---------- Render general ----------
  function renderTodo() {
    renderCabecera();
    renderSeedbar();
    renderSemillas();
    renderCosecha();
    actualizarGrid();
    el.aviso.hidden = S.esPersistente();
  }

  // ---------- Eventos ----------
  function alTocarParcela(ev) {
    const b = ev.target.closest('.parcela');
    if (!b) return;
    const idx = Number(b.dataset.idx);
    const ahora = Date.now();
    const info = G.estadoParcela(S.get().parcelas[idx], ahora);

    if (info.tipo === 'bloqueada') return mostrar(G.comprarParcela(idx));
    if (info.tipo === 'lista') return mostrar(G.cosechar(idx, ahora));
    if (info.tipo === 'creciendo') {
      return toast(`${info.cultivo.nombre} ${info.cultivo.emoji}: faltan ${fmtDuracion(info.restanteMs)}`);
    }
    // Parcela vacía -> sembrar la semilla elegida
    if (!seleccion) return toast('No tienes semillas. Cómpralas en la pestaña Semillas.', 'error');
    mostrar(G.plantar(idx, seleccion, ahora));
  }

  function alTocarSemilla(ev) {
    const b = ev.target.closest('.chip');
    if (!b) return;
    const c = POR_ID[b.dataset.id];
    if (c.nivelReq > G.nivelDeXp(S.get().xp)) return toast(`${c.nombre} se desbloquea en el nivel ${c.nivelReq}.`, 'error');
    seleccion = c.id;
    renderSeedbar();
  }

  function alTocarMercado(ev) {
    const b = ev.target.closest('[data-accion]');
    if (!b || b.disabled) return;
    const { accion, id, n } = b.dataset;
    if (accion === 'comprar') mostrar(G.comprarSemillas(id, Number(n)));
    else if (accion === 'vender') mostrar(G.vender(id, n === 'todo' ? 'todo' : Number(n)));
    else if (accion === 'vender-todo') mostrar(G.venderTodo());
  }

  function iniciar() {
    el = {
      dinero: $('dinero'), nivel: $('nivel'), xpBarra: $('xp-barra'), xpTexto: $('xp-texto'),
      grid: $('grid'), seedbar: $('seedbar'), btnCosecharTodo: $('btn-cosechar-todo'),
      tabSemillas: $('tab-semillas'), tabCosecha: $('tab-cosecha'),
      panelSemillas: $('panel-semillas'), panelCosecha: $('panel-cosecha'),
      toasts: $('toasts'), aviso: $('aviso-almacenamiento'), btnReiniciar: $('btn-reiniciar'),
    };

    crearGrid();
    el.grid.addEventListener('click', alTocarParcela);
    el.seedbar.addEventListener('click', alTocarSemilla);
    el.panelSemillas.addEventListener('click', alTocarMercado);
    el.panelCosecha.addEventListener('click', alTocarMercado);
    el.btnCosecharTodo.addEventListener('click', () => mostrar(G.cosecharTodo()));
    el.tabSemillas.addEventListener('click', () => cambiarTab('semillas'));
    el.tabCosecha.addEventListener('click', () => cambiarTab('cosecha'));
    el.btnReiniciar.addEventListener('click', () => {
      if (global.confirm('¿Seguro que quieres borrar tu conuco y empezar de cero?')) {
        seleccion = null;
        S.reiniciar();
        toast('Partida reiniciada. ¡A sembrar!', 'ok');
      }
    });

    S.suscribir(renderTodo); // cualquier cambio de estado redibuja
    cambiarTab(tabActiva);
    renderTodo();
  }

  /** Llamado cada segundo desde main.js. */
  function tick() {
    actualizarGrid();
  }

  Conuco.UI = { iniciar, tick, toast };
})(typeof window !== 'undefined' ? window : globalThis);
