/**
 * Apple AR Quick Look Launcher for iOS & iPadOS devices.
 * Implements the official Apple Safari specification using <a rel="ar" href="...">.
 */
export async function launchAppleQuickLook(usdzUrl: string): Promise<void> {
  if (!usdzUrl) {
    throw new Error('USDZ URL is required to launch Apple AR Quick Look.');
  }

  // Ensure absolute URL
  const absoluteUrl = new URL(usdzUrl, window.location.href).href;

  // Add allowsContentScaling parameter so user can resize in Quick Look
  const quickLookUrl = absoluteUrl.includes('#')
    ? absoluteUrl
    : `${absoluteUrl}#allowsContentScaling=1`;

  // Create an AR-enabled anchor per Apple Quick Look spec
  const anchor = document.createElement('a');
  anchor.setAttribute('rel', 'ar');
  anchor.setAttribute('href', quickLookUrl);

  // Apple spec requires an <img> child inside the anchor
  const img = document.createElement('img');
  img.setAttribute(
    'src',
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
  );
  img.setAttribute('alt', '3D Model AR Preview');
  img.style.display = 'none';

  anchor.appendChild(img);
  anchor.style.display = 'none';

  document.body.appendChild(anchor);

  try {
    // Trigger the native iOS Quick Look AR experience
    anchor.click();
  } finally {
    // Clean up DOM element
    setTimeout(() => {
      if (anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
    }, 1000);
  }
}

