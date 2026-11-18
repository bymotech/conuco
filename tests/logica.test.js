/**
 * Pruebas de la lógica del juego (sin navegador).
 * Ejecutar:  node tests/logica.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/** Carga los scripts del juego en un "navegador falso" con su propio localStorage. */
function crearMundo(almacen = {}, almacenamientoRoto = false) {
  const ctx = {
    console, setTimeout, clearTimeout, Math, Date,
    localStorage: almacenamientoRoto
      ? { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } }
      : {
        getItem: (k) => (k in almacen ? almacen[k] : null),
        setItem: (k, v) => { almacen[k] = String(v); },
      },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['config', 'state', 'game', 'iso']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  }
  return { Conuco: ctx.Conuco, almacen };
}

/** Carga la partida y hace la configuración inicial (zona Costa: maíz y yuca de inicio). */
function empezar(Conuco, zona = 'costa') {
  Conuco.State.cargar();
  Conuco.Game.configurarPartida('indigena', 'Ana', zona);
}

// Los objetos vienen de otro 'realm' (vm), así que se comparan como JSON.
const igual = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

let pruebas = 0;
function prueba(nombre, fn) {
  fn();
  pruebas++;
  console.log('  ✔', nombre);
}

console.log('Lógica del conuco');

prueba('partida nueva: 100 Bs, 4 parcelas; las semillas llegan al elegir zona', () => {
  const { Conuco } = crearMundo();
  const r = Conuco.State.cargar();
  const s = Conuco.State.get();
  assert.equal(r.nuevo, true);
  assert.equal(s.dinero, 100);
  assert.equal(s.zona, null);
  assert.equal(s.parcelas.length, 81);
  assert.equal(s.parcelas.filter((p) => p.desbloqueada).length, 4);
  igual(s.semillas, {});
  assert.equal(Conuco.Game.configurarPartida('indigena', 'Ana', 'costa').ok, true);
  igual(Conuco.State.get().semillas, { maiz: 4, yuca: 2 });
});

prueba('cada zona da sus propias semillas, solo la primera vez', () => {
  const { Conuco } = crearMundo();
  Conuco.State.cargar();
  const G = Conuco.Game;
  assert.equal(G.configurarPartida('espanol', '', 'andes').ok, true);
  igual(Conuco.State.get().semillas, { zanahoria: 4, papa: 2 });
  igual(G.cultivosDisponibles().map((c) => c.id), ['zanahoria', 'papa', 'ajo', 'fresa', 'durazno', 'cafe']);
  G.configurarPartida('espanol', '', 'andes');
  igual(Conuco.State.get().semillas, { zanahoria: 4, papa: 2 });
  assert.equal(G.configurarPartida('espanol', '', 'marte').ok, false);
  assert.equal(G.configurarPartida('vikingo', '', 'andes').ok, false);
});

prueba('todas las zonas tienen 6 rubros válidos, uno por escalón', () => {
  const { Conuco } = crearMundo();
  for (const z of Conuco.ZONAS) {
    const cs = Conuco.cultivosDeZona(z.id);
    assert.equal(cs.length, 6, z.id);
    cs.forEach((c, k) => assert.equal(c.escalon, k + 1, `${z.id}: ${c.id}`));
  }
});

