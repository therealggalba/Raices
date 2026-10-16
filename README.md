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
| Inicio global (vídeos de todos los canales mezclados, Top 10, filas temáticas por tipo de canal) | ✅ |
| Catálogo completo con filtros (canal, tipo de evento, década, persona, favoritos) y orden | ✅ |
| Cronología por años | ✅ |
| Eventos + cumpleaños derivados de las personas + avisos (≤ 7 días) | ✅ |
| Personas (ficha, biografía, vídeos y fechas asociados) | ✅ |
| Fase 2: álbumes, cromos, sobres, rarezas | ⏳ |
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

## Arquitectura

```
src/
  types/domain.ts        Modelo de dominio (tipos, enums, inputs, read models)
  utils/                 Lógica de negocio pura y testeada
    validation.ts        Validación/saneado de entradas (lado "servidor")
    media.ts             Enlace externo -> embed seguro (solo https, ids validados)
    events.ts            Próximas ocurrencias, cumpleaños derivados, avisos
    home.ts              Filas de Inicio global (mezcla por tipo de canal, Top 10…)
    catalogFilters.ts    Filtros del catálogo completo <-> URL
    catalog.ts           Filas por canal, cronología
    invitations.ts       Códigos CSPRNG, normalización, estados
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
