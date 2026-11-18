/**
 * sprites.js — Todo el arte del juego, dibujado con Canvas 2D (no usa imágenes).
 *
 * Cada función recibe `ctx` ya transformado al "mundo" (píxeles proyectados), así que
 * dibuja en coordenadas del mundo. Los objetos se dibujan con el origen en el suelo
 * (los pies, la base del tronco, etc.).
 */
(function (global) {
  'use strict';
  const Conuco = (global.Conuco = global.Conuco || {});
  const Iso = Conuco.Iso;
  const M = Conuco.MAPA;
  const { HW, HH } = Iso;
  const TAU = Math.PI * 2;

  // ---------- Utilidades ----------

  const P = (tx, ty) => Iso.aPantalla(tx, ty);
  const sube = (p, h) => ({ x: p.x, y: p.y - h });
  const lerp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

  function poli(ctx, pts, relleno, trazo) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    if (trazo) { ctx.strokeStyle = trazo; ctx.stroke(); }
  }

  function rombo(ctx, cx, cy, hw, hh) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy);
    ctx.closePath();
  }

  function elipse(ctx, x, y, rx, ry, color, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function circulo(ctx, x, y, r, color) { elipse(ctx, x, y, r, r, color); }

  /** Rectángulo con esquinas redondeadas (no depende de ctx.roundRect). */
  function rr(ctx, x, y, w, h, r, color) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (color) { ctx.fillStyle = color; ctx.fill(); }
  }

  function linea(ctx, a, b, color, ancho) {
    ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  /** Hoja alargada que sale de (x,y) en dirección `ang`. */
  function hoja(ctx, x, y, ang, largo, ancho, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(largo / 2, 0, Math.max(0.01, largo / 2), Math.max(0.01, ancho / 2), 0, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // ---------- Terreno ----------

  /** Fondo del mundo según la zona: montañas detrás de la isla (Andes) o el mar alrededor (Costa). */
  function fondoZona(ctx, zona, t) {
    const W = M.ANCHO, H = M.ALTO;
    const Tp = P(0, 0), R = P(W, 0), B = P(W, H), Lp = P(0, H);
    if (zona.mar) {
      // agua clara cerca de la orilla y olas
      const m = 2.2;
      poli(ctx, [P(-m, -m), P(W + m, -m), P(W + m, H + m), P(-m, H + m)].map((p) => ({ x: p.x, y: p.y + 14 })), 'rgba(170,235,240,0.55)');
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let k = 0; k < 46; k++) {
        const u = Iso.hash(k, 3, 1), v = Iso.hash(k, 7, 2);
        const lado = k % 4;
        const d = 3 + v * 9;
        const pt = lado === 0 ? P(-d, u * H) : lado === 1 ? P(u * W, -d) : lado === 2 ? P(W + d, u * H) : P(u * W, H + d);
        const o = Math.sin(t * 1.4 + k) * 4;
        ctx.beginPath(); ctx.moveTo(pt.x - 10 + o, pt.y + 20); ctx.quadraticCurveTo(pt.x + o, pt.y + 15, pt.x + 10 + o, pt.y + 20); ctx.stroke();
      }
    }
    if (zona.montanas) {
      // cordillera detrás de los dos bordes de atrás
      const picos = [];
      for (let k = 0; k <= 12; k++) {
        const u = k / 12;
        picos.push({ p: lerp(Lp, Tp, u), h: 130 + Iso.hash(k, 1, 4) * 150, a: 120 + Iso.hash(k, 2, 4) * 90 });
        picos.push({ p: lerp(Tp, R, u), h: 130 + Iso.hash(k, 5, 4) * 150, a: 120 + Iso.hash(k, 6, 4) * 90 });
      }
      picos.sort((a, b) => b.h - a.h);
      for (const { p, h, a } of picos) {
        const base = p.y + 40, cima = { x: p.x, y: p.y - h };
        poli(ctx, [{ x: p.x - a, y: base }, cima, { x: p.x + a, y: base }], '#7d93a6');
        poli(ctx, [cima, { x: p.x + a, y: base }, { x: p.x + a * 0.15, y: base }], '#6a8095');
        const n = 0.26;
        poli(ctx, [cima, { x: p.x + a * n, y: cima.y + h * n }, { x: p.x + a * 0.08, y: cima.y + h * n * 0.8 }, { x: p.x - a * 0.1, y: cima.y + h * n * 1.05 }, { x: p.x - a * n, y: cima.y + h * n }], '#f4f7fb');
      }
    }
  }

  /** Borde de "isla" con tierra visible por los dos lados frontales. */
  function isla(ctx, zona) {
    const W = M.ANCHO, H = M.ALTO, e = 30;
    const [cIzq, cDer, cPasto] = zona.borde;
    const T = P(0, 0), R = P(W, 0), B = P(W, H), L = P(0, H);
    poli(ctx, [{ x: T.x, y: T.y + e + 10 }, { x: R.x + 6, y: R.y + e + 10 }, { x: B.x, y: B.y + e + 16 }, { x: L.x - 6, y: L.y + e + 10 }], 'rgba(30,60,30,0.16)');
    poli(ctx, [L, B, { x: B.x, y: B.y + e }, { x: L.x, y: L.y + e }], cIzq);
    poli(ctx, [B, R, { x: R.x, y: R.y + e }, { x: B.x, y: B.y + e }], cDer);
    ctx.strokeStyle = 'rgba(40,25,10,0.22)'; ctx.lineWidth = 1.5;
    for (let k = 1; k < 6; k++) {
      const yy = 6 + k * 4;
      ctx.beginPath(); ctx.moveTo(L.x, L.y + yy); ctx.lineTo(B.x, B.y + yy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(B.x, B.y + yy); ctx.lineTo(R.x, R.y + yy); ctx.stroke();
    }
    poli(ctx, [L, B, { x: B.x, y: B.y + 6 }, { x: L.x, y: L.y + 6 }], cPasto);
    poli(ctx, [B, R, { x: R.x, y: R.y + 6 }, { x: B.x, y: B.y + 6 }], cPasto);
  }

  /** Una casilla de suelo. `detalle` = dibujar matas y flores (se omite con poco zoom). */
  function sueloTile(ctx, tx, ty, tipo, zona, detalle) {
    const p = P(tx, ty);
    const cx = p.x, cy = p.y + HH;
    const h = Iso.hash(tx, ty);
    rombo(ctx, cx, cy, HW + 0.8, HH + 0.4);
    if (tipo === 'camino') {
      ctx.fillStyle = zona.id === 'occidente' ? `hsl(30, ${36 + h * 8}%, ${66 + h * 6}%)` : `hsl(34, ${42 + h * 8}%, ${61 + h * 7}%)`;
      ctx.fill();
      if (detalle && h > 0.45) {
        const ox = (Iso.hash(tx, ty, 2) - 0.5) * HW, oy = (Iso.hash(tx, ty, 3) - 0.5) * HH * 0.8;
        elipse(ctx, cx + ox, cy + oy, 3, 1.7, 'rgba(120,85,45,0.55)');
        elipse(ctx, cx + ox + 7, cy + oy + 2, 1.8, 1, 'rgba(120,85,45,0.45)');
      }
      return;
    }
    if (tipo === 'arena') {
      ctx.fillStyle = `hsl(44, ${58 + h * 8}%, ${78 + h * 5}%)`; ctx.fill();
      if (detalle && h > 0.8) elipse(ctx, cx, cy, 3, 1.6, '#f6e3d0');
      return;
    }
    if (tipo === 'agua') { ctx.fillStyle = '#4aa8c9'; ctx.fill(); return; }
    const [hue, sat, luz] = zona.pasto;
    ctx.fillStyle = `hsl(${hue + h * 10}, ${sat + h * 8}%, ${luz + h * 6}%)`;
    ctx.fill();
    if (!detalle) return;
    if (Iso.hash(tx, ty, 2) > 0.5) { // matas de pasto
      const ox = (Iso.hash(tx, ty, 3) - 0.5) * HW * 1.1, oy = (Iso.hash(tx, ty, 4) - 0.5) * HH * 0.9;
      ctx.strokeStyle = `hsla(${hue + 10}, ${sat + 10}%, ${luz - 22}%, 0.6)`; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(cx + ox + k * 2.2, cy + oy); ctx.lineTo(cx + ox + k * 3.2, cy + oy - 4.6); ctx.stroke();
      }
    }
    const f = Iso.hash(tx, ty, 5);
    if (f > 0.93) { // florecitas o piedras
      const col = zona.id === 'occidente' ? '#b9a07a' : zona.id === 'andes' ? ['#ffffff', '#c9b6e8', '#ffe066'][Math.floor(f * 100) % 3] : ['#ffffff', '#ffe066', '#ff9fb2'][Math.floor(f * 100) % 3];
      circulo(ctx, cx + (Iso.hash(tx, ty, 6) - 0.5) * HW, cy + (Iso.hash(tx, ty, 7) - 0.5) * HH * 0.7, 1.8, col);
    }
  }

  /** Laguna de 2x2 casillas con orilla, reflejos y bora. */
  function laguna(ctx, lg, t) {
    const m = 0.12;
    const A = P(lg.x + m, lg.y + m), Bq = P(lg.x + lg.w - m, lg.y + m), Cq = P(lg.x + lg.w - m, lg.y + lg.d - m), D = P(lg.x + m, lg.y + lg.d - m);
    const c = P(lg.x + lg.w / 2, lg.y + lg.d / 2);
    ctx.beginPath(); ctx.ellipse(c.x, c.y, HW * 1.7, HH * 1.7, 0, 0, TAU); ctx.fillStyle = '#c9a66b'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x, c.y + 1, HW * 1.5, HH * 1.5, 0, 0, TAU);
    const g = ctx.createLinearGradient(A.x, A.y, Cq.x, Cq.y); g.addColorStop(0, '#5dbad8'); g.addColorStop(1, '#2f86b0');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      const o = Math.sin(t * 1.2 + k * 2) * 5;
      ctx.beginPath(); ctx.moveTo(c.x - 18 + k * 12 + o, c.y - 6 + k * 6); ctx.lineTo(c.x - 8 + k * 12 + o, c.y - 6 + k * 6); ctx.stroke();
    }
    for (const [dx, dy] of [[-26, 6], [20, -4], [8, 12]]) { // hojas de bora
      elipse(ctx, c.x + dx, c.y + dy, 5, 2.6, '#5aa845');
      circulo(ctx, c.x + dx + 2, c.y + dy - 1.5, 1.4, '#d9a8e8');
    }
    void Bq; void D;
  }

  /** Esquinas (en píxeles) de la parcela `i`, con un pequeño margen hacia adentro. */
  function esquinasParcela(i, m = 0.03) {
    const o = Iso.parcelaOrigen(i);
    const a = o.x + m, b = o.y + m, c = o.x + M.PARCELA_TAM - m, d = o.y + M.PARCELA_TAM - m;
    return { T: P(a, b), R: P(c, b), B: P(c, d), L: P(a, d), x0: a, y0: b, x1: c, y1: d };
  }

  /** Cantero de tierra de una parcela (con surcos) o, si está bloqueada, terreno enmalezado. */
  function parcelaSuelo(ctx, i, bloqueada, zona) {
    const { T, R, B, L, x0, y0, x1, y1 } = esquinasParcela(i);
    const e = 4;
    poli(ctx, [L, B, { x: B.x, y: B.y + e }, { x: L.x, y: L.y + e }], bloqueada ? '#5c4d30' : '#4a2e16');
    poli(ctx, [B, R, { x: R.x, y: R.y + e }, { x: B.x, y: B.y + e }], bloqueada ? '#6e5e3b' : '#5d3a1b');
    if (bloqueada) {
      const [hue, sat, luz] = zona.pasto;
      poli(ctx, [T, R, B, L], `hsl(${hue + 6}, ${sat - 6}%, ${luz - 6}%)`);
      ctx.strokeStyle = `hsla(${hue + 10}, ${sat}%, ${luz - 26}%, 0.7)`; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      for (let k = 0; k < 9; k++) { // malezas
        const u = x0 + (x1 - x0) * (0.12 + 0.76 * Iso.hash(i, k, 1));
        const v = y0 + (y1 - y0) * (0.12 + 0.76 * Iso.hash(i, k, 2));
        const p = P(u, v);
        for (let s = -1; s <= 1; s++) {
          ctx.beginPath(); ctx.moveTo(p.x + s * 2, p.y); ctx.lineTo(p.x + s * 3.6, p.y - 6); ctx.stroke();
        }
      }
      return;
    }
    const g = ctx.createLinearGradient(T.x, T.y, B.x, B.y);
    g.addColorStop(0, '#85572f'); g.addColorStop(1, '#63401f');
    poli(ctx, [T, R, B, L], g);
    // surcos paralelos al eje ty
    ctx.lineCap = 'round';
    for (let k = 1; k <= 3; k++) {
      const u = x0 + ((x1 - x0) * k) / 4;
      const a = P(u, y0 + 0.14), b = P(u, y1 - 0.14);
      linea(ctx, a, b, 'rgba(38,20,8,0.5)', 2.6);
      linea(ctx, { x: a.x + 1.6, y: a.y - 1 }, { x: b.x + 1.6, y: b.y - 1 }, 'rgba(255,225,175,0.14)', 1.2);
    }
    ctx.lineWidth = 1.4; poli(ctx, [T, R, B, L], null, 'rgba(60,35,15,0.8)');
  }

  /** Borde punteado de un campo de parcelas bloqueadas (parcelas sueltas por comprar). */
  function parcelaBloqueadaBorde(ctx, i) {
    const { T, R, B, L } = esquinasParcela(i, 0.08);
    ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
    poli(ctx, [T, R, B, L], null, '#e9c983');
    ctx.setLineDash([]);
  }

  /** Velo oscuro sobre un terreno que aún no es tuyo, con borde punteado. */
  function terrenoVelo(ctx, t) {
    const o = Iso.origenTerreno(t), n = M.TERRENO;
    const pts = [P(o.x, o.y), P(o.x + n, o.y), P(o.x + n, o.y + n), P(o.x, o.y + n)];
    poli(ctx, pts, 'rgba(45,40,30,0.36)');
    ctx.setLineDash([10, 7]); ctx.lineWidth = 2.5;
    const q = [P(o.x + 0.15, o.y + 0.15), P(o.x + n - 0.15, o.y + 0.15), P(o.x + n - 0.15, o.y + n - 0.15), P(o.x + 0.15, o.y + n - 0.15)];
    poli(ctx, q, null, 'rgba(255,240,200,0.6)');
    ctx.setLineDash([]);
  }

  /** Letrero de madera "SE VENDE" en el centro de un terreno bloqueado. */
  function letrero(ctx, x, y) {
    elipse(ctx, x, y + 1, 12, 4, 'rgba(0,0,0,0.25)');
    linea(ctx, { x: x - 8, y }, { x: x - 8, y: y - 30 }, '#5a3a1c', 3);
    linea(ctx, { x: x + 8, y }, { x: x + 8, y: y - 30 }, '#5a3a1c', 3);
    rr(ctx, -20 + x, y - 44, 40, 20, 3, '#c8935a');
    rr(ctx, -20 + x, y - 44, 40, 4, 2, '#dcae76');
    ctx.fillStyle = '#5a3418'; ctx.font = '800 8px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SE VENDE', x, y - 33);
  }

  /** Contorno brillante para resaltar una parcela (al pasar el cursor). */
  function parcelaResalte(ctx, i) {
    const { T, R, B, L } = esquinasParcela(i, 0);
    ctx.lineWidth = 3; ctx.lineJoin = 'round';
    poli(ctx, [T, R, B, L], 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.95)');
  }

  function tileResalte(ctx, tx, ty) {
    const p = P(tx, ty);
    ctx.lineWidth = 2;
    rombo(ctx, p.x, p.y + HH, HW - 1, HH - 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
  }

  // ---------- Cultivos ----------

  function brote(ctx, x, y, prog, bal) {
    const k = 0.6 + prog * 1.7;
    elipse(ctx, x, y, 4.2, 2.1, '#5a3a1c');
    linea(ctx, { x, y }, { x: x + bal * 0.4, y: y - 5 * k }, '#5fa83c', 1.7);
    hoja(ctx, x + bal * 0.4, y - 5 * k, -0.5, 5.5 * k, 2.6 * k, '#6cc24a');
    hoja(ctx, x + bal * 0.4, y - 5 * k, Math.PI + 0.5, 5.5 * k, 2.6 * k, '#5fb23f');
  }

  const BAYAS = [[-6, -9], [-2, -13], [3, -12], [7, -8], [-4, -6], [1, -8], [5, -5]];

  /** Formas grandes: llevan 2x2 plantas por parcela en vez de 3x3. */
  const FORMAS_GRANDES = new Set(['mata', 'platano', 'arbolito', 'cocotero', 'rastrera', 'pina', 'parra']);

  /**
   * Una planta de un rubro (objeto de CULTIVOS). `prog` va de 0 a 1; `listo` = lista para cosechar.
   * Crece de brote a planta adulta; al estar lista muestra el fruto característico.
   */
  function planta(ctx, c, x, y, prog, listo, t, sem) {
    const s = listo ? 1 : 0.24 + 0.76 * Math.min(1, prog / 0.92);
    const bal = Math.sin(t * 1.7 + sem * 6.28) * 1.4 * s;
    const fr = c.fruto;
    const conFruto = prog > 0.6 || listo;
    elipse(ctx, x, y + 1, 6 * s + 3, 2.6 * s + 1.4, 'rgba(0,0,0,0.2)');
    if (prog < 0.28 && !listo) { brote(ctx, x, y, prog, bal); return; }

    switch (c.forma) {
      case 'tallo': { // maíz
        const h = 40 * s, tx = x + bal, ty = y - h;
        linea(ctx, { x, y }, { x: tx, y: ty }, '#4f8f2f', 2.6 * Math.max(0.6, s));
        for (let k = 0; k < 3; k++) {
          const f = 0.3 + 0.24 * k;
          hoja(ctx, x + bal * f, y - h * f, k % 2 ? -0.45 : Math.PI + 0.45, 16 * s, 4.4 * s, k % 2 ? '#5fae3a' : '#4a9a30');
        }
        if (conFruto) {
          ctx.save();
          ctx.translate(x + bal * 0.55 + 3 * s, y - h * 0.52); ctx.rotate(-0.25);
          elipse(ctx, 0, 0, 3.4 * s, 7.2 * s, '#7fbf4a');
          if (listo) elipse(ctx, 0.4, -1.2 * s, 2.4 * s, 5.4 * s, fr);
          ctx.restore();
        }
        ctx.strokeStyle = '#d8c07a'; ctx.lineWidth = 1; ctx.lineCap = 'round';
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + k * 2.3 * s, ty - 5.5 * s); ctx.stroke(); }
        break;
      }
      case 'espiga': { // arroz
        const verde = listo ? '#b9b34e' : '#6db33f';
        for (let k = -3; k <= 3; k++) {
          const tip = { x: x + k * 2.6 * s + bal, y: y - (22 + Math.abs(k % 2) * 5) * s };
          linea(ctx, { x: x + k * 0.8, y }, tip, verde, 1.5);
          if (conFruto) {
            const caida = listo ? 5 : 2;
            for (let g = 0; g < 4; g++) circulo(ctx, tip.x + (k < 0 ? -1 : 1) * g * 0.9, tip.y + g * 1.6 + caida * 0.3, 1.2, listo ? fr : '#a9c96a');
          }
        }
        break;
      }
      case 'mata': { // yuca
        const a = { x: x + bal * 0.8 - 3 * s, y: y - 22 * s }, b = { x: x + bal + 3 * s, y: y - 27 * s };
        linea(ctx, { x: x - 1, y }, a, '#9b4a3a', 2.2 * s + 0.5);
        linea(ctx, { x: x + 1, y }, b, '#a85848', 2.2 * s + 0.5);
        for (const top of [a, b]) {
          for (let k = 0; k < 6; k++) hoja(ctx, top.x, top.y, -Math.PI / 2 + (k - 2.5) * 0.52, 15 * s, 4.4 * s, k % 2 ? '#2f7d32' : '#3b9140');
        }
        if (listo) {
          elipse(ctx, x - 5, y + 1, 5, 2.4, fr, 0.3);
          elipse(ctx, x + 5, y + 1.5, 5.5, 2.6, '#bf9468', -0.25);
          elipse(ctx, x, y + 3, 4.5, 2.2, '#d2ad86', 0.05);
        }
        break;
      }
      case 'raiz': { // zanahoria, papa, cebolla, ajo
        if (c.id === 'cebolla' || c.id === 'ajo') {
          for (let k = -2; k <= 2; k++) linea(ctx, { x: x + k, y: y - 2 }, { x: x + k * 3 * s + bal, y: y - (18 + (k % 2) * 4) * s }, k % 2 ? '#4f9a3c' : '#62ad48', 2);
        } else if (c.id === 'zanahoria') {
          for (let k = -2; k <= 2; k++) {
            const tip = { x: x + k * 3.6 * s + bal, y: y - 16 * s };
            linea(ctx, { x, y: y - 1 }, tip, '#4f9a3c', 1.3);
            circulo(ctx, tip.x, tip.y, 3 * s, k % 2 ? '#5fae3a' : '#4a9a30');
          }
        } else { // papa
          circulo(ctx, x - 5 * s, y - 7 * s, 6 * s, '#3f8f3a'); circulo(ctx, x + 5 * s, y - 7 * s, 6 * s, '#357d33');
          circulo(ctx, x + bal * 0.4, y - 12 * s, 6.5 * s, '#4aa043');
          if (conFruto) for (const [dx, dy] of [[-4, -15], [3, -14]]) circulo(ctx, x + dx * s, y + dy * s, 1.5, '#e6d6f5');
        }
        if (listo) {
          if (c.id === 'zanahoria') poli(ctx, [{ x: x - 3.4, y: y - 1 }, { x: x + 3.4, y: y - 1 }, { x, y: y + 6 }], fr);
          else if (c.id === 'papa') { elipse(ctx, x - 5, y + 1, 4, 2.8, fr); elipse(ctx, x + 4, y + 2, 4.4, 3, '#b8925a'); }
          else elipse(ctx, x, y, 5, 4, fr);
        }
        break;
      }
      case 'arbusto': { // tomate, ají, pimentón, caraota, fresa
        const bajo = c.id === 'fresa' ? 0.6 : 1;
        const r = s * bajo;
        circulo(ctx, x - 5 * r, y - 6 * r, 7 * r, '#3f8f3a');
        circulo(ctx, x + 5 * r, y - 6 * r, 7 * r, '#357d33');
        circulo(ctx, x + bal * 0.3, y - 11 * r, 8 * r, '#4aa043');
        circulo(ctx, x - 2 * r, y - 13 * r, 4 * r, '#63b858');
        if (!conFruto) break;
        if (c.id === 'caraota') {
          for (const [dx, dy] of [[-8, -4], [0, -3], [8, -5]]) {
            ctx.save(); ctx.translate(x + dx * r, y + dy * r); ctx.rotate(0.35 * (dx < 0 ? 1 : -1));
            elipse(ctx, 0, 0, 1.8 * r, 5.2 * r, listo ? fr : '#6f9f45');
            ctx.restore();
          }
        } else {
          const tam = c.id === 'pimenton' ? 3.6 : c.id === 'aji' ? 2.2 : 2.8;
          const col = listo ? fr : '#8fc35a';
          for (const [dx, dy] of [[-6, -8], [5, -10], [0, -5], [7, -4], [-3, -13]]) {
            if (c.id === 'aji') elipse(ctx, x + dx * r, y + dy * r, tam * 0.7, tam * 1.3, col, 0.4);
            else circulo(ctx, x + dx * r, y + dy * r, tam * r + 0.4, col);
          }
        }
        break;
      }
      case 'rastrera': { // patilla, melón
        for (const [dx, dy, rr2] of [[-9, -2, 6], [8, -3, 6], [0, -6, 7], [-3, 2, 5]]) circulo(ctx, x + dx * s, y + dy * s, rr2 * s, dx > 0 ? '#3f8f3a' : '#4aa043');
        ctx.strokeStyle = '#3b7d2c'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x - 12 * s, y); ctx.quadraticCurveTo(x, y - 9 * s, x + 12 * s, y - 1); ctx.stroke();
        if (conFruto) {
          const k = listo ? 1 : 0.6;
          elipse(ctx, x + 2, y - 2, 8 * k, 5.6 * k, listo ? fr : '#7fb84a');
          if (c.id === 'patilla') {
            ctx.strokeStyle = 'rgba(25,70,25,0.7)'; ctx.lineWidth = 1.3;
            for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.ellipse(x + 2 + j * 3 * k, y - 2, 1.2 * k, 5.2 * k, 0, 0, TAU); ctx.stroke(); }
          } else {
            elipse(ctx, x, y - 4, 3 * k, 1.6 * k, 'rgba(255,255,255,0.35)');
          }
        }
        break;
      }
      case 'platano': {
        const tx = x + bal, ty = y - 26 * s;
        poli(ctx, [{ x: x - 3.4 * s - 1, y }, { x: x + 3.4 * s + 1, y }, { x: tx + 2.4 * s, y: ty }, { x: tx - 2.4 * s, y: ty }], '#8fc05a');
        linea(ctx, { x: x + 1.5, y }, { x: tx + 1, y: ty }, 'rgba(60,100,30,0.4)', 1.5);
        [-2.9, -2.3, -0.85, -0.25, -1.57].forEach((ang, k) => {
          hoja(ctx, tx, ty, ang + (k % 2 ? 0.1 : -0.05) + bal * 0.02, 27 * s, 9.5 * s, k % 2 ? '#4f9f36' : '#5fb142');
          hoja(ctx, tx, ty, ang, 27 * s, 1.1, 'rgba(30,80,30,0.45)');
        });
        if (listo) {
          for (let k = 0; k < 5; k++) elipse(ctx, tx + 4 + k * 0.6, ty + 8 + k * 2.6, 2.4, 5, fr, 0.4 - k * 0.05);
          elipse(ctx, tx + 5, ty + 20, 2.6, 3.4, '#7a2e5a');
        }
        break;
      }
      case 'pina': {
        for (let k = 0; k < 9; k++) {
          const a = -Math.PI / 2 + (k - 4) * 0.36;
          hoja(ctx, x, y - 2, a, 16 * s, 3 * s, k % 2 ? '#4f8f5a' : '#5fa36a');
        }
        if (conFruto) {
          const k = listo ? 1 : 0.65;
          elipse(ctx, x, y - 10 * k, 5.4 * k, 7.4 * k, listo ? fr : '#8fb35a');
          ctx.strokeStyle = 'rgba(120,70,10,0.45)'; ctx.lineWidth = 0.9;
          for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(x - 5 * k, y - 10 * k + j * 3); ctx.lineTo(x + 5 * k, y - 13 * k + j * 3); ctx.stroke(); }
          for (let j = -2; j <= 2; j++) hoja(ctx, x, y - 17 * k, -Math.PI / 2 + j * 0.35, 8 * k, 2, '#3f8f4a');
        }
        break;
      }
      case 'cocotero': {
        const cx = x + bal + 4 * s, cy = y - 34 * s;
        ctx.strokeStyle = '#8c6b44'; ctx.lineWidth = 3.4 * s + 0.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - 18 * s, cx, cy); ctx.stroke();
        for (let k = 0; k < 7; k++) {
          const a = (k * TAU) / 7;
          hoja(ctx, cx, cy, Math.atan2(Math.sin(a) * 0.45 + 0.35, Math.cos(a)), 20 * s, 4.6 * s, k % 2 ? '#2f8a3d' : '#3da04c');
        }
        if (conFruto) for (const [dx, dy] of [[-2.6, 3], [2.6, 3.4], [0, 5.6]]) circulo(ctx, cx + dx, cy + dy, 2.6 * s, listo ? fr : '#6f9f45');
        break;
      }
      case 'girasol': {
        const tx = x + bal, ty = y - 40 * s;
        linea(ctx, { x, y }, { x: tx, y: ty }, '#4f8f2f', 2.4);
        hoja(ctx, x + bal * 0.4, y - 16 * s, Math.PI + 0.5, 10 * s, 5 * s, '#4a9a30');
        hoja(ctx, x + bal * 0.6, y - 24 * s, -0.5, 10 * s, 5 * s, '#5fae3a');
        if (conFruto) {
          const k = listo ? 1 : 0.6;
          for (let p = 0; p < 12; p++) { const a = (p / 12) * TAU; elipse(ctx, tx + Math.cos(a) * 5.4 * k, ty + Math.sin(a) * 5.4 * k, 3 * k, 1.5 * k, fr, a); }
          circulo(ctx, tx, ty, 4 * k, '#6b4423');
        } else circulo(ctx, tx, ty, 3, '#7fbf4a');
        break;
      }
      case 'cana': {
        for (let k = -1; k <= 1; k++) {
          const bx = x + k * 4, h = (40 + k * 4) * s, tip = { x: bx + bal, y: y - h };
          linea(ctx, { x: bx, y }, tip, listo ? '#c9b35a' : fr, 3);
          for (let n = 1; n < 4; n++) { const pz = lerp({ x: bx, y }, tip, n / 4); linea(ctx, { x: pz.x - 1.8, y: pz.y }, { x: pz.x + 1.8, y: pz.y }, 'rgba(70,90,30,0.6)', 1); }
          hoja(ctx, tip.x, tip.y + 4, k < 0 ? Math.PI + 0.6 : -0.6, 15 * s, 3 * s, '#5fae3a');
          hoja(ctx, tip.x, tip.y + 12, k < 0 ? -0.5 : Math.PI + 0.5, 13 * s, 2.6 * s, '#4a9a30');
        }
        break;
      }
      case 'parra': { // uva: emparrado con racimos
        const hgt = 30 * s;
        linea(ctx, { x: x - 12, y }, { x: x - 12, y: y - hgt }, '#6b4a2e', 2.4);
        linea(ctx, { x: x + 12, y: y - 2 }, { x: x + 12, y: y - 2 - hgt }, '#6b4a2e', 2.4);
        for (let k = 0; k < 6; k++) circulo(ctx, x - 12 + k * 4.8 + bal * 0.3, y - hgt - 2 + Math.sin(k) * 2, 5.4 * s, k % 2 ? '#3f8f3a' : '#4aa043');
        if (conFruto) {
          for (const dx of [-6, 4]) {
            for (let f = 0; f < 4; f++) for (let g = 0; g <= 3 - f; g++) circulo(ctx, x + dx + g * 2.4 - (3 - f) * 1.2, y - hgt + 4 + f * 2.4, 1.5, listo ? fr : '#9cc45a');
          }
        }
        break;
      }
      default: { // arbolito: cacao, café, durazno, mango
        if (c.id === 'cafe') {
          circulo(ctx, x, y - 9 * s, 9 * s, '#245f2e');
          circulo(ctx, x - 7 * s, y - 7 * s, 7 * s, '#2a6d33');
          circulo(ctx, x + 7 * s, y - 7 * s, 7 * s, '#2a6d33');
          circulo(ctx, x - 2 * s, y - 12 * s, 5 * s, '#3c8b3f');
          if (prog > 0.45 && !listo) for (const [dx, dy] of BAYAS.slice(0, 4)) circulo(ctx, x + dx * s, y + dy * s, 1.3, '#ffffff');
          if (conFruto) for (const [dx, dy] of BAYAS) circulo(ctx, x + dx * s, y + dy * s, 1.9 * s + 0.4, listo ? fr : '#7fa03a');
          break;
        }
        linea(ctx, { x, y }, { x, y: y - 22 * s }, '#6b4423', 3.8 * s + 0.4);
        const copa = c.id === 'durazno' ? ['#4d9a44', '#5aa84f', '#66b85a'] : ['#2f7a33', '#3a8c3c', '#46a048'];
        [[-8, -26, 8, 0], [8, -27, 8, 1], [0, -33, 9, 2], [-2, -24, 7, 0]].forEach(([dx, dy, r, ci]) => {
          circulo(ctx, x + dx * s + bal * 0.5, y + dy * s, r * s, copa[ci]);
        });
        if (c.id === 'durazno' && prog > 0.4 && !listo) for (const [dx, dy] of [[-6, -30], [6, -32], [0, -36]]) circulo(ctx, x + dx * s, y + dy * s, 1.6, '#f7b6c8');
        if (conFruto) {
          const pos = c.id === 'cacao' ? [[-4, -14], [4, -10], [0, -18]] : [[-6, -26], [6, -28], [1, -34], [-2, -22]];
          for (const [dx, dy] of pos) {
            if (c.id === 'cacao') elipse(ctx, x + dx * s, y + dy * s, 2.7 * s, 4.4 * s, listo ? fr : '#7ab648', 0.3);
            else circulo(ctx, x + dx * s, y + dy * s, 2.6 * s, listo ? fr : '#8fbf4a');
          }
        }
      }
    }
  }

  // ---------- Árboles ----------

  function palma(ctx, x, y, t, sem) {
    const sway = Math.sin(t * 1.1 + sem * 5) * 2.2;
    const cx = x + 9 + sway, cy = y - 74;
    elipse(ctx, x + 2, y + 1, 17, 7, 'rgba(0,0,0,0.2)');
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8c6b44'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 1, y - 40, cx, cy); ctx.stroke();
    ctx.strokeStyle = '#a6845a'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x - 1.2, y); ctx.quadraticCurveTo(x, y - 40, cx - 1.5, cy); ctx.stroke();
    for (let k = 0; k < 9; k++) {
      const a = (k * TAU) / 9 + sem * 2;
      const tipx = cx + Math.cos(a) * 40, tipy = cy + Math.sin(a) * 14 + 14 + sway * 0.4;
      const ctrx = cx + Math.cos(a) * 22, ctry = cy + Math.sin(a) * 7 - 14;
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.quadraticCurveTo(ctrx, ctry - 5, tipx, tipy); ctx.quadraticCurveTo(ctrx, ctry + 7, cx, cy);
      ctx.fillStyle = k % 2 ? '#2f8a3d' : '#3da04c'; ctx.fill();
    }
    circulo(ctx, cx - 3, cy + 4, 3.4, '#6b4a2a'); circulo(ctx, cx + 3, cy + 5, 3.4, '#5e4125'); circulo(ctx, cx, cy + 8, 3.2, '#74502d');
  }

  function mango(ctx, x, y, t, sem) {
    const sway = Math.sin(t * 0.9 + sem * 5) * 1;
    elipse(ctx, x, y + 1, 22, 8, 'rgba(0,0,0,0.2)');
    linea(ctx, { x, y }, { x, y: y - 24 }, '#6b4a2e', 8);
    [[-14, -34, 15, '#2d7a34'], [12, -36, 16, '#37913f'], [0, -48, 17, '#3fa047'], [-2, -30, 14, '#2d7a34'], [-18, -24, 10, '#37913f'], [18, -26, 11, '#2d7a34']]
      .forEach(([dx, dy, r, c]) => circulo(ctx, x + dx + sway, y + dy, r, c));
    for (const [dx, dy] of [[-8, -30], [10, -34], [2, -22], [-16, -22]]) circulo(ctx, x + dx + sway, y + dy, 2.5, '#f2a33a');
  }

  function araguaney(ctx, x, y, t, sem) { // árbol nacional: florece en amarillo
    const sway = Math.sin(t * 1.0 + sem * 5) * 1.2;
    elipse(ctx, x, y + 1, 19, 7, 'rgba(0,0,0,0.2)');
    linea(ctx, { x, y }, { x: x + 2, y: y - 30 }, '#7a6048', 5);
    [[-12, -40, 13, '#f6c90e'], [11, -42, 13, '#f9d835'], [0, -54, 14, '#f6c90e'], [-3, -38, 12, '#e9b50a'], [-16, -30, 9, '#f9d835'], [16, -32, 9, '#e9b50a']]
      .forEach(([dx, dy, r, c]) => circulo(ctx, x + dx + sway, y + dy, r, c));
    for (const [dx, dy] of [[-6, -48], [8, -50], [-14, -36], [14, -38]]) circulo(ctx, x + dx + sway, y + dy, 3.2, '#6aa84a');
  }

  function moriche(ctx, x, y, t, sem) { // palma de los llanos: tronco recto y hojas en abanico
    const sway = Math.sin(t * 1.1 + sem * 5) * 1.6;
    const cx = x + sway, cy = y - 80;
    elipse(ctx, x, y + 1, 16, 6, 'rgba(0,0,0,0.2)');
    linea(ctx, { x, y }, { x: cx, y: cy }, '#7d6a52', 6.5);
    for (let k = 1; k < 8; k++) linea(ctx, { x: x + (cx - x) * k / 8 - 3, y: y - 80 * k / 8 }, { x: x + (cx - x) * k / 8 + 3, y: y - 80 * k / 8 + 1 }, 'rgba(60,45,30,0.35)', 1);
    for (let k = 0; k < 11; k++) {
      const a = Math.PI + 0.15 + (k / 10) * (Math.PI - 0.3);
      const largo = 26 + (k % 3) * 4;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(largo, -7); ctx.lineTo(largo + 3, 0); ctx.lineTo(largo, 7); ctx.closePath();
      ctx.fillStyle = k % 2 ? '#3f8f3d' : '#4fa64a'; ctx.fill();
      ctx.restore();
    }
    for (let k = 0; k < 4; k++) hoja(ctx, cx, cy, 0.4 + k * 0.7, 22, 6, k % 2 ? '#2f7d35' : '#3b9140');
    for (const [dx, dy] of [[-3, 6], [3, 7], [0, 9]]) circulo(ctx, cx + dx, cy + dy, 2.6, '#8a3d22');
  }

  function saman(ctx, x, y, t, sem) { // copa ancha como sombrilla
    const sway = Math.sin(t * 0.8 + sem * 5) * 0.8;
    elipse(ctx, x, y + 2, 34, 12, 'rgba(0,0,0,0.2)');
    linea(ctx, { x, y }, { x: x - 2, y: y - 28 }, '#5e4632', 9);
    linea(ctx, { x: x - 2, y: y - 26 }, { x: x - 18, y: y - 38 }, '#5e4632', 5);
    linea(ctx, { x: x - 2, y: y - 26 }, { x: x + 18, y: y - 40 }, '#5e4632', 5);
    [[-24, -42, 14, '#3d8a3a'], [22, -44, 15, '#3d8a3a'], [0, -50, 18, '#4c9c46'], [-12, -50, 14, '#56a84f'], [14, -52, 13, '#56a84f'], [-30, -38, 9, '#357d33'], [30, -40, 9, '#357d33']]
      .forEach(([dx, dy, r, c]) => elipse(ctx, x + dx + sway, y + dy, r * 1.2, r * 0.75, c));
    for (const [dx, dy] of [[-10, -54], [12, -56], [0, -46], [-22, -44]]) circulo(ctx, x + dx + sway, y + dy, 1.8, '#f2a1c0');
  }

  function pino(ctx, x, y, t, sem) {
    const sway = Math.sin(t * 1 + sem * 5) * 0.8;
    elipse(ctx, x, y + 1, 14, 5, 'rgba(0,0,0,0.22)');
    linea(ctx, { x, y }, { x, y: y - 14 }, '#5a3f28', 5);
    for (let k = 0; k < 4; k++) {
      const base = y - 10 - k * 15, ancho = 20 - k * 4;
      poli(ctx, [{ x: x - ancho, y: base }, { x: x + sway * (k + 1) * 0.3, y: base - 26 }, { x: x + ancho, y: base }], k % 2 ? '#1f5f3a' : '#2a7045');
      poli(ctx, [{ x: x + sway * (k + 1) * 0.3, y: base - 26 }, { x: x + ancho, y: base }, { x: x + ancho * 0.2, y: base }], 'rgba(0,0,0,0.15)');
    }
  }

  function frailejon(ctx, x, y, t, sem) { // planta del páramo: tallo grueso, roseta lanuda y flores amarillas
    const sway = Math.sin(t * 1.3 + sem * 5) * 1;
    elipse(ctx, x, y + 1, 10, 4, 'rgba(0,0,0,0.2)');
    rr(ctx, x - 4, y - 24, 8, 24, 3, '#8a7a5c');
    for (let k = 0; k < 4; k++) linea(ctx, { x: x - 4, y: y - 4 - k * 5 }, { x: x + 4, y: y - 2 - k * 5 }, 'rgba(70,60,40,0.4)', 1.2);
    for (let k = 0; k < 12; k++) hoja(ctx, x + sway, y - 26, -Math.PI / 2 + (k - 5.5) * 0.28, 15, 4.6, k % 2 ? '#b9c9a4' : '#cfdcb9');
    for (const [dx, dy] of [[-8, -46], [6, -48], [0, -52]]) {
      linea(ctx, { x: x + sway, y: y - 32 }, { x: x + dx + sway, y: y + dy + 4 }, '#a6b48a', 1.2);
      circulo(ctx, x + dx + sway, y + dy, 3, '#f5c518');
      circulo(ctx, x + dx + sway, y + dy, 1.2, '#c48a12');
    }
  }

  function cardon(ctx, x, y, t, sem) { // cactus columnar del semiárido larense y falconiano
    elipse(ctx, x, y + 1, 12, 4.5, 'rgba(0,0,0,0.2)');
    const col = '#5f8f4a', luz = '#76a85d';
    const brazo = (lado, h0, h1) => {
      rr(ctx, x + lado * 6 - (lado < 0 ? 12 : 0), y - h0 - 6, 12, 6, 3, col);
      rr(ctx, x + lado * 12 - 3.5, y - h1, 7, h1 - h0, 3.5, col);
      rr(ctx, x + lado * 12 - 1.5, y - h1 + 2, 2, h1 - h0 - 4, 1, luz);
    };
    brazo(-1, 26, 52); brazo(1, 34, 62);
    rr(ctx, x - 5, y - 74, 10, 74, 5, col);
    rr(ctx, x - 2, y - 72, 2.6, 70, 1.3, luz);
    if (sem > 0.5) circulo(ctx, x, y - 75, 2.6, '#f2f0e0');
  }

  function cuji(ctx, x, y, t, sem) { // árbol espinoso de copa plana
    const sway = Math.sin(t * 0.9 + sem * 5) * 0.8;
    elipse(ctx, x, y + 1, 24, 8, 'rgba(0,0,0,0.18)');
    ctx.strokeStyle = '#5d4630'; ctx.lineCap = 'round'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 18, x - 2, y - 34); ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x + 2, y - 20); ctx.lineTo(x + 16, y - 36); ctx.moveTo(x - 1, y - 28); ctx.lineTo(x - 16, y - 38); ctx.stroke();
    [[-16, -42, 12], [14, -42, 13], [0, -46, 14], [-26, -38, 7], [25, -38, 7]].forEach(([dx, dy, r], k) =>
      elipse(ctx, x + dx + sway, y + dy, r * 1.3, r * 0.45, k % 2 ? '#7f9a46' : '#8faa52'));
  }

  function tuna(ctx, x, y, t, sem) { // cactus de paletas
    elipse(ctx, x, y + 1, 12, 4, 'rgba(0,0,0,0.2)');
    const pal = [[0, -10, 7, 10, 0], [-7, -24, 6, 8.5, -0.4], [7, -25, 6, 8.5, 0.4], [1, -36, 5, 7, 0.1]];
    pal.forEach(([dx, dy, rx, ry, a], k) => {
      elipse(ctx, x + dx, y + dy, rx, ry, k % 2 ? '#6f9e52' : '#7fb05f', a);
      for (let p = 0; p < 3; p++) circulo(ctx, x + dx + (p - 1) * 2.4, y + dy + (p % 2) * 2.4, 0.7, '#e8e4c8');
    });
    if (sem > 0.4) { circulo(ctx, x - 9, y - 32, 2.2, '#d63a5f'); circulo(ctx, x + 6, y - 43, 2.2, '#d63a5f'); }
  }

  function bucare(ctx, x, y, t, sem) { // árbol de sombra de los cacaotales, de flores naranja
    const sway = Math.sin(t * 0.9 + sem * 5) * 1;
    elipse(ctx, x, y + 1, 22, 8, 'rgba(0,0,0,0.2)');
    linea(ctx, { x, y }, { x: x + 1, y: y - 30 }, '#6e5a48', 6);
    [[-14, -40, 13, '#e8642c'], [12, -42, 13, '#f07a33'], [0, -54, 15, '#e8642c'], [-4, -36, 11, '#d9541f'], [-20, -30, 8, '#f07a33'], [20, -32, 8, '#d9541f']]
      .forEach(([dx, dy, r, c]) => circulo(ctx, x + dx + sway, y + dy, r, c));
    for (const [dx, dy] of [[-6, -46], [8, -48], [-14, -34], [14, -36]]) circulo(ctx, x + dx + sway, y + dy, 3, '#5f9a45');
  }

  function uvero(ctx, x, y, t, sem) { // uva de playa: arbusto de hojas redondas
    const sway = Math.sin(t * 1.1 + sem * 5) * 0.8;
    elipse(ctx, x, y + 1, 18, 6, 'rgba(0,0,0,0.2)');
    linea(ctx, { x, y }, { x: x - 4, y: y - 14 }, '#7a5a3c', 4);
    linea(ctx, { x, y }, { x: x + 5, y: y - 12 }, '#7a5a3c', 3.5);
    [[-10, -18, 9], [9, -18, 9], [0, -26, 10], [-4, -14, 7], [8, -28, 6]].forEach(([dx, dy, r], k) =>
      circulo(ctx, x + dx + sway, y + dy, r, k % 2 ? '#4f9a3a' : ['#5fae47', '#c0532f'][k === 4 ? 1 : 0]));
    for (const [dx, dy] of [[-4, -20], [6, -22]]) { for (let g = 0; g < 3; g++) circulo(ctx, x + dx + sway, y + dy + g * 2.2, 1.4, '#6b2f5a'); }
  }

  const ARBOL = { palma, mango, araguaney, moriche, saman, pino, frailejon, cardon, cuji, tuna, bucare, uvero };

  function arbol(ctx, a, t) {
    const p = P(a.x + 0.5, a.y + 0.5);
    const sem = Iso.hash(a.x, a.y, 9);
    (ARBOL[a.tipo] || palma)(ctx, p.x + (sem - 0.5) * 10, p.y + (Iso.hash(a.x, a.y, 8) - 0.5) * 6, t, sem);
  }

  // ---------- Edificios ----------

  /** Caja isométrica; devuelve las esquinas del suelo. */
  function caja(ctx, x, y, w, d, alto, cTapa, cIzq, cDer) {
    const T = P(x, y), R = P(x + w, y), B = P(x + w, y + d), L = P(x, y + d);
    poli(ctx, [L, B, sube(B, alto), sube(L, alto)], cIzq);
    poli(ctx, [B, R, sube(R, alto), sube(B, alto)], cDer);
    if (cTapa) poli(ctx, [sube(T, alto), sube(R, alto), sube(B, alto), sube(L, alto)], cTapa);
    return { T, R, B, L };
  }

  /** Cuadrilátero sobre una pared: de u0 a u1 a lo largo del borde A→B, de altura h0 a h1. */
  function cara(A, B, u0, u1, h0, h1) {
    const a = lerp(A, B, u0), b = lerp(A, B, u1);
    return [sube(a, h0), sube(b, h0), sube(b, h1), sube(a, h1)];
  }

  function sombraEdificio(ctx, o) {
    poli(ctx, [P(o.x + 0.1, o.y + 0.1), P(o.x + o.w + 0.5, o.y + 0.1), P(o.x + o.w + 0.5, o.y + o.d + 0.5), P(o.x + 0.1, o.y + o.d + 0.5)], 'rgba(0,0,0,0.16)');
  }

  function casa(ctx, o) { // casa colonial: paredes blancas, techo de teja
    const alto = 34;
    sombraEdificio(ctx, o);
    const { B, R, L } = caja(ctx, o.x, o.y, o.w, o.d, alto, null, '#e6d8b6', '#f6edd6');
    linea(ctx, B, sube(B, alto), '#6b4423', 3); // viga de esquina
    // puerta y ventanas
    poli(ctx, cara(B, R, 0.38, 0.6, 0, 22), '#6b4423');
    poli(ctx, cara(B, R, 0.41, 0.57, 0, 19), '#8a5a2e');
    circulo(ctx, lerp(B, R, 0.55).x, lerp(B, R, 0.55).y - 10, 1, '#f2d27a');
    for (const [u0, u1] of [[0.1, 0.27], [0.73, 0.9]]) {
      poli(ctx, cara(B, R, u0, u1, 12, 27), '#fffdf5');
      poli(ctx, cara(B, R, u0 + 0.02, u1 - 0.02, 14, 25), '#7fb2d6');
    }
    for (const [u0, u1] of [[0.2, 0.36], [0.62, 0.78]]) {
      poli(ctx, cara(L, B, u0, u1, 12, 27), '#fffdf5');
      poli(ctx, cara(L, B, u0 + 0.02, u1 - 0.02, 14, 25), '#6a9cc2');
      poli(ctx, cara(L, B, u0 - 0.04, u0 + 0.02, 12, 27), '#6b4423'); // postigos
      poli(ctx, cara(L, B, u1 - 0.02, u1 + 0.04, 12, 27), '#6b4423');
    }
    // techo a cuatro aguas
    const e = 0.24, hz = alto - 2;
    const Tt = sube(P(o.x - e, o.y - e), hz), Rt = sube(P(o.x + o.w + e, o.y - e), hz);
    const Bt = sube(P(o.x + o.w + e, o.y + o.d + e), hz), Lt = sube(P(o.x - e, o.y + o.d + e), hz);
    const c = P(o.x + o.w / 2, o.y + o.d / 2), ap = { x: c.x, y: c.y - alto - 32 };
    poli(ctx, [Tt, Rt, ap], '#9a3b25'); poli(ctx, [Lt, Tt, ap], '#8a321f');
    poli(ctx, [Lt, Bt, ap], '#b84a2e'); poli(ctx, [Bt, Rt, ap], '#cf5c3b');
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(70,20,10,0.3)';
    for (let k = 1; k <= 5; k++) {
      const u = k / 6;
      for (const [A, Bp] of [[Lt, Bt], [Bt, Rt]]) {
        const a = lerp(A, ap, u), b = lerp(Bp, ap, u);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.4; ctx.strokeStyle = '#7a2a18';
    ctx.beginPath(); ctx.moveTo(Lt.x, Lt.y); ctx.lineTo(Bt.x, Bt.y); ctx.lineTo(Rt.x, Rt.y); ctx.stroke();
  }

  function churuata(ctx, o) { // vivienda indígena: base redonda y techo cónico de palma
    const c = P(o.x + o.w / 2, o.y + o.d / 2);
    const rx = 50, ry = 25, hp = 16;
    elipse(ctx, c.x + 4, c.y + 3, rx + 8, ry + 5, 'rgba(0,0,0,0.16)');
    // pared de barro
    ctx.beginPath();
    ctx.moveTo(c.x - rx, c.y); ctx.lineTo(c.x - rx, c.y - hp);
    ctx.ellipse(c.x, c.y - hp, rx, ry, 0, Math.PI, 0, false);
    ctx.lineTo(c.x + rx, c.y); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath(); ctx.fillStyle = '#b98b5a'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x, c.y - hp, rx, ry, 0, 0, Math.PI, false);
    ctx.lineTo(c.x - rx, c.y - hp); ctx.fillStyle = '#c59a66'; ctx.fill();
    // puerta
    rr(ctx, c.x - 8, c.y + ry - hp + 2, 16, 15, 7, '#3a2412');
    // techo cónico
    const rr2 = rx + 7, apice = { x: c.x, y: c.y - hp - 62 };
    const g = ctx.createLinearGradient(c.x - rr2, 0, c.x + rr2, 0);
    g.addColorStop(0, '#b07c2a'); g.addColorStop(0.55, '#dcae4a'); g.addColorStop(1, '#c4922f');
    ctx.beginPath();
    ctx.moveTo(c.x - rr2, c.y - hp + 4);
    ctx.lineTo(apice.x, apice.y);
    ctx.lineTo(c.x + rr2, c.y - hp + 4);
    ctx.ellipse(c.x, c.y - hp + 4, rr2, ry + 4, 0, 0, Math.PI, false);
    ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    // paja: líneas radiales y aros
    ctx.strokeStyle = 'rgba(110,70,15,0.35)'; ctx.lineWidth = 1.2;
    for (let k = 0; k <= 12; k++) {
      const a = (k / 12) * Math.PI, ex = c.x + Math.cos(a) * rr2, ey = c.y - hp + 4 + Math.sin(a) * (ry + 4);
      ctx.beginPath(); ctx.moveTo(apice.x, apice.y); ctx.lineTo(ex, ey); ctx.stroke();
    }
    for (const f of [0.35, 0.62, 0.86]) {
      ctx.beginPath();
      ctx.ellipse(c.x, apice.y + (c.y - hp + 4 - apice.y) * f, rr2 * f, (ry + 4) * f, 0, 0, Math.PI, false);
      ctx.stroke();
    }
  }

  function puesto(ctx, o, t) { // puesto de mercado con toldo a franjas
    sombraEdificio(ctx, o);
    const { x, y, w, d } = o;
    const poste = (px, py) => linea(ctx, P(px, py), sube(P(px, py), 46), '#5a3a1c', 3.2);
    poste(x + 0.08, y + 0.08); poste(x + 0.08, y + d - 0.08);
    caja(ctx, x + 0.14, y + 0.1, w - 0.28, d - 0.2, 16, '#d4a367', '#8a5a2a', '#a8743a');
    const frutas = ['#d9432b', '#f2c230', '#59a845', '#e8872b'];
    for (let k = 0; k < 4; k++) { // cestas con frutas
      const p = P(x + 0.5, y + 0.3 + k * ((d - 0.6) / 3));
      elipse(ctx, p.x, p.y - 17, 7, 3.4, '#7a4f22');
      for (const [dx, dy] of [[-3.4, -20], [3.4, -20], [0, -23.4]]) circulo(ctx, p.x + dx, p.y + dy, 3.3, frutas[k]);
    }
    poste(x + w - 0.08, y + 0.08); poste(x + w - 0.08, y + d - 0.08);
    const e = 0.22, ha = 52, hf = 42;
    for (let k = 0; k < 6; k++) {
      const y0 = y - e + ((d + 2 * e) * k) / 6, y1 = y - e + ((d + 2 * e) * (k + 1)) / 6;
      const c = k % 2 ? '#f3e9cf' : '#3f9150';
      const A = sube(P(x - e, y0), ha), Bq = sube(P(x - e, y1), ha), C = sube(P(x + w + e, y1), hf), D = sube(P(x + w + e, y0), hf);
      poli(ctx, [A, D, C, Bq], c);
      poli(ctx, [D, C, { x: C.x, y: C.y + 7 }, { x: D.x, y: D.y + 7 }], k % 2 ? '#dcd0b0' : '#2f7a3f');
    }
  }

  function edificio(ctx, o, t) {
    if (o.tipo === 'casa') casa(ctx, o);
    else if (o.tipo === 'churuata') churuata(ctx, o);
    else puesto(ctx, o, t);
  }

  // ---------- Animales ----------

  // Cuadrúpedos: medidas del cuerpo (rx, ry), largo de las patas y colores.
  const CUADRUPEDOS = {
    vaca:     { rx: 14, ry: 8,   pata: 9,  piel: '#f4f1ea', mancha: '#2f2b28', cabeza: [6, 5],   hocico: '#eaa9a0', cuernos: '#e8dcc0', cola: '#2f2b28' },
    caballo:  { rx: 13, ry: 7,   pata: 12, piel: '#8b5a2b', crin: '#3b2414', cabeza: [5.5, 4], cuello: 9, hocico: '#6e4420', cola: '#3b2414' },
    chiguire: { rx: 11, ry: 7.5, pata: 4,  piel: '#8a6a45', cabeza: [6.5, 5.5], hocico: '#6e5236', orejasCortas: true },
    oveja:    { rx: 10, ry: 7,   pata: 6,  piel: '#f5f2ea', lana: true, cabeza: [4.5, 4], cara: '#3a3330', patas: '#3a3330', cola: '#f5f2ea' },
    chivo:    { rx: 9,  ry: 5.5, pata: 8,  piel: '#efe7d4', mancha: '#8a5a35', cabeza: [4.5, 3.6], cuernosAtras: '#9a8a70', barba: true, cola: '#efe7d4' },
    burro:    { rx: 11, ry: 6.5, pata: 9,  piel: '#8d8a85', crin: '#4a4643', cabeza: [5, 4], cuello: 6, hocico: '#e9e4dc', orejasLargas: true, cola: '#4a4643' },
    cochino:  { rx: 10, ry: 7,   pata: 4,  piel: '#f2a7a0', cabeza: [5.5, 5], trompa: '#e98d86', colaRizada: true },
  };

  function cuadrupedo(ctx, a, fase, comiendo, t) {
    const h = a.pata;
    const cy = -h - a.ry * 0.6;
    const patasCol = a.patas || a.piel;
    const oscuro = 'rgba(0,0,0,0.18)';
    // patas de atrás (lado lejano)
    for (const [bx, f] of [[-a.rx * 0.55, -fase], [a.rx * 0.55, fase]]) {
      linea(ctx, { x: bx + 2, y: cy + a.ry * 0.5 }, { x: bx + 2 + f * 2.6, y: -0.5 }, patasCol, 3.2);
      linea(ctx, { x: bx + 2, y: cy + a.ry * 0.5 }, { x: bx + 2 + f * 2.6, y: -0.5 }, oscuro, 3.2);
    }
    // cola
    if (a.cola) linea(ctx, { x: -a.rx + 1, y: cy - 2 }, { x: -a.rx - 3 + Math.sin(t * 3) * 1.5, y: cy + a.ry * 0.9 }, a.cola, 1.8);
    if (a.colaRizada) { ctx.strokeStyle = a.piel; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(-a.rx - 1.5, cy - 2, 2.2, 0, Math.PI * 1.6); ctx.stroke(); }
    // cuerpo
    if (a.lana) {
      for (let k = 0; k < 7; k++) circulo(ctx, -a.rx * 0.7 + k * a.rx * 0.23, cy + (k % 2 ? -2 : 1.5), a.ry * 0.75, k % 2 ? a.piel : '#e9e4d8');
    } else {
      elipse(ctx, 0, cy, a.rx, a.ry, a.piel);
      elipse(ctx, 0, cy + a.ry * 0.45, a.rx * 0.8, a.ry * 0.4, 'rgba(0,0,0,0.08)');
    }
    if (a.mancha) { elipse(ctx, -a.rx * 0.3, cy - 1.5, a.rx * 0.32, a.ry * 0.45, a.mancha, 0.3); elipse(ctx, a.rx * 0.35, cy + 1, a.rx * 0.2, a.ry * 0.35, a.mancha, -0.2); }
    // patas de adelante (lado cercano)
    for (const [bx, f] of [[-a.rx * 0.55, fase], [a.rx * 0.55, -fase]]) {
      linea(ctx, { x: bx, y: cy + a.ry * 0.5 }, { x: bx + f * 2.6, y: 0 }, patasCol, 3.4);
      elipse(ctx, bx + f * 2.6, 0, 2, 1, '#3a2a1e');
    }
    // cuello y cabeza
    const baja = comiendo ? 1 : 0;
    const hx = a.rx + (a.cuello ? 3 : 1), hy = cy - (a.cuello || 3) + baja * (h + a.ry * 0.4);
    if (a.cuello) {
      poli(ctx, [{ x: a.rx * 0.55, y: cy - a.ry * 0.7 }, { x: a.rx * 0.9, y: cy + a.ry * 0.3 }, { x: hx + 1, y: hy + 2 }, { x: hx - 3, y: hy - 2 }], a.piel);
      if (a.crin) linea(ctx, { x: a.rx * 0.55, y: cy - a.ry * 0.7 }, { x: hx - 3, y: hy - 3 }, a.crin, 2.4);
    }
    const [crx, cry] = a.cabeza;
    elipse(ctx, hx + crx * 0.5, hy, crx, cry, a.cara || a.piel, 0.15 + baja * 0.6);
    if (a.hocico) elipse(ctx, hx + crx * 1.25, hy + cry * 0.35 + baja * 2, crx * 0.55, cry * 0.6, a.hocico);
    if (a.trompa) { elipse(ctx, hx + crx * 1.35, hy + 1, 2, 2.6, a.trompa); circulo(ctx, hx + crx * 1.45, hy + 0.2, 0.5, '#8a4a44'); circulo(ctx, hx + crx * 1.45, hy + 1.8, 0.5, '#8a4a44'); }
    // orejas, cuernos, barba
    if (a.orejasLargas) { elipse(ctx, hx - 1, hy - cry - 4, 1.6, 5, a.piel, -0.3); elipse(ctx, hx + 2, hy - cry - 4, 1.6, 5, a.piel, 0.2); }
    else if (a.orejasCortas) circulo(ctx, hx - 1, hy - cry + 0.5, 1.8, a.piel);
    else elipse(ctx, hx - 2, hy - cry * 0.4, 3, 1.4, a.cara || a.piel, -0.4);
    if (a.cuernos) { linea(ctx, { x: hx, y: hy - cry + 1 }, { x: hx - 2, y: hy - cry - 3 }, a.cuernos, 1.6); linea(ctx, { x: hx + 2, y: hy - cry + 1 }, { x: hx + 4, y: hy - cry - 3 }, a.cuernos, 1.6); }
    if (a.cuernosAtras) { ctx.strokeStyle = a.cuernosAtras; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(hx + 1, hy - cry + 1); ctx.quadraticCurveTo(hx - 2, hy - cry - 5, hx - 5, hy - cry - 2); ctx.stroke(); }
    if (a.barba) poli(ctx, [{ x: hx + crx * 0.9, y: hy + cry * 0.6 }, { x: hx + crx * 1.3, y: hy + cry * 0.6 }, { x: hx + crx * 1.05, y: hy + cry + 3 }], '#d8cdb4');
    circulo(ctx, hx + crx * 0.75, hy - cry * 0.25, 0.9, '#1a1410');
  }

  function gallina(ctx, fase, comiendo, t) {
    const pico = comiendo ? Math.max(0, Math.sin(t * 9)) * 4 : 0;
    linea(ctx, { x: -1.5, y: -6 }, { x: -1.5 + fase, y: 0 }, '#e2a43a', 1.4);
    linea(ctx, { x: 1.5, y: -6 }, { x: 1.5 - fase, y: 0 }, '#e2a43a', 1.4);
    poli(ctx, [{ x: -8, y: -12 }, { x: -11, y: -18 }, { x: -6, y: -14 }], '#3a2a20');
    elipse(ctx, 0, -10, 7, 5, '#f4efe4');
    elipse(ctx, -1, -9, 4, 2.6, '#e0d8c8', 0.2);
    const hx = 5 + pico * 0.5, hy = -15 + pico;
    circulo(ctx, hx, hy, 3.2, '#f4efe4');
    elipse(ctx, hx - 0.5, hy - 3.2, 1.6, 1.4, '#d8322a');
    poli(ctx, [{ x: hx + 2.6, y: hy - 0.5 }, { x: hx + 5.4, y: hy + 0.6 }, { x: hx + 2.6, y: hy + 1.4 }], '#f0b33a');
    elipse(ctx, hx + 1.4, hy + 2.6, 0.9, 1.4, '#d8322a');
    circulo(ctx, hx + 1, hy - 0.6, 0.6, '#1a1410');
  }

  function corocora(ctx, fase, comiendo, t) { // ibis escarlata de los llanos
    const roja = '#e3402e';
    linea(ctx, { x: -1, y: -12 }, { x: -1 + fase * 1.5, y: 0 }, '#c43a2a', 1.3);
    linea(ctx, { x: 2, y: -12 }, { x: 2 - fase * 1.5, y: 0 }, '#c43a2a', 1.3);
    elipse(ctx, 0, -15, 7, 4.6, roja, -0.2);
    poli(ctx, [{ x: -6, y: -16 }, { x: -11, y: -14 }, { x: -6, y: -13 }], '#2a1a1a');
    const baja = comiendo ? 9 : 0;
    ctx.strokeStyle = roja; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(5, -17); ctx.quadraticCurveTo(9, -23 + baja * 0.4, 7, -27 + baja * 1.4); ctx.stroke();
    circulo(ctx, 7, -27 + baja * 1.4, 2.4, roja);
    ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(8.5, -27 + baja * 1.4); ctx.quadraticCurveTo(13, -26 + baja * 1.4, 14, -21 + baja * 1.4); ctx.stroke();
  }

  function pelicano(ctx, fase, comiendo, t) {
    linea(ctx, { x: -2, y: -7 }, { x: -2 + fase, y: 0 }, '#6a5a4a', 1.8);
    linea(ctx, { x: 2, y: -7 }, { x: 2 - fase, y: 0 }, '#6a5a4a', 1.8);
    elipse(ctx, 0, -13, 9, 6.5, '#8a8076', -0.2);
    elipse(ctx, -2, -13, 6, 3.5, '#6f665d', -0.2);
    linea(ctx, { x: 5, y: -16 }, { x: 6, y: -24 }, '#f2ede2', 3.4);
    circulo(ctx, 6.4, -25.5, 3, '#f2ede2');
    poli(ctx, [{ x: 8, y: -27 }, { x: 20, y: -22 }, { x: 8, y: -24 }], '#d9a14a');
    elipse(ctx, 12, -21.5, 4, 1.8, '#c98f40');
    circulo(ctx, 7, -26.4, 0.7, '#1a1410');
  }

  function iguana(ctx, fase, comiendo, t) {
    ctx.strokeStyle = '#5c8f3a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, -3); ctx.quadraticCurveTo(-14, -2 + Math.sin(t * 3) * 1.5, -20, -0.5); ctx.stroke();
    for (const [x0, f] of [[-4, fase], [4, -fase]]) {
      linea(ctx, { x: x0, y: -3 }, { x: x0 - 2 + f, y: 0 }, '#4f7d32', 1.6);
      linea(ctx, { x: x0, y: -3 }, { x: x0 + 2 - f, y: 0 }, '#4f7d32', 1.6);
    }
    elipse(ctx, 0, -4, 8, 3, '#6fa845');
    for (let k = 0; k < 6; k++) poli(ctx, [{ x: -5 + k * 2, y: -6.6 }, { x: -4 + k * 2, y: -9 }, { x: -3 + k * 2, y: -6.6 }], '#4f7d32');
    elipse(ctx, 9.5, -5, 3.6, 2.4, '#7cb850');
    circulo(ctx, 10.5, -5.8, 0.6, '#1a1410');
  }

  function cangrejo(ctx, fase, comiendo, t) {
    const roj = '#d6452e';
    for (let k = -1; k <= 1; k++) {
      linea(ctx, { x: -4, y: -3 + k }, { x: -9, y: 0 + k * 1.6 + fase * 0.6 }, roj, 1.2);
      linea(ctx, { x: 4, y: -3 + k }, { x: 9, y: 0 + k * 1.6 - fase * 0.6 }, roj, 1.2);
    }
    elipse(ctx, 0, -4, 6, 3.6, roj);
    const pinza = Math.sin(t * 6) * 0.3;
    elipse(ctx, -7, -8, 2.6, 2, '#e8583e', pinza); elipse(ctx, 7, -8, 2.6, 2, '#e8583e', -pinza);
    linea(ctx, { x: -1.6, y: -6.5 }, { x: -1.6, y: -9 }, roj, 0.9); linea(ctx, { x: 1.6, y: -6.5 }, { x: 1.6, y: -9 }, roj, 0.9);
    circulo(ctx, -1.6, -9.4, 0.9, '#1a1410'); circulo(ctx, 1.6, -9.4, 0.9, '#1a1410');
  }

  const PEQUENOS = { gallina, corocora, pelicano, iguana, cangrejo };

  /**
   * Animal en el suelo. (x,y) = punto entre las patas.
   * o: { dir: 1|-1, t: segundos, caminando: bool, comiendo: bool }
   */
  function animal(ctx, tipo, x, y, o = {}) {
    const t = o.t || 0;
    const fase = o.caminando ? Math.sin(t * 9) : 0;
    const q = CUADRUPEDOS[tipo];
    const ancho = q ? q.rx + 3 : 8;
    elipse(ctx, x, y, ancho, ancho * 0.35, 'rgba(0,0,0,0.22)');
    ctx.save();
    ctx.translate(x, y - (o.caminando ? Math.abs(Math.cos(t * 9)) * 1 : 0));
    ctx.scale(tipo === 'cangrejo' ? 1 : (o.dir < 0 ? -1 : 1), 1);
    ctx.lineCap = 'round';
    if (q) cuadrupedo(ctx, q, fase, !!o.comiendo, t);
    else (PEQUENOS[tipo] || gallina)(ctx, fase, !!o.comiendo, t);
    ctx.restore();
  }

  // Aves que vuelan sobre el mapa: colores (cuerpo, ala, cabeza), envergadura y aleteo.
  const AVES = {
    garza:     { cuerpo: '#ffffff', ala: '#f1f1ec', cabeza: '#ffffff', pico: '#f0c03a', env: 22, aleteo: 5 },
    condor:    { cuerpo: '#1f1d1c', ala: '#2b2826', cabeza: '#d68b74', cuello: '#ffffff', pico: '#e8dcc0', env: 38, aleteo: 1.5 },
    turpial:   { cuerpo: '#f39a1e', ala: '#1c1a18', cabeza: '#1c1a18', pico: '#9aa0a8', env: 12, aleteo: 12, franja: '#ffffff' },
    guacamaya: { cuerpo: '#d8262b', ala: '#2a62c9', cabeza: '#d8262b', pico: '#efe8d8', env: 24, aleteo: 6, franja: '#f2c21a', colaLarga: true },
    pelicano:  { cuerpo: '#8a8076', ala: '#6f665d', cabeza: '#f2ede2', pico: '#d9a14a', env: 30, aleteo: 3 },
  };

  /** Ave volando. (x,y) en el aire; dir = hacia dónde va (1 derecha, -1 izquierda). */
  function ave(ctx, tipo, x, y, t, dir, sem) {
    const a = AVES[tipo] || AVES.garza;
    const ang = Math.sin(t * a.aleteo + sem * 6) * 0.9;
    ctx.save();
    ctx.translate(x, y); ctx.scale(dir < 0 ? -1 : 1, 1);
    const e = a.env;
    const alaY = -Math.sin(ang) * e * 0.55;
    poli(ctx, [{ x: -3, y: 0 }, { x: 3, y: 0 }, { x: -e * 0.25, y: alaY - 2 }, { x: -e * 0.6, y: alaY }], a.ala);
    if (a.franja) poli(ctx, [{ x: -1, y: 0 }, { x: 2, y: 0 }, { x: -e * 0.25, y: alaY * 0.6 - 1 }], a.franja);
    if (a.colaLarga) poli(ctx, [{ x: -5, y: 0 }, { x: -e * 0.9, y: 3 }, { x: -e * 0.85, y: 5 }], a.cuerpo);
    else poli(ctx, [{ x: -5, y: 0 }, { x: -e * 0.35, y: -2 }, { x: -e * 0.35, y: 3 }], a.cuerpo);
    elipse(ctx, 0, 0, e * 0.28, e * 0.1 + 2, a.cuerpo);
    if (a.cuello) elipse(ctx, e * 0.22, -1, 3, 2.6, a.cuello);
    circulo(ctx, e * 0.3, -1.5, Math.max(2.2, e * 0.08), a.cabeza);
    poli(ctx, [{ x: e * 0.3 + 2, y: -2.2 }, { x: e * 0.3 + (tipo === 'pelicano' ? 13 : 6), y: -0.5 }, { x: e * 0.3 + 2, y: 0 }], a.pico);
    poli(ctx, [{ x: -3, y: 0 }, { x: 3, y: 0 }, { x: -e * 0.15, y: -alaY * 0.7 - 1 }, { x: -e * 0.45, y: -alaY * 0.7 }], a.ala);
    ctx.restore();
  }

  // ---------- Personajes ----------

  const PAL = {
    indigena: { piel: '#b67a4c', pelo: '#1d1612', tunica: '#d9a13b', borde: '#b8322a', pie: '#9a6439' },
    espanol: { piel: '#eab994', pelo: '#5a3a22', jubon: '#2f5b94', cuello: '#f7f4ec', calza: '#7e2f2f', media: '#e9e1cf', bota: '#5b3a1e', sombrero: '#4b3425', pluma: '#c0392b' },
  };

  /**
   * Muñeco del jugador. (x,y) = punto entre los pies.
   * o: { dir: 1|-1 (mira a la derecha/izquierda), frente: bool (se ve la cara o la espalda),
   *      caminando: bool, t: segundos, escala, salto: 0..1 }
   */
  function avatar(ctx, etnia, x, y, o = {}) {
    const ind = etnia === 'indigena';
    const c = PAL[ind ? 'indigena' : 'espanol'];
    const dir = o.dir < 0 ? -1 : 1, k = o.escala || 1, t = o.t || 0;
    const cam = !!o.caminando, frente = o.frente !== false;
    const salto = Math.sin(Math.PI * Math.min(1, o.salto || 0)) * 7;

    elipse(ctx, x, y, 10.5 * k, 4.4 * k, 'rgba(0,0,0,0.25)');
    ctx.save();
    ctx.translate(x, y - salto * k);
    ctx.scale(dir * k, k);
    const fase = cam ? Math.sin(t * 11) : 0;
    ctx.translate(0, cam ? -Math.abs(Math.cos(t * 11)) * 2.2 : Math.sin(t * 2.2) * -0.7);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // piernas
    for (const [bx, f] of [[-3, fase], [3, -fase]]) {
      const fx = bx + f * 3.6, fy = -Math.max(0, f) * 2.2;
      linea(ctx, { x: bx, y: -10 }, { x: fx, y: fy - 1.5 }, ind ? c.piel : c.media, 4.2);
      elipse(ctx, fx + 0.8, fy - 0.6, ind ? 3.6 : 4.5, 2.3, ind ? c.pie : c.bota);
    }
    if (ind) elipse(ctx, 0, -29, 8.6, 10.5, c.pelo); // cabello largo detrás
    else rr(ctx, -7.6, -14, 15.2, 7.5, 3, c.calza); // calzas

    // torso
    rr(ctx, -7, -27, 14, 17, 4, ind ? c.tunica : c.jubon);
    if (ind) {
      rr(ctx, -7, -13, 14, 3.2, 1.4, c.borde);
      for (let i = 0; i < 4; i++) { // dibujo geométrico del borde
        const px = -5.2 + i * 3.5;
        poli(ctx, [{ x: px, y: -11.4 }, { x: px + 1.3, y: -12.8 }, { x: px + 2.6, y: -11.4 }, { x: px + 1.3, y: -10.4 }], '#f2d27a');
      }
      if (frente) for (let i = -3; i <= 3; i++) circulo(ctx, i * 1.8, -26 + Math.abs(i) * 0.7, 1.05, i % 2 ? '#f2e6c8' : '#d94a3a');
    } else {
      rr(ctx, -7, -16, 14, 2.4, 1, '#5b3a1e');
      if (frente) for (let i = 0; i < 3; i++) circulo(ctx, 0, -24 + i * 3, 0.9, '#e6c35c');
      elipse(ctx, 0, -27, 6.4, 2.6, c.cuello); // gorguera
    }

    // brazos
    for (const [lado, f] of [[-1, -fase], [1, fase]]) {
      const hx = lado * 9 + f * 2.4, hy = -14 - Math.abs(f) * 1.2;
      linea(ctx, { x: lado * 6.6, y: -25 }, { x: hx, y: hy }, ind ? c.piel : c.jubon, 3.8);
      circulo(ctx, hx, hy + 0.6, 2.2, c.piel);
    }

    // cabeza
    const hy = -33.5;
    if (ind) {
      elipse(ctx, 0, hy, 7.3, 7.6, c.piel);
      if (frente) {
        ctx.beginPath(); ctx.ellipse(0, hy - 1, 7.7, 6.9, 0, Math.PI, TAU); ctx.fillStyle = c.pelo; ctx.fill();
        rr(ctx, -7.4, -38.6, 14.8, 2.9, 1.2, '#c0392b'); // cinta
        rr(ctx, -7.4, -37.5, 14.8, 0.9, 0.4, '#f2d27a');
      } else {
        elipse(ctx, 0, hy, 7.7, 7.9, c.pelo);
        rr(ctx, -7.6, -38.6, 15.2, 2.9, 1.2, '#c0392b');
      }
      ctx.save(); ctx.translate(5.8, -40); ctx.rotate(0.55); // pluma
      elipse(ctx, 0, -3, 1.9, 6, '#f5f0e6'); elipse(ctx, 0, -7, 1.6, 2.6, '#c0392b');
      ctx.restore();
    } else {
      elipse(ctx, 0, hy, 7.3, 7.6, c.piel);
      if (frente) {
        ctx.beginPath(); ctx.ellipse(0, -31.4, 6.6, 5.4, 0, 0, Math.PI); ctx.fillStyle = c.pelo; ctx.fill(); // barba
        elipse(ctx, 0, -30.4, 2.6, 1.5, '#b87a62'); // boca entre la barba
        elipse(ctx, -2.2, -31.6, 2.1, 0.9, c.pelo); elipse(ctx, 2.2, -31.6, 2.1, 0.9, c.pelo); // bigote
      } else {
        elipse(ctx, 0, hy, 7.6, 7.8, c.pelo);
      }
      elipse(ctx, 0, -40.4, 12.8, 3.5, c.sombrero); // ala
      elipse(ctx, 0, -39.8, 12.8, 3, 'rgba(0,0,0,0.25)');
      rr(ctx, -6.4, -49.4, 12.8, 9.6, 3.2, c.sombrero); // copa
      rr(ctx, -6.4, -42.8, 12.8, 2.2, 0.6, '#2a1c12');
      ctx.strokeStyle = c.pluma; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(5, -46.4); ctx.quadraticCurveTo(11, -48.4, 12, -54.4); ctx.stroke();
    }
    if (frente) { // cara
      circulo(ctx, -2.8, -33.4, 1.15, '#2b1b12'); circulo(ctx, 2.8, -33.4, 1.15, '#2b1b12');
      ctx.strokeStyle = '#5a2d1b'; ctx.lineWidth = 1;
      if (ind) { ctx.beginPath(); ctx.arc(0, -30.6, 1.7, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
      if (ind) { circulo(ctx, -4.6, -31.6, 1.2, 'rgba(210,90,70,0.3)'); circulo(ctx, 4.6, -31.6, 1.2, 'rgba(210,90,70,0.3)'); }
    }
    ctx.restore();
  }

  Conuco.Sprites = {
    poli, rombo, elipse, rr, circulo,
    fondoZona, isla, sueloTile, laguna, parcelaSuelo, parcelaBloqueadaBorde, terrenoVelo, letrero,
    parcelaResalte, tileResalte, esquinasParcela,
    planta, FORMAS_GRANDES, arbol, edificio, avatar, animal, ave,
  };
})(typeof window !== 'undefined' ? window : globalThis);
