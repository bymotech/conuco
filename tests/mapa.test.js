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

const igual = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
let pruebas = 0;
function prueba(nombre, fn) { fn(); pruebas++; console.log('  ✔', nombre); }

const Conuco = crearMundo();
const { Iso, MAPA: M } = Conuco;

console.log('Mapa isométrico');

const C0 = crearMundo();
C0.State.cargar();
const I = C0.Iso;
const comprarTodo = (C) => C.State.mutar((s) => { s.terrenos = s.terrenos.map(() => true); });

prueba('proyección: pantalla <-> casilla es reversible', () => {
  for (const [tx, ty] of [[0, 0], [3.5, 7.25], [35, 2], [20, 30]]) {
    const p = Iso.aPantalla(tx, ty);
    const t = Iso.aTile(p.x, p.y);
    assert.ok(Math.abs(t.tx - tx) < 1e-9 && Math.abs(t.ty - ty) < 1e-9);
  }
});

prueba('el mapa es de 36x36: 3x3 terrenos de 12x12', () => {
  assert.equal(M.ANCHO, 36);
  assert.equal(M.ALTO, 36);
  assert.equal(Iso.terrenoDe(0, 0), 0);
  assert.equal(Iso.terrenoDe(13, 13), 4);
  assert.equal(Iso.terrenoDe(35, 35), 8);
});

prueba('81 parcelas de 2x2, pegadas en campos de 3x3 y reconocibles al revés', () => {
  const vistas = new Set();
  for (let i = 0; i < Conuco.TOTAL_PARCELAS; i++) {
    const o = Iso.parcelaOrigen(i);
    assert.equal(Iso.terrenoDe(o.x, o.y), Conuco.terrenoDeParcela(i));
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const k = (o.x + dx) + ',' + (o.y + dy);
      assert.ok(!vistas.has(k), 'parcelas solapadas');
      vistas.add(k);
      assert.equal(Iso.parcelaEnTile(o.x + dx, o.y + dy), i);
    }
  }
  // pegadas: el campo de cada terreno es un bloque de 6x6 sin huecos
  const o = Iso.origenTerreno(4);
  for (let j = 0; j < 6; j++) for (let k = 0; k < 6; k++) assert.ok(Iso.parcelaEnTile(o.x + 3 + k, o.y + 3 + j) >= 0);
});

prueba('las parcelas 0..8 son del terreno inicial y las 4 primeras forman un bloque', () => {
  for (let i = 0; i < 9; i++) assert.equal(Conuco.terrenoDeParcela(i), M.TERRENO_INICIAL);
  const xs = [0, 1, 2, 3].map((i) => Iso.parcelaOrigen(i));
  const minX = Math.min(...xs.map((p) => p.x)), minY = Math.min(...xs.map((p) => p.y));
  const claves = new Set(xs.map((p) => (p.x - minX) + ',' + (p.y - minY)));
  for (const k of ['0,0', '2,0', '0,2', '2,2']) assert.ok(claves.has(k));
});

prueba('al empezar solo se camina por el terreno inicial', () => {
  assert.equal(Iso.esCaminable(M.SPAWN.x, M.SPAWN.y), true);
  const fuera = Iso.origenTerreno(1);
  assert.equal(Iso.esCaminable(fuera.x + 5, fuera.y + 2), false);
  assert.equal(Iso.buscarCamino(M.SPAWN.x, M.SPAWN.y, fuera.x + 5, fuera.y + 2), null);
});

prueba('en todas las zonas se llega a cada parcela y edificio (con todo comprado)', () => {
  for (const z of Conuco.ZONAS) {
    const C = crearMundo();
    C.State.cargar();
    C.Game.configurarPartida('indigena', '', z.id);
    comprarTodo(C);
    for (let i = 0; i < C.TOTAL_PARCELAS; i++) {
      const o = C.Iso.parcelaOrigen(i);
      assert.ok(C.Iso.buscarCamino(M.SPAWN.x, M.SPAWN.y, o.x, o.y), `${z.id}: parcela ${i}`);
    }
    for (const e of C.Iso.mapa().edificios.filter((e) => e.accion)) {
      assert.ok(C.Iso.caminoHastaEdificio(M.SPAWN.x, M.SPAWN.y, e), `${z.id}: ${e.id}`);
    }
    assert.ok(C.Iso.mapa().arboles.length > 40, `${z.id}: tiene árboles`);
  }
});

