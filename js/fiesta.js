/**
 * fiesta.js — Celebraciones: lluvia de confeti y estrellas sobre toda la pantalla,
 * y la tarjeta de "¡Subiste de nivel!".
 */
(function (global) {
  'use strict';
  const Conuco = global.Conuco;
  const doc = global.document;

  const COLORES = ['#f7c500', '#0b3d91', '#cf142b', '#6cbf3f', '#ff8fb1', '#ffffff', '#ff9f1c'];
  const TAU = Math.PI * 2;
  let canvas, ctx, piezas = [], andando = false, ultimo = 0, timerTarjeta = null;

  function preparar() {
    if (canvas) return;
    canvas = doc.getElementById('fiesta');
    ctx = canvas.getContext('2d');
    doc.getElementById('fiesta-ok').addEventListener('click', cerrarTarjeta);
  }

  function estrella(c, r) {
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
  }

  /**
   * Lanza confeti y estrellas desde un punto de la pantalla (por defecto, el centro).
   * @param {number} cantidad
   * @param {{x:number,y:number}} [origen] en píxeles de la ventana
   */
  function confeti(cantidad = 140, origen) {
    preparar();
    const w = global.innerWidth, h = global.innerHeight;
    const o = origen || { x: w / 2, y: h * 0.42 };
    for (let i = 0; i < cantidad; i++) {
      const a = Math.random() * TAU, v = 260 + Math.random() * 520;
      const esEstrella = i % 6 === 0;
      piezas.push({
        x: o.x, y: o.y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 380,
        rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12,
        tam: esEstrella ? 7 + Math.random() * 7 : 5 + Math.random() * 5,
        color: esEstrella ? (Math.random() < 0.7 ? '#ffd23f' : '#ffffff') : COLORES[i % COLORES.length],
        estrella: esEstrella, vida: 0, max: 2.6 + Math.random() * 1.4,
      });
    }
    // lluvia desde arriba
    for (let i = 0; i < cantidad / 2; i++) {
      piezas.push({
        x: Math.random() * w, y: -20 - Math.random() * h * 0.4, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 120,
        rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 8, tam: 5 + Math.random() * 4,
        color: COLORES[i % COLORES.length], estrella: i % 7 === 0, vida: 0, max: 4,
      });
    }
    if (!andando) { andando = true; ultimo = 0; global.requestAnimationFrame(cuadro); }
  }

  function cuadro(ms) {
    const dt = ultimo ? Math.min(0.05, (ms - ultimo) / 1000) : 0.016;
    ultimo = ms;
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const w = global.innerWidth, h = global.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    piezas = piezas.filter((p) => p.vida < p.max && p.y < h + 40);
    for (const p of piezas) {
      p.vida += dt;
      p.vy += 620 * dt;             // gravedad
      p.vx *= 1 - 1.6 * dt;         // roce del aire
      p.vy = Math.min(p.vy, 260);   // caen flotando
      p.x += p.vx * dt + Math.sin(p.vida * 6 + p.rot) * 0.6;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (p.max - p.vida) * 2);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.estrella) { estrella(ctx, p.tam); ctx.fill(); }
      else { ctx.scale(1, Math.abs(Math.cos(p.vida * 7 + p.rot))); ctx.fillRect(-p.tam / 2, -p.tam / 3, p.tam, p.tam * 0.66); }
      ctx.restore();
    }
    if (piezas.length) global.requestAnimationFrame(cuadro);
    else { andando = false; ctx.clearRect(0, 0, w, h); }
  }

  function cerrarTarjeta() {
    doc.getElementById('fiesta-tarjeta').hidden = true;
    if (timerTarjeta) { clearTimeout(timerTarjeta); timerTarjeta = null; }
  }

  /** Tarjeta de felicitación + confeti. */
  function celebrar(titulo, texto) {
    preparar();
    doc.getElementById('fiesta-titulo').textContent = titulo;
    doc.getElementById('fiesta-texto').textContent = texto;
    doc.getElementById('fiesta-tarjeta').hidden = false;
    confeti(160);
    setTimeout(() => confeti(70, { x: global.innerWidth * 0.2, y: global.innerHeight * 0.6 }), 450);
    setTimeout(() => confeti(70, { x: global.innerWidth * 0.8, y: global.innerHeight * 0.6 }), 800);
    if (timerTarjeta) clearTimeout(timerTarjeta);
    timerTarjeta = setTimeout(cerrarTarjeta, 7000);
  }

  Conuco.Fiesta = { confeti, celebrar };
})(window);
