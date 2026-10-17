import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EmptyState, LinkButton } from './components/ui';
import { AppLayout } from './layouts/AppLayout';
import { ChannelLayout } from './layouts/ChannelLayout';
import { AlbumPage } from './pages/AlbumPage';
import { AlbumsPage } from './pages/AlbumsPage';
import { CardFormPage } from './pages/CardFormPage';
import { CardPage } from './pages/CardPage';
import { CatalogPage } from './pages/CatalogPage';
import { ChannelHomePage } from './pages/ChannelHomePage';
import { ChannelSettingsPage } from './pages/ChannelSettingsPage';
import { ChannelsPage } from './pages/ChannelsPage';
import { DatesPage } from './pages/DatesPage';
import { EventsPage } from './pages/EventsPage';
import { HomePage } from './pages/HomePage';
import { JoinPage } from './pages/JoinPage';
import { NewChannelPage } from './pages/NewChannelPage';
import { OpenPackPage } from './pages/OpenPackPage';
import { PacksPage } from './pages/PacksPage';
import { PeoplePage } from './pages/PeoplePage';
import { PersonFormPage } from './pages/PersonFormPage';
import { PersonPage } from './pages/PersonPage';
import { TimelinePage } from './pages/TimelinePage';
import { VideoFormPage } from './pages/VideoFormPage';
import { VideoPage } from './pages/VideoPage';

// Must match the production mount path inside GalbaHUB (/family-memories),
// same as vite.config.ts `base` — see GalbaHub README, incident 2026-08-16.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

/** New screens start at the top (except in-page anchors like #y1998). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <EmptyState icon="🧭">
      <p>Esta página no existe.</p>
      <LinkButton to="/" variant="primary">
        Ir al inicio
      </LinkButton>
    </EmptyState>
  );
}

/** Old per-channel video URLs now live at /v/:videoId. */
function ChannelVideoRedirect() {
  const { videoId } = useParams();
  return <Navigate to={`/v/${videoId}`} replace />;
}

/** A fresh opening screen per album (no state carried over between packs). */
function OpenPackRoute() {
  const { channelId } = useParams();
  return <OpenPackPage key={channelId} />;
}

/** Albums are browsed from the global «Álbumes» section. */
function ChannelAlbumRedirect() {
  const { channelId, cardId } = useParams();
  return <Navigate to={`/albumes/${channelId}${cardId ? `/${cardId}` : ''}`} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={basename}>
        <ScrollToTop />
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="catalogo" element={<CatalogPage />} />
            <Route path="fechas" element={<DatesPage />} />
            <Route path="albumes" element={<AlbumsPage />} />
            <Route path="sobres" element={<PacksPage />} />
            <Route path="sobres/:channelId" element={<OpenPackRoute />} />
            <Route path="albumes/:channelId" element={<AlbumPage />} />
            <Route path="albumes/:channelId/:cardId" element={<CardPage />} />
            <Route path="v/:videoId" element={<VideoPage />} />
            <Route path="canales" element={<ChannelsPage />} />
            <Route path="unirse" element={<JoinPage />} />
            <Route path="nuevo" element={<NewChannelPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="c/:channelId" element={<ChannelLayout />}>
            <Route index element={<ChannelHomePage />} />
            <Route path="subir" element={<VideoFormPage />} />
            <Route path="v/:videoId" element={<ChannelVideoRedirect />} />
            <Route path="v/:videoId/editar" element={<VideoFormPage />} />
            <Route path="cronologia" element={<TimelinePage />} />
            <Route path="eventos" element={<EventsPage />} />
            <Route path="personas" element={<PeoplePage />} />
            <Route path="personas/nueva" element={<PersonFormPage />} />
            <Route path="personas/:personId" element={<PersonPage />} />
            <Route path="personas/:personId/editar" element={<PersonFormPage />} />
            <Route path="album" element={<ChannelAlbumRedirect />} />
            <Route path="album/nuevo" element={<CardFormPage />} />
            <Route path="album/:cardId" element={<ChannelAlbumRedirect />} />
            <Route path="album/:cardId/editar" element={<CardFormPage />} />
            <Route path="canal" element={<ChannelSettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