prueba('terrenos: hay que ser vecino y tener el dinero; trae 9 parcelas y el precio se duplica', () => {
  const { Conuco } = crearMundo();
  empezar(Conuco);
  const G = Conuco.Game;
  const S = Conuco.State;
  assert.equal(G.costoTerreno(), 600);
  assert.equal(G.puedeComprarTerreno(0).razon, 'lejos', 'una esquina no toca el terreno inicial');
  assert.equal(G.comprarTerreno(1).ok, false, 'sin dinero');
  assert.equal(G.comprarTerreno(4).ok, false, 'el inicial ya es tuyo');
  S.mutar((s) => { s.dinero = 2000; });
  const r = G.comprarTerreno(1);
  assert.equal(r.ok, true);
  const s = S.get();
  assert.equal(s.dinero, 1400);
  assert.equal(s.terrenos[1], true);
  const abiertas = s.parcelas.map((p, i) => (p.desbloqueada ? i : -1)).filter((i) => i >= 9);
  assert.equal(abiertas.length, 9);
  assert.ok(abiertas.every((i) => Conuco.terrenoDeParcela(i) === 1));
  assert.equal(G.costoTerreno(), 1200);
  assert.equal(G.puedeComprarTerreno(0).razon, null, 'la esquina ya toca un terreno tuyo');
  assert.equal(G.comprarParcela(abiertas[0]).ok, false);
});

prueba('sembrar, crecer por timestamp y cosechar', () => {
  const { Conuco } = crearMundo();
  empezar(Conuco);
  const G = Conuco.Game;
  const t0 = 1_000_000;
  assert.equal(G.plantar(0, 'maiz', t0).ok, true);
  assert.equal(Conuco.State.get().semillas.maiz, 3);
  assert.equal(G.estadoParcela(Conuco.State.get().parcelas[0], t0 + 29_000).tipo, 'creciendo');
  assert.equal(G.cosechar(0, t0 + 29_000).ok, false, 'no se puede cosechar antes de tiempo');
  assert.equal(G.estadoParcela(Conuco.State.get().parcelas[0], t0 + 30_000).tipo, 'lista');
  const r = G.cosechar(0, t0 + 30_000);
  assert.equal(r.ok, true);
  const s = Conuco.State.get();
  assert.equal(s.cosechas.maiz, 2);
  assert.equal(s.xp, 3);
  assert.equal(s.parcelas[0].cultivo, null);
});

prueba('el cultivo sigue creciendo con el navegador cerrado (recarga)', () => {
  const almacen = {};
  const a = crearMundo(almacen);
  empezar(a.Conuco);
  const ahora = Date.now();
  a.Conuco.Game.plantar(1, 'yuca', ahora - 120_000); // sembrada hace 2 min (yuca: 90 s)
  a.Conuco.State.guardar();

  const b = crearMundo(almacen); // "nuevo navegador" con el mismo localStorage
  const r = b.Conuco.State.cargar();
  assert.equal(r.nuevo, false);
  assert.equal(b.Conuco.Game.estadoParcela(b.Conuco.State.get().parcelas[1], Date.now()).tipo, 'lista');
  assert.equal(b.Conuco.Game.contarListas(), 1);
});

prueba('vender da dinero y XP; "todo" vacía el inventario', () => {
  const { Conuco } = crearMundo();
  empezar(Conuco);
  const G = Conuco.Game;
  G.plantar(0, 'maiz', 0);
  G.cosechar(0, 30_000); // 2 maíz
  const r = G.vender('maiz', 'todo'); // 2 x 5 = 10 Bs
  assert.equal(r.ok, true);
  const s = Conuco.State.get();
  assert.equal(s.dinero, 110);
  assert.equal(s.cosechas.maiz, undefined);
  assert.equal(s.xp, 3 + 1);
  assert.equal(G.vender('maiz', 1).ok, false);
});

prueba('nivel: fórmula y desbloqueo de cultivos por nivel', () => {
  const { Conuco } = crearMundo();
  empezar(Conuco);
  const G = Conuco.Game;
  assert.equal(G.nivelDeXp(0), 1);
  assert.equal(G.nivelDeXp(49), 1);
  assert.equal(G.nivelDeXp(50), 2);
  assert.equal(G.nivelDeXp(200), 3);
  assert.equal(G.comprarSemillas('cafe', 1).ok, false, 'café pide nivel 5');
  Conuco.State.mutar((s) => { s.xp = 800; });
  assert.equal(G.comprarSemillas('cafe', 1).ok, true);
});

