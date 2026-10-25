import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { exitApp, listenBackButton, setupStatusBar } from './nativeBridge';

/** Android-only glue that needs the router (back button) — renders nothing. */
export function NativeBridge() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const path = useRef(pathname);
  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  useEffect(() => {
    void setupStatusBar();
    return listenBackButton((canGoBack) => {
      // A video in full screen: leave the full screen first.
      if (document.fullscreenElement) void document.exitFullscreen();
      // Inside a channel, «back» goes straight to the main screen.
      else if (path.current.startsWith('/c/')) navigate('/', { replace: true });
      else if (canGoBack && path.current !== '/') navigate(-1);
      else exitApp();
    });
  }, [navigate]);
  return null;
}
