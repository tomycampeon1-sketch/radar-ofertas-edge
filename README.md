# 🎯 Radar de Ofertas

Comparador personal de precios de tecnología en Argentina, pensado para encontrar **la forma más barata de jugar GTA 6** (consola contra PC para 2K, contado contra cuotas). Uso personal, no se vende nada.

Tiene tres partes que usan **la misma base de datos**:

| Parte | Qué hace | Dónde está |
|---|---|---|
| Base de datos | Precios por tienda, historial y ofertas detectadas | `docs/data/db.json` |
| Actualización automática | Cada 6 horas GitHub revisa las tiendas y actualiza la base | `.github/workflows/actualizar.yml`, `scraper/` |
| Página | Comparador GTA 6, ofertas nuevas y todos los precios | `docs/` → https://tomycampeon1-sketch.github.io/radar-ofertas-edge/ |
| Extensión de Edge | Lee la base y te avisa de ofertas nuevas; revisa las portadas por eventos y, si la activás, lee desde tu compu las tiendas que bloquean a GitHub y aporta esos precios | `extension/` |

```
 Tiendas ──(cada 6 h, GitHub Actions)──▶ docs/data/db.json ──▶ Página (GitHub Pages)
                                                     └──────▶ Extensión de Edge (avisos)
 Tiendas que bloquean a GitHub ──(tu Edge, cada 3 h)──▶ docs/data/aportes.json ──▶ se suma a db.json
```

## Puesta en marcha (una sola vez)

1. **Activar la página**: en GitHub, *Settings > Pages*, en "Build and deployment" elegí *Deploy from a branch*, rama `main`, carpeta `/docs`, y *Save*. En un par de minutos queda en https://tomycampeon1-sketch.github.io/radar-ofertas-edge/.
2. **Primera actualización**: pestaña *Actions > Actualizar ofertas > Run workflow*. Después corre sola cada 6 horas.
3. **Aporte de precios (opcional, recomendado)**: en las Opciones de la extensión, sección "Aportar precios", seguí los pasos para crear una clave de GitHub (fine-grained, solo este repo, permiso *Contents: Read and write*), pegala, tocá "Probar clave" y después "Guardar y aportar ahora".
4. **Extensión**: descargá el ZIP del repo (*Code > Download ZIP*), descomprimilo y cargá la carpeta `extension` en `edge://extensions` con "Cargar desempaquetada" (detalle en `extension/README.md`).

## Cambiar los productos

Editá `productos.json` en GitHub (ícono del lápiz). Cada producto tiene:

- `busqueda`: lo que se escribe en el buscador de cada tienda.
- `debeTener`: palabras que tiene que tener el título (con `|` para alternativas).
- `excluir`: palabras que descartan accesorios (joystick, funda, juego…).
- `minimo` / `maximo`: rango de precio razonable, para descartar errores.
- `referencia`: precios de la investigación, que se muestran como "nota" hasta tener precios al día.

Al guardar, la base se actualiza sola en unos minutos.

## Qué cuenta como oferta nueva

- El mejor precio de contado bajó 3% o más desde la lectura anterior.
- Mínimo histórico.
- Descuento de 15% o más sobre el precio de lista de la tienda.
- Aparece un plan de 12 cuotas sin interés o más.

## Cómo lee las tiendas

Para cada tienda prueba, en orden: la API pública de VTEX (la plataforma de varias tiendas argentinas, trae contado y cuotas), los datos estructurados de la página de búsqueda (JSON-LD) y los datos de Next.js. Mercado Libre se lee del listado público y, si está bloqueado, de las páginas de Mejores Compras cargadas en `extra`. Pausa de 1,5 s entre pedidos y deja de insistir con una tienda que bloquea. Compra Gamer es una página hecha 100% con JavaScript y por ahora queda como enlace.

Las tiendas que bloquean a GitHub las puede leer la extensión desde tu compu (`extension/lib/aporte.js`): sube `docs/data/aportes.json` y GitHub suma esos precios (de menos de 24 h) donde no tiene dato propio. El lector de tiendas es el mismo código para los dos (`extension/lib/core/`).

Si una tienda no responde, se conserva su último precio hasta 3 días (marcado "viejo").

## Probar a mano

```bash
node --test scraper/test.mjs  # pruebas con páginas simuladas
node scraper/run.mjs          # actualiza docs/data/db.json
node scraper/run.mjs --sin-red  # rearma la base solo con las referencias
python3 -m http.server -d docs  # ver la página en http://localhost:8000
```
