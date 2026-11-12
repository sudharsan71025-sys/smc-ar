export type AppState =
  | 'INITIAL'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'VALIDATING'
  | 'CHECKING_COMPATIBILITY'
  | 'READY'
  | 'AR_INITIALIZING'
  | 'AR_ACTIVE'
  | 'ERROR';

export type ARMode = 'webxr' | 'scene-viewer' | 'quick-look' | 'none';

export type PlatformType = 'android' | 'ios' | 'other';

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
  usdzSize?: number;
}

export interface ARCompatibilityResult {
  mode: ARMode;
  platform: PlatformType;
  supported: boolean;
  reason?: string;
  isSecureContext: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  usdzUrl?: string;
}

export interface AppError {
  type:
    | 'INVALID_GLB'
    | 'CORRUPTED_MODEL'
    | 'USDZ_CONVERSION_FAILURE'
    | 'USDZ_VALIDATION_FAILURE'
    | 'UNSUPPORTED_AR'
    | 'CAMERA_PERMISSION_DENIED'
    | 'HTTPS_MISSING'
    | 'SESSION_INIT_FAILED'
    | 'QUICK_LOOK_LAUNCH_FAILED'
    | 'LOAD_FAILED';
  message: string;
}
