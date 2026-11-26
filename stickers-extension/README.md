# 🔊 Stickers con Sonido para WhatsApp Web (extensión de Edge / Chrome)

Sirve para mandar **stickers con sonido de verdad** aunque tu WhatsApp todavía no tenga el botón para crearlos.

## Por qué funciona

- WhatsApp está activando los stickers con sonido **de a poco, cuenta por cuenta**. Muchas cuentas ya los pueden **recibir, escuchar, guardar en favoritos y reenviar**, pero todavía no los pueden **crear**.
- WhatsApp Web ya trae el código para enviarlos, solo que está apagado en las cuentas que no tienen la función. Esta extensión lo prende **solo en tu navegador** y manda el sticker con las funciones de subida y envío del propio WhatsApp Web: un WebP animado más el audio en Opus, igual que una nota de voz.
- Una vez que el sticker está en tu chat, lo marcás como **favorito en el celular** y queda para siempre en tus stickers.

## Instalación (1 minuto, igual que la extensión del Radar)

1. Descargá el repositorio (*Code → Download ZIP*) y descomprimilo.
2. En Edge, abrí `edge://extensions` (en Chrome, `chrome://extensions`).
3. Activá el **Modo de desarrollador**.
4. Tocá **Cargar desempaquetada** y elegí la carpeta `stickers-extension`.
5. Abrí https://web.whatsapp.com y vinculá tu WhatsApp escaneando el QR desde el celular, en *Dispositivos vinculados*.

## Cómo crear el sticker

1. En WhatsApp Web, tocá el ícono de la extensión en la barra del navegador.
2. Elegí la pestaña:
   - **Video**: usa el video con su propio sonido.
   - **Imagen**: una imagen fija más el sonido que quieras.
   - **GIF**: un GIF o un video más otro sonido.
3. Arrastrá los extremos para elegir la parte (lo mejor es **10 segundos o menos**) y tocá **Crear sticker**.
4. En **Más opciones → Al enviar**, elegí **"Guardar en mi propio chat y después reenviar"**.
5. Tocá **Enviar**.

Tip: los archivos de la app web (https://tomycampeon1-sketch.github.io/radar-ofertas-edge/stickers/) sirven como materia prima: el MP4 con sonido va en la pestaña Video, y el PNG + MP3 en la pestaña Imagen.

## Después, en el iPhone

1. Abrí el chat contigo mismo ("Tú" o "Mensaje a ti mismo").
2. Tocá el sticker → **Agregar a favoritos** ⭐.
3. Ya lo tenés en tus stickers favoritos para mandarlo a cualquier chat.

## ⚠️ Importante

- Es **no oficial**. Usa el código interno de WhatsApp Web, así que una actualización de WhatsApp puede romperla sin aviso, y hay un **riesgo chico para tu cuenta**. Probala primero mandándote stickers a vos mismo.
- Que el sonido se escuche en un celular depende de la versión de WhatsApp de cada uno, porque la función se está activando de a poco. Quien todavía no la tenga verá el sticker sin sonido.
- Todo se procesa en tu compu. La extensión solo tiene permiso para `web.whatsapp.com` y para guardar un registro local de errores (con los números de teléfono ocultos).
- Si algo falla, abajo en el panel está **Registro → Guardar**, para tener el detalle del error.

## Créditos

Basada en [whatsapp-audio-stickers](https://github.com/KaraBala10/whatsapp-audio-stickers) de Mohammad KaraBala (licencia MIT, ver `LICENSE`). Cambios en esta copia: traducción completa al español (que pasa a ser el idioma por defecto) y este README. El resto del código no se modificó.
