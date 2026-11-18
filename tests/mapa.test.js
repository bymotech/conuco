/**
 * Pruebas del mapa isométrico, el pathfinding y el personaje (sin navegador).
 * Ejecutar:  node tests/mapa.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function crearMundo(almacen = {}) {
  const ctx = {
    console, setTimeout, clearTimeout, Math, Date,
    localStorage: {
      getItem: (k) => (k in almacen ? almacen[k] : null),
      setItem: (k, v) => { almacen[k] = String(v); },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['config', 'state', 'game', 'iso']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  }
  return ctx.Conuco;
}

let pruebas = 0;
function prueba(nombre, fn) { fn(); pruebas++; console.log('  ✔', nombre); }

const Conuco = crearMundo();
const { Iso, MAPA: M } = Conuco;

console.log('Mapa isométrico');

prueba('proyección: pantalla <-> casilla es reversible', () => {
  for (const [tx, ty] of [[0, 0], [3.5, 7.25], [16, 16], [8.5, 15.5]]) {
    const p = Iso.aPantalla(tx, ty);
    const t = Iso.aTile(p.x, p.y);
    assert.ok(Math.abs(t.tx - tx) < 1e-9 && Math.abs(t.ty - ty) < 1e-9);
  }
  // el vértice de arriba es (0,0) y la casilla de abajo queda más abajo en pantalla
  assert.equal(Iso.aPantalla(0, 0).y, 0);
  assert.ok(Iso.aPantalla(5, 5).y > Iso.aPantalla(1, 1).y);
});

prueba('las 16 parcelas ocupan 2x2 casillas distintas y se reconocen al revés', () => {
  const vistas = new Set();
  for (let i = 0; i < 16; i++) {
    const o = Iso.parcelaOrigen(i);
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const clave = `${o.x + dx},${o.y + dy}`;
        assert.ok(!vistas.has(clave), 'casilla repetida ' + clave);
        vistas.add(clave);
        assert.equal(Iso.parcelaEnTile(o.x + dx, o.y + dy), i);
      }
    }
  }
  assert.equal(vistas.size, 64);
  assert.equal(Iso.parcelaEnTile(5, 3), -1, 'el camino entre parcelas no es parcela');
  assert.equal(Iso.parcelaEnTile(0, 0), -1);
});

prueba('las 4 parcelas iniciales son las del centro del conuco', () => {
  const origenes = [0, 1, 2, 3].map((i) => Iso.parcelaOrigen(i)).map((o) => `${o.x},${o.y}`).sort();
  assert.deepEqual(origenes, ['6,6', '6,9', '9,6', '9,9'].sort());
});

prueba('desde la entrada se puede llegar a toda parcela y a cada edificio interactivo', () => {
  const { x, y } = M.SPAWN;
  for (let i = 0; i < 16; i++) {
    const o = Iso.parcelaOrigen(i);
    assert.ok(Iso.buscarCamino(x, y, o.x, o.y), 'parcela ' + i);
    assert.ok(Iso.buscarCamino(x, y, o.x + 1, o.y + 1), 'parcela ' + i + ' (esquina)');
  }
  for (const e of Iso.EDIFICIOS.filter((b) => b.accion)) {
    assert.ok(Iso.caminoHastaEdificio(x, y, e), 'edificio ' + e.id);
  }
});

prueba('A*: no atraviesa obstáculos ni corta esquinas', () => {
  let rutas = 0;
  for (let ty = 0; ty < M.ALTO; ty += 2) {
    for (let tx = 0; tx < M.ANCHO; tx += 2) {
      if (!Iso.esCaminable(tx, ty)) continue;
      const ruta = Iso.buscarCamino(M.SPAWN.x, M.SPAWN.y, tx, ty);
      assert.ok(ruta, `sin camino a ${tx},${ty}`);
      let px = M.SPAWN.x, py = M.SPAWN.y;
      for (const paso of ruta) {
        assert.ok(Iso.esCaminable(paso.tx, paso.ty), 'pisa un obstáculo');
        const dx = paso.tx - px, dy = paso.ty - py;
        assert.ok(Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx || dy), 'salto de más de una casilla');
        if (dx && dy) assert.ok(Iso.esCaminable(px + dx, py) && Iso.esCaminable(px, py + dy), 'corta una esquina');
        px = paso.tx; py = paso.ty;
      }
      assert.equal(`${px},${py}`, `${tx},${ty}`);
      rutas++;
    }
  }
  assert.ok(rutas > 30);
});

prueba('A*: destino bloqueado o fuera del mapa devuelve null; mismo lugar devuelve []', () => {
  const casa = Iso.EDIFICIOS.find((e) => e.id === 'casa');
  assert.equal(Iso.buscarCamino(8, 15, casa.x, casa.y), null);
  assert.equal(Iso.buscarCamino(8, 15, -1, 3), null);
  assert.equal(Iso.buscarCamino(8, 15, 99, 3), null);
  assert.equal(Iso.buscarCamino(8, 15, 8, 15).length, 0);
});

prueba('tipos de suelo: parcela, camino alrededor, entrada y pasto', () => {
  assert.equal(Iso.tipoSuelo(6, 6), 'parcela');
  assert.equal(Iso.tipoSuelo(5, 6), 'camino');
  assert.equal(Iso.tipoSuelo(2, 2), 'camino');   // anillo exterior
  assert.equal(Iso.tipoSuelo(8, 16), 'camino');  // entrada
  assert.equal(Iso.tipoSuelo(0, 9), 'pasto');
});

prueba('tocar el edificio interactivo (incluida su altura) lo detecta', () => {
  const ch = Iso.EDIFICIOS.find((e) => e.id === 'churuata');
  const c = Iso.aPantalla(ch.x + 1, ch.y + 1);
  assert.equal(Iso.edificioEnPunto(c.x, c.y - 40).id, 'churuata');
  assert.equal(Iso.edificioEnPunto(0, 400), null);
  const casa = Iso.EDIFICIOS.find((e) => e.id === 'casa');
  const cc = Iso.aPantalla(casa.x + 1, casa.y + 1);
  assert.equal(Iso.edificioEnPunto(cc.x, cc.y - 30), null, 'la casa es solo decorado');
});

console.log('Personaje y partidas antiguas');

prueba('partida nueva: sin personaje elegido y en la entrada', () => {
  const C = crearMundo();
  C.State.cargar();
  const j = C.State.get().jugador;
  assert.equal(j.etnia, null);
  assert.equal(Math.floor(j.tx), M.SPAWN.x);
  assert.equal(Math.floor(j.ty), M.SPAWN.y);
});

prueba('elegirAvatar: valida la etnia y limpia el nombre', () => {
  const C = crearMundo();
  C.State.cargar();
  assert.equal(C.Game.elegirAvatar('marciano', 'X').ok, false);
  assert.equal(C.State.get().jugador.etnia, null);
  const r = C.Game.elegirAvatar('espanol', '  <b>Pedro</b> con un nombre larguísimo  ');
  assert.equal(r.ok, true);
  const j = C.State.get().jugador;
  assert.equal(j.etnia, 'espanol');
  assert.ok(!/[<>]/.test(j.nombre));
  assert.ok(j.nombre.length <= 16);
  assert.equal(C.Game.elegirAvatar('indigena', '').ok, true);
  assert.equal(C.State.get().jugador.etnia, 'indigena');
  assert.equal(C.State.get().jugador.nombre, '');
});

prueba('guardarPosicion es silencioso (no redibuja paneles) pero se guarda', () => {
  const almacen = {};
  const C = crearMundo(almacen);
  C.State.cargar();
  let avisos = 0;
  C.State.suscribir(() => { avisos++; });
  C.Game.guardarPosicion(7.5, 9.5);
  assert.equal(avisos, 0);
  C.State.guardar();
  const guardado = JSON.parse(almacen.conuco_save_v1);
  assert.equal(guardado.jugador.tx, 7.5);
  assert.equal(guardado.jugador.ty, 9.5);
});

prueba('una partida v1 (sin jugador) conserva su progreso y pide elegir personaje', () => {
  const almacen = {
    conuco_save_v1: JSON.stringify({
      version: 1, dinero: 345, xp: 120, semillas: { maiz: 2 }, cosechas: { yuca: 3 },
      parcelas: [{ desbloqueada: true, cultivo: 'maiz', plantadoEn: Date.now() - 5000 }],
    }),
  };
  const C = crearMundo(almacen);
  const r = C.State.cargar();
  const s = C.State.get();
  assert.equal(r.nuevo, false);
  assert.equal(s.dinero, 345);
  assert.equal(s.xp, 120);
  assert.equal(s.parcelas[0].cultivo, 'maiz');
  assert.equal(s.jugador.etnia, null);
});

prueba('datos de jugador manipulados se corrigen', () => {
  const almacen = {
    conuco_save_v1: JSON.stringify({ jugador: { etnia: 'dragon', nombre: '<script>x</script>'.repeat(5), tx: 9999, ty: -4 } }),
  };
  const C = crearMundo(almacen);
  C.State.cargar();
  const j = C.State.get().jugador;
  assert.equal(j.etnia, null);
  assert.ok(!/[<>]/.test(j.nombre) && j.nombre.length <= 16);
  assert.ok(j.tx <= M.ANCHO && j.ty >= 0);
});

console.log(`\n${pruebas} pruebas OK`);
process.exit(0);
