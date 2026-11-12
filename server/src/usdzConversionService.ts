import { glbToUsdzAsync } from 'gltf2usd-js';

export interface USDZConversionResult {
  success: boolean;
  usdzBuffer?: Buffer;
  fileSize?: number;
  error?: string;
  details?: string;
}

/**
 * Validates a generated USDZ file binary container.
 * Per the Pixar/Apple USDZ specification, a USDZ file is a zero-compression,
 * 64-byte aligned zip archive containing USDA/USDC scene definitions and textures.
 */
export function validateUsdzBinary(buffer: Buffer): { valid: boolean; error?: string } {
  if (!buffer || buffer.length < 30) {
    return { valid: false, error: 'USDZ output buffer is too small to be a valid archive.' };
  }

  // Check Zip Local File Header Magic: 0x04034b50 ("PK\x03\x04")
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x04034b50) {
    return {
      valid: false,
      error: `Invalid USDZ container signature. Expected Zip header (0x04034b50), found 0x${magic.toString(16)}.`,
    };
  }

  return { valid: true };
}

/**
 * Converts a validated GLB binary into an Apple AR Quick Look compatible USDZ file.
 * Preserves PBR materials (baseColor, metallic, roughness, normal maps), UV coordinates,
 * mesh hierarchy, and real-world meter dimensions.
 */
export async function convertGlbToUsdz(glbBuffer: Buffer): Promise<USDZConversionResult> {
  try {
    const startTime = Date.now();
    const rawUsdzArray = await glbToUsdzAsync(glbBuffer);
    const usdzBuffer = Buffer.from(rawUsdzArray);

    // Validate the generated USDZ archive
    const validation = validateUsdzBinary(usdzBuffer);
    if (!validation.valid) {
      console.error('[USDZ Conversion] Validation failed:', validation.error);
      return {
        success: false,
        error: 'USDZ_VALIDATION_FAILURE',
        details: validation.error,
      };
    }

    const duration = Date.now() - startTime;
    console.log(`[USDZ Conversion] Generated ${usdzBuffer.byteLength} bytes in ${duration}ms`);

    return {
      success: true,
      usdzBuffer,
      fileSize: usdzBuffer.byteLength,
    };
  } catch (err: any) {
    console.error('[USDZ Conversion] Conversion error:', err);
    return {
      success: false,
      error: 'USDZ_CONVERSION_FAILURE',
      details: err?.message || 'Unknown conversion error',
    };
  }
}

