import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import dotenv from 'dotenv';
import { validateGlbAsset } from './validator.js';
import { StorageService } from './storage.js';
import { getOrCreateSSLCertificate } from './ssl.js';
import { ModelMetadata } from './types.js';

dotenv.config();

const app = express();
const HTTP_PORT = parseInt(process.env.PORT || '5000', 10);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '5443', 10);
const ENABLE_HTTPS = process.env.ENABLE_HTTPS !== 'false';

// Enable CORS for all requests (important for WebXR and model-viewer fetching GLBs)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
}));

app.use(express.json());

// In-memory metadata store for quick queries
const modelMetadataCache = new Map<string, ModelMetadata>();

// Multer memory storage with 50MB file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: (_req, file, cb) => {
    // Basic check - deep check happens in validation step
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.glb') {
      return cb(new Error('INVALID_EXTENSION'));
    }
    cb(null, true);
  },
});

/**
 * Health check endpoint
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    platform: 'PAYA 2 VR',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Upload and Validate GLB Endpoint
 * Strictly implements Step 2 & Step 3
 */
app.post('/api/upload', (req: Request, res: Response, next: NextFunction) => {
  upload.single('model')(req, res, async (err: any) => {
    if (err) {
      if (err.message === 'INVALID_EXTENSION') {
        return res.status(400).json({
          success: false,
          errorType: 'INVALID_GLB',
          message: 'Invalid 3D model. Please upload a valid GLB file.',
        });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          errorType: 'LIMIT_EXCEEDED',
          message: 'File size exceeds maximum allowed limit (50 MB).',
        });
      }
      return res.status(400).json({
        success: false,
        errorType: 'INVALID_GLB',
        message: 'Invalid 3D model. Please upload a valid GLB file.',
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        errorType: 'INVALID_GLB',
        message: 'No 3D model file provided. Please upload a valid GLB file.',
      });
    }

    try {
      const validation = await validateGlbAsset(req.file.buffer);

      if (!validation.isValid) {
        return res.status(422).json({
          success: false,
          errorType: validation.errorType,
          message: validation.message,
          details: validation.details,
        });
      }

      // Save valid model to temporary storage
      const { modelId } = StorageService.saveModel(req.file.buffer);
      modelMetadataCache.set(modelId, validation.metadata);

      // Determine public model URL
      const host = req.get('host') || `localhost:${HTTP_PORT}`;
      const protocol = req.protocol;
      const modelUrl = `${protocol}://${host}/api/models/${modelId}/model.glb`;

      return res.status(200).json({
        success: true,
        modelId,
        modelUrl,
        metadata: validation.metadata,
      });
    } catch (validationErr: any) {
      return res.status(422).json({
        success: false,
        errorType: 'CORRUPTED_MODEL',
        message: 'Unable to process this 3D model. Please try another file.',
        details: validationErr?.message,
      });
    }
  });
});

/**
 * Serve GLB model binary with proper MIME type and CORS
 */
app.get('/api/models/:id/model.glb', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const filePath = StorageService.getModelPath(id);

  if (!filePath) {
    return res.status(404).json({
      success: false,
      message: 'Model not found or has expired.',
    });
  }

  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  res.setHeader('Content-Type', 'model/gltf-binary');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': chunksize,
    });
    file.pipe(res);
  } else {
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
  }
});

/**
 * Retrieve model metadata
 */
app.get('/api/models/:id/info', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const metadata = modelMetadataCache.get(id);

  if (!metadata) {
    const filePath = StorageService.getModelPath(id);
    if (!filePath) {
      return res.status(404).json({ success: false, message: 'Model not found.' });
    }
    return res.json({ success: true, modelId: id, available: true });
  }

  return res.json({
    success: true,
    modelId: id,
    metadata,
  });
});

// Serve frontend build in production
const possibleClientDistPaths = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
];

let clientDistPath = possibleClientDistPaths.find((p) => fs.existsSync(p));
if (clientDistPath) {
  console.log(`[PAYA 2 VR] Serving client from ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDistPath!, 'index.html'));
  });
}

// Helper to get local network IP
function getLocalNetworkIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const networkIp = getLocalNetworkIp();

// Start HTTP server
const httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`[PAYA 2 VR] HTTP Server running:`);
  console.log(`  > Local:   http://localhost:${HTTP_PORT}`);
  console.log(`  > Network: http://${networkIp}:${HTTP_PORT}`);
});

// Start HTTPS server if enabled (for mobile WebXR over LAN)
if (ENABLE_HTTPS) {
  try {
    const ssl = getOrCreateSSLCertificate();
    const httpsServer = https.createServer(ssl, app);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`[PAYA 2 VR] HTTPS Server running (WebXR Ready):`);
      console.log(`  > Local:   https://localhost:${HTTPS_PORT}`);
      console.log(`  > Network: https://${networkIp}:${HTTPS_PORT}`);
    });
  } catch (sslErr) {
    console.warn('[PAYA 2 VR] Could not start HTTPS server:', sslErr);
  }
}
