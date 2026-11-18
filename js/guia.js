/**
 * guia.js — Burbujas que explican los primeros pasos (solo la primera vez).
 *
 * Cada paso se da por cumplido mirando las estadísticas de la partida, así que la guía
 * avanza sola cuando el jugador hace lo que se le pide y desaparece al terminar.
 * La burbuja sigue al lugar del mapa del que habla (una parcela, el mercado...).
 */
(function (global) {
  'use strict';
  const Conuco = global.Conuco;
  const S = Conuco.State;
  const G = Conuco.Game;
  const Iso = Conuco.Iso;
  const doc = global.document;
  const PPT = Conuco.CONFIG.PARCELAS_POR_TERRENO;

  let el = {};
  let repaso = -1;        // >= 0: el jugador pidió ver la guía otra vez (paso a paso, con botón)
  let pasoActual = null;
  let ocultaPor = () => false;

  const centroParcela = (i) => { const o = Iso.parcelaOrigen(i); return { tx: o.x + 1, ty: o.y + 1, alto: 30 }; };
  const centroEdificio = (accion) => {
    const e = Iso.edificioPorAccion(accion);
    return e ? { tx: e.x + e.w / 2, ty: e.y + e.d / 2, alto: e.alto } : null;
  };

  function primeraParcela(s, filtro) {
    for (let i = 0; i < s.parcelas.length; i++) if (filtro(s.parcelas[i], i)) return i;
    return -1;
  }

  const PASOS = [
    {
      id: 'sembrar',
      hecho: (s) => s.estadisticas.sembradas > 0,
      texto: (s) => {
        const c = G.cultivosDisponibles(s)[0];
        return `👆 Toca una parcela de tierra para sembrar ${c.nombre} ${c.emoji}. Tu personaje caminará hasta ella.`;
      },
      ancla: (s) => {
        const i = primeraParcela(s, (p) => p.desbloqueada && !p.cultivo);
        return i >= 0 ? centroParcela(i) : null;
      },
    },
    {
      id: 'cosechar',
      hecho: (s) => s.estadisticas.cosechadas > 0,
      texto: (s) => (primeraParcela(s, (p) => G.estadoParcela(p).tipo === 'lista') >= 0
        ? '🧺 ¡Ya está lista! Toca la parcela de la burbuja para cosechar.'
        : '🌱 ¡Muy bien! El reloj muestra cuánto falta. Cuando aparezca la burbuja con el fruto, tócala para cosechar.'),
      ancla: (s) => {
        let i = primeraParcela(s, (p) => G.estadoParcela(p).tipo === 'lista');
        if (i < 0) i = primeraParcela(s, (p) => !!p.cultivo);
        return i >= 0 ? centroParcela(i) : null;
      },
    },
    {
      id: 'vender',
      hecho: (s) => s.estadisticas.vendidas > 0,
      texto: () => '💰 Lleva tu cosecha al puesto del Mercado y véndela para ganar bolívares.',
      ancla: () => centroEdificio('mercado'),
      boton: 'btn-mercado',
    },
    {
      id: 'comprar',
      hecho: (s) => s.estadisticas.semillasCompradas > 0,
      texto: () => '🌱 Con esa plata compra más semillas en la choza de Semillas.',
      ancla: () => centroEdificio('semillas'),
      boton: 'btn-tienda',
    },
    {
      id: 'expandir',
      hecho: () => false,
      final: true,
      texto: () => '🎉 ¡Ya sabes lo básico! Junta bolívares para abrir parcelas 🔓 y comprar los terrenos de alrededor. Cada nivel desbloquea rubros nuevos.',
      ancla: (s) => {
        const i = primeraParcela(s, (p, k) => k < PPT && !p.desbloqueada);
        if (i >= 0) return centroParcela(i);
        const t = s.terrenos.findIndex((v, k) => !v && G.puedeComprarTerreno(k, s).razon !== 'lejos');
        if (t < 0) return null;
        const c = Iso.centroTerreno(t);
        return { tx: c.tx, ty: c.ty, alto: 60 };
      },
    },
  ];

  function paso(s) {
    if (repaso >= 0) return PASOS[repaso];
    if (!s.jugador.etnia || !s.zona || s.tutorial.hecho) return null;
    return PASOS.find((p) => !p.hecho(s)) || null;
  }

  function terminar() {
    repaso = -1;
    if (!S.get().tutorial.hecho) G.terminarTutorial();
    actualizar();
  }

  /** Llamado cuando cambia el estado: elige el paso y su texto. */
  function actualizar() {
    const s = S.get();
    const p = paso(s);
    if (pasoActual && pasoActual.boton && (!p || p.boton !== pasoActual.boton)) {
      const b = doc.getElementById(pasoActual.boton);
      if (b) b.classList.remove('resaltar');
    }
    pasoActual = p;
    if (!p) { el.guia.hidden = true; el.pulso.hidden = true; return; }
    el.texto.textContent = p.texto(s);
    const conBoton = repaso >= 0 || p.final;
    el.ok.hidden = !conBoton;
    el.ok.textContent = repaso >= 0 && repaso < PASOS.length - 1 ? 'Siguiente →' : '¡Entendido!';
    el.saltar.hidden = repaso >= 0 || p.final;
    if (p.boton) { const b = doc.getElementById(p.boton); if (b) b.classList.add('resaltar'); }
  }

  /** Llamado en cada cuadro del mapa: coloca la burbuja sobre su lugar. */
  function alCuadro() {
    if (!pasoActual || ocultaPor()) { el.guia.hidden = true; el.pulso.hidden = true; return; }
    el.guia.hidden = false;
    const vw = global.innerWidth, vh = global.innerHeight;
    const a = pasoActual.ancla(S.get());
    const bw = el.guia.offsetWidth, bh = el.guia.offsetHeight;
    let p = a ? Conuco.Mapa.pantallaDeTile(a.tx, a.ty) : null;
    const fuera = !p || p.x < 20 || p.x > vw - 20 || p.y < 90 || p.y > vh - 60;
    if (fuera) { // abajo al centro, sin flecha
      el.guia.classList.add('sin-flecha');
      el.guia.style.transform = `translate(${Math.round((vw - bw) / 2)}px, ${Math.round(vh - bh - 90)}px)`;
      el.pulso.hidden = true;
      return;
    }
    el.pulso.hidden = false;
    el.pulso.style.left = p.x + 'px';
    el.pulso.style.top = p.y + 'px';
    const arriba = p.y - (a.alto || 30) - 26 - bh;
    const x = Math.max(10, Math.min(vw - bw - 70, p.x - bw / 2));
    const y = Math.max(70, arriba);
    el.guia.classList.toggle('sin-flecha', y !== arriba);
    el.guia.style.setProperty('--flecha', Math.max(18, Math.min(bw - 18, p.x - x)) + 'px');
    el.guia.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  function iniciar(opciones = {}) {
    el = {
      guia: doc.getElementById('guia'), texto: doc.getElementById('guia-texto'),
      ok: doc.getElementById('guia-ok'), saltar: doc.getElementById('guia-saltar'),
      pulso: doc.getElementById('guia-pulso'),
    };
    if (opciones.ocultaPor) ocultaPor = opciones.ocultaPor;
    el.saltar.addEventListener('click', terminar);
    el.ok.addEventListener('click', () => {
      if (repaso >= 0 && repaso < PASOS.length - 1) { repaso += 1; actualizar(); }
      else terminar();
    });
    S.suscribir(actualizar);
    actualizar();
  }

  /** Muestra la guía otra vez, paso a paso. */
  function repasar() {
    repaso = 0;
    actualizar();
  }

  Conuco.Guia = { iniciar, alCuadro, repasar, actualizar };
})(window);
