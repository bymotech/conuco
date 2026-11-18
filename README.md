# 🌾 Mi Conuco

Juego de cosecha estilo *FarmTown* ambientado en el conuco venezolano. Elige tu personaje, camina por un conuco en vista isométrica, siembra maíz, yuca, caraota, plátano, cacao y café, vende en el mercado local, gana bolívares y XP, sube de nivel y desbloquea más parcelas.

🎮 **Jugar:** https://mi-conuco.netlify.app

**100% en el navegador**: sin servidor, sin base de datos, sin dependencias. La partida se guarda en `localStorage`.

## Cómo probarlo

- **Más simple:** abre `index.html` con doble clic. Usa scripts clásicos (no módulos ES), por eso funciona sin servidor.
- **Con servidor local** (opcional): `python3 -m http.server 8000` y entra a `http://localhost:8000`.
- **Pruebas:** `node tests/logica.test.js` y `node tests/mapa.test.js`

## Cómo se juega

1. Al empezar eliges tu personaje (**Indígena** o **Español colonizador**) y, si quieres, un nombre.
2. Elige una semilla en **Semilla a sembrar** y **toca una parcela**: tu personaje camina hasta ella (esquivando árboles y casas) y al llegar:
   - parcela vacía → siembra la semilla elegida,
   - parcela brillando (**burbuja con el fruto**) → cosecha,
   - parcela bloqueada 🔒 → la compra (el precio sube con cada una),
   - parcela creciendo → te dice cuánto falta (también ves el contador sobre la parcela).
3. Toca la **choza 🌱** para abrir la tienda de semillas o el **puesto 🧺** para vender la cosecha. También puedes usar los paneles de la derecha.
4. Cosechar y vender da XP. Al subir de nivel se desbloquean rubros más rentables (cacao, café).
5. **Mover la cámara:** arrastra el mapa. **Zoom:** rueda del ratón, pellizco con dos dedos o los botones ＋ － ◎ (◎ centra en tu personaje).

Las parcelas se desbloquean del centro hacia afuera.

## Estructura

```
conuco-game/
├── index.html          Página única (mapa, paneles y pantalla de selección de personaje)
├── css/styles.css      Estilos mobile-first (sin dependencias)
├── js/
│   ├── config.js       Rubros, precios, tiempos, tamaño del mapa y personajes  ← aquí se balancea el juego
│   ├── state.js        Estado del jugador + guardado/carga en localStorage (con migración de partidas viejas)
│   ├── game.js         Reglas: sembrar, cosechar, vender, comprar, niveles, elegir personaje
│   ├── iso.js          Geometría isométrica, disposición del mapa y búsqueda de caminos (A*)  — sin dibujo
│   ├── sprites.js      Todo el arte, dibujado con Canvas 2D (suelo, cultivos, árboles, edificios, personajes)
│   ├── escena.js       Compone un cuadro completo (orden de profundidad, etiquetas, partículas)
│   ├── mapa.js         Cámara, arrastre/zoom, toques, el personaje caminando y sus acciones
│   ├── ui.js           Paneles de la página, selección de personaje y avisos
│   └── main.js         Arranque, bucle de 1 s y autoguardado
├── tests/
│   ├── logica.test.js  Reglas del juego y guardado
│   └── mapa.test.js    Proyección isométrica, pathfinding, personaje y partidas antiguas
└── .nojekyll
```

Orden de carga: `config → state → game → iso → sprites → escena → mapa → ui → main` (cada uno usa a los anteriores mediante el espacio de nombres `window.Conuco`).

## Cómo funciona la vista isométrica

- El mapa es una cuadrícula de 17x17 casillas. Cada casilla es un rombo de 64x32 px (relación 2:1).
- Proyección: `pantallaX = (tx - ty) * 32`, `pantallaY = (tx + ty) * 16`. Está en `iso.js`.
- Para que lo de adelante tape lo de atrás, todos los objetos (árboles, edificios, plantas y el jugador) se ordenan por `tx + ty` antes de dibujarse.
- Para cambiar el mapa edita `EDIFICIOS` y `ARBOLES` en `iso.js`. Las casillas ocupadas se bloquean solas para el pathfinding.
- Las parcelas se numeran según el orden de desbloqueo (`ORDEN_PARCELAS` en `config.js`), no por su posición.

## Cómo funciona el tiempo (incluso con el navegador cerrado)

No se guarda el "progreso" de un cultivo, solo el instante en que se sembró (`plantadoEn`, en milisegundos). El progreso siempre se calcula como `Date.now() - plantadoEn` frente al `tiempoMs` del rubro. Así, al volver horas después, la parcela ya aparece lista. Al abrir el juego se avisa cuántas parcelas quedaron listas.

La partida se guarda tras cada acción, cada 15 s y al ocultar/cerrar la pestaña. Si `localStorage` falla (modo privado), el juego sigue y muestra un aviso. Una partida corrupta se respalda en `conuco_save_v1_corrupto` y se empieza de cero.

## Desplegar gratis en GitHub Pages

1. Crea un repositorio en GitHub y sube **todo el contenido** de esta carpeta (que `index.html` quede en la raíz).
2. En el repo: **Settings → Pages**.
3. En *Build and deployment* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`, y guarda.
4. En 1–2 minutos queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

Las rutas son relativas, así que funciona en esa subcarpeta sin cambios.

## Añadir un rubro nuevo

Agrega un objeto en `CULTIVOS` dentro de `js/config.js`:

```js
{ id: 'aji', nombre: 'Ají dulce', emoji: '🌶️', costoSemilla: 15, tiempoMs: 120 * 1000,
  rendimiento: 4, precioVenta: 8, xp: 12, nivelReq: 2 }
```

La tienda, el selector, el inventario y el mercado lo toman automáticamente.

## Limitaciones conocidas

- Es un juego local: quien cambie el reloj del dispositivo o edite `localStorage` puede hacer trampa (no hay servidor que lo valide).
- La partida vive en ese navegador y dispositivo; borrar los datos del sitio la elimina.

## Ideas para la siguiente fase

Diferencias reales entre personajes (herramientas, rubros o precios propios), precios de mercado que varían por día, eventos (sequía, lluvia), riego, animales (gallinas, vacas), pedidos de clientes, ciclo día/noche, exportar/importar partida, PWA instalable y sonidos.
