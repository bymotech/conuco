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
    SAVE_VERSION: 1,

    GRID_COLS: 4,
    TOTAL_PARCELAS: 16,           // 4x4
    PARCELAS_INICIALES: 4,        // parcelas desbloqueadas al empezar

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