prueba('A*: no atraviesa obstáculos ni corta esquinas', () => {
  const C = crearMundo();
  C.State.cargar();
  C.Game.configurarPartida('indigena', '', 'llanos');
  comprarTodo(C);
  const ruta = C.Iso.buscarCamino(M.SPAWN.x, M.SPAWN.y, 1, 1);
  assert.ok(ruta && ruta.length);
  let x = M.SPAWN.x, y = M.SPAWN.y;
  for (const p of ruta) {
    assert.ok(C.Iso.esCaminable(p.tx, p.ty));
    const dx = p.tx - x, dy = p.ty - y;
    assert.ok(Math.abs(dx) <= 1 && Math.abs(dy) <= 1);
    if (dx && dy) assert.ok(C.Iso.esCaminable(x + dx, y) && C.Iso.esCaminable(x, y + dy));
    x = p.tx; y = p.ty;
  }
});

prueba('A*: destino bloqueado o fuera del mapa devuelve null; mismo lugar devuelve []', () => {
  const casa = I.mapa().edificios.find((e) => e.id === 'casa');
  assert.equal(Iso.buscarCamino(M.SPAWN.x, M.SPAWN.y, casa.x, casa.y), null);
  assert.equal(Iso.buscarCamino(M.SPAWN.x, M.SPAWN.y, -1, 3), null);
  igual(Iso.buscarCamino(M.SPAWN.x, M.SPAWN.y, M.SPAWN.x, M.SPAWN.y), []);
});

prueba('tipos de suelo: parcela, camino alrededor del campo, arena en la costa, agua en lagunas', () => {
  const o = Iso.origenTerreno(4);
  assert.equal(Iso.tipoSuelo(o.x + 3, o.y + 3), 'parcela');
  assert.equal(Iso.tipoSuelo(o.x + 2, o.y + 2), 'camino');
  assert.equal(Iso.tipoSuelo(o.x + 5, o.y + 11), 'camino', 'cruce hacia el terreno de abajo');
  const costa = crearMundo(); costa.State.cargar(); costa.Game.configurarPartida('indigena', '', 'costa');
  assert.equal(costa.Iso.tipoSuelo(0, 10), 'arena');
  const llanos = crearMundo(); llanos.State.cargar(); llanos.Game.configurarPartida('indigena', '', 'llanos');
  const lg = llanos.Iso.mapa().lagunas[0];
  assert.equal(llanos.Iso.tipoSuelo(lg.x, lg.y), 'agua');
  llanos.State.mutar((s) => { s.terrenos[0] = true; });
  assert.equal(llanos.Iso.esCaminable(lg.x, lg.y), false, 'no se camina por el agua');
});

prueba('animales: cada terreno tiene casillas libres, sin parcelas ni agua', () => {
  for (let t = 0; t < 9; t++) {
    const libres = Iso.casillasFauna(t);
    assert.ok(libres.length > 30);
    for (const c of libres) {
      assert.equal(Iso.terrenoDe(c.tx, c.ty), t);
      assert.notEqual(Iso.tipoSuelo(c.tx, c.ty), 'parcela');
    }
  }
});

prueba('tocar el edificio interactivo (incluida su altura) lo detecta', () => {
  const ch = I.mapa().edificios.find((e) => e.id === 'churuata');
  const c = Iso.aPantalla(ch.x + 1, ch.y + 1);
  assert.equal(Iso.edificioEnPunto(c.x, c.y - 50).id, 'churuata');
  const casa = I.mapa().edificios.find((e) => e.id === 'casa');
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
    conuco_save_v1: JSON.stringify({ version: 3, zona: 'atlantida', terrenos: [true, 'si', 1], jugador: { etnia: 'dragon', nombre: '<script>x</script>'.repeat(5), tx: 9999, ty: -4 } }),
  };
  const C = crearMundo(almacen);
  C.State.cargar();
  const j = C.State.get().jugador;
  assert.equal(j.etnia, null);
  assert.ok(!/[<>]/.test(j.nombre) && j.nombre.length <= 16);
  assert.ok(j.tx <= M.ANCHO && j.ty >= 0);
  const s = C.State.get();
  assert.equal(s.zona, null);
  igual(s.terrenos, [true, false, false, false, true, false, false, false, false]);
});

console.log(`\n${pruebas} pruebas OK`);
process.exit(0);
