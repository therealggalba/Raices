import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenBackButton, setupStatusBar } from './nativeBridge';

/** Android-only glue that needs the router (back button) — renders nothing. */
export function NativeBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    void setupStatusBar();
    // Back while a video is in full screen closes the full screen first.
    return listenBackButton(() => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else navigate(-1);
    });
  }, [navigate]);
  return null;
}
