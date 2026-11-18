/**
 * main.js — Arranque del juego y bucle local.
 */
(function (global) {
  'use strict';
  const Conuco = global.Conuco;
  const { State: S, Game: G, UI, CONFIG: C } = Conuco;

  function iniciar() {
    // 1) Cargar partida guardada (o crear una nueva)
    const { nuevo, ultimaVezAnterior } = S.cargar();

    // 2) Dibujar la interfaz
    UI.iniciar();

    // 3) "Mientras no estabas": avisa de cultivos que terminaron de crecer.
    //    (A un jugador nuevo, la pantalla de selección de personaje le da la bienvenida.)
    if (!nuevo) {
      const ausenteMs = Date.now() - (ultimaVezAnterior || Date.now());
      const listas = G.contarListas();
      if (ausenteMs > 30 * 1000 && listas > 0) {
        UI.toast(`¡Bienvenido de vuelta! Tienes ${listas} parcela(s) lista(s) para cosechar 🧺`, 'ok');
      }
    }

    // 4) Bucle local: refresca contadores y barras cada segundo
    setInterval(UI.tick, C.TICK_MS);

    // 5) Guardado de respaldo y al salir/ocultar la pestaña
    setInterval(S.guardar, C.AUTOGUARDADO_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) S.guardar();
      else UI.tick(); // al volver, se recalcula con los timestamps reales
    });
    global.addEventListener('pagehide', S.guardar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
