import { ARCompatibilityResult, PlatformType } from './types';
import { isIOSDevice, detectIOSARCapability } from './iosARCapability';

/**
 * Unified Cross-Platform AR Router.
 * Automatically routes between:
 *  - Android WebXR (Primary Android)
 *  - Android Google Scene Viewer (Fallback Android)
 *  - iOS / iPadOS Apple AR Quick Look (Native iOS)
 *  - Unsupported environments
 */
export async function resolveARPlatformRoute(usdzUrl?: string): Promise<ARCompatibilityResult> {
  const isSecure =
    typeof window !== 'undefined' &&
    (window.isSecureContext ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = isIOSDevice();

  let platform: PlatformType = 'other';
  if (isAndroid) platform = 'android';
  else if (isIOS) platform = 'ios';

  // ========================================================
  // ROUTE 1: iOS & iPadOS (Apple AR Quick Look)
  // ========================================================
  if (isIOS) {
    const iosCapability = detectIOSARCapability(usdzUrl);

    if (iosCapability.canLaunchAR && usdzUrl) {
      return {
        mode: 'quick-look',
        platform,
        supported: true,
        isSecureContext: isSecure,
        isAndroid: false,
        isIOS: true,
        usdzUrl,
      };
    }

    return {
      mode: 'none',
      platform,
      supported: false,
      reason:
        iosCapability.reason ||
        'AR is not supported on your current iPhone or browser. Please try a compatible iPhone using Safari.',
      isSecureContext: isSecure,
      isAndroid: false,
      isIOS: true,
    };
  }

  // ========================================================
  // ROUTE 2: Android (WebXR AR Primary, Scene Viewer Fallback)
  // ========================================================
  if (isAndroid) {
    // Step 2A: Check WebXR Immersive-AR
    let webXRSupported = false;
    if (isSecure && 'xr' in navigator && navigator.xr) {
      try {
        const isImmersiveArSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (isImmersiveArSupported) {
          webXRSupported = true;
        }
      } catch {
        webXRSupported = false;
      }
    }

    if (webXRSupported) {
      return {
        mode: 'webxr',
        platform,
        supported: true,
        isSecureContext: isSecure,
        isAndroid: true,
        isIOS: false,
      };
    }

    // Step 2B: Scene Viewer Fallback
    const isChromeOrCompatible =
      /Chrome|Chromium|SamsungBrowser|Edge/i.test(userAgent) && !/wv/i.test(userAgent);

    if (isChromeOrCompatible) {
      return {
        mode: 'scene-viewer',
        platform,
        supported: true,
        reason: 'WebXR unavailable. Using Android Scene Viewer native fallback.',
        isSecureContext: isSecure,
        isAndroid: true,
        isIOS: false,
      };
    }

    return {
      mode: 'none',
      platform,
      supported: false,
      reason:
        'AR is not supported on your current device or browser. Your device cannot use either of the supported AR modes. Please try a compatible Android device and browser.',
      isSecureContext: isSecure,
      isAndroid: true,
      isIOS: false,
    };
  }

  // ========================================================
  // ROUTE 3: Desktop or other non-mobile platforms
  // ========================================================
  return {
    mode: 'none',
    platform,
    supported: false,
    reason:
      'AR is not supported on your current device or browser. Please open this page on a compatible mobile device (iPhone/iPad with Safari or Android with Chrome).',
    isSecureContext: isSecure,
    isAndroid: false,
    isIOS: false,
  };
}