prueba('compras: sin dinero falla y no cambia nada', () => {
  const { Conuco } = crearMundo();
  Conuco.State.cargar();
  const antes = JSON.stringify(Conuco.State.get());
  assert.equal(Conuco.Game.comprarSemillas('maiz', 1000).ok, false);
  assert.equal(JSON.stringify(Conuco.State.get()), antes);
});

prueba('desbloquear parcela cuesta 80 Bs y el precio sube', () => {
  const { Conuco } = crearMundo();
  empezar(Conuco);
  const G = Conuco.Game;
  assert.equal(G.costoParcela(), 80);
  assert.equal(G.comprarParcela(4).ok, true);
  assert.equal(Conuco.State.get().dinero, 20);
  assert.equal(G.costoParcela(), 116);
  assert.equal(G.comprarParcela(4).ok, false);
});

prueba('cosechar todo junta varias parcelas', () => {
  const { Conuco } = crearMundo();
  empezar(Conuco);
  const G = Conuco.Game;
  G.plantar(0, 'maiz', 0);
  G.plantar(1, 'maiz', 0);
  const r = G.cosecharTodo(30_000);
  assert.equal(r.ok, true);
  assert.equal(Conuco.State.get().cosechas.maiz, 4);
  assert.equal(G.cosecharTodo(30_000).ok, false);
});

prueba('partida corrupta: se respalda y se empieza de cero', () => {
  const almacen = { conuco_save_v1: '{esto no es json' };
  const { Conuco } = crearMundo(almacen);
  const r = Conuco.State.cargar();
  assert.equal(r.nuevo, true);
  assert.equal(almacen.conuco_save_v1_corrupto, '{esto no es json');
  assert.equal(Conuco.State.get().dinero, 100);
});

prueba('datos manipulados se sanean (negativos, cultivos falsos, siembra del futuro)', () => {
  const futuro = Date.now() + 10 * 24 * 3600 * 1000;
  const almacen = {
    conuco_save_v1: JSON.stringify({
      dinero: -50, xp: 'abc',
      semillas: { maiz: 3, inventado: 99, yuca: -2 },
      parcelas: [{ desbloqueada: true, cultivo: 'maiz', plantadoEn: futuro }, { desbloqueada: true, cultivo: 'dragon', plantadoEn: 5 }],
    }),
  };
  const { Conuco } = crearMundo(almacen);
  Conuco.State.cargar();
  const s = Conuco.State.get();
  assert.equal(s.dinero, 100);          // valor inválido -> por defecto
  assert.equal(s.xp, 0);
  igual(s.semillas, { maiz: 3 });
  assert.ok(s.parcelas[0].plantadoEn <= Date.now() + 1000, 'siembra del futuro corregida');
  assert.equal(s.parcelas[1].cultivo, null);
  assert.equal(s.parcelas.length, 81);
});

prueba('partida del mapa chico (v2, 16 parcelas): se conserva y lo que sobra se devuelve', () => {
  const ahora = Date.now();
  const parcelas = [];
  for (let i = 0; i < 16; i++) parcelas.push({ desbloqueada: i < 12, cultivo: i === 2 || i === 10 ? 'cacao' : null, plantadoEn: ahora - 1000 });
  const almacen = {
    conuco_save_v1: JSON.stringify({
      version: 2, dinero: 500, xp: 300, semillas: { maiz: 1 }, cosechas: { cafe: 3 }, parcelas,
      jugador: { etnia: 'espanol', nombre: 'Pedro', tx: 8.5, ty: 15.5 },
    }),
  };
  const { Conuco } = crearMundo(almacen);
  Conuco.State.cargar();
  const s = Conuco.State.get();
  assert.equal(s.zona, null, 'tiene que elegir zona');
  assert.equal(s.jugador.etnia, 'espanol');
  assert.equal(s.jugador.nombre, 'Pedro');
  assert.equal(s.parcelas.slice(0, 9).filter((p) => p.desbloqueada).length, 9);
  assert.equal(s.parcelas[2].cultivo, 'cacao');
  assert.equal(s.dinero, 500 + 3 * 150, '3 parcelas compradas que no caben se devuelven');
  igual(s.semillas, { maiz: 1, cacao: 1 });
  igual(s.cosechas, { cafe: 3 });
  assert.equal(s.parcelas.slice(9).filter((p) => p.desbloqueada).length, 0);
  assert.equal(s.tutorial.hecho, true, 'ya sabe jugar: sin guía');
  assert.equal(s.jugador.tx, Conuco.MAPA.SPAWN.x + 0.5, 'vuelve a la entrada del mapa nuevo');
  // al elegir zona se agregan las semillas de inicio de la zona
  Conuco.Game.configurarPartida('espanol', 'Pedro', 'llanos');
  igual(Conuco.State.get().semillas, { maiz: 5, cacao: 1, arroz: 2 });
});

