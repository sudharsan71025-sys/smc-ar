import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { ModelMetadata, ValidationResult, Vector3D } from './types.js';

const GLB_HEADER_MAGIC = 0x46546C67; // "glTF"
const GLB_VERSION_2 = 2;
const GLB_CHUNK_TYPE_JSON = 0x4E4F534A; // "JSON"

/**
 * Validates the raw binary GLB header and chunk structure.
 */
export function validateGlbBinaryHeader(buffer: Buffer): { valid: boolean; error?: string } {
  if (buffer.length < 20) {
    return { valid: false, error: 'File is too small to be a valid GLB container.' };
  }

  const magic = buffer.readUInt32LE(0);
  if (magic !== GLB_HEADER_MAGIC) {
    return {
      valid: false,
      error: 'Invalid file format: GLB magic number 0x46546C67 ("glTF") missing.',
    };
  }

  const version = buffer.readUInt32LE(4);
  if (version !== GLB_VERSION_2) {
    return {
      valid: false,
      error: `Unsupported glTF version ${version}. Only glTF 2.0 is supported for AR.`,
    };
  }

  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength > buffer.length) {
    return {
      valid: false,
      error: `GLB file is truncated (declared ${declaredLength} bytes, found ${buffer.length} bytes).`,
    };
  }

  const firstChunkLength = buffer.readUInt32LE(12);
  const firstChunkType = buffer.readUInt32LE(16);

  if (firstChunkType !== GLB_CHUNK_TYPE_JSON) {
    return {
      valid: false,
      error: 'First GLB chunk is not JSON chunk.',
    };
  }

  if (12 + 8 + firstChunkLength > buffer.length) {
    return {
      valid: false,
      error: 'GLB JSON chunk data overflows file length.',
    };
  }

  return { valid: true };
}

/**
 * Performs deep inspection of the GLB asset using @gltf-transform.
 * Validates meshes, primitives, materials, textures, and bounding box dimensions.
 */
export async function validateGlbAsset(buffer: Buffer): Promise<ValidationResult> {
  // Step 1: Binary Container Check
  const headerCheck = validateGlbBinaryHeader(buffer);
  if (!headerCheck.valid) {
    return {
      isValid: false,
      errorType: 'INVALID_GLB',
      message: 'Invalid 3D model. Please upload a valid GLB file.',
      details: headerCheck.error,
    };
  }

  // Step 2: GLB parsing and schema inspection
  try {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const document = await io.readBinary(new Uint8Array(buffer));
    const root = document.getRoot();

    const meshes = root.listMeshes();
    if (meshes.length === 0) {
      return {
        isValid: false,
        errorType: 'EMPTY_GEOMETRY',
        message: 'Unable to process this 3D model. No meshes found.',
        details: 'The GLB file contains no mesh objects.',
      };
    }

    let totalPrimitives = 0;
    let totalVertices = 0;
    let totalTriangles = 0;
    let hasNormals = false;
    let hasTangents = false;
    let hasTexCoords = false;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const mesh of meshes) {
      const primitives = mesh.listPrimitives();
      totalPrimitives += primitives.length;

      for (const prim of primitives) {
        const position = prim.getAttribute('POSITION');
        if (!position) {
          continue;
        }

        const vertCount = position.getCount();
        totalVertices += vertCount;

        if (prim.getAttribute('NORMAL')) hasNormals = true;
        if (prim.getAttribute('TANGENT')) hasTangents = true;
        if (prim.getAttribute('TEXCOORD_0')) hasTexCoords = true;

        // Triangles calculation
        const indices = prim.getIndices();
        if (indices) {
          totalTriangles += Math.floor(indices.getCount() / 3);
        } else {
          totalTriangles += Math.floor(vertCount / 3);
        }

        // Bounding box calculation
        const minArr = position.getMin([0, 0, 0]);
        const maxArr = position.getMax([0, 0, 0]);

        if (minArr && maxArr) {
          if (Number.isFinite(minArr[0])) minX = Math.min(minX, minArr[0]);
          if (Number.isFinite(minArr[1])) minY = Math.min(minY, minArr[1]);
          if (Number.isFinite(minArr[2])) minZ = Math.min(minZ, minArr[2]);

          if (Number.isFinite(maxArr[0])) maxX = Math.max(maxX, maxArr[0]);
          if (Number.isFinite(maxArr[1])) maxY = Math.max(maxY, maxArr[1]);
          if (Number.isFinite(maxArr[2])) maxZ = Math.max(maxZ, maxArr[2]);
        }
      }
    }

    if (totalVertices === 0 || totalTriangles === 0) {
      return {
        isValid: false,
        errorType: 'EMPTY_GEOMETRY',
        message: 'Invalid 3D model. Geometry contains no vertices or faces.',
        details: 'Zero vertices found across all mesh primitives.',
      };
    }

    // Fallback if bounds could not be computed from accessors
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      minX = -0.5; maxX = 0.5;
      minY = 0; maxY = 1.0;
      minZ = -0.5; maxZ = 0.5;
    }

    const sizeX = Math.abs(maxX - minX);
    const sizeY = Math.abs(maxY - minY);
    const sizeZ = Math.abs(maxZ - minZ);

    const materials = root.listMaterials();
    const textures = root.listTextures();

    const metadata: ModelMetadata = {
      fileSize: buffer.length,
      meshCount: meshes.length,
      primitiveCount: totalPrimitives,
      vertexCount: totalVertices,
      triangleCount: totalTriangles,
      materialCount: materials.length,
      textureCount: textures.length,
      dimensions: {
        x: Number(sizeX.toFixed(4)),
        y: Number(sizeY.toFixed(4)),
        z: Number(sizeZ.toFixed(4)),
      },
      boundingBox: {
        min: { x: Number(minX.toFixed(4)), y: Number(minY.toFixed(4)), z: Number(minZ.toFixed(4)) },
        max: { x: Number(maxX.toFixed(4)), y: Number(maxY.toFixed(4)), z: Number(maxZ.toFixed(4)) },
      },
      hasNormals,
      hasTangents,
      hasTexCoords,
    };

    return {
      isValid: true,
      metadata,
    };
  } catch (error: any) {
    return {
      isValid: false,
      errorType: 'CORRUPTED_MODEL',
      message: 'Unable to process this 3D model. Please try another file.',
      details: error?.message || 'glTF document parsing failed',
    };
  }
}
