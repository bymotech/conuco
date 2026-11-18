/**
 * config.js — Datos y constantes del juego (aquí NO hay lógica).
 *
 * Para añadir un rubro nuevo basta con agregar un objeto a CULTIVOS.
 * Todo el resto del juego (tienda, mercado, inventario, parcelas) lo toma de aquí.
 */
(function (global) {
  'use strict';
  const Conuco = (global.Conuco = global.Conuco || {});

  Conuco.CONFIG = Object.freeze({
    SAVE_KEY: 'conuco_save_v1',   // clave en localStorage
    SAVE_VERSION: 2,              // v2: añade `jugador` (avatar y posición)

    TOTAL_PARCELAS: 16,           // 4x4
    PARCELAS_INICIALES: 4,        // parcelas desbloqueadas al empezar (índices lógicos 0..3 = centro del conuco)

    DINERO_INICIAL: 100,          // bolívares
    SEMILLAS_INICIALES: { maiz: 4, yuca: 2 },

    // Costo de desbloquear una parcela: BASE * FACTOR^(parcelas ya compradas)
    COSTO_PARCELA_BASE: 80,
    COSTO_PARCELA_FACTOR: 1.45,

    // Nivel = floor(sqrt(xp / XP_BASE)) + 1  ->  Nv2: 50xp, Nv3: 200xp, Nv4: 450xp...
    XP_BASE: 50,

    TICK_MS: 1000,                // refresco de la interfaz
    AUTOGUARDADO_MS: 15000,       // guardado periódico de respaldo
  });

  /**
   * Mapa isométrico. Las coordenadas del mapa son "tiles" (casillas) enteras o fraccionarias.
   * Proyección: pantallaX = (tx - ty) * TILE_W/2,  pantallaY = (tx + ty) * TILE_H/2
   */
  Conuco.MAPA = Object.freeze({
    ANCHO: 17, ALTO: 17,                 // casillas
    TILE_W: 64, TILE_H: 32,              // rombo de cada casilla en píxeles (relación 2:1)

    // Las 16 parcelas forman un bloque 4x4; cada una ocupa 2x2 casillas con 1 de camino entre ellas.
    PARCELA_COLS: 4, PARCELA_TAM: 2, PARCELA_SEP: 1,
    PARCELA_X0: 3, PARCELA_Y0: 3,

    // Orden en que se desbloquean las parcelas: del centro hacia afuera.
    // El índice lógico i (el que se guarda) ocupa la posición ORDEN_PARCELAS[i] dentro del bloque 4x4.
    ORDEN_PARCELAS: Object.freeze([5, 6, 9, 10, 1, 2, 13, 14, 4, 8, 7, 11, 0, 3, 12, 15]),

    SPAWN: Object.freeze({ x: 8, y: 15 }), // dónde aparece el jugador
    VELOCIDAD: 3.6,                         // casillas por segundo al caminar
  });

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

  /**
   * Rubros del conuco.
   *  costoSemilla : Bs por semilla
   *  tiempoMs     : tiempo de crecimiento
   *  rendimiento  : unidades que se cosechan por parcela
   *  precioVenta  : Bs por unidad en el mercado local
   *  xp           : experiencia por cosechar una parcela
   *  nivelReq     : nivel mínimo para sembrarla
   */
  Conuco.CULTIVOS = Object.freeze([
    { id: 'maiz',    nombre: 'Maíz',    emoji: '🌽', costoSemilla: 4,   tiempoMs: 30 * 1000,  rendimiento: 2, precioVenta: 5,  xp: 3,  nivelReq: 1 },
    { id: 'yuca',    nombre: 'Yuca',    emoji: '🥔', costoSemilla: 8,   tiempoMs: 90 * 1000,  rendimiento: 3, precioVenta: 6,  xp: 6,  nivelReq: 1 },
    { id: 'caraota', nombre: 'Caraota', emoji: '🫘', costoSemilla: 12,  tiempoMs: 150 * 1000, rendimiento: 4, precioVenta: 7,  xp: 10, nivelReq: 2 },
    { id: 'platano', nombre: 'Plátano', emoji: '🍌', costoSemilla: 25,  tiempoMs: 300 * 1000, rendimiento: 5, precioVenta: 12, xp: 20, nivelReq: 3 },
    { id: 'cacao',   nombre: 'Cacao',   emoji: '🍫', costoSemilla: 60,  tiempoMs: 600 * 1000, rendimiento: 4, precioVenta: 35, xp: 45, nivelReq: 4 },
    { id: 'cafe',    nombre: 'Café',    emoji: '☕', costoSemilla: 100, tiempoMs: 900 * 1000, rendimiento: 5, precioVenta: 50, xp: 80, nivelReq: 5 },
  ].map(Object.freeze));

  Conuco.CULTIVOS_POR_ID = Object.freeze(
    Object.fromEntries(Conuco.CULTIVOS.map((c) => [c.id, c]))
  );
})(typeof window !== 'undefined' ? window : globalThis);
