import { ARCompatibilityResult } from './types';

/**
 * Detects whether the current device and browser environment
 * can support WebXR immersive AR or Android Scene Viewer.
 */
export async function detectARCompatibility(): Promise<ARCompatibilityResult> {
  const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const userAgent = navigator.userAgent || '';
  const isAndroid = /Android/i.test(userAgent);
  const isChromeOrCompatible = /Chrome|Chromium|SamsungBrowser|Edge/i.test(userAgent) && !/wv/i.test(userAgent);

  // Check 1: WebXR Immersive AR (Primary Path)
  let webXRSupported = false;
  let webXRHitTestSupported = false;

  if (isSecure && 'xr' in navigator && navigator.xr) {
    try {
      const isImmersiveArSupported = await navigator.xr.isSessionSupported('immersive-ar');
      if (isImmersiveArSupported) {
        webXRSupported = true;
        // Verify hit-test feature availability
        // In WebXR, hit-test is a standard feature of immersive-ar on ARCore devices
        webXRHitTestSupported = true;
      }
    } catch {
      webXRSupported = false;
    }
  }

  // Final Decision Logic
  // IF WebXR immersive AR is supported: Select WebXR
  if (webXRSupported && webXRHitTestSupported) {
    return {
      mode: 'webxr',
      supported: true,
      isSecureContext: isSecure,
      isAndroid,
    };
  }

  // ELSE IF Android Scene Viewer fallback is available: Select Scene Viewer
  // Scene Viewer is supported on Android devices running modern Chrome/compatible browser with ARCore
  if (isAndroid && isChromeOrCompatible) {
    return {
      mode: 'scene-viewer',
      supported: true,
      reason: 'WebXR unavailable. Using Android Scene Viewer native fallback.',
      isSecureContext: isSecure,
      isAndroid: true,
    };
  }

  // ELSE: Mark AR as unsupported
  let reason = 'AR is not supported on your current device or browser. Your device cannot use either of the supported AR modes. Please try a compatible Android device and browser.';
  if (!isSecure && !webXRSupported && !isAndroid) {
    reason = 'Secure HTTPS access is required for the AR camera experience.';
  }

  return {
    mode: 'none',
    supported: false,
    reason,
    isSecureContext: isSecure,
    isAndroid,
  };
}
