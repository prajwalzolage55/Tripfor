/**
 * Cesium 3D Globe Loader
 * Supports loading CesiumJS from local public/cesium/ with automatic CDN fallback.
 * Configures CESIUM_BASE_URL and WebGL context cleanly in Next.js.
 */

let cesiumLoadPromise: Promise<any> | null = null;

export function loadCesium(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Cesium can only be loaded in browser environment'));
  }

  // Already loaded
  if ((window as any).Cesium) {
    return Promise.resolve((window as any).Cesium);
  }

  if (cesiumLoadPromise) {
    return cesiumLoadPromise;
  }

  cesiumLoadPromise = new Promise((resolve, reject) => {
    // 1. Configure Base URL for workers, assets, and shaders
    (window as any).CESIUM_BASE_URL = '/cesium/';

    // 2. Inject Cesium CSS
    if (!document.getElementById('cesium-widgets-css')) {
      const link = document.createElement('link');
      link.id = 'cesium-widgets-css';
      link.rel = 'stylesheet';
      link.href = '/cesium/Widgets/widgets.css';
      link.onerror = () => {
        // Fallback to high-speed CDN
        link.href = 'https://cdn.jsdelivr.net/npm/cesium@1.125.0/Build/Cesium/Widgets/widgets.css';
      };
      document.head.appendChild(link);
    }

    // 3. Inject Cesium JS
    const existingScript = document.getElementById('cesium-js') as HTMLScriptElement | null;
    if (existingScript) {
      if ((window as any).Cesium) {
        resolve((window as any).Cesium);
        return;
      }
      existingScript.addEventListener('load', () => resolve((window as any).Cesium));
      existingScript.addEventListener('error', () => reject(new Error('Cesium script failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'cesium-js';
    script.src = '/cesium/Cesium.js';
    script.async = true;

    script.onload = () => {
      if ((window as any).Cesium) {
        resolve((window as any).Cesium);
      } else {
        reject(new Error('Cesium object missing on window after script load'));
      }
    };

    script.onerror = () => {
      console.warn('Local Cesium.js failed, falling back to CDN...');
      (window as any).CESIUM_BASE_URL = 'https://cdn.jsdelivr.net/npm/cesium@1.125.0/Build/Cesium/';
      const fallbackScript = document.createElement('script');
      fallbackScript.src = 'https://cdn.jsdelivr.net/npm/cesium@1.125.0/Build/Cesium/Cesium.js';
      fallbackScript.async = true;
      fallbackScript.onload = () => {
        if ((window as any).Cesium) {
          resolve((window as any).Cesium);
        } else {
          reject(new Error('Cesium CDN script loaded but Cesium object missing'));
        }
      };
      fallbackScript.onerror = (err) => reject(new Error('Failed to load Cesium from both local and CDN: ' + err));
      document.body.appendChild(fallbackScript);
    };

    document.body.appendChild(script);
  });

  return cesiumLoadPromise;
}
