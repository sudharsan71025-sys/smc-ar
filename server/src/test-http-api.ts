import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { validateGlbAsset } from './validator.js';
import { StorageService } from './storage.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

// Build mini Express app instance for test
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.glb') return cb(new Error('INVALID_EXTENSION'));
    cb(null, true);
  },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', platform: 'PAYA 2 VR' });
});

app.post('/api/upload', (req, res) => {
  upload.single('model')(req, res, async (err: any) => {
    if (err) {
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
        });
      }

      const { modelId } = StorageService.saveModel(req.file.buffer);
      const modelUrl = `/api/models/${modelId}/model.glb`;

      return res.status(200).json({
        success: true,
        modelId,
        modelUrl,
        metadata: validation.metadata,
      });
    } catch {
      return res.status(422).json({
        success: false,
        errorType: 'CORRUPTED_MODEL',
        message: 'Unable to process this 3D model. Please try another file.',
      });
    }
  });
});

app.get('/api/models/:id/model.glb', (req, res) => {
  const id = String(req.params.id);
  const filePath = StorageService.getModelPath(id);
  if (!filePath) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  res.setHeader('Content-Type', 'model/gltf-binary');
  res.setHeader('Access-Control-Allow-Origin', '*');
  fs.createReadStream(filePath).pipe(res);
});

async function runHttpTests() {
  console.log('==================================================');
  console.log('PAYA 2 VR – HTTP Integration Tests');
  console.log('==================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Health check test
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = (await healthRes.json()) as any;
    assert(healthRes.status === 200 && healthData.status === 'ok', 'GET /api/health returns 200 OK');

    // 2. Valid GLB Upload
    const validGlbPath = path.resolve(process.cwd(), '../sample-models/paya-cube.glb');
    const validBlob = new Blob([fs.readFileSync(validGlbPath)], { type: 'model/gltf-binary' });
    const formData = new FormData();
    formData.append('model', validBlob, 'paya-cube.glb');

    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    const uploadData = (await uploadRes.json()) as any;
    assert(uploadRes.status === 200, 'POST /api/upload with valid GLB returns HTTP 200');
    assert(uploadData.success === true, 'Upload response contains success: true');
    assert(Boolean(uploadData.modelId && uploadData.modelUrl), 'Upload response contains modelId and modelUrl');
    assert(uploadData.metadata?.meshCount === 1, 'Upload response contains verified metadata (meshCount: 1)');

    // 3. Download GLB
    const downloadRes = await fetch(`${baseUrl}${uploadData.modelUrl}`);
    assert(downloadRes.status === 200, 'GET /api/models/:id/model.glb returns HTTP 200');
    assert(
      downloadRes.headers.get('content-type') === 'model/gltf-binary',
      'Download response has Content-Type: model/gltf-binary'
    );
    const downloadedBuffer = await downloadRes.arrayBuffer();
    assert(
      downloadedBuffer.byteLength === validBlob.size,
      `Downloaded size (${downloadedBuffer.byteLength}) matches original (${validBlob.size})`
    );

    // Clean up created test model
    StorageService.deleteModel(uploadData.modelId);

    // 4. Invalid GLB (Text file renamed to .glb) - Case 1
    const textBlob = new Blob(['This is not a GLB file at all.'], { type: 'text/plain' });
    const fakeFormData = new FormData();
    fakeFormData.append('model', textBlob, 'fake.glb');

    const fakeRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: fakeFormData,
    });
    const fakeData = (await fakeRes.json()) as any;
    assert(fakeRes.status === 422 || fakeRes.status === 400, 'POST /api/upload with fake GLB is rejected');
    assert(
      fakeData.message === 'Invalid 3D model. Please upload a valid GLB file.',
      'Returns exact Case 1 message: "Invalid 3D model. Please upload a valid GLB file."'
    );

    // 5. Corrupted GLB binary - Case 2
    const corruptedBuffer = Buffer.from(fs.readFileSync(validGlbPath));
    corruptedBuffer.fill(0x00, 20, 150); // Corrupt chunk
    const corruptBlob = new Blob([corruptedBuffer], { type: 'model/gltf-binary' });
    const corruptForm = new FormData();
    corruptForm.append('model', corruptBlob, 'corrupted.glb');

    const corruptRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: corruptForm,
    });
    const corruptData = (await corruptRes.json()) as any;
    assert(corruptRes.status === 422, 'POST /api/upload with corrupted GLB returns 422');
    assert(
      corruptData.message === 'Unable to process this 3D model. Please try another file.',
      'Returns exact Case 2 message: "Unable to process this 3D model. Please try another file."'
    );

    console.log(`\nHTTP Tests Passed: ${passed}/${passed + failed}`);
    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runHttpTests().catch((err) => {
  console.error('Fatal HTTP test error:', err);
  process.exit(1);
});
