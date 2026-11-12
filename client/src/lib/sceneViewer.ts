/**
 * Official Google Scene Viewer launcher for Android devices.
 */
export async function launchGoogleSceneViewer(modelUrl: string, modelTitle = 'PAYA 2 VR 3D Model'): Promise<void> {
  // Convert modelUrl to absolute URL if relative
  const absoluteUrl = new URL(modelUrl, window.location.href).href;

  // Scene Viewer requires an HTTPS URL to fetch the 3D model
  const isHttps = absoluteUrl.startsWith('https://');

  if (!isHttps && window.location.hostname !== 'localhost') {
    console.warn('[PAYA 2 VR] Scene Viewer requires an HTTPS URL for external assets on Android.');
  }

  // Fallback URL if Google Play Services for AR (ARCore) needs to be installed/updated
  const fallbackUrl = `https://play.google.com/store/apps/details?id=com.google.ar.core`;

  // Official Google Scene Viewer Intent URI specification
  // mode=ar_only: opens directly into AR camera mode without a 3D web preview
  // resizable=true: allows pinch-to-scale in AR
  const sceneViewerIntent = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(
    absoluteUrl
  )}&mode=ar_only&resizable=true&title=${encodeURIComponent(
    modelTitle
  )}#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(
    fallbackUrl
  )};end;`;

  // Create an invisible anchor tag to trigger the Android Intent
  const anchor = document.createElement('a');
  anchor.setAttribute('href', sceneViewerIntent);
  anchor.setAttribute('rel', 'noopener');
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
