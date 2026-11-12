/**
 * Client-side binary pre-validation of GLB files.
 */
export async function preValidateGlbFile(file: File): Promise<{ valid: boolean; error?: string }> {
  // 1. Extension check
  if (!file.name.toLowerCase().endsWith('.glb')) {
    return {
      valid: false,
      error: 'Invalid 3D model. Please upload a valid GLB file.',
    };
  }

  // 2. Minimum file size check
  if (file.size < 20) {
    return {
      valid: false,
      error: 'Invalid 3D model. Please upload a valid GLB file.',
    };
  }

  // 3. Read first 20 bytes for container header validation
  try {
    const headerBuffer = await file.slice(0, 20).arrayBuffer();
    const dataView = new DataView(headerBuffer);

    // Magic number: 0x46546C67 ("glTF")
    const magic = dataView.getUint32(0, true);
    if (magic !== 0x46546c67) {
      return {
        valid: false,
        error: 'Invalid 3D model. Please upload a valid GLB file.',
      };
    }

    // Version: must be 2
    const version = dataView.getUint32(4, true);
    if (version !== 2) {
      return {
        valid: false,
        error: 'Unsupported 3D model version. Only glTF 2.0 GLB files are supported.',
      };
    }

    // First chunk type: 0x4E4F534A ("JSON")
    const firstChunkType = dataView.getUint32(16, true);
    if (firstChunkType !== 0x4e4f534a) {
      return {
        valid: false,
        error: 'Invalid 3D model structure. Please upload a valid GLB file.',
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Unable to process this 3D model. Please try another file.',
    };
  }
}

