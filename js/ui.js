/**
 * ui.js — Paneles de la página (cabecera, semillas, mercado), pantalla de selección de
 * personaje y avisos. El mapa isométrico vive en mapa.js / escena.js.
 *
 * - Las listas (semillas, cosecha) se redibujan solo cuando cambia el estado.
 * - Todo el texto que entra en innerHTML viene de config.js. Lo que escribe el jugador
 *   (su nombre) solo se inserta con textContent / value, nunca como HTML.
 */
(function (global) {
  'use strict';
  const Conuco = global.Conuco;
  const { CULTIVOS, CULTIVOS_POR_ID: POR_ID, ETNIAS } = Conuco;
  const S = Conuco.State;
  const G = Conuco.Game;

  // ---------- Formato ----------
  const fmtBs = (n) => 'Bs ' + Math.floor(n).toLocaleString('es-VE');

  function fmtDuracion(ms) {
    const t = Math.round(ms / 1000);
    if (t < 60) return t + ' s';
    const m = Math.floor(t / 60);
    return m + ' min' + (t % 60 ? ' ' + (t % 60) + ' s' : '');
  }

  // ---------- Estado de la interfaz (no se guarda) ----------
  let seleccion = null;       // id de la semilla elegida para sembrar
  let tabActiva = 'semillas';
  let el = {};                // referencias al DOM
  let etniaElegida = null;    // en la pantalla de selección de personaje

  const $ = (id) => document.getElementById(id);
  const setTexto = (nodo, t) => { if (nodo.textContent !== t) nodo.textContent = t; };

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

  /** Abre una pestaña del mercado (la usa el mapa al llegar a la choza o al puesto). */
  function abrirPanel(nombre) {
    cambiarTab(nombre);
    toast(nombre === 'semillas' ? '🌱 Tienda de semillas' : '🧺 Mercado local: vende tu cosecha');
    const destino = nombre === 'semillas' ? el.panelSemillas : el.panelCosecha;
    if (destino.scrollIntoView) destino.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function actualizarBotones() {
    el.btnCosecharTodo.disabled = G.contarListas() === 0;
    el.aviso.hidden = S.esPersistente();
  }

  // ---------- Selección de personaje ----------
  function marcarOpcion() {
    el.opciones.forEach((b) => {
      const sel = b.dataset.etnia === etniaElegida;
      b.classList.toggle('sel', sel);
      b.setAttribute('aria-pressed', String(sel));
    });
    el.btnComenzar.disabled = !etniaElegida;
  }

  /** Dibuja los muñecos de la pantalla de selección (el elegido camina en el lugar). */
  function animarPrevias(ms) {
    if (el.modal.hidden) return;
    el.opciones.forEach((b) => {
      const c = b.querySelector('canvas');
      const ctx = c.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      const elegido = b.dataset.etnia === etniaElegida;
      Conuco.Sprites.elipse(ctx, 140, 300, 86, 26, 'rgba(0,0,0,0.1)');
      Conuco.Sprites.avatar(ctx, b.dataset.etnia, 140, 296, { escala: 4.6, frente: true, dir: 1, caminando: elegido, t: ms / 1000 });
    });
    global.requestAnimationFrame(animarPrevias);
  }

  function abrirModalAvatar() {
    const j = S.get().jugador;
    etniaElegida = j.etnia;
    el.nombreJugador.value = j.nombre;
    el.btnCancelarAvatar.hidden = !j.etnia; // la primera vez es obligatorio elegir
    marcarOpcion();
    const yaEstaba = !el.modal.hidden;
    el.modal.hidden = false;
    if (!yaEstaba) global.requestAnimationFrame(animarPrevias);
  }

  function renderTodo() {
    renderCabecera();
    renderSeedbar();
    renderSemillas();
    renderCosecha();
    actualizarBotones();
    if (!S.get().jugador.etnia && el.modal.hidden) abrirModalAvatar();
  }

  // ---------- Eventos ----------
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
      seedbar: $('seedbar'), btnCosecharTodo: $('btn-cosechar-todo'),
      tabSemillas: $('tab-semillas'), tabCosecha: $('tab-cosecha'),
      panelSemillas: $('panel-semillas'), panelCosecha: $('panel-cosecha'),
      toasts: $('toasts'), aviso: $('aviso-almacenamiento'),
      btnReiniciar: $('btn-reiniciar'), btnCambiarAvatar: $('btn-cambiar-avatar'),
      modal: $('modal-avatar'), nombreJugador: $('nombre-jugador'),
      btnComenzar: $('btn-comenzar'), btnCancelarAvatar: $('btn-cancelar-avatar'),
      opciones: Array.from(document.querySelectorAll('.opcion-avatar')),
    };

    // Textos de los personajes (vienen de config.js)
    el.opciones.forEach((b) => {
      const e = ETNIAS.find((x) => x.id === b.dataset.etnia);
      b.querySelector('b').textContent = e.nombre;
      b.querySelector('small').textContent = e.descripcion;
      b.addEventListener('click', () => { etniaElegida = e.id; marcarOpcion(); });
    });
    el.btnComenzar.addEventListener('click', () => {
      const res = G.elegirAvatar(etniaElegida, el.nombreJugador.value);
      if (res.ok) { el.modal.hidden = true; mostrar(res); }
      else mostrar(res);
    });
    el.btnCancelarAvatar.addEventListener('click', () => { el.modal.hidden = true; });
    el.btnCambiarAvatar.addEventListener('click', abrirModalAvatar);

    // El mapa necesita saber qué semilla hay elegida y poder avisar al jugador
    Conuco.Mapa.iniciar({ obtenerSeleccion: () => seleccion, mostrar, toast, abrirPanel });

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
        Conuco.Mapa.reubicar();
        toast('Partida reiniciada. ¡A sembrar!', 'ok');
      }
    });

    S.suscribir(renderTodo); // cualquier cambio de estado redibuja los paneles
    cambiarTab(tabActiva);
    renderTodo();
  }

  /** Llamado cada segundo desde main.js: lo único que cambia solo con el tiempo es "Cosechar todo". */
  function tick() {
    actualizarBotones();
  }

  Conuco.UI = { iniciar, tick, toast };
})(typeof window !== 'undefined' ? window : globalThis);