prueba('estadísticas de la guía: sembradas y semillas compradas', () => {
  const { Conuco } = crearMundo();
  empezar(Conuco);
  const G = Conuco.Game;
  G.plantar(0, 'maiz', 0);
  G.comprarSemillas('maiz', 3);
  const e = Conuco.State.get().estadisticas;
  assert.equal(e.sembradas, 1);
  assert.equal(e.semillasCompradas, 3);
  assert.equal(Conuco.State.get().tutorial.hecho, false);
  G.terminarTutorial();
  assert.equal(Conuco.State.get().tutorial.hecho, true);
});

prueba('sin localStorage (modo privado) el juego sigue funcionando', () => {
  const { Conuco } = crearMundo({}, true);
  empezar(Conuco);
  assert.equal(Conuco.State.esPersistente(), false);
  assert.equal(Conuco.Game.plantar(0, 'maiz', 0).ok, true);
  assert.equal(Conuco.Game.cosechar(0, 30_000).ok, true);
});

prueba('almacén: 20 semillas al empezar, +10 por nivel y +40 por granero', () => {
  const { Conuco } = crearMundo();
  empezar(Conuco);
  const G = Conuco.Game, S = Conuco.State;
  S.mutar((s) => { s.dinero = 10000; });
  assert.equal(G.capacidadSemillas(), 20);
  assert.equal(G.semillasGuardadas(), 6);
  assert.equal(G.comprarSemillas('maiz', 15).ok, false, 'no caben 15 (solo 14)');
  assert.equal(G.comprarSemillas('maiz', 14).ok, true);
  assert.equal(G.espacioSemillas(), 0);
  assert.equal(G.comprarSemillas('maiz', 1).ok, false, 'almacén lleno');
  S.mutar((s) => { s.xp = 50; }); // nivel 2
  assert.equal(G.capacidadSemillas(), 30);
  S.mutar((s) => { s.graneros.push({ x: 0, y: 0 }); });
  assert.equal(G.capacidadSemillas(), 70);
});

