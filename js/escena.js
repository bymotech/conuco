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
  const PPT = Conuco.CONFIG.PARCELAS_POR_TERRENO;

  // Texto primero y emojis como respaldo: si la fuente de emojis va primera, algunos navegadores
  // dibujan también los dígitos con ella y quedan con un espaciado raro.
  const FUENTE = 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"';

  // Dónde crecen las plantas dentro de la parcela de 2x2 casillas (en casillas, por eje).
  // Los rubros grandes llevan menos plantas para que no se amontonen.
  const siembra = (c) => (S.FORMAS_GRANDES.has(c.forma) ? [0.6, 1.4] : [0.4, 1, 1.6]);

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
        pildora(ctx, `${alcanza ? '🔓' : '🔒'} ${costo.toLocaleString('es-VE')}`, alcanza ? 'rgba(47,107,31,0.88)' : 'rgba(50,40,30,0.72)', '#fff', 10);
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
        ctx.fillText(POR_ID[o.seleccion] ? POR_ID[o.seleccion].emoji : '', 0, 0);
      });
    }
  }

  function etiquetaEdificio(ctx, e, z) {
    const c = Iso.aPantalla(e.x + e.w / 2, e.y + e.d / 2);
    enPantalla(ctx, c.x, c.y - e.alto - 12, z, () => pildora(ctx, e.etiqueta, 'rgba(60,40,15,0.85)', '#fff', 12));
  }

  function etiquetaTerreno(ctx, t, o) {
    const c = Iso.centroTerreno(t);
    const p = Iso.aPantalla(c.tx, c.ty);
    const info = G.puedeComprarTerreno(t, o.estado);
    const precio = 'Bs ' + info.costo.toLocaleString('es-VE');
    enPantalla(ctx, p.x, p.y - 62, o.cam.zoom, () => {
      if (info.ok) pildora(ctx, `🔓 Comprar terreno · ${precio}`, 'rgba(47,107,31,0.95)', '#fff', 13);
      else if (info.razon === 'dinero') pildora(ctx, `🔒 Terreno · ${precio}`, 'rgba(50,40,30,0.85)', '#fff', 12);
      else pildora(ctx, '🔒 Terreno', 'rgba(50,40,30,0.7)', '#e9dcc4', 11);
    });
  }

  // ---------- Cuadro completo ----------

  /**
   * @param o { w, h, dpr, cam:{x,y,zoom}, estado, ahora(ms), hover:{tx,ty,parcela}|null,
   *            avatar:{x,y,dir,frente,caminando,salto}|null, marcador, particulas, seleccion,
   *            fauna:[{tipo,x,y,dir,caminando,comiendo}], aves:[{tipo,x,y,alto,dir,sem}] }
   */
  function dibujar(ctx, o) {
    const { w, h, dpr, cam, estado, ahora } = o;
    const z = cam.zoom;
    const t = ahora / 1000;
    const mapa = Iso.mapa();
    const zona = mapa.zona;

    // 1. fondo
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fondo = ctx.createLinearGradient(0, 0, 0, h);
    fondo.addColorStop(0, zona.fondo[0]); fondo.addColorStop(1, zona.fondo[1]);
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, w, h);

    // cámara: el centro de la pantalla mira a (cam.x, cam.y) del mundo
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 - cam.x * z), dpr * (h / 2 - cam.y * z));
    // parte visible del mundo (para no dibujar lo que queda fuera)
    const vx0 = cam.x - w / 2 / z - 90, vx1 = cam.x + w / 2 / z + 90;
    const vy0 = cam.y - h / 2 / z - 40, vy1 = cam.y + h / 2 / z + 140;
    const visible = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;

    // 2. suelo
    S.fondoZona(ctx, zona, t);
    S.isla(ctx, zona);
    const detalle = z > 0.45;
    for (let ty = 0; ty < M.ALTO; ty++) {
      for (let tx = 0; tx < M.ANCHO; tx++) {
        const p = Iso.aPantalla(tx + 0.5, ty + 0.5);
        if (p.x < vx0 || p.x > vx1 || p.y < vy0 - 40 || p.y > vy1 - 100) continue;
        const tipo = Iso.tipoSuelo(tx, ty);
        S.sueloTile(ctx, tx, ty, tipo === 'parcela' ? 'pasto' : tipo, zona, detalle);
      }
    }
    for (const lg of mapa.lagunas) S.laguna(ctx, lg, t);

    // 3. canteros (en terrenos ajenos se ven enmalezados)
    estado.parcelas.forEach((p, i) => {
      const propio = Iso.terrenoComprado(Iso.terrenoDeParcela(i));
      S.parcelaSuelo(ctx, i, !p.desbloqueada, zona);
      if (propio && !p.desbloqueada) S.parcelaBloqueadaBorde(ctx, i);
    });

    // 4. velo sobre los terrenos que no son tuyos
    const ajenos = [];
    for (let k = 0; k < estado.terrenos.length; k++) if (!estado.terrenos[k]) { ajenos.push(k); S.terrenoVelo(ctx, k); }

    // 5. resaltes
    if (o.hover && !o.construir) {
      if (o.hover.parcela >= 0 && Iso.terrenoComprado(Iso.terrenoDe(o.hover.tx, o.hover.ty))) S.parcelaResalte(ctx, o.hover.parcela);
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

    // 6. objetos ordenados por profundidad (más lejos primero)
    const objs = [];
    const agregar = (tx, ty, prof, f) => { const p = Iso.aPantalla(tx, ty); if (visible(p.x, p.y)) objs.push({ prof, f }); };
    for (const e of Iso.graneros()) agregar(e.x + 1, e.y + 1, e.x + e.y + 2, () => S.edificio(ctx, e, t));
    for (const e of mapa.edificios) agregar(e.x + e.w / 2, e.y + e.d / 2, e.x + e.w / 2 + e.y + e.d / 2, () => S.edificio(ctx, e, t));
    for (const a of mapa.arboles) agregar(a.x + 0.5, a.y + 0.5, a.x + a.y + 1, () => S.arbol(ctx, a, t));
    for (const k of ajenos) {
      const c = Iso.centroTerreno(k);
      const p = Iso.aPantalla(c.tx, c.ty);
      agregar(c.tx, c.ty, c.tx + c.ty, () => S.letrero(ctx, p.x, p.y));
    }
    estado.parcelas.forEach((p, i) => {
      if (!p.desbloqueada || !p.cultivo) return;
      const info = G.estadoParcela(p, ahora);
      const lista = info.tipo === 'lista';
      const o0 = Iso.parcelaOrigen(i);
      const pos = siembra(info.cultivo);
      for (const a of pos) {
        for (const b of pos) {
          const tx = o0.x + a, ty = o0.y + b;
          const pp = Iso.aPantalla(tx, ty);
          const sem = Iso.hash(tx, ty, 4);
          agregar(tx, ty, tx + ty, () => S.planta(ctx, info.cultivo, pp.x, pp.y, info.pct, lista, t, sem));
        }
      }
    });
    for (const a of o.fauna || []) {
      const pp = Iso.aPantalla(a.x, a.y);
      agregar(a.x, a.y, a.x + a.y, () => S.animal(ctx, a.tipo, pp.x, pp.y, { dir: a.dir, t: t + a.sem * 10, caminando: a.caminando, comiendo: a.comiendo }));
    }
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

    // vista previa de lo que se está construyendo
    if (o.construir && o.construir.x != null) S.fantasma(ctx, o.construir.tipo, o.construir.x, o.construir.y, o.construir.valido, t);

    // 7. aves en vuelo
    for (const b of o.aves || []) {
      const p = Iso.aPantalla(b.x, b.y);
      if (visible(p.x, p.y - b.alto)) S.ave(ctx, b.tipo, p.x, p.y - b.alto, t, b.dir, b.sem);
    }

    // 8. etiquetas y partículas (tamaño constante en pantalla)
    estado.parcelas.forEach((p, i) => {
      if (i >= PPT && !p.desbloqueada) return; // las de terrenos ajenos llevan el letrero del terreno
      const c = centroParcela(i);
      if (visible(c.x, c.y)) etiquetaParcela(ctx, i, p, o);
    });
    for (const e of mapa.edificios) if (e.etiqueta) etiquetaEdificio(ctx, e, z);
    for (const k of ajenos) etiquetaTerreno(ctx, k, o);
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
