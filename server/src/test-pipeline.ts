import fs from 'node:fs';
import path from 'node:path';
import { validateGlbBinaryHeader, validateGlbAsset } from './validator.js';
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

async function runTests() {
  console.log('==================================================');
  console.log('PAYA 2 VR – Automated End-to-End Test Suite');
  console.log('==================================================\n');

  const validGlbPath = path.resolve(process.cwd(), '../sample-models/paya-cube.glb');
  if (!fs.existsSync(validGlbPath)) {
    throw new Error(`Sample GLB missing at ${validGlbPath}`);
  }
  const validBuffer = fs.readFileSync(validGlbPath);

  // ----------------------------------------------------
  console.log('1. Binary Header Validation Tests');
  // ----------------------------------------------------
  const validHeader = validateGlbBinaryHeader(validBuffer);
  assert(validHeader.valid === true, 'Valid GLB binary container recognized');

  // Test: Buffer smaller than 20 bytes
  const tinyBuffer = Buffer.from([0x01, 0x02, 0x03]);
  const tinyRes = validateGlbBinaryHeader(tinyBuffer);
  assert(tinyRes.valid === false, 'Rejects files under 20 bytes');

  // Test: Wrong magic number (e.g. "PNG\0" or random bytes)
  const fakeGlb = Buffer.from(validBuffer);
  fakeGlb.writeUInt32LE(0x12345678, 0); // Corrupt magic
  const fakeRes = validateGlbBinaryHeader(fakeGlb);
  assert(fakeRes.valid === false && Boolean(fakeRes.error?.includes('magic number')), 'Rejects files with invalid magic number');

  // Test: Wrong version (e.g. version 1)
  const v1Glb = Buffer.from(validBuffer);
  v1Glb.writeUInt32LE(1, 4); // Set version to 1
  const v1Res = validateGlbBinaryHeader(v1Glb);
  assert(v1Res.valid === false && Boolean(v1Res.error?.includes('version')), 'Rejects glTF version 1 files');

  // Test: Truncated file length
  const truncGlb = validBuffer.subarray(0, 50);
  const truncRes = validateGlbBinaryHeader(truncGlb);
  assert(truncRes.valid === false, 'Rejects truncated GLB containers');

  // ----------------------------------------------------
  console.log('\n2. Deep Model & Geometry Inspection Tests');
  // ----------------------------------------------------
  const validAsset = await validateGlbAsset(validBuffer);
  assert(validAsset.isValid === true, 'Deep asset validation succeeds for valid model');
  if (validAsset.isValid) {
    const meta = validAsset.metadata;
    assert(meta.meshCount === 1, `Mesh count matches expected (found ${meta.meshCount})`);
    assert(meta.vertexCount === 24, `Vertex count matches expected (found ${meta.vertexCount})`);
    assert(meta.triangleCount === 12, `Triangle count matches expected (found ${meta.triangleCount})`);
    assert(meta.hasNormals === true, 'Detected normal vectors');
    assert(meta.hasTexCoords === true, 'Detected texture coordinates');
    assert(meta.materialCount >= 1, `Material count matches expected (found ${meta.materialCount})`);
    assert(
      meta.dimensions.x > 0.25 && meta.dimensions.x < 0.35,
      `Calculated accurate X dimension (~0.3m, found ${meta.dimensions.x})`
    );
  }

  // Multi-material chair validation test
  const chairPath = path.resolve(process.cwd(), '../sample-models/paya-chair.glb');
  if (fs.existsSync(chairPath)) {
    const chairBuffer = fs.readFileSync(chairPath);
    const chairAsset = await validateGlbAsset(chairBuffer);
    assert(chairAsset.isValid === true, 'Deep asset validation succeeds for multi-material chair');
    if (chairAsset.isValid) {
      assert(chairAsset.metadata.materialCount === 2, `Detected multiple materials (found ${chairAsset.metadata.materialCount})`);
      assert(chairAsset.metadata.primitiveCount === 6, `Detected 6 primitives (found ${chairAsset.metadata.primitiveCount})`);
    }
  }

  // Corrupted GLB (corrupting JSON chunk)
  const corruptChunk = Buffer.from(validBuffer);
  corruptChunk.fill(0xff, 20, 100);
  const corruptRes = await validateGlbAsset(corruptChunk);
  assert(corruptRes.isValid === false, 'Rejects corrupted GLB chunk payload');
  if (!corruptRes.isValid) {
    assert(
      corruptRes.message === 'Unable to process this 3D model. Please try another file.',
      'Returns exact Case 2 user message on corrupted model'
    );
  } else {
    assert(false, 'Corrupted chunk should fail');
  }

  // ----------------------------------------------------
  console.log('\n3. Storage & Security Tests');
  // ----------------------------------------------------
  const saved = StorageService.saveModel(validBuffer);
  assert(Boolean(saved.modelId && saved.filePath), 'Model saved with secure UUID');
  assert(fs.existsSync(saved.filePath), 'Saved model file exists on disk');

  const retrievedPath = StorageService.getModelPath(saved.modelId);
  assert(retrievedPath === saved.filePath, 'Model path retrieved correctly via valid UUID');

  // Path traversal test
  const traversalPath = StorageService.getModelPath('../../../etc/passwd');
  assert(traversalPath === null, 'Rejects path traversal injection attempts');

  const deleted = StorageService.deleteModel(saved.modelId);
  assert(deleted === true, 'Storage successfully cleans up model');
  assert(StorageService.getModelPath(saved.modelId) === null, 'Model no longer accessible after deletion');

  // ----------------------------------------------------
  console.log('\n4. Summary');
  // ----------------------------------------------------
  console.log(`Passed: ${passed}/${passed + failed}`);
  if (failed > 0) {
    console.error(`Failed: ${failed}`);
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED SUCCESSFULLY! ✓\n');
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
