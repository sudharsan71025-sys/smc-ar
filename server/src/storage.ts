import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Clean up files older than 2 hours periodically
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(UPLOAD_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > MAX_AGE_MS) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.error('File cleanup error:', err);
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupOldFiles, 30 * 60 * 1000).unref();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class StorageService {
  /**
   * Save a GLB model buffer to storage with a secure UUID.
   */
  static saveModel(buffer: Buffer): { modelId: string; filePath: string } {
    const modelId = uuidv4();
    const filePath = path.join(UPLOAD_DIR, `${modelId}.glb`);
    fs.writeFileSync(filePath, buffer);
    return { modelId, filePath };
  }

  /**
   * Save a USDZ model buffer associated with an existing modelId.
   */
  static saveUSDZ(modelId: string, buffer: Buffer): { filePath: string } | null {
    if (!UUID_REGEX.test(modelId)) {
      return null;
    }
    const filePath = path.join(UPLOAD_DIR, `${modelId}.usdz`);
    fs.writeFileSync(filePath, buffer);
    return { filePath };
  }

  /**
   * Get the file path of a GLB model by ID.
   * Uses strict UUID validation to prevent path traversal.
   */
  static getModelPath(modelId: string): string | null {
    if (!UUID_REGEX.test(modelId)) {
      return null;
    }

    const filePath = path.join(UPLOAD_DIR, `${modelId}.glb`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    return null;
  }

  /**
   * Get the file path of a USDZ model by ID.
   * Uses strict UUID validation to prevent path traversal.
   */
  static getUSDZPath(modelId: string): string | null {
    if (!UUID_REGEX.test(modelId)) {
      return null;
    }

    const filePath = path.join(UPLOAD_DIR, `${modelId}.usdz`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    return null;
  }

  /**
   * Check whether a USDZ asset exists for a given model ID.
   */
  static hasUSDZ(modelId: string): boolean {
    return this.getUSDZPath(modelId) !== null;
  }

  /**
   * Delete both GLB and USDZ model assets from storage.
   */
  static deleteModel(modelId: string): boolean {
    if (!UUID_REGEX.test(modelId)) {
      return false;
    }

    let deleted = false;
    const glbPath = path.join(UPLOAD_DIR, `${modelId}.glb`);
    if (fs.existsSync(glbPath)) {
      fs.unlinkSync(glbPath);
      deleted = true;
    }

    const usdzPath = path.join(UPLOAD_DIR, `${modelId}.usdz`);
    if (fs.existsSync(usdzPath)) {
      fs.unlinkSync(usdzPath);
      deleted = true;
    }

    return deleted;
  }
}