prueba('parcela extra: solo en espacio libre de un terreno tuyo; el precio sube', () => {
  const { Conuco } = crearMundo();
  empezar(Conuco);
  const G = Conuco.Game, S = Conuco.State, I = Conuco.Iso;
  const o = I.origenTerreno(4);
  assert.equal(G.comprarParcelaEn(o.x + 9, o.y + 3).ok, false, 'sin dinero');
  S.mutar((s) => { s.dinero = 5000; });
  assert.equal(G.costoParcelaExtra(), 150);
  // sobre el campo fijo, sobre un edificio, fuera del terreno comprado
  assert.equal(I.puedeColocar('parcela', o.x + 3, o.y + 3).razon, 'ocupado');
  assert.equal(I.puedeColocar('parcela', o.x, o.y).razon, 'ocupado');
  assert.equal(I.puedeColocar('parcela', o.x - 3, o.y + 4).razon, 'terreno');
  // buscar un hueco libre en el terreno inicial
  let lugar = null;
  for (let y = o.y; y < o.y + 11 && !lugar; y++) for (let x = o.x; x < o.x + 11 && !lugar; x++) if (I.puedeColocar('parcela', x, y).ok) lugar = { x, y };
  assert.ok(lugar, 'hay espacio libre');
  assert.equal(I.puedeColocar('parcela', lugar.x, lugar.y, [{ tx: lugar.x + 1, ty: lugar.y, quien: 'animal' }]).razon, 'animal');
  const r = G.comprarParcelaEn(lugar.x, lugar.y);
  assert.equal(r.ok, true);
  const i = r.indice;
  assert.equal(I.parcelaEnTile(lugar.x + 1, lugar.y + 1), i);
  assert.equal(I.puedeColocar('parcela', lugar.x, lugar.y).razon, 'ocupado', 'no se encima');
  assert.equal(G.costoParcelaExtra(), 177);
  // se siembra y cosecha como cualquier otra
  assert.equal(G.plantar(i, 'maiz', 0).ok, true);
  assert.equal(G.cosechar(i, 30_000).ok, true);
  assert.ok(I.buscarCamino(Conuco.MAPA.SPAWN.x, Conuco.MAPA.SPAWN.y, lugar.x, lugar.y), 'se puede caminar hasta ella');
});

prueba('granero: no va en el camino ni cierra el paso; bloquea al caminar; máximo 6', () => {
  const { Conuco } = crearMundo();
  empezar(Conuco);
  const G = Conuco.Game, S = Conuco.State, I = Conuco.Iso;
  S.mutar((s) => { s.dinero = 100000; });
  const o = I.origenTerreno(4);
  assert.equal(I.puedeColocar('granero', o.x + 2, o.y + 2).razon !== null, true);
  assert.equal(G.costoGranero(), 250);
  let lugar = null;
  for (let y = o.y; y < o.y + 11 && !lugar; y++) for (let x = o.x; x < o.x + 11 && !lugar; x++) if (I.puedeColocar('granero', x, y).ok) lugar = { x, y };
  assert.ok(lugar);
  assert.equal(G.comprarGranero(lugar.x, lugar.y).ok, true);
  assert.equal(I.esCaminable(lugar.x, lugar.y), false);
  assert.equal(G.costoGranero(), 500);
  assert.equal(I.graneros().length, 1);
  S.mutar((s) => { s.graneros = [1, 2, 3, 4, 5, 6].map((k) => ({ x: k, y: 0 })); });
  assert.equal(G.comprarGranero(lugar.x + 3, lugar.y).ok, false, 'máximo alcanzado');
});

prueba('parcelas extra y graneros se guardan y se recargan', () => {
  const almacen = {};
  const a = crearMundo(almacen);
  empezar(a.Conuco);
  a.Conuco.State.mutar((s) => { s.dinero = 9000; });
  const I = a.Conuco.Iso, o = I.origenTerreno(4);
  let p = null, g = null;
  for (let y = o.y; y < o.y + 11; y++) for (let x = o.x; x < o.x + 11; x++) { if (!p && I.puedeColocar('parcela', x, y).ok) p = { x, y }; }
  a.Conuco.Game.comprarParcelaEn(p.x, p.y);
  for (let y = o.y; y < o.y + 11; y++) for (let x = o.x; x < o.x + 11; x++) { if (!g && I.puedeColocar('granero', x, y).ok) g = { x, y }; }
  a.Conuco.Game.comprarGranero(g.x, g.y);
  a.Conuco.State.guardar();
  const b = crearMundo(almacen);
  b.Conuco.State.cargar();
  const s = b.Conuco.State.get();
  assert.equal(s.parcelas.length, 82);
  assert.equal(s.parcelas[81].x, p.x);
  igual(s.graneros, [g]);
  assert.equal(b.Conuco.Iso.parcelaEnTile(p.x, p.y), 81);
});

console.log(`\n${pruebas} pruebas OK`);
process.exit(0);
