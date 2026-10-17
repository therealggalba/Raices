# FamilyMemories

Plataforma de conservación y transmisión de recuerdos familiares (app de **Portfolio** del ecosistema GalbaHUB).
Se sirve en producción bajo `/family-memories/`.

> Especificación funcional: nota de Obsidian «Proyectos Web › GalbaHub › 01 Portfolio › 02 FamilyAlbum»
> (documento *Idea Conservacion Transmisor Recuerdos*).

## Estado: MVP Fase 1 (público, de pruebas)

| Módulo | Estado |
| --- | --- |
| Usuarios (perfil local) | ✅ |
| Canales (crear, editar, salir) | ✅ |
| Invitaciones (código único, un solo uso, caducidad, revocación, trazabilidad) | ✅ |
| Gestión de miembros (roles admin/miembro, expulsar, mínimo un admin) | ✅ |
| Vídeos por enlace externo (YouTube, Vimeo, Google Drive, .mp4 directo) | ✅ |
| Inicio global (vídeos de todos los canales mezclados: recientes, Top 10, favoritos, mes actual, remix) | ✅ |
| Catálogo completo con filtros (canal, tipo de evento, década, persona, favoritos) y orden | ✅ |
| Continuar viendo (por usuario; archivos directos, YouTube y Drive con API key) | ✅ |
| Cronología por años | ✅ |
| Fechas importantes (aniversario anual numerado), vista anual global con filtros y aviso emergente del día | ✅ |
| Personas (ficha, biografía, vídeos y fechas asociados) | ✅ |
| Árbol genealógico en canales de tipo Familia (ver «Hoja de ruta») | ⏳ |
| Fase 2 (base): álbumes globales por canal, categorías por persona, colección por usuario con cromos bloqueados (desenfoque) y % real | ✅ |
| Fase 2 (detalle): sobres (misma probabilidad para todos los cromos), repetidos; subida a Supabase | ⏳ |
| Fase 3: audios, muro de recuerdos | ⏳ |
| Privacidad real (Supabase Auth + RLS) | ⏳ |

**Decisiones del MVP** (acordadas 2026-10-15):

- **Público y sin login.** Los datos viven en el navegador (`localStorage`, clave `family-memories:v1`) y se siembran
  con una familia ficticia de demostración. Cada visitante tiene su propia copia: nadie puede escribir en los datos de
  otro. La autenticación y la privacidad se abordarán en una fase posterior.
- **Vídeos por enlace externo**; nada de subidas. Las imágenes de los cromos (Fase 2) irán a Supabase Storage.
- **Patrón repositorio** (`src/services/repository.ts`): la UI solo habla con `MemoriesRepository`. La implementación
  local (`localRepository.ts`) se comporta como un servidor (comprueba roles y valida cada entrada), de modo que la
  futura implementación Supabase se enchufa sin tocar las pantallas.

## Hoja de ruta: árbol genealógico (decidido 2026-10-17, pendiente)

En los canales de tipo **Familia**, sustituir el texto libre «Relación familiar» por un árbol real:

- **Vínculos registrados**: padre/madre y pareja(s) de cada persona (con fecha de boda o separación
  opcional). Abuelos, tíos, primos, cuñados, etc. se **calculan** a partir de ellos; cubre familias
  reconstituidas y segundas parejas.
- **Parentesco relativo a quien mira**: cada usuario se vincula a «su» persona del árbol y ve las relaciones
  desde ella (tú ves «Abuelo», tu sobrino ve «Bisabuelo»). Sin vínculo, se usa una persona de referencia del canal.
- Vista de árbol navegable en el canal; ficha de persona con padres, pareja(s), hijos y hermanos.
- Las personas existentes se conservan; solo habrá que añadirles sus vínculos. Mientras tanto, la
  «Relación familiar» se escribe tomando como referencia al propietario del canal.

## Arquitectura

```
src/
  types/domain.ts        Modelo de dominio (tipos, enums, inputs, read models)
  utils/                 Lógica de negocio pura y testeada
    validation.ts        Validación/saneado de entradas (lado "servidor")
    media.ts             Enlace externo -> embed seguro (solo https, ids validados)
    events.ts            Fechas: ocurrencias anuales, número de aniversario, filtros, avisos del día
    home.ts              Filas de Inicio global (recientes, Top 10, mes actual, remix…)
    catalogFilters.ts    Filtros del catálogo completo <-> URL
    catalog.ts           Filas por canal, cronología
    invitations.ts       Códigos CSPRNG, normalización, estados
    album.ts             Álbum de cromos: secciones por persona, numeración, progreso
    dates.ts, people.ts  Fechas parciales (AAAA / AAAA-MM / AAAA-MM-DD), edades
  services/              Repositorio (contrato + implementación local + datos demo)
  hooks/ components/ layouts/ pages/   UI (React + SCSS Modules)
  tests/                 Vitest
```

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5196
npm test
npm run lint
npm run build    # tsc -b && vite build (base /family-memories/)
```
