# Changelog

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
