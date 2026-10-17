import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenBackButton, setupStatusBar } from './nativeBridge';

/** Android-only glue that needs the router (back button) — renders nothing. */
export function NativeBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    void setupStatusBar();
    return listenBackButton(() => navigate(-1));
  }, [navigate]);
  return null;
}
