# Changelog

## 0.16.0 — 2026-10-17

- Cambio de nombre completo a **Raíces** antes de las pruebas con familia y amigos y de Google Play:
  identificador Android definitivo `com.ggalba.raices` (es una app nueva: desinstalar la anterior
  «FamilyMemories»), nueva clave de firma a nombre de Raíces, ruta web `/raices/`, paquete `raices`, ficha de
  GalbaHub (`app.meta.json`) y claves internas del dispositivo (`raices:*`: hay que volver a iniciar sesión una vez).
- README reescrito con el estado actual y el plan de lanzamiento.

## 0.15.0 — 2026-10-17

- La app pasa a llamarse **Raíces** (nombre visible en Android, títulos y textos; el paquete sigue siendo
  `com.ggalba.familymemories` para que se actualice encima de la instalada).
- Logotipo: árbol blanco con raíces y un botón de «play» en la copa, sobre fondo naranja. Iconos de Android
  (normal, redondo y adaptativo), pantalla de arranque naranja y favicon. Fuentes en `brand/` y script
  `brand/generate-android-assets.sh` para regenerarlos.
- Versiones distinguibles: cada APK se llama `Raices-v<versión>-build<número>.apk` (el número de compilación
  sube en cada build) y la versión aparece en el menú de opciones y en la información de la app de Android.

## 0.14.0 — 2026-10-17

- Cada invitación es para una persona concreta del canal: el administrador la elige al crearla y quien la usa
  entra ya enlazado a su ficha. Quien entra en un canal sin ficha asignada (por ejemplo, su creador) tiene que
  elegir quién es antes de usarlo (o, si es administrador, crear su ficha). Después solo un administrador puede
  cambiarlo (Canal › Miembros). Aplica a todos los canales.
- Las personas fallecidas ya no tienen cumpleaños: se recuerda el día de su fallecimiento («En memoria de…»,
  «Hace N años»). Nuevo tipo de fecha «Fallecimiento».
- Estética más sobria: blanco y naranja como colores principales, tema claro u oscuro según el móvil, una sola
  tipografía (Inter), sin emojis decorativos ni degradados de colores, iconos de línea sencillos solo donde
  ayudan, menos textos explicativos y árbol en tonos neutros. Logotipo provisional (cuadrado naranja).
- Base de datos: migración `0004_invitation_person.sql`.

## 0.13.0 — 2026-10-17

- Acceso: casilla «Recordarme en este dispositivo» (recuerda el usuario, nunca la contraseña; el gestor de
  contraseñas del móvil puede guardarla). La sesión se cierra sola tras 30 días sin usar la app. Fuera el texto
  de presentación de la pantalla de entrada.
- Demo del portfolio solo para mirar: no se puede crear, editar ni restaurar nada (sí ver vídeos, abrir sobres y
  elegir quién eres en el árbol). Nueva página «Saber más» (solo en la demo) que explica qué es la app, para quién
  es, qué se puede hacer y casos de uso.
- Demo con fotos familiares reales incluidas en la app (Unsplash, licencia libre; créditos en
  `public/demo/CREDITOS.md`): carátulas de todos los vídeos y fotos de los cromos.
- Personas: género (hombre / mujer / sin indicar) y fecha de fallecimiento, mostrada con una cruz ✝ en la ficha,
  la lista y el árbol; su cumpleaños pasa a «Cumpliría N».
- Árbol: cada miembro puede decir «Esta persona soy yo» y entonces cada tarjeta muestra su parentesco con él
  (padre, tía, primo segundo, cuñada, suegro, tío político…), con su tarjeta resaltada y centrada. Un admin
  puede deshacer un enlace equivocado desde Canal › Miembros. Diseño más simétrico: los hermanos quedan juntos
  en el centro y las parejas por fuera.
- Base de datos: migración `0003_people_details.sql`.

## 0.12.0 — 2026-10-17

- Cuentas reales con Supabase: registro con nombre de usuario, correo y contraseña. El correo se confirma una vez
  con un código de 6 dígitos (escrito en la app, sin enlaces: igual en el navegador y en Android).
- Entrada con usuario o correo y contraseña; «¿Has olvidado la contraseña?» envía un código para crear una nueva.
  Los intentos fallidos por usuario se frenan (10 cada 15 minutos) y el usuario nunca revela el correo.
- Cada cuenta nueva empieza vacía. Todas las pantallas trabajan con los datos del servidor: canales,
  invitaciones (de un solo uso y con caducidad), vídeos, personas, árbol, fechas, álbum, sobres, favoritos,
  «continuar viendo» y vistas. Los errores se muestran en español, sin detalles internos.
- La demo ficticia queda como muestra del portfolio: enlace discreto en la pantalla de entrada, en memoria (se
  pierde al cerrar) y sin recordarse entre visitas.
- Base de datos: migración `0002_usernames.sql` (usuarios únicos, entrada por usuario, freno de intentos).

## 0.11.0 — 2026-10-17

