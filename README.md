# 🦜 Vuelo Verde

Un juego web 3D en español: controla un loro verde con tus brazos, vuela sobre una isla tropical y atraviesa 18 aros dorados en un máximo de 90 segundos.

HTML, CSS y JavaScript nativos. Sin compilación, backend ni cuenta de jugador. Modelo de loro y paisaje originales creados con geometría procedural.

**Jugar:** https://caraujo1987.github.io/vuelo-verde/

**Repositorio:** https://github.com/Caraujo1987/vuelo-verde

## Ejecutar

Con Node.js 20 o posterior:

```sh
npm start
```

Abre **http://127.0.0.1:4173** en Chrome o Edge. No abras `index.html` con doble clic: los módulos y la cámara necesitan un servidor local o HTTPS. Hace falta Internet para cargar Three.js, MediaPipe, el modelo de pose y las fuentes.

## Jugar con la cámara

1. Selecciona **Con mis brazos** y **Activar cámara y preparar vuelo**.
2. Permite la cámara. No se solicita micrófono.
3. Aléjate hasta que se vean hombros, codos y las dos manos. Usa buena iluminación.
4. Extiende los brazos en T durante dos segundos para calibrar.
5. Pulsa **Comenzar mi vuelo**.

| Movimiento | Acción |
| --- | --- |
| Brazos abiertos a la altura de los hombros | Planear |
| Subir y bajar ambos brazos | Impulso de aleteo |
| Recoger ambos brazos y mantenerlos cerca del cuerpo | Recoger las alas y descender |
| Mantener ambos brazos arriba / abajo | Ganar / perder altura |
| Bajar el brazo derecho / izquierdo | Girar a la derecha / izquierda |
| P o Escape | Pausar / continuar |

El seguimiento usa las muñecas y, si alguna queda oculta, estima el brazo desde el codo. Las señales se suavizan y se corrigen según la proporción de la imagen para conservar el comportamiento en vertical y horizontal. Un cierre mantenido durante aproximadamente medio segundo se distingue de un aleteo rápido; abre los brazos para volver a planear.

Si faltan señales nuevas durante 350 ms, el loro empieza a planear con asistencia y deja de mantener giros o descensos anteriores. Tras 8 segundos sin postura, el vuelo se pausa; se reanuda automáticamente después de tres detecciones consecutivas. Las pausas manuales y por cambio de ventana siguen requiriendo pulsar «Seguir volando». «Recalibrar postura» vuelve al inicio. «Apagar cámara» detiene todas las pistas de video. Puedes jugar sentado si el encuadre incluye los brazos.

Las alas siguen la elevación de cada brazo y se recogen al detectar cierre. El impulso de aleteo se reconoce por el cambio de altura de los brazos, sin exigir que se eleven por encima de los hombros. Las pruebas sintéticas cubren pérdidas, codos, cierre, aleteo y orientación; la estabilidad real debe validarse con cada cámara, iluminación y dispositivo.

## Teclado

Selecciona **Con teclado**. Usa flechas o WASD para dirección y altura; Espacio para aletear. P pausa el juego. No requiere cámara. No hay daño por colisiones: la primera versión se centra en aprender a volar y atravesar los aros.

## Privacidad y dependencias

Los fotogramas se analizan localmente con MediaPipe Pose Landmarker Lite; no se graban ni se envían a servidores. En tablets se analiza directamente el video (máximo 8 veces por segundo); en escritorio se prefiere un Web Worker con retorno automático al modo compatible si falla. No hay analítica. Solo se guarda la mejor puntuación en `localStorage`. La descarga inicial de bibliotecas/modelo/fuentes sí contacta con jsDelivr, Google Cloud Storage y Google Fonts.

### iPad y otras tablets

Abre el enlace HTTPS directamente en Chrome o Safari y permite la cámara frontal. Si aparece un error de permiso, revisa el acceso a Cámara de la aplicación en Ajustes y el permiso del sitio. La vista previa aparece antes de cargar el detector para distinguir un problema de cámara de uno de reconocimiento. El modo compatible evita transferir imágenes a un worker. La prueba `/tests/tablet.html` valida el análisis de video sintético sin cámara; no sustituye la prueba en un iPad real.

- Three.js `0.170.0` (MIT): https://threejs.org/manual/#en/installation
- MediaPipe Tasks Vision `0.10.21` (Apache-2.0): https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Modelo `pose_landmarker_lite/float16/1` de MediaPipe.
- Fuentes DM Sans y Manrope de Google Fonts (SIL Open Font License).

## Verificar

```sh
npm test
npm run check
```

Las pruebas verifican señales de postura, dirección de giro, detección de aleteo, cruces de aros, límites y final de partida. La precisión de la cámara debe comprobarse además con una persona frente a una webcam real.

La página `/tests/browser.html` permite comprobar la descarga del detector y una inferencia con imagen vacía, sin activar la cámara. La carga del modelo y esa inferencia se verificaron en Chrome durante el desarrollo.

## Publicar en GitHub Pages

En **Settings → Pages**, elige **Deploy from a branch**, rama **main**, carpeta **/ (root)**. Todos los recursos locales usan rutas relativas, por lo que funciona en un subdirectorio de GitHub Pages. La web publicada utiliza HTTPS, necesario para la cámara.

## Estructura

- `index.html`, `style.css`: interfaz adaptable.
- `src/world.js`: paisaje, loro, cámara 3D y partículas.
- `src/flight.js`: simulación y señales de postura, independientes del render.
- `src/camera.js`, `src/pose-worker.js`: cámara, reconocimiento y dibujo del esqueleto.
- `src/main.js`: calibración, estados del juego, controles y audio opcional.
- `server.mjs`: servidor local sin dependencias.
- `tests/flight.test.js`: pruebas con el test runner de Node.js.
