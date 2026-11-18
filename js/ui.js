/**
 * ui.js — Interfaz que flota sobre el mapa: barra de arriba, botones, selector de semillas,
 * panel de tienda/mercado, configuración guiada (personaje, nombre y zona), confirmaciones,
 * avisos y la celebración al subir de nivel.
 *
 * - Las listas se redibujan solo cuando cambia el estado.
 * - Todo el texto que entra en innerHTML viene de config.js. Lo que escribe el jugador
 *   (su nombre) solo se inserta con textContent / value, nunca como HTML.
 */
(function (global) {
  'use strict';
  const Conuco = global.Conuco;
  const { CULTIVOS_POR_ID: POR_ID, ETNIAS, ZONAS, ZONAS_POR_ID } = Conuco;
  const S = Conuco.State;
  const G = Conuco.Game;
  const doc = global.document;

  // ---------- Formato ----------
  const fmtBs = (n) => 'Bs ' + Math.floor(n).toLocaleString('es-VE');

  function fmtDuracion(ms) {
    const t = Math.round(ms / 1000);
    if (t < 60) return t + ' s';
    const m = Math.floor(t / 60);
    return m + ' min' + (t % 60 ? ' ' + (t % 60) + ' s' : '');
  }

  // ---------- Estado de la interfaz (no se guarda) ----------
  let seleccion = null;        // id de la semilla elegida para sembrar
  let tabActiva = 'semillas';
  let el = {};
  let nivelVisto = null;       // para detectar cuándo se sube de nivel
  let dineroVisto = null;
  let avatarDibujado = '';
  // configuración guiada
  let asis = { paso: 1, etnia: null, zona: null, soloPersonaje: false };
  let alConfirmar = null;

  const $ = (id) => doc.getElementById(id);
  const setTexto = (nodo, t) => { if (nodo.textContent !== t) nodo.textContent = t; };

  // ---------- Avisos ----------
  function toast(mensaje, tipo = 'info') {
    const t = doc.createElement('div');
    t.className = 'toast ' + tipo;
    t.textContent = mensaje;
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('fuera'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  function mostrar(res) {
    if (!res) return;
    toast(res.mensaje, res.ok ? 'ok' : 'error');
  }

  // ---------- Barra de arriba ----------
  function dibujarMiniAvatar(etnia) {
    const c = el.miniAvatar, ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (etnia) Conuco.Sprites.avatar(ctx, etnia, 48, 150, { escala: 2.6, frente: true, dir: 1 });
  }

  function renderHud() {
    const s = S.get();
    const p = G.progresoNivel(s.xp);
    const dinero = Math.floor(s.dinero);
    setTexto(el.dinero, dinero.toLocaleString('es-VE'));
    if (dineroVisto !== null && dinero > dineroVisto) {
      el.cajaDinero.classList.remove('sube'); void el.cajaDinero.offsetWidth; el.cajaDinero.classList.add('sube');
    }
    dineroVisto = dinero;
    setTexto(el.nivel, String(p.nivel));
    el.xpBarra.style.width = Math.round(p.pct * 100) + '%';
    setTexto(el.xpTexto, `${p.actual} / ${p.necesario} XP`);
    setTexto(el.hudNombre, s.jugador.nombre || 'Conuquero');
    const z = ZONAS_POR_ID[s.zona];
    setTexto(el.hudZona, z ? `· ${z.emoji} ${z.nombre}` : '');
    if (avatarDibujado !== (s.jugador.etnia || '')) {
      avatarDibujado = s.jugador.etnia || '';
      dibujarMiniAvatar(s.jugador.etnia);
    }
    const cosecha = Object.values(s.cosechas).reduce((a, b) => a + b, 0);
    el.badgeCosecha.hidden = !cosecha;
    setTexto(el.badgeCosecha, String(cosecha));
  }

  // ---------- Selector de semillas ----------
  /** Rubros de la zona + cualquier otro del que tenga semillas (p. ej. de una partida vieja). */
  function rubrosVisibles(s) {
    const lista = G.cultivosDisponibles(s).slice();
    for (const id of Object.keys(s.semillas)) if (!lista.some((c) => c.id === id)) lista.push(POR_ID[id]);
    return lista;
  }

  function renderSeedbar() {
    const s = S.get();
    const nivel = G.nivelDeXp(s.xp);
    const lista = rubrosVisibles(s);
    // Si la semilla elegida ya no sirve (se acabó, o es de otro nivel), pasa a la primera que tenga.
    if (!seleccion || !POR_ID[seleccion] || POR_ID[seleccion].nivelReq > nivel || !(s.semillas[seleccion] > 0)) {
      const primera = lista.find((c) => c.nivelReq <= nivel && (s.semillas[c.id] || 0) > 0);
      seleccion = primera ? primera.id : null;
    }
    el.seedbar.innerHTML = lista.map((c) => {
      const n = s.semillas[c.id] || 0;
      const bloq = c.nivelReq > nivel;
      const cls = ['chip', c.id === seleccion ? 'sel' : '', n === 0 ? 'sin' : '', bloq ? 'nivel-bloq' : ''].join(' ').trim();
      const texto = bloq ? `🔒${c.nivelReq}` : `×${n}`;
      return `<button type="button" class="${cls}" data-id="${c.id}" title="${c.nombre}" aria-pressed="${c.id === seleccion}">${c.emoji} <b>${texto}</b></button>`;
    }).join('');
  }

  // ---------- Panel: tienda de semillas ----------
  function renderSemillas() {
    const s = S.get();
    const nivel = G.nivelDeXp(s.xp);
    const z = ZONAS_POR_ID[s.zona];
    const cab = z ? `<div class="vacio" style="padding:4px 0 2px">Semillas de ${z.emoji} ${z.nombre}</div>` : '';
    el.panelSemillas.innerHTML = cab + G.cultivosDisponibles(s).map((c) => {
      const bloq = c.nivelReq > nivel;
      const tengo = s.semillas[c.id] || 0;
      const det = bloq
        ? `Se desbloquea en el nivel ${c.nivelReq}`
        : `Crece en ${fmtDuracion(c.tiempoMs)} · da ${c.rendimiento} · se vende a ${fmtBs(c.precioVenta)} c/u · tienes ${tengo}`;
      const acciones = bloq ? '' : `
        <div class="acciones">
          <button class="btn" type="button" data-accion="comprar" data-id="${c.id}" data-n="1" ${s.dinero < c.costoSemilla ? 'disabled' : ''}>×1 · ${fmtBs(c.costoSemilla)}</button>
          <button class="btn" type="button" data-accion="comprar" data-id="${c.id}" data-n="5" ${s.dinero < c.costoSemilla * 5 ? 'disabled' : ''}>×5 · ${fmtBs(c.costoSemilla * 5)}</button>
          <button class="btn" type="button" data-accion="comprar" data-id="${c.id}" data-n="10" ${s.dinero < c.costoSemilla * 10 ? 'disabled' : ''}>×10 · ${fmtBs(c.costoSemilla * 10)}</button>
        </div>`;
      return `<div class="fila ${bloq ? 'bloq' : ''}">
        <span class="em">${bloq ? '🔒' : c.emoji}</span>
        <div><div class="nombre">${c.nombre}</div><div class="det">${det}</div></div>
        ${acciones}
      </div>`;
    }).join('');
  }

  // ---------- Panel: venta de cosecha ----------
  function renderCosecha() {
    const s = S.get();
    const filas = Object.keys(s.cosechas).map((id) => POR_ID[id]).filter(Boolean);
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
    el.panelCosecha.innerHTML = `<button class="btn btn-primary total" type="button" data-accion="vender-todo">💰 Vender toda la cosecha (${fmtBs(total)})</button>` + html;
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

  /** Abre el panel en una pestaña (lo usa también el mapa al llegar a la choza o al puesto). */
  function abrirPanel(nombre) {
    cambiarTab(nombre);
    el.panel.hidden = false;
  }
  const cerrarPanel = () => { el.panel.hidden = true; };

  function actualizarBotones() {
    const listas = G.contarListas();
    el.btnCosecharTodo.disabled = listas === 0;
    el.badgeListas.hidden = !listas;
    setTexto(el.badgeListas, String(listas));
    el.aviso.hidden = S.esPersistente();
  }

  // ---------- Subir de nivel ----------
  function revisarNivel() {
    const s = S.get();
    const nivel = G.nivelDeXp(s.xp);
    if (nivelVisto !== null && nivel > nivelVisto && s.zona) {
      const nuevos = G.cultivosDisponibles(s).filter((c) => c.nivelReq > nivelVisto && c.nivelReq <= nivel);
      const texto = nuevos.length
        ? `Desbloqueaste: ${nuevos.map((c) => c.emoji + ' ' + c.nombre).join(', ')}. ¡Búscalo en la tienda de semillas!`
        : '¡Tu conuco crece! Sigue sembrando y compra más tierra.';
      Conuco.Fiesta.celebrar(`¡Nivel ${nivel}!`, texto);
    }
    nivelVisto = nivel;
  }

  // ---------- Confirmaciones ----------
  function confirmar({ icono, titulo, texto, si }, fn) {
    setTexto(el.confIcono, icono || '❓');
    setTexto(el.confTitulo, titulo);
    setTexto(el.confTexto, texto);
    setTexto(el.confSi, si || 'Sí');
    alConfirmar = fn;
    el.confirmar.hidden = false;
    el.confSi.focus();
  }

  /** Al tocar un terreno ajeno en el mapa. */
  function comprarTerreno(t) {
    const s = S.get();
    const info = G.puedeComprarTerreno(t, s);
    if (info.razon === 'lejos') return toast('Primero compra un terreno vecino a este 🗺️', 'error');
    if (info.razon === 'dinero') return toast(`Este terreno cuesta ${fmtBs(info.costo)}. Te faltan ${fmtBs(info.costo - s.dinero)}.`, 'error');
    if (!info.ok) return;
    confirmar({
      icono: '🏞️',
      titulo: '¿Comprar este terreno?',
      texto: `Cuesta ${fmtBs(info.costo)} y trae ${Conuco.CONFIG.PARCELAS_POR_TERRENO} parcelas listas para sembrar, más espacio para caminar.`,
      si: `Comprar · ${fmtBs(info.costo)}`,
    }, () => {
      const res = G.comprarTerreno(t);
      mostrar(res);
      if (res.ok) {
        const c = Conuco.Iso.centroTerreno(t);
        const p = Conuco.Mapa.pantallaDeTile(c.tx, c.ty);
        Conuco.Fiesta.confeti(120, p);
        Conuco.Mapa.particula('🏞️ ¡Tuyo!', c.tx, c.ty);
      }
    });
  }

  // ---------- Configuración guiada ----------
  function irAPaso(n) {
    asis.paso = n;
    el.asistente.querySelectorAll('.paso').forEach((p) => { p.hidden = Number(p.dataset.paso) !== n; });
    el.puntos.forEach((p, i) => p.classList.toggle('activo', i === n - 1));
    el.puntosCaja.hidden = asis.soloPersonaje;
    marcarOpciones();
  }

  function marcarOpciones() {
    el.opcionesAvatar.forEach((b) => {
      const sel = b.dataset.etnia === asis.etnia;
      b.classList.toggle('sel', sel);
      b.setAttribute('aria-pressed', String(sel));
    });
    el.asistente.querySelectorAll('.opcion-zona').forEach((b) => {
      const sel = b.dataset.zona === asis.zona;
      b.classList.toggle('sel', sel);
      b.setAttribute('aria-pressed', String(sel));
    });
    el.btnSiguiente2.disabled = !asis.etnia;
    el.btnComenzar.disabled = !asis.etnia || !asis.zona;
  }

  /** Muñecos animados de la pantalla de personaje (el elegido camina en el lugar). */
  function animarPrevias(ms) {
    if (el.asistente.hidden) return;
    if (asis.paso === 2) {
      el.opcionesAvatar.forEach((b) => {
        const c = b.querySelector('canvas');
        const ctx = c.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        const elegido = b.dataset.etnia === asis.etnia;
        Conuco.Sprites.elipse(ctx, 140, 300, 86, 26, 'rgba(0,0,0,0.1)');
        Conuco.Sprites.avatar(ctx, b.dataset.etnia, 140, 296, { escala: 4.6, frente: true, dir: 1, caminando: elegido, t: ms / 1000 });
      });
    }
    global.requestAnimationFrame(animarPrevias);
  }

  /** soloPersonaje = true: solo cambia personaje y nombre (desde el menú). */
  function abrirAsistente(soloPersonaje) {
    const s = S.get();
    asis = { paso: 1, etnia: s.jugador.etnia, zona: s.zona, soloPersonaje: !!soloPersonaje };
    el.nombreJugador.value = s.jugador.nombre;
    el.btnAtras2.hidden = false;
    el.btnAtras2.textContent = soloPersonaje ? 'Cancelar' : '← Atrás';
    el.btnSiguiente2.textContent = soloPersonaje ? 'Guardar' : 'Siguiente →';
    const yaEstaba = !el.asistente.hidden;
    el.asistente.hidden = false;
    // Si ya tiene personaje pero le falta la zona (partida vieja), empieza en la zona.
    irAPaso(soloPersonaje ? 2 : (s.jugador.etnia && !s.zona ? 3 : 1));
    if (!yaEstaba) global.requestAnimationFrame(animarPrevias);
  }

  function construirZonas() {
    el.opcionesZona.innerHTML = ZONAS.map((z) => `
      <button type="button" class="opcion-zona" data-zona="${z.id}" aria-pressed="false">
        <span class="zona-banda" style="background:linear-gradient(135deg, ${z.fondo[0]}, ${z.fondo[1]})">${z.emoji}</span>
        <span class="zona-cuerpo">
          <b>${z.nombre}</b>
          <span class="estados">${z.estados}</span>
          <p>${z.descripcion}</p>
          <span class="rubros" title="Cultivos">${Conuco.cultivosDeZona(z.id).map((c) => c.emoji).join(' ')}</span>
          <span class="fauna">${z.fauna}</span>
        </span>
      </button>`).join('');
  }

  function terminarAsistente() {
    const s = S.get();
    const nombre = el.nombreJugador.value;
    if (asis.soloPersonaje) {
      mostrar(G.elegirAvatar(asis.etnia, nombre));
      el.asistente.hidden = true;
      return;
    }
    const cambiaZona = s.zona !== asis.zona;
    const res = G.configurarPartida(asis.etnia, nombre, asis.zona);
    if (!res.ok) return mostrar(res);
    el.asistente.hidden = true;
    if (cambiaZona) Conuco.Mapa.reubicar();
    mostrar(res);
    Conuco.Fiesta.confeti(90);
  }

  function renderTodo() {
    renderHud();
    renderSeedbar();
    renderSemillas();
    renderCosecha();
    actualizarBotones();
    revisarNivel();
    const s = S.get();
    if ((!s.jugador.etnia || !s.zona) && el.asistente.hidden) abrirAsistente(false);
  }

  // ---------- Eventos ----------
  function alTocarSemilla(ev) {
    const b = ev.target.closest('.chip');
    if (!b) return;
    const c = POR_ID[b.dataset.id];
    if (c.nivelReq > G.nivelDeXp(S.get().xp)) return toast(`${c.nombre} se desbloquea en el nivel ${c.nivelReq}.`, 'error');
    if (!(S.get().semillas[c.id] > 0)) { abrirPanel('semillas'); return toast(`No tienes semillas de ${c.nombre}. Cómpralas aquí 🌱`); }
    seleccion = c.id;
    renderSeedbar();
  }

  function alTocarMercado(ev) {
    const b = ev.target.closest('[data-accion]');
    if (!b || b.disabled) return;
    const { accion, id, n } = b.dataset;
    if (accion === 'comprar') {
      const res = G.comprarSemillas(id, Number(n));
      mostrar(res);
      if (res.ok && !(S.get().semillas[seleccion] > 0)) { seleccion = id; renderSeedbar(); }
    } else if (accion === 'vender') mostrar(G.vender(id, n === 'todo' ? 'todo' : Number(n)));
    else if (accion === 'vender-todo') mostrar(G.venderTodo());
  }

  function iniciar() {
    el = {
      dinero: $('dinero'), cajaDinero: doc.querySelector('.hud-dinero'), nivel: $('nivel'),
      xpBarra: $('xp-barra'), xpTexto: $('xp-texto'), hudNombre: $('hud-nombre'), hudZona: $('hud-zona'),
      miniAvatar: $('mini-avatar'), badgeCosecha: $('badge-cosecha'), badgeListas: $('badge-listas'),
      seedbar: $('seedbar'), btnCosecharTodo: $('btn-cosechar-todo'),
      btnTienda: $('btn-tienda'), btnMercado: $('btn-mercado'),
      panel: $('panel'), tabSemillas: $('tab-semillas'), tabCosecha: $('tab-cosecha'),
      panelSemillas: $('panel-semillas'), panelCosecha: $('panel-cosecha'),
      toasts: $('toasts'), aviso: $('aviso-almacenamiento'),
      menu: $('menu'), btnMenu: $('btn-menu'),
      asistente: $('asistente'), nombreJugador: $('nombre-jugador'),
      btnComenzar: $('btn-comenzar'), btnSiguiente2: $('btn-siguiente-2'), btnAtras2: $('btn-atras-2'),
      opcionesAvatar: Array.from(doc.querySelectorAll('.opcion-avatar')), opcionesZona: $('opciones-zona'),
      puntosCaja: doc.querySelector('.pasos-puntos'), puntos: Array.from(doc.querySelectorAll('.pasos-puntos i')),
      confirmar: $('confirmar'), confIcono: $('confirmar-icono'), confTitulo: $('t-confirmar'),
      confTexto: $('confirmar-texto'), confSi: $('confirmar-si'), confNo: $('confirmar-no'),
    };

    // --- configuración guiada
    construirZonas();
    el.opcionesAvatar.forEach((b) => {
      const e = ETNIAS.find((x) => x.id === b.dataset.etnia);
      b.querySelector('b').textContent = e.nombre;
      b.querySelector('small').textContent = e.descripcion;
      b.addEventListener('click', () => { asis.etnia = e.id; marcarOpciones(); });
    });
    el.opcionesZona.addEventListener('click', (ev) => {
      const b = ev.target.closest('.opcion-zona');
      if (b) { asis.zona = b.dataset.zona; marcarOpciones(); }
    });
    el.asistente.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ir]');
      if (!b || b.disabled) return;
      if (asis.soloPersonaje && b === el.btnAtras2) { el.asistente.hidden = true; return; }
      if (asis.soloPersonaje && b === el.btnSiguiente2) { terminarAsistente(); return; }
      irAPaso(Number(b.dataset.ir));
    });
    el.btnComenzar.addEventListener('click', terminarAsistente);
    el.nombreJugador.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !el.btnSiguiente2.disabled) el.btnSiguiente2.click(); });

    // --- confirmación
    el.confNo.addEventListener('click', () => { el.confirmar.hidden = true; alConfirmar = null; });
    el.confSi.addEventListener('click', () => {
      el.confirmar.hidden = true;
      const fn = alConfirmar; alConfirmar = null;
      if (fn) fn();
    });

    // --- menú
    const cerrarMenu = () => { el.menu.hidden = true; el.btnMenu.setAttribute('aria-expanded', 'false'); };
    el.btnMenu.addEventListener('click', (ev) => {
      ev.stopPropagation();
      el.menu.hidden = !el.menu.hidden;
      el.btnMenu.setAttribute('aria-expanded', String(!el.menu.hidden));
    });
    doc.addEventListener('pointerdown', (ev) => { if (!el.menu.hidden && !ev.target.closest('#menu, #btn-menu')) cerrarMenu(); });
    $('btn-cambiar-avatar').addEventListener('click', () => { cerrarMenu(); abrirAsistente(true); });
    $('btn-ver-guia').addEventListener('click', () => { cerrarMenu(); cerrarPanel(); Conuco.Guia.repasar(); });
    $('btn-reiniciar').addEventListener('click', () => {
      cerrarMenu();
      confirmar({
        icono: '🗑️', titulo: '¿Empezar de cero?',
        texto: 'Se borra tu conuco, tu dinero y tu nivel. Podrás elegir otro personaje y otra zona.',
        si: 'Sí, reiniciar',
      }, () => {
        seleccion = null; nivelVisto = null; dineroVisto = null;
        S.reiniciar();
        Conuco.Mapa.reubicar();
      });
    });

    // --- mapa (necesita saber qué semilla hay elegida y poder avisar al jugador)
    Conuco.Mapa.iniciar({
      obtenerSeleccion: () => seleccion, mostrar, toast, abrirPanel, comprarTerreno,
      alCuadro: () => Conuco.Guia.alCuadro(),
    });
    Conuco.Guia.iniciar({
      ocultaPor: () => !el.asistente.hidden || !el.confirmar.hidden || !$('fiesta-tarjeta').hidden || !el.panel.hidden,
    });

    // --- panel y botones
    el.seedbar.addEventListener('click', alTocarSemilla);
    el.panelSemillas.addEventListener('click', alTocarMercado);
    el.panelCosecha.addEventListener('click', alTocarMercado);
    el.btnTienda.addEventListener('click', () => (el.panel.hidden || tabActiva !== 'semillas' ? abrirPanel('semillas') : cerrarPanel()));
    el.btnMercado.addEventListener('click', () => (el.panel.hidden || tabActiva !== 'cosecha' ? abrirPanel('cosecha') : cerrarPanel()));
    $('btn-cerrar-panel').addEventListener('click', cerrarPanel);
    el.btnCosecharTodo.addEventListener('click', () => mostrar(G.cosecharTodo()));
    el.tabSemillas.addEventListener('click', () => cambiarTab('semillas'));
    el.tabCosecha.addEventListener('click', () => cambiarTab('cosecha'));
    doc.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      if (!el.confirmar.hidden) el.confNo.click();
      else if (!el.panel.hidden) cerrarPanel();
      else cerrarMenu();
    });

    S.suscribir(renderTodo); // cualquier cambio de estado redibuja la interfaz
    cambiarTab(tabActiva);
    renderTodo();
  }

  /** Llamado cada segundo desde main.js: lo que cambia solo con el tiempo. */
  function tick() {
    actualizarBotones();
    Conuco.Guia.actualizar(); // "espera a que crezca" -> "¡ya está lista!"
  }

  Conuco.UI = { iniciar, tick, toast };
})(typeof window !== 'undefined' ? window : globalThis);
