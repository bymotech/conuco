/**
 * escena.js — Compone y dibuja un cuadro completo del mapa isométrico.
 *
 * Orden de dibujo (algoritmo del pintor):
 *   1. fondo  2. isla y casillas del suelo  3. canteros de las parcelas
 *   4. resaltes  5. objetos ordenados por profundidad (edificios, árboles, plantas, jugador)
 *   6. etiquetas y partículas (tamaño constante en pantalla, sin importar el zoom)
 */
(function (global) {
  'use strict';
  const Conuco = (global.Conuco = global.Conuco || {});
  const Iso = Conuco.Iso;
  const S = Conuco.Sprites;
  const G = Conuco.Game;
  const M = Conuco.MAPA;
  const POR_ID = Conuco.CULTIVOS_POR_ID;

  // Texto primero y emojis como respaldo: si la fuente de emojis va primera, algunos navegadores
  // dibujan también los dígitos con ella y quedan con un espaciado raro.
  const FUENTE = 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"';

  // Dónde crecen las plantas dentro de la parcela de 2x2 casillas (en casillas, por eje).
  // Los rubros grandes llevan menos plantas para que no se amontonen.
  const SIEMBRA = {
    maiz: [0.4, 1, 1.6], caraota: [0.4, 1, 1.6],
    yuca: [0.6, 1.4], platano: [0.6, 1.4], cacao: [0.6, 1.4], cafe: [0.6, 1.4],
  };

  // ---------- Etiquetas de tamaño constante ----------

  function enPantalla(ctx, wx, wy, zoom, fn) {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.scale(1 / zoom, 1 / zoom);
    fn();
    ctx.restore();
  }

  /** Cápsula con texto centrada en (0,0) (coordenadas de pantalla). */
  function pildora(ctx, texto, fondo, color = '#fff', tam = 12) {
    ctx.font = `700 ${tam}px ${FUENTE}`;
    const w = ctx.measureText(texto).width + 16, h = tam + 9;
    S.rr(ctx, -w / 2, -h / 2, w, h, h / 2, fondo);
    ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, 0, 0.5);
    return { w, h };
  }

  const centroParcela = (i) => {
    const o = Iso.parcelaOrigen(i);
    return Iso.aPantalla(o.x + M.PARCELA_TAM / 2, o.y + M.PARCELA_TAM / 2);
  };

  function etiquetaParcela(ctx, i, p, o) {
    const c = centroParcela(i);
    const z = o.cam.zoom;
    const info = G.estadoParcela(p, o.ahora);
    const t = o.ahora / 1000;

    if (info.tipo === 'bloqueada') {
      const costo = G.costoParcela(o.estado);
      const alcanza = o.estado.dinero >= costo;
      enPantalla(ctx, c.x, c.y - 4, z, () => {
        pildora(ctx, `${alcanza ? '🔓' : '🔒'} Bs ${costo.toLocaleString('es-VE')}`, alcanza ? 'rgba(47,107,31,0.92)' : 'rgba(50,40,30,0.82)');
      });
    } else if (info.tipo === 'creciendo') {
      const seg = Math.ceil(info.restanteMs / 1000);
      const texto = Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
      enPantalla(ctx, c.x, c.y - 10, z, () => {
        const { w, h } = pildora(ctx, texto, 'rgba(40,30,20,0.78)', '#fff', 11);
        S.rr(ctx, -w / 2 + 6, h / 2 - 5, w - 12, 3, 1.5, 'rgba(255,255,255,0.25)');
        S.rr(ctx, -w / 2 + 6, h / 2 - 5, Math.max(2, (w - 12) * info.pct), 3, 1.5, '#8ee05a');
      });
    } else if (info.tipo === 'lista') {
      const rebote = Math.abs(Math.sin(t * 4 + i)) * 7;
      enPantalla(ctx, c.x, c.y - 34 - rebote, z, () => {
        ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#f7c500'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-5, 15); ctx.lineTo(0, 22); ctx.lineTo(5, 15); ctx.closePath();
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.font = `20px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(info.cultivo.emoji, 0, 1);
      });
    } else if (o.hover && o.hover.parcela === i && o.seleccion) { // parcela vacía bajo el cursor
      enPantalla(ctx, c.x, c.y - 12, z, () => {
        ctx.globalAlpha = 0.75; ctx.font = `26px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(POR_ID[o.seleccion].emoji, 0, 0);
      });
    }
  }

  function etiquetaEdificio(ctx, e, z) {
    const c = Iso.aPantalla(e.x + e.w / 2, e.y + e.d / 2);
    enPantalla(ctx, c.x, c.y - e.alto - 12, z, () => pildora(ctx, e.etiqueta, 'rgba(60,40,15,0.85)', '#fff', 12));
  }

  // ---------- Cuadro completo ----------

  /**
   * @param o { w, h, dpr, cam:{x,y,zoom}, estado, ahora(ms), hover:{tx,ty,parcela}|null,
   *            avatar:{x,y,dir,frente,caminando,salto}|null, marcador, particulas, seleccion }
   */
  function dibujar(ctx, o) {
    const { w, h, dpr, cam, estado, ahora } = o;
    const z = cam.zoom;
    const t = ahora / 1000;

    // 1. fondo
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fondo = ctx.createLinearGradient(0, 0, 0, h);
    fondo.addColorStop(0, '#d2ecad'); fondo.addColorStop(1, '#9ed071');
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, w, h);

    // cámara: el centro de la pantalla mira a (cam.x, cam.y) del mundo
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 - cam.x * z), dpr * (h / 2 - cam.y * z));

    // 2. suelo
    S.isla(ctx);
    for (let ty = 0; ty < M.ALTO; ty++) {
      for (let tx = 0; tx < M.ANCHO; tx++) {
        S.sueloTile(ctx, tx, ty, Iso.tipoSuelo(tx, ty) === 'camino' ? 'camino' : 'pasto');
      }
    }

    // 3. canteros
    estado.parcelas.forEach((p, i) => S.parcelaSuelo(ctx, i, !p.desbloqueada));

    // 4. resaltes
    if (o.hover) {
      if (o.hover.parcela >= 0) S.parcelaResalte(ctx, o.hover.parcela);
      else if (Iso.esCaminable(o.hover.tx, o.hover.ty)) S.tileResalte(ctx, o.hover.tx, o.hover.ty);
    }
    if (o.marcador) {
      const edad = (ahora - o.marcador.t0) / 800;
      if (edad >= 0 && edad < 1) {
        const p = Iso.aPantalla(o.marcador.tx, o.marcador.ty);
        const k = 0.55 + edad * 0.45;
        ctx.globalAlpha = 1 - edad; ctx.lineWidth = 3;
        S.rombo(ctx, p.x, p.y + Iso.HH, Iso.HW * k, Iso.HH * k);
        ctx.strokeStyle = '#ffd23f'; ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // 5. objetos ordenados por profundidad (más lejos primero)
    const objs = [];
    for (const e of Iso.EDIFICIOS) objs.push({ prof: e.x + e.w / 2 + e.y + e.d / 2, f: () => S.edificio(ctx, e, t) });
    for (const a of Iso.ARBOLES) objs.push({ prof: a.x + a.y + 1, f: () => S.arbol(ctx, a, t) });
    estado.parcelas.forEach((p, i) => {
      if (!p.desbloqueada || !p.cultivo) return;
      const info = G.estadoParcela(p, ahora);
      const lista = info.tipo === 'lista';
      const o0 = Iso.parcelaOrigen(i);
      for (const a of SIEMBRA[p.cultivo]) {
        for (const b of SIEMBRA[p.cultivo]) {
          const tx = o0.x + a, ty = o0.y + b;
          const pp = Iso.aPantalla(tx, ty);
          const sem = Iso.hash(tx, ty, 4);
          objs.push({ prof: tx + ty, f: () => S.planta(ctx, p.cultivo, pp.x, pp.y, info.pct, lista, t, sem) });
        }
      }
    });
    if (o.avatar && estado.jugador.etnia) {
      const a = o.avatar;
      const pp = Iso.aPantalla(a.x, a.y);
      objs.push({
        prof: a.x + a.y,
        f: () => S.avatar(ctx, estado.jugador.etnia, pp.x, pp.y, { dir: a.dir, frente: a.frente, caminando: a.caminando, salto: a.salto, t, escala: 1.15 }),
      });
    }
    objs.sort((u, v) => u.prof - v.prof);
    for (const ob of objs) ob.f();

    // 6. etiquetas y partículas
    estado.parcelas.forEach((p, i) => etiquetaParcela(ctx, i, p, o));
    for (const e of Iso.EDIFICIOS) if (e.etiqueta) etiquetaEdificio(ctx, e, z);
    if (o.avatar && estado.jugador.etnia && estado.jugador.nombre) {
      const pp = Iso.aPantalla(o.avatar.x, o.avatar.y);
      enPantalla(ctx, pp.x, pp.y - 66, z, () => pildora(ctx, estado.jugador.nombre, 'rgba(255,255,255,0.85)', '#3b2a18', 11));
    }
    for (const q of o.particulas || []) {
      const edad = (ahora - q.t0) / 1300;
      if (edad < 0 || edad > 1) continue;
      enPantalla(ctx, q.x, q.y - edad * 48, z, () => {
        ctx.globalAlpha = 1 - edad * edad;
        ctx.font = `800 17px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,30,15,0.85)'; ctx.strokeText(q.texto, 0, 0);
        ctx.fillStyle = '#fff6c9'; ctx.fillText(q.texto, 0, 0);
      });
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  Conuco.Escena = { dibujar };
})(typeof window !== 'undefined' ? window : globalThis);
