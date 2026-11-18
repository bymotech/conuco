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

  /** Borde de "isla" con tierra visible por los dos lados frontales. */
  function isla(ctx) {
    const W = M.ANCHO, H = M.ALTO, e = 24;
    const T = P(0, 0), R = P(W, 0), B = P(W, H), L = P(0, H);
    // sombra suave debajo
    poli(ctx, [{ x: T.x, y: T.y + e + 10 }, { x: R.x + 6, y: R.y + e + 10 }, { x: B.x, y: B.y + e + 14 }, { x: L.x - 6, y: L.y + e + 10 }], 'rgba(40,80,30,0.16)');
    poli(ctx, [L, B, { x: B.x, y: B.y + e }, { x: L.x, y: L.y + e }], '#7a5230');
    poli(ctx, [B, R, { x: R.x, y: R.y + e }, { x: B.x, y: B.y + e }], '#8f6338');
    // vetas de tierra
    ctx.strokeStyle = 'rgba(60,35,15,0.25)'; ctx.lineWidth = 1.5;
    for (let k = 1; k < 5; k++) {
      const yy = 5 + k * 4;
      ctx.beginPath(); ctx.moveTo(L.x, L.y + yy); ctx.lineTo(B.x, B.y + yy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(B.x, B.y + yy); ctx.lineTo(R.x, R.y + yy); ctx.stroke();
    }
    poli(ctx, [L, B, { x: B.x, y: B.y + 6 }, { x: L.x, y: L.y + 6 }], '#4f8a32');
    poli(ctx, [B, R, { x: R.x, y: R.y + 6 }, { x: B.x, y: B.y + 6 }], '#5e9a3a');
    poli(ctx, [T, R, B, L], '#79b84a');
  }

  /** Una casilla de pasto o camino de tierra. */
  function sueloTile(ctx, tx, ty, tipo) {
    const p = P(tx, ty);
    const cx = p.x, cy = p.y + HH;
    const h = Iso.hash(tx, ty);
    if (tipo === 'camino') {
      rombo(ctx, cx, cy, HW + 0.8, HH + 0.4);
      ctx.fillStyle = `hsl(34, ${42 + h * 8}%, ${61 + h * 7}%)`;
      ctx.fill();
      if (h > 0.4) { // piedritas
        const ox = (Iso.hash(tx, ty, 2) - 0.5) * HW, oy = (Iso.hash(tx, ty, 3) - 0.5) * HH * 0.8;
        elipse(ctx, cx + ox, cy + oy, 3, 1.7, 'rgba(120,85,45,0.55)');
        elipse(ctx, cx + ox + 7, cy + oy + 2, 1.8, 1, 'rgba(120,85,45,0.45)');
      }
      return;
    }
    rombo(ctx, cx, cy, HW + 0.8, HH + 0.4);
    ctx.fillStyle = `hsl(${96 + h * 10}, ${44 + h * 8}%, ${51 + h * 6}%)`;
    ctx.fill();
    if (Iso.hash(tx, ty, 2) > 0.5) { // matas de pasto
      const ox = (Iso.hash(tx, ty, 3) - 0.5) * HW * 1.1, oy = (Iso.hash(tx, ty, 4) - 0.5) * HH * 0.9;
      ctx.strokeStyle = 'rgba(40,110,40,0.55)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(cx + ox + k * 2.2, cy + oy); ctx.lineTo(cx + ox + k * 3.2, cy + oy - 4.6); ctx.stroke();
      }
    }
    const f = Iso.hash(tx, ty, 5);
    if (f > 0.92) { // florecitas
      circulo(ctx, cx + (Iso.hash(tx, ty, 6) - 0.5) * HW, cy + (Iso.hash(tx, ty, 7) - 0.5) * HH * 0.7, 1.7,
        ['#ffffff', '#ffe066', '#ff9fb2'][Math.floor(f * 100) % 3]);
    }
  }

  /** Esquinas (en píxeles) de la parcela `i`, con un pequeño margen hacia adentro. */
  function esquinasParcela(i, m = 0.05) {
    const o = Iso.parcelaOrigen(i);
    const a = o.x + m, b = o.y + m, c = o.x + M.PARCELA_TAM - m, d = o.y + M.PARCELA_TAM - m;
    return { T: P(a, b), R: P(c, b), B: P(c, d), L: P(a, d), x0: a, y0: b, x1: c, y1: d };
  }

  /** Cantero de tierra de una parcela (con surcos) o, si está bloqueada, terreno enmalezado. */
  function parcelaSuelo(ctx, i, bloqueada) {
    const { T, R, B, L, x0, y0, x1, y1 } = esquinasParcela(i);
    const e = 5;
    poli(ctx, [L, B, { x: B.x, y: B.y + e }, { x: L.x, y: L.y + e }], bloqueada ? '#5c4d30' : '#4a2e16');
    poli(ctx, [B, R, { x: R.x, y: R.y + e }, { x: B.x, y: B.y + e }], bloqueada ? '#6e5e3b' : '#5d3a1b');
    if (bloqueada) {
      poli(ctx, [T, R, B, L], '#74a24a');
      ctx.strokeStyle = 'rgba(40,100,40,0.6)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      for (let k = 0; k < 9; k++) { // malezas
        const u = x0 + (x1 - x0) * (0.12 + 0.76 * Iso.hash(i, k, 1));
        const v = y0 + (y1 - y0) * (0.12 + 0.76 * Iso.hash(i, k, 2));
        const p = P(u, v);
        for (let s = -1; s <= 1; s++) {
          ctx.beginPath(); ctx.moveTo(p.x + s * 2, p.y); ctx.lineTo(p.x + s * 3.6, p.y - 6); ctx.stroke();
        }
      }
      ctx.setLineDash([6, 4]); ctx.strokeStyle = '#d5b070'; ctx.lineWidth = 2.2;
      poli(ctx, [T, R, B, L], null, '#d5b070');
      ctx.setLineDash([]);
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
    // borde de madera
    ctx.lineWidth = 2; poli(ctx, [T, R, B, L], null, '#4a2e16');
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

  /**
   * Una planta de un rubro. `prog` va de 0 a 1; `listo` = lista para cosechar.
   * Crece de brote a planta adulta; al estar lista muestra el fruto característico.
   */
  function planta(ctx, id, x, y, prog, listo, t, sem) {
    const s = listo ? 1 : 0.24 + 0.76 * Math.min(1, prog / 0.92);
    const bal = Math.sin(t * 1.7 + sem * 6.28) * 1.4 * s;
    elipse(ctx, x, y + 1, 6 * s + 3, 2.6 * s + 1.4, 'rgba(0,0,0,0.2)');
    if (prog < 0.28 && !listo) { brote(ctx, x, y, prog, bal); return; }

    switch (id) {
      case 'maiz': {
        const h = 40 * s, tx = x + bal, ty = y - h;
        linea(ctx, { x, y }, { x: tx, y: ty }, '#4f8f2f', 2.6 * Math.max(0.6, s));
        for (let k = 0; k < 3; k++) {
          const f = 0.3 + 0.24 * k;
          hoja(ctx, x + bal * f, y - h * f, k % 2 ? -0.45 : Math.PI + 0.45, 16 * s, 4.4 * s, k % 2 ? '#5fae3a' : '#4a9a30');
        }
        if (prog > 0.6 || listo) {
          ctx.save();
          ctx.translate(x + bal * 0.55 + 3 * s, y - h * 0.52); ctx.rotate(-0.25);
          elipse(ctx, 0, 0, 3.4 * s, 7.2 * s, '#7fbf4a');
          if (listo) elipse(ctx, 0.4, -1.2 * s, 2.4 * s, 5.4 * s, '#f4c430');
          ctx.restore();
        }
        ctx.strokeStyle = '#d8c07a'; ctx.lineWidth = 1; ctx.lineCap = 'round';
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + k * 2.3 * s, ty - 5.5 * s); ctx.stroke(); }
        break;
      }
      case 'yuca': {
        const a = { x: x + bal * 0.8 - 3 * s, y: y - 22 * s }, b = { x: x + bal + 3 * s, y: y - 27 * s };
        linea(ctx, { x: x - 1, y }, a, '#9b4a3a', 2.2 * s + 0.5);
        linea(ctx, { x: x + 1, y }, b, '#a85848', 2.2 * s + 0.5);
        for (const top of [a, b]) {
          for (let k = 0; k < 6; k++) {
            hoja(ctx, top.x, top.y, -Math.PI / 2 + (k - 2.5) * 0.52, 15 * s, 4.4 * s, k % 2 ? '#2f7d32' : '#3b9140');
          }
        }
        if (listo) { // raíces asomando
          elipse(ctx, x - 5, y + 1, 5, 2.4, '#c9a27a', 0.3);
          elipse(ctx, x + 5, y + 1.5, 5.5, 2.6, '#bf9468', -0.25);
          elipse(ctx, x, y + 3, 4.5, 2.2, '#d2ad86', 0.05);
        }
        break;
      }
      case 'caraota': {
        const r = s;
        circulo(ctx, x - 5 * r, y - 6 * r, 7 * r, '#3f8f3a');
        circulo(ctx, x + 5 * r, y - 6 * r, 7 * r, '#357d33');
        circulo(ctx, x, y - 11 * r, 8 * r, '#4aa043');
        circulo(ctx, x - 2 * r, y - 13 * r, 4 * r, '#63b858');
        if (prog > 0.6 || listo) {
          for (const [dx, dy] of [[-8, -4], [0, -3], [8, -5]]) {
            ctx.save(); ctx.translate(x + dx * r, y + dy * r); ctx.rotate(0.35 * (dx < 0 ? 1 : -1));
            elipse(ctx, 0, 0, 1.8 * r, 5.2 * r, listo ? '#2a1f24' : '#6f9f45');
            ctx.restore();
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
          for (let k = 0; k < 5; k++) elipse(ctx, tx + 4 + k * 0.6, ty + 8 + k * 2.6, 2.4, 5, '#f4d03f', 0.4 - k * 0.05);
          elipse(ctx, tx + 5, ty + 20, 2.6, 3.4, '#7a2e5a');
        }
        break;
      }
      case 'cacao': {
        linea(ctx, { x, y }, { x, y: y - 22 * s }, '#6b4423', 3.8 * s + 0.4);
        [[-8, -26, 8, '#2f7a33'], [8, -27, 8, '#3a8c3c'], [0, -33, 9, '#46a048'], [-2, -24, 7, '#2f7a33']].forEach(([dx, dy, r, c]) => {
          circulo(ctx, x + dx * s + bal * 0.5, y + dy * s, r * s, c);
        });
        if (prog > 0.6 || listo) {
          for (const [dx, dy] of [[-4, -14], [4, -10], [0, -18]]) {
            elipse(ctx, x + dx * s, y + dy * s, 2.7 * s, 4.4 * s, listo ? '#e0802b' : '#7ab648', 0.3);
          }
        }
        break;
      }
      default: { // cafe
        circulo(ctx, x, y - 9 * s, 9 * s, '#245f2e');
        circulo(ctx, x - 7 * s, y - 7 * s, 7 * s, '#2a6d33');
        circulo(ctx, x + 7 * s, y - 7 * s, 7 * s, '#2a6d33');
        circulo(ctx, x - 2 * s, y - 12 * s, 5 * s, '#3c8b3f');
        if (prog > 0.45 && !listo) for (const [dx, dy] of BAYAS.slice(0, 4)) circulo(ctx, x + dx * s, y + dy * s, 1.3, '#ffffff');
        if (prog > 0.7 || listo) for (const [dx, dy] of BAYAS) circulo(ctx, x + dx * s, y + dy * s, 1.9 * s + 0.4, listo ? '#c8212b' : '#7fa03a');
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

  function arbol(ctx, a, t) {
    const p = P(a.x + 0.5, a.y + 0.5);
    const sem = Iso.hash(a.x, a.y, 9);
    if (a.tipo === 'palma') palma(ctx, p.x, p.y, t, sem);
    else if (a.tipo === 'mango') mango(ctx, p.x, p.y, t, sem);
    else araguaney(ctx, p.x, p.y, t, sem);
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
    poli, rombo, elipse, rr,
    isla, sueloTile, parcelaSuelo, parcelaResalte, tileResalte, esquinasParcela,
    planta, arbol, edificio, avatar,
  };
})(typeof window !== 'undefined' ? window : globalThis);
