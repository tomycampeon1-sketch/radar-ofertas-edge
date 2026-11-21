# 🎯 Radar de Ofertas Tech AR

Extensión para **Microsoft Edge** (también sirve en Chrome, Brave, Opera y cualquier navegador Chromium) que te avisa cuando hay ofertas o eventos de ofertas en tiendas de tecnología argentinas. Está pensada para seguir consolas y componentes de PC, por ejemplo para armar una PC o comprar una consola para jugar GTA 6.

## Qué hace

- **Sigue tus productos en Mercado Libre** (PS5 Slim, Xbox Series S/X, RTX 5060 Ti, RX 9060 XT, Ryzen 5 7600 y monitor 27" 165 Hz vienen cargados, y podés cambiarlos). Te avisa cuando:
  - el precio baja de tu **tope**,
  - tiene un **descuento** mayor al que elegiste,
  - se puede pagar en **cuotas sin interés** (desde 6 cuotas, configurable),
  - el precio baja más de 5% respecto del mínimo visto.
- **Revisa la portada de cada tienda** (Compra Gamer, Frávega, Garbarino, Musimundo, Mexx, Venex, Full H4rd, ofertas de Mercado Libre y los sitios oficiales de Hot Sale y CyberMonday) y te avisa cuando aparece un evento: Hot Sale, CyberMonday, Black Friday, Cyber Week, Día del Padre, Día del Niño, Navidad, liquidaciones o cuotas sin interés.
- **Calendario de eventos** con fechas estimadas, y un aviso unos días antes de que empiecen.
- **Botones para comparar**: en "Mis productos" tenés un botón por tienda que abre la búsqueda de ese producto ahí.
- Notificaciones de Windows, un contador rojo en el ícono y un historial en la ventanita.

Revisa todo cada 1 hora (lo podés cambiar en Opciones) mientras Edge esté abierto.

## Cómo instalarla en Edge (modo desarrollador)

1. Descargá el archivo **`radar-ofertas-edge.zip`** y descomprimilo (clic derecho > *Extraer todo*). Te queda una carpeta `extension`. Dejala en un lugar fijo, por ejemplo en *Documentos*, porque Edge la usa desde ahí.
2. Abrí Edge y escribí en la barra de direcciones: `edge://extensions` y apretá Enter.
3. Abajo a la izquierda activá **"Modo de desarrollador"**.
4. Tocá el botón **"Cargar desempaquetada"** y elegí la carpeta `extension` (la que tiene adentro el archivo `manifest.json`).
5. Listo. Para tenerla a mano, tocá el ícono de las piezas de rompecabezas 🧩 al lado de la barra de direcciones y hacé clic en el ojito 👁 de **Radar de Ofertas Tech AR** para que quede fija.
6. Si Windows pregunta, **permití las notificaciones de Edge** (Configuración de Windows > Sistema > Notificaciones > Microsoft Edge activado).

Para configurarla: clic derecho en el ícono > **Opciones**. Ahí cargás tus productos, el precio tope que estás dispuesto a pagar, qué tiendas revisar y cada cuánto.

### Actualizar a una versión nueva

Reemplazá los archivos de la carpeta por los nuevos y en `edge://extensions` tocá **"Volver a cargar"** (la flechita circular) en la tarjeta de la extensión. Tus productos y configuración se mantienen.

### Si Edge muestra "Deshabilitar extensiones en modo de desarrollador"

Es un aviso normal para extensiones cargadas a mano. Tocá la X para cerrarlo. No la desactives.

## Fuentes y cómo consulta

- **Base compartida con la página**: cada vez que revisa, lee `db.json` de la página del radar (https://tomycampeon1-sketch.github.io/radar-ofertas-edge/), que GitHub actualiza cada 6 horas con los precios de todas las tiendas. Te avisa de las ofertas nuevas que haya ahí. La primera vez no avisa de las viejas. La pestaña **Precios** muestra el mejor precio de cada producto.

- **Mercado Libre**: usa la API pública oficial (`api.mercadolibre.com`). Si la API pide autorización, lee la página pública de resultados (`listado.mercadolibre.com.ar`), una vez por producto y por chequeo. Si tenés una app de desarrollador de Mercado Libre, podés pegar un token de acceso en Opciones.
- **Tiendas**: lee la portada pública de cada tienda una vez por chequeo, como cualquier visita normal, y busca palabras como "Black Friday" o "12 cuotas sin interés". No inicia sesión ni compra nada.
- **Fechas de eventos**: son estimadas según cómo se repiten cada año (Hot Sale en mayo, CyberMonday a principios de noviembre, Black Friday el viernes después del 4º jueves de noviembre). El aviso real llega cuando el evento aparece en las tiendas.

Tu configuración se guarda solo en tu navegador. La extensión solo lee la base pública; no manda datos a ningún lado.

## Aportar precios a la base (opcional)

Algunas tiendas bloquean a los servidores de GitHub pero no a tu navegador. En **Opciones > Aportar precios** pegás una clave de GitHub (los pasos están ahí mismo) y cada 3 horas la extensión lee esas tiendas desde Edge y guarda los precios en `docs/data/aportes.json` de tu repo. GitHub los suma a la base en unos minutos. La clave queda solo en este Edge y solo puede tocar ese repo.

## Limitaciones

- Funciona mientras Edge esté abierto (si Edge corre en segundo plano, también).
- Si una tienda cambia mucho su página, la detección puede fallar. En la ventanita, abajo, ves cuántas fuentes dieron error en el último chequeo (pasá el mouse para ver cuáles).
- Los botones de búsqueda por tienda abren la búsqueda de cada sitio. Si alguna tienda cambió su buscador, puede abrir la portada.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `manifest.json` | Configuración de la extensión (Manifest V3) |
| `background.js` | Chequeos periódicos y notificaciones |
| `lib/config.js` | Tiendas, palabras clave y productos por defecto |
| `lib/ml.js` | Búsqueda en Mercado Libre |
| `lib/events.js` | Calendario de eventos |
| `lib/shared.js` | Lectura de la base compartida con la página |
| `lib/aporte.js` | Aporte de precios leídos desde tu compu |
| `lib/core/` | Lector de tiendas (el mismo que usa GitHub) |
| `popup.html/js` | La ventanita del ícono |
| `options.html/js` | Página de opciones |
