# Raíces

App para conservar, ver y transmitir los recuerdos de una familia o un grupo: vídeos, fechas importantes,
personas con su árbol genealógico y un álbum de cromos con sus fotos. App de **Portfolio** del ecosistema
GalbaHUB, pensada sobre todo como **app de Android** (APK) y servida también en web bajo `/raices/`.

> Especificación funcional original: nota de Obsidian «Proyectos Web › GalbaHub › 01 Portfolio › 02 FamilyAlbum».
> Las mejoras de cada ronda de pruebas se dejan en esa misma carpeta («Mejoras DDMMAAAA»).

## Plan de lanzamiento

1. Pruebas del autor.
2. Pruebas con familia y amigos (perfiles muy distintos: gente mayor, jóvenes…).
3. Publicación en **Google Play** (identificador definitivo `com.ggalba.raices`).

## Qué hace

| Módulo | Estado |
| --- | --- |
| Cuentas: registro con usuario, correo y contraseña; correo confirmado una vez con código de 6 dígitos; entrar con usuario o correo; recuperar contraseña; «Recordarme»; sesión de 30 días sin uso | ✅ |
| Canales privados por familia o grupo, con roles (admin / miembro) | ✅ |
| Invitaciones de un solo uso, con caducidad, **para una persona concreta** del canal | ✅ |
| «¿Quién eres?» obligatorio al entrar en un canal; parentesco calculado respecto a quien mira | ✅ |
| Vídeos por enlace (Google Drive con reproductor propio, YouTube, Vimeo, .mp4): inicio tipo plataforma, catálogo con filtros, favoritos, lo más visto, continuar viendo | ✅ |
| Fechas importantes anuales (cumpleaños, aniversarios, fallecimientos), aviso del día y notificaciones en el móvil | ✅ |
| Personas: ficha, género, nacimiento y fallecimiento (✝), árbol genealógico | ✅ |
| Álbum de cromos por canal, 3 sobres diarios de 5 cromos, repetidos acumulados | ✅ |
| Demo del portfolio (familia ficticia, solo lectura) y página «Saber más» | ✅ |
| Subir fotos de cromos a Supabase Storage desde la app | ⏳ |
| Usos de los cromos repetidos (intercambio…) | ⏳ |
| Fase 3: audios, muro de recuerdos | ⏳ |

## Arquitectura

```
src/
  types/domain.ts        Modelo de dominio (tipos, enums, inputs, read models)
  utils/                 Lógica pura y testeada (validación, fechas, árbol, parentesco, sobres…)
  services/              Repositorio: contrato (repository.ts), Supabase (cuentas reales),
                         local de solo lectura para la demo, y datos demo (seed.ts)
  auth/                  Sesión, pantalla de entrada, reglas de cuenta
  native/                Puente con Android (botón Atrás, barra de estado, notificaciones, compartir)
  components/ layouts/ pages/   UI (React + SCSS Modules, tema claro/oscuro)
  tests/                 Vitest
supabase/
  migrations/            Esquema, RLS y funciones (ejecutar en orden en el SQL Editor)
  tests/                 Pruebas de seguridad de la base de datos (PGlite)
brand/                   Logotipo (SVG) y script que genera iconos y pantalla de arranque de Android
```

- La UI solo habla con `MemoriesRepository`; la seguridad real está en la base de datos (Row Level Security y
  funciones `SECURITY DEFINER`), y la app valida además en el cliente para dar mensajes claros.
- Secretos: solo en `.env.local` (ignorado por git) y en los *secrets* de GitHub. La clave publicable de
  Supabase y la clave de Google (restringida) son públicas por diseño. Nunca se sube la clave secreta.

## App Android (APK)

- **GitHub Actions** (`.github/workflows/build-apk.yml`) pasa los tests y compila el APK en cada push a `main`:
  artefacto `Raices-v<versión>-build<número>.apk` (*Actions › Build Android APK › Artifacts*, 30 días).
  La versión sale de `package.json` (subirla en cada entrega) y el número de compilación crece solo.
- Todos los APK se firman con la misma clave (guardada solo en los *secrets* de GitHub y con copia local
  fuera del repo), así que cada versión se instala encima de la anterior.
- `npm run build:android` compila la web con base `/`; `npm run android:sync` la copia a `android/`.
- Iconos y pantalla de arranque: `bash brand/generate-android-assets.sh` tras cambiar el logo.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5196
npm test         # tests de la app
npm run test:db  # tests de seguridad de la base de datos
npm run lint
npm run build    # tsc -b && vite build (base /raices/)
```
