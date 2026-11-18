/**
 * config.js — Datos y constantes del juego (aquí NO hay lógica).
 *
 * - CULTIVOS: catálogo de todos los rubros. Cada uno pertenece a un "escalón" (precio,
 *   tiempo, ganancia y nivel). Para añadir un rubro, agrégalo aquí y en la lista de su zona.
 * - ZONAS: regiones de Venezuela. Cada una define sus 6 rubros, sus animales, sus árboles
 *   y los colores del terreno.
 */
(function (global) {
  'use strict';
  const Conuco = (global.Conuco = global.Conuco || {});

  Conuco.CONFIG = Object.freeze({
    SAVE_KEY: 'conuco_save_v1',   // clave en localStorage
    SAVE_VERSION: 3,              // v2: jugador; v3: zonas, terrenos y mapa grande

    PARCELAS_POR_TERRENO: 9,      // 3x3 parcelas pegadas
    PARCELAS_INICIALES: 4,        // parcelas listas al empezar (índices 0..3)

    DINERO_INICIAL: 100,          // bolívares
    SEMILLAS_INICIALES: [4, 2],   // del 1er y 2do rubro de la zona elegida

    // Parcela suelta (solo en el terreno inicial): BASE * FACTOR^(parcelas ya compradas)
    COSTO_PARCELA_BASE: 80,
    COSTO_PARCELA_FACTOR: 1.45,
    // Terreno nuevo (trae sus 9 parcelas listas): BASE * FACTOR^(terrenos ya comprados)
    COSTO_TERRENO_BASE: 600,
    COSTO_TERRENO_FACTOR: 2,

    // Parcelas extra que el jugador pone donde quiera (en espacio libre de sus terrenos)
    COSTO_PARCELA_EXTRA_BASE: 150,
    COSTO_PARCELA_EXTRA_FACTOR: 1.18,

    // Almacén de semillas: tope = BASE + POR_NIVEL * (nivel - 1) + POR_GRANERO * graneros
    ALMACEN_BASE: 20,
    ALMACEN_POR_NIVEL: 10,
    ALMACEN_POR_GRANERO: 40,
    COSTO_GRANERO_BASE: 250,
    COSTO_GRANERO_FACTOR: 2,
    MAX_GRANEROS: 6,

    // Nivel = floor(sqrt(xp / XP_BASE)) + 1  ->  Nv2: 50xp, Nv3: 200xp, Nv4: 450xp...
    XP_BASE: 50,

    TICK_MS: 1000,                // refresco de la interfaz
    AUTOGUARDADO_MS: 15000,       // guardado periódico de respaldo
  });

  /**
   * Mapa isométrico: una cuadrícula de 3x3 terrenos de 12x12 casillas (36x36 en total).
   * Proyección: pantallaX = (tx - ty) * TILE_W/2,  pantallaY = (tx + ty) * TILE_H/2
   */
  const LADO = 3, TERRENO = 12;
  Conuco.MAPA = Object.freeze({
    TERRENOS_LADO: LADO,
    TERRENO,                              // casillas por lado de cada terreno
    ANCHO: LADO * TERRENO, ALTO: LADO * TERRENO,
    TILE_W: 64, TILE_H: 32,               // rombo de cada casilla en píxeles (relación 2:1)

    // Dentro de cada terreno, el campo de 3x3 parcelas de 2x2 casillas empieza en (3,3)
    CAMPO_X0: 3, CAMPO_Y0: 3, PARCELA_TAM: 2, PARCELAS_LADO: 3,

    TERRENO_INICIAL: 4,                   // el del centro
    // Orden de los terrenos en la lista de parcelas: el inicial primero (parcelas 0..8),
    // luego los vecinos directos y al final las esquinas.
    ORDEN_TERRENOS: Object.freeze([4, 1, 3, 5, 7, 0, 2, 6, 8]),
    // Posición (0..8, por filas) de cada parcela dentro del campo: las 4 primeras forman un bloque.
    ORDEN_PARCELAS: Object.freeze([4, 1, 3, 0, 5, 7, 2, 6, 8]),

    SPAWN: Object.freeze({ x: TERRENO + 5, y: TERRENO + 10 }), // dónde aparece el jugador
    VELOCIDAD: 3.6,                       // casillas por segundo al caminar
  });

  Conuco.TOTAL_PARCELAS = LADO * LADO * Conuco.CONFIG.PARCELAS_POR_TERRENO; // 81
  /** Terreno (0..8, por filas) al que pertenece la parcela lógica `i`. */
  Conuco.terrenoDeParcela = (i) => Conuco.MAPA.ORDEN_TERRENOS[Math.floor(i / Conuco.CONFIG.PARCELAS_POR_TERRENO)];

  /** Personajes entre los que el jugador elige al empezar. */
  Conuco.ETNIAS = Object.freeze([
    {
      id: 'indigena', nombre: 'Indígena',
      descripcion: 'Hijo de esta tierra: conoce la yuca, el maíz y el conuco desde hace generaciones.',
    },
    {
      id: 'espanol', nombre: 'Español colonizador',
      descripcion: 'Llegó de ultramar con semillas y herramientas para fundar su hacienda en el Nuevo Mundo.',
    },
  ]);

  /** Escalones de rubros: cuanto más alto, más caro, lento y rentable. */
  const ESCALONES = [
    null,
    { costoSemilla: 4,   tiempoMs: 30e3,  rendimiento: 2, precioVenta: 5,  xp: 3,  nivelReq: 1 },
    { costoSemilla: 8,   tiempoMs: 90e3,  rendimiento: 3, precioVenta: 6,  xp: 6,  nivelReq: 1 },
    { costoSemilla: 12,  tiempoMs: 150e3, rendimiento: 4, precioVenta: 7,  xp: 10, nivelReq: 2 },
    { costoSemilla: 25,  tiempoMs: 300e3, rendimiento: 5, precioVenta: 12, xp: 20, nivelReq: 3 },
    { costoSemilla: 60,  tiempoMs: 600e3, rendimiento: 4, precioVenta: 35, xp: 45, nivelReq: 4 },
    { costoSemilla: 100, tiempoMs: 900e3, rendimiento: 5, precioVenta: 50, xp: 80, nivelReq: 5 },
  ];

  /**
   * Catálogo de rubros.
   *  forma: cómo se dibuja la planta (tallo, mata, raiz, arbusto, rastrera, platano, pina, arbolito, cana)
   *  fruto: color del fruto cuando está lista
   */
  const RUBROS = [
    // escalón 1
    ['maiz',      'Maíz',        '🌽', 1, 'tallo',    '#f4c430'],
    ['tomate',    'Tomate',      '🍅', 1, 'arbusto',  '#e0352b'],
    ['zanahoria', 'Zanahoria',   '🥕', 1, 'raiz',     '#f08a24'],
    ['aji',       'Ají dulce',   '🌶️', 1, 'arbusto',  '#d8402a'],
    // escalón 2
    ['yuca',      'Yuca',        '🍠', 2, 'mata',     '#c9a27a'],
    ['arroz',     'Arroz',       '🌾', 2, 'espiga',   '#e8cf6a'],
    ['papa',      'Papa',        '🥔', 2, 'raiz',     '#c8a46a'],
    ['pimenton',  'Pimentón',    '🫑', 2, 'arbusto',  '#3f9c35'],
    // escalón 3
    ['caraota',   'Caraota',     '🫘', 3, 'arbusto',  '#2a1f24'],
    ['cebolla',   'Cebolla',     '🧅', 3, 'raiz',     '#c77dab'],
    ['ajo',       'Ajo',         '🧄', 3, 'raiz',     '#f1e9da'],
    // escalón 4
    ['patilla',   'Patilla',     '🍉', 4, 'rastrera', '#3c8a3a'],
    ['platano',   'Plátano',     '🍌', 4, 'platano',  '#f4d03f'],
    ['fresa',     'Fresa',       '🍓', 4, 'arbusto',  '#e3263b'],
    ['pina',      'Piña',        '🍍', 4, 'pina',     '#e9b234'],
    ['coco',      'Coco',        '🥥', 4, 'cocotero', '#7a5230'],
    // escalón 5
    ['cacao',     'Cacao',       '🍫', 5, 'arbolito', '#e0802b'],
    ['girasol',   'Girasol',     '🌻', 5, 'girasol',  '#f7c815'],
    ['durazno',   'Durazno',     '🍑', 5, 'arbolito', '#f59a6b'],
    ['melon',     'Melón',       '🍈', 5, 'rastrera', '#d9e08a'],
    // escalón 6
    ['cafe',      'Café',        '☕', 6, 'arbolito', '#c8212b'],
    ['cana',      'Caña de azúcar', '🎋', 6, 'cana',  '#9bc45a'],
    ['uva',       'Uva',         '🍇', 6, 'parra',    '#6b3fa0'],
    ['mango',     'Mango',       '🥭', 6, 'arbolito', '#f2a33a'],
  ];

  Conuco.CULTIVOS = Object.freeze(RUBROS.map(([id, nombre, emoji, escalon, forma, fruto]) =>
    Object.freeze({ id, nombre, emoji, escalon, forma, fruto, ...ESCALONES[escalon] })));

  Conuco.CULTIVOS_POR_ID = Object.freeze(
    Object.fromEntries(Conuco.CULTIVOS.map((c) => [c.id, c]))
  );

  /**
   * Zonas de Venezuela. `cultivos` va del escalón 1 al 6.
   *  animales: andan por el suelo · aves: vuelan sobre el mapa · arboles: decorado
   *  pasto: [tono, saturación, luz] del pasto · fondo: degradado detrás del mapa
   *  borde: colores de la tierra del borde de la isla (frente izq., frente der., franja de pasto)
   */
  Conuco.ZONAS = Object.freeze([
    {
      id: 'llanos', nombre: 'Los Llanos', emoji: '🌾',
      estados: 'Apure · Barinas · Guárico · Portuguesa',
      descripcion: 'Sabanas planas, morichales y lagunas. Tierra de arroz, maíz y ganado.',
      cultivos: ['maiz', 'arroz', 'caraota', 'patilla', 'girasol', 'cana'],
      animales: ['vaca', 'caballo', 'chiguire', 'corocora'],
      aves: ['garza'],
      fauna: '🐄 Vacas · 🐎 caballos · chigüires · corocoras',
      arboles: ['moriche', 'moriche', 'saman', 'araguaney'],
      pasto: [80, 52, 53], fondo: ['#eef4c8', '#c9dc8c'],
      borde: ['#8a6038', '#9b6d40', '#7aa53c'], agua: true,
    },
    {
      id: 'andes', nombre: 'Los Andes', emoji: '⛰️',
      estados: 'Mérida · Trujillo · Táchira',
      descripcion: 'Montañas frías con frailejones y pinos. Papa, fresas y el mejor café.',
      cultivos: ['zanahoria', 'papa', 'ajo', 'fresa', 'durazno', 'cafe'],
      animales: ['vaca', 'oveja', 'gallina'],
      aves: ['condor'],
      fauna: '🐄 Vacas · 🐑 ovejas · 🐔 gallinas · cóndores',
      arboles: ['pino', 'frailejon', 'frailejon', 'pino'],
      pasto: [118, 34, 44], fondo: ['#d5ebf7', '#a8cde3'],
      borde: ['#6d6862', '#807a72', '#4f7a3a'], montanas: true,
    },
    {
      id: 'occidente', nombre: 'Occidente', emoji: '🌵',
      estados: 'Lara · Falcón · Zulia',
      descripcion: 'Tierra seca y cálida de cardones y cujíes. Tomate, cebolla, uva y chivos.',
      cultivos: ['tomate', 'pimenton', 'cebolla', 'platano', 'melon', 'uva'],
      animales: ['chivo', 'burro', 'iguana'],
      aves: ['turpial'],
      fauna: '🐐 Chivos · 🫏 burros · 🦎 iguanas · turpiales',
      arboles: ['cardon', 'cuji', 'tuna', 'cardon'],
      pasto: [50, 44, 60], fondo: ['#f7e7c2', '#e4c78e'],
      borde: ['#a0703f', '#b5824b', '#b5a456'],
    },
    {
      id: 'oriente', nombre: 'Oriente', emoji: '🦜',
      estados: 'Sucre · Monagas · Anzoátegui',
      descripcion: 'Selva húmeda y ríos. Ají dulce, piña, mango y el famoso cacao de Carúpano.',
      cultivos: ['aji', 'yuca', 'caraota', 'pina', 'cacao', 'mango'],
      animales: ['cochino', 'gallina', 'iguana'],
      aves: ['guacamaya'],
      fauna: '🐖 Cochinos · 🐔 gallinas · 🦎 iguanas · 🦜 guacamayas',
      arboles: ['bucare', 'mango', 'palma', 'araguaney'],
      pasto: [120, 46, 41], fondo: ['#d3ecc4', '#93c67c'],
      borde: ['#6e4426', '#80512e', '#3f7f35'], agua: true,
    },
    {
      id: 'costa', nombre: 'La Costa', emoji: '🏖️',
      estados: 'Aragua · Carabobo · Miranda · La Guaira',
      descripcion: 'Playas con cocoteros entre el mar y la montaña. Coco, plátano y el cacao de Chuao.',
      cultivos: ['maiz', 'yuca', 'caraota', 'coco', 'cacao', 'cafe'],
      animales: ['cangrejo', 'gallina', 'burro'],
      aves: ['pelicano'],
      fauna: '🦀 Cangrejos · 🐔 gallinas · 🫏 burros · pelícanos',
      arboles: ['palma', 'palma', 'uvero', 'araguaney'],
      pasto: [98, 46, 50], fondo: ['#7fd0e8', '#3ea2c9'],
      borde: ['#c9a36a', '#d8b47c', '#e8d29a'], mar: true,
    },
  ].map(Object.freeze));

  Conuco.ZONAS_POR_ID = Object.freeze(Object.fromEntries(Conuco.ZONAS.map((z) => [z.id, z])));

  /** Lista de rubros (objetos) de una zona, en orden de escalón. */
  Conuco.cultivosDeZona = (zonaId) => {
    const z = Conuco.ZONAS_POR_ID[zonaId] || Conuco.ZONAS[0];
    return z.cultivos.map((id) => Conuco.CULTIVOS_POR_ID[id]);
  };
})(typeof window !== 'undefined' ? window : globalThis);
