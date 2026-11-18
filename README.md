# 🌾 Mi Conuco

Juego de cosecha estilo *FarmTown* ambientado en el conuco venezolano. Siembra maíz, yuca, caraota, plátano, cacao y café; vende en el mercado local, gana bolívares y XP, sube de nivel y desbloquea más parcelas.

**100% en el navegador**: sin servidor, sin base de datos, sin dependencias. La partida se guarda en `localStorage`.

## Cómo probarlo

- **Más simple:** abre `index.html` con doble clic. Usa scripts clásicos (no módulos ES), por eso funciona sin servidor.
- **Con servidor local** (opcional): `python3 -m http.server 8000` y entra a `http://localhost:8000`.
- **Pruebas de la lógica:** `node tests/logica.test.js`

## Cómo se juega

1. Elige una semilla en **Semilla a sembrar**.
2. Toca una parcela vacía para sembrar. Muestra un contador mientras crece.
3. Cuando la parcela brille (**¡Lista!**), tócala para cosechar, o usa **Cosechar todo**.
4. En **Mercado local → Cosecha** vendes lo cosechado. En **Semillas** compras más.
5. Cosechar y vender da XP. Al subir de nivel se desbloquean rubros más rentables (cacao, café).
6. Toca una parcela 🔒 para comprarla (el precio sube con cada parcela).

## Estructura

```
conuco-game/
├── index.html          Página única (estructura de la UI)
├── css/styles.css      Estilos mobile-first (sin dependencias)
├── js/
│   ├── config.js       Rubros, precios, tiempos y constantes  ← aquí se balancea el juego
│   ├── state.js        Estado del jugador + guardado/carga en localStorage
│   ├── game.js         Reglas: sembrar, cosechar, vender, comprar, niveles
│   ├── ui.js           Dibuja el estado y maneja toques/clics
│   └── main.js         Arranque, bucle de 1 s y autoguardado
├── tests/logica.test.js
└── .nojekyll           Evita que GitHub Pages procese el sitio con Jekyll
```

Orden de carga: `config → state → game → ui → main` (cada uno usa al anterior mediante el espacio de nombres `window.Conuco`).

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

Precios de mercado que varían por día, eventos (sequía, lluvia), riego, animales (gallinas, vacas), pedidos/encargos de clientes, exportar/importar partida, PWA instalable y sonidos.
