export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox3D {
  min: Vector3D;
  max: Vector3D;
}

export interface ModelMetadata {
  fileSize: number;
  meshCount: number;
  primitiveCount: number;
  vertexCount: number;
  triangleCount: number;
  materialCount: number;
  textureCount: number;
  dimensions: Vector3D;
  boundingBox: BoundingBox3D;
  hasNormals: boolean;
  hasTangents: boolean;
  hasTexCoords: boolean;
}

export interface ValidationSuccess {
  isValid: true;
  metadata: ModelMetadata;
}

export interface ValidationFailure {
  isValid: false;
  errorType: 'INVALID_GLB' | 'CORRUPTED_MODEL' | 'EMPTY_GEOMETRY' | 'LIMIT_EXCEEDED';
  message: string;
  details?: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export interface UploadResponseSuccess {
  success: true;
  modelId: string;
  modelUrl: string;
  metadata: ModelMetadata;
}

export interface UploadResponseError {
  success: false;
  errorType: string;
  message: string;
}

export type UploadResponse = UploadResponseSuccess | UploadResponseError;
