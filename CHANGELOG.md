# Changelog

## 0.6.0 — 2026-10-17

- Álbum de cromos (Fase 2, base): un álbum por canal organizado por personas (cada persona es una categoría,
  más «Varios» para fotos de grupo). Cromos ilimitados con número de álbum estable (#1, #2…; nunca se
  reutiliza), título, imagen por enlace https (vale una URL pública de Supabase Storage), fecha de la foto,
  rareza (Común, Poco común, Raro, Épico, Legendario) y descripción.
- Pantallas: pestaña «Álbum» en cada canal, cromo a tamaño completo al estilo de la app Android original
  (con anterior/siguiente de la misma persona) y formulario para administradores.
- Demo: cromos de ejemplo en los tres canales de prueba (y personas nuevas en Amigos y Primos). Al actualizar
  datos guardados, el álbum de ejemplo se añade solo a los canales demo que sigan existiendo.
- Esquema de datos v5 (cromos + contador por canal) con migración.
- Pendiente de definir: sobres, colección por usuario, repetidos y probabilidades; subida directa a Supabase.

## 0.5.0 — 2026-10-16

- Fechas importantes: tipo de evento, descripción, fecha de origen y personas; todas se repiten cada año y
  muestran su número de aniversario («Cumple 31», «18.º aniversario»). Se añaden desde cada canal.
- Nueva sección global «Fechas» (`/fechas`): todo el año en orden cronológico, agrupado por meses, con el día de
  hoy marcado, cambio de año y filtros por canal, mes, tipo de evento y nombre de persona (en la URL).
- Aviso del día: ventana emergente al abrir la app con las fechas de hoy (una vez al día) y, con permiso,
  notificación del navegador mientras la app está abierta.
- «No te olvides» enlaza a Fechas. Cabecera compacta en móvil.
- Esquema de datos v4 (sin la opción «se repite») con migración.

## 0.4.0 — 2026-10-16

- Continuar viendo: se guarda por usuario dónde se dejó cada vídeo (cada 5 s, al pausar, al terminar y al
  salir) y se ofrece «Continuar desde m:ss» o «Empezar desde el principio». Barra de progreso en las tarjetas.
  Funciona con archivos directos y YouTube; con Google Drive, si se configura `VITE_GOOGLE_API_KEY`.
- Google Drive con clave de API: reproducción con el reproductor propio vía Drive API (sin ella, visor de Drive).
- Top 10: los números ya no quedan tapados por las tarjetas.
- Demo con clips reales y más largos (tráiler de Sintel y Big Buck Bunny, Blender Foundation, CC-BY).
- Esquema de datos v3 (progreso) con migración; el almacenamiento local se relee antes de cada operación
  para no perder cambios hechos desde otra pestaña.

## 0.3.0 — 2026-10-16

- Inicio simplificado: No te olvides, Añadidos recientemente (últimos 10), Lo más visto, Mis favoritos,
  Recuerdos del mes actual y «Un poco de todo» (remix aleatorio y variado en cada visita). Se quitan las
  filas temáticas por tipo de canal.
- «No te olvides»: las 3 fechas más cercanas en una franja compacta de 3 columnas a todo el ancho.
- Filas: flechas animadas en los bordes que avanzan de 1 en 1 tarjeta; en móvil cada deslizamiento avanza
  una sola tarjeta (scroll-snap-stop).

## 0.2.0 — 2026-10-16

- Inicio global estilo Netflix: vídeos de todos los canales mezclados (destacado, Añadidos recientemente,
  Top 10 más visto, Mis favoritos, «Recuerdos de <mes>» y filas temáticas). Las filas temáticas solo mezclan
  canales del mismo tipo (Familia, Amigos, Viajes, Otros) y piden al menos 2 vídeos.
- Catálogo completo (`/catalogo`) con búsqueda, filtros (canal, tipo de evento, década, persona, favoritos)
  y orden; los filtros viven en la URL y los «Ver todo» de Inicio llevan a él ya filtrado.
- Ficha de vídeo global (`/v/:id`) con canal de origen, contador de reproducciones y relacionados del mismo tipo de canal.
- Reproducciones: se cuenta una al empezar a reproducir (portada con botón ▶; los embeds se cargan bajo demanda).
- Canales con tipo (`kind`); esquema de datos v2 con migración automática desde v1.
- Crear canal, unirse, cambiar nombre y restaurar demo pasan a un menú de opciones en la cabecera; «Mis canales» en `/canales`.
- Demo: nuevo canal «Primos Sanz» (familia), más vídeos de amigos y reproducciones de ejemplo.

## 0.1.0 — 2026-10-15

- MVP Fase 1 público: canales, invitaciones, miembros y roles, catálogo VOD de vídeos por enlace externo, cronología,
  personas, eventos con avisos y cumpleaños automáticos, favoritos y búsqueda.
- Datos en el navegador con familia de demostración ficticia; botón para restaurar la demo.