- Vídeos: al reproducir en el móvil pasan a pantalla completa y, en la app, se pueden girar a horizontal; al
  salir (✕, botón Atrás o al terminar) la app vuelve a vertical.
- Sobres: al terminar, botones directos «Abrir otro sobre (N)» (si quedan) y «Ver el álbum» / «Ver álbumes» en
  lugar de «¡Visto bueno!».
- Carátulas de vídeos, cromos y portadas con tamaño estándar para fotos horizontales o verticales: la foto se ve
  completa (sin recortar) y el espacio sobrante se rellena con la misma foto ampliada y desenfocada.
  Miniaturas de YouTube en 16:9 (sin franjas negras).

## 0.10.0 — 2026-10-17

- Preparada como app Android (Capacitor 8): proyecto `android/` (orientación vertical fija), modo de compilación
  `android`, scripts `build:android` / `android:sync` / `android:open` y flujo de GitHub Actions que genera el APK.
- SCSS para pantallas táctiles verticales: márgenes seguros bajo la barra de estado y sobre la barra de gestos,
  efectos *hover* solo con ratón (no se quedan pegados al tocar), sin selección ni menú de pulsación larga en la
  interfaz y las fotos.
- Fuentes Inter y Fraunces incluidas en la app (sin Google Fonts: funciona sin depender de terceros).
- Nativo: botón Atrás, barra de estado, notificaciones locales de fechas importantes (a las 9:00, con la app
  cerrada) y compartir invitaciones con la hoja nativa.

## 0.9.0 — 2026-10-17

- Árbol genealógico en los canales de tipo Familia (Personas › 🌳 Árbol): generaciones de arriba abajo,
  parejas unidas por una línea con 💍 (discontinua si se separaron) y flechas descendentes hacia los hijos.
  Cada tarjeta: nombre completo y fecha de nacimiento. Cada pareja queda centrada sobre sus descendientes.
- Vínculos: hasta dos progenitores por persona (se eligen al editarla; nunca un descendiente) y parejas con
  fecha de boda y de separación opcionales. Sección «Familia» en la ficha de cada persona: padres, pareja(s),
  hijos y hermanos, con alta, edición de fechas y baja de parejas.
- Demo: árbol de la Familia Montero (con la rama de Pilar y Jorge) y de Primos Sanz.
- Esquema de datos v8 (progenitores y parejas) con migración.
- Pendiente: parentesco calculado respecto a quien mira («Abuelo», «Bisabuelo»…).

## 0.8.0 — 2026-10-17

- Sobres: 3 al día por usuario (entre todos los álbumes, se renuevan a medianoche, no se acumulan); el
  usuario elige de qué álbum abrir cada uno. Cada sobre trae 5 cromos del canal, todos con la misma
  probabilidad y sin repetir dentro del mismo sobre (si el álbum tiene al menos 5).
- Repetidos: contador de copias por usuario y cromo (×N en el álbum y en el cromo), para futuros intercambios.
- Apertura estilo Pokémon TCG Pocket: se corta el sobre deslizando el dedo por la parte de arriba (o con un
  botón alternativo), sale volando la tira superior y aparecen los 5 cromos en un carrusel con la etiqueta
  «¡NUEVA!» en los recién desbloqueados, hasta dar el visto bueno. El sobre se gasta al cortarlo.
- Aviso en Inicio («No te olvides») con los sobres que quedan hoy y acceso directo; también desde Álbumes y
  desde cada álbum. Nueva página `/sobres` y apertura en `/sobres/:canal`.
- Diseño de los sobres por canal (Clásico, Atardecer, Océano, Bosque, Vintage, Galaxia), elegible en la
  configuración del canal.
- Corregidos: flechas de carrusel que no avanzaban (contenedor sin `position: relative`) y miniaturas de sobre
  cuyo contenido desbordaba el marco.
- Esquema de datos v7 (copias, aperturas de sobres, diseño de sobre) con migración.

## 0.7.0 — 2026-10-17

- «Álbumes» pasa a la cabecera (junto a Fechas): listado de los canales con cromos, con contador y % real
  de desbloqueados; dentro, la fila de personas ocupa todo el ancho (carrusel con flechas si no caben) y al
  elegir una se muestran solo sus cromos. La pestaña «Álbum» del canal desaparece (sus URLs redirigen).
- Sin rarezas: todos los cromos valen lo mismo y tendrán la misma probabilidad en los sobres. Un único marco.
- Colección por usuario: los cromos bloqueados muestran la foto con un desenfoque gaussiano fuerte y un 🔒,
  y ocultan su descripción; al desbloquearlos se ven tal cual. La demo trae ~2/3 desbloqueados.
- Contador «desbloqueados / total» y % real (redondeado hacia abajo) en el listado, el álbum y cada persona.
- Cabecera móvil: el logo se oculta en pantallas estrechas para que quepan las cuatro pestañas.
- Esquema de datos v6 (sin rareza, con desbloqueos) con migración.

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
- Pendiente: subida directa a Supabase; usos de los repetidos (intercambio…).

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
