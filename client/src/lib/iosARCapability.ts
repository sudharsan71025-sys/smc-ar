/**
 * iOS & iPadOS Apple AR Quick Look Capability Detection Module.
 * Uses robust feature detection and platform heuristics.
 */

/**
 * Detects whether the client is running on an Apple iOS or iPadOS device.
 * Handles both classic iOS user agents and modern iPadOS desktop-class Safari.
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';

  // 1. Direct UA check for iPhone, iPod, iPad
  const isDirectIOS = /iPhone|iPod|iPad/i.test(userAgent);

  // 2. iPadOS 13+ desktop-class Safari detection
  // iPadOS identifies as 'MacIntel' in navigator.platform but has multi-touch support
  const isIPadOSDesktopSafari =
    platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;

  return isDirectIOS || isIPadOSDesktopSafari;
}

/**
 * Checks whether the current browser supports the official Apple AR Quick Look launch mechanism.
 * Evaluates anchor.relList.supports('ar') per Apple specification.
 */
export function supportsARQuickLook(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const anchor = document.createElement('a');
    // Feature detection: relList support for "ar"
    if (anchor.relList && typeof anchor.relList.supports === 'function') {
      return anchor.relList.supports('ar');
    }
  } catch {
    // Fall back to platform check
  }

  // Fallback for iOS environments where relList.supports is missing but rel="ar" is handled by WebKit
  return isIOSDevice();
}

/**
 * Evaluates end-to-end iOS AR Quick Look readiness.
 * Verifies platform, browser Quick Look support, and USDZ asset availability.
 */
export function detectIOSARCapability(usdzUrl?: string): {
  isIOS: boolean;
  supportsQuickLook: boolean;
  canLaunchAR: boolean;
  reason?: string;
} {
  const isIOS = isIOSDevice();

  if (!isIOS) {
    return {
      isIOS: false,
      supportsQuickLook: false,
      canLaunchAR: false,
    };
  }

  const quickLookSupported = supportsARQuickLook();

  if (!quickLookSupported) {
    return {
      isIOS: true,
      supportsQuickLook: false,
      canLaunchAR: false,
      reason:
        'AR is not supported on your current iPhone or browser. Please try a compatible iPhone using Safari.',
    };
  }

  if (!usdzUrl) {
    return {
      isIOS: true,
      supportsQuickLook: true,
      canLaunchAR: false,
      reason: 'Unable to prepare your 3D model for iPhone AR. Please try another model.',
    };
  }

  return {
    isIOS: true,
    supportsQuickLook: true,
    canLaunchAR: true,
  };
}

