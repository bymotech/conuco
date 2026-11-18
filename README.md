# 🌾 Mi Conuco

Juego de cosecha estilo *FarmTown* ambientado en el conuco venezolano. Elige tu personaje y tu región (Llanos, Andes, Occidente, Oriente o Costa), camina por un conuco en vista isométrica, siembra los rubros de tu zona, vende en el mercado local, sube de nivel y compra terrenos para crecer.

🎮 **Jugar:** https://mi-conuco.netlify.app

**100% en el navegador**: sin servidor, sin base de datos, sin dependencias. La partida se guarda en `localStorage`.

## Cómo probarlo

- **Más simple:** abre `index.html` con doble clic. Usa scripts clásicos (no módulos ES), por eso funciona sin servidor.
- **Con servidor local** (opcional): `python3 -m http.server 8000` y entra a `http://localhost:8000`.
- **Pruebas:** `node tests/logica.test.js` y `node tests/mapa.test.js`

## Cómo se juega

1. **Configuración guiada:** eliges personaje (**Indígena** o **Español colonizador**), un nombre opcional y tu **zona de Venezuela**. Cada zona tiene su paisaje, sus animales y sus 6 rubros:

   | Zona | Rubros (del nivel 1 al 5) | Animales |
   |---|---|---|
   | 🌾 Los Llanos | maíz, arroz, caraota, patilla, girasol, caña | vacas, caballos, chigüires, corocoras, garzas |
   | ⛰️ Los Andes | zanahoria, papa, ajo, fresa, durazno, café | vacas, ovejas, gallinas, cóndores |
   | 🌵 Occidente | tomate, pimentón, cebolla, plátano, melón, uva | chivos, burros, iguanas, turpiales |
   | 🦜 Oriente | ají dulce, yuca, caraota, piña, cacao, mango | cochinos, gallinas, iguanas, guacamayas |
   | 🏖️ La Costa | maíz, yuca, caraota, coco, cacao, café | cangrejos, gallinas, burros, pelícanos |

2. **Guía de primeros pasos:** burbujas te indican qué hacer (sembrar → cosechar → vender → comprar semillas) y desaparecen cuando lo haces. Se puede volver a ver desde el menú ☰.
3. Elige la semilla en la barra de abajo y **toca una parcela**: tu personaje camina hasta ella y al llegar siembra, cosecha o (si tienes el dinero) la compra.
4. Toca la **choza 🌱** o el botón *Semillas* para comprar semillas, y el **puesto 🧺** o *Vender* para vender la cosecha.
5. **Terrenos:** el mapa tiene 3x3 terrenos. Empiezas en el del centro; los demás aparecen bloqueados con un letrero *SE VENDE*. Tócalo para comprarlo (debe tocar por un lado a un terreno tuyo y necesitas el dinero). Cada terreno trae 9 parcelas listas; el precio se duplica con cada compra (600, 1.200, 2.400…).
6. **Subir de nivel** lanza confeti y estrellas y te dice qué rubro desbloqueaste.
7. **Cámara:** arrastra el mapa. **Zoom:** rueda del ratón, pellizco con dos dedos o los botones ＋ － ◎.

## Estructura

```
├── index.html          Página única: mapa a pantalla completa + interfaz flotante
├── css/styles.css      Estilos (sin dependencias)
├── js/
│   ├── config.js       Rubros, zonas, precios, tiempos y tamaño del mapa  ← aquí se balancea el juego
│   ├── state.js        Estado del jugador + guardado en localStorage (migra partidas viejas)
│   ├── game.js         Reglas: sembrar, cosechar, vender, comprar parcelas/terrenos, niveles, zona
│   ├── iso.js          Geometría isométrica, disposición del mapa por zona y caminos (A*) — sin dibujo
│   ├── sprites.js      Todo el arte en Canvas 2D: suelo, cultivos, árboles, edificios, animales, personajes
│   ├── escena.js       Compone cada cuadro (orden de profundidad, terrenos bloqueados, etiquetas)
│   ├── mapa.js         Cámara, toques, el personaje caminando, los animales y las aves
│   ├── fiesta.js       Confeti, estrellas y tarjeta de "¡Subiste de nivel!"
│   ├── guia.js         Burbujas de la guía de primeros pasos
│   ├── ui.js           Barra de arriba, botones, panel de tienda/mercado, configuración guiada
│   └── main.js         Arranque, bucle de 1 s y autoguardado
└── tests/
    ├── logica.test.js  Reglas, zonas, terrenos y guardado
    └── mapa.test.js    Proyección, parcelas, caminos en las 5 zonas y partidas antiguas
```

## Cómo funciona el mapa

- 36x36 casillas = 3x3 terrenos de 12x12. Cada casilla es un rombo de 64x32 px.
- Proyección: `pantallaX = (tx - ty) * 32`, `pantallaY = (tx + ty) * 16` (en `iso.js`).
- Cada terreno tiene en el centro un campo de 3x3 parcelas pegadas (de 2x2 casillas), rodeado de un camino que se une con los terrenos vecinos.
- Los árboles y lagunas se generan según la zona de forma fija (siempre igual para la misma zona). Se bloquean solos para el pathfinding.
- Los objetos se ordenan por `tx + ty` antes de dibujarse para que lo de adelante tape lo de atrás. Solo se dibuja lo que está en pantalla.

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

En `js/config.js` agrega una línea en `RUBROS` (id, nombre, emoji, escalón 1–6, forma de la planta, color del fruto) y pon su id en la lista `cultivos` de la zona que quieras. El escalón define precio, tiempo, ganancia y nivel; la tienda, el selector y el mercado lo toman solos.

```js
['ocumo', 'Ocumo', '🥔', 2, 'raiz', '#9b7a5a'],
```

## Limitaciones conocidas

- Es un juego local: quien cambie el reloj del dispositivo o edite `localStorage` puede hacer trampa (no hay servidor que lo valide).
- La partida vive en ese navegador y dispositivo; borrar los datos del sitio la elimina.

## Ideas para la siguiente fase

Diferencias reales entre personajes, animales que producen (leche, huevos), precios de mercado que varían por día, eventos (sequía, lluvia), pedidos de clientes, ciclo día/noche, exportar/importar partida, PWA instalable y sonidos.
