import fs from 'node:fs';
import path from 'node:path';
import { validateGlbBinaryHeader, validateGlbAsset } from './validator.js';
import { StorageService } from './storage.js';
import { convertGlbToUsdz, validateUsdzBinary } from './usdzConversionService.js';

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
  console.log('PAYA 2 VR / SMC - AR – Unified Test Suite');
  console.log('==================================================\n');

  const samplePaths = [
    path.resolve(process.cwd(), 'sample-models/paya-cube.glb'),
    path.resolve(process.cwd(), '../sample-models/paya-cube.glb'),
  ];
  const validGlbPath = samplePaths.find((p) => fs.existsSync(p)) || samplePaths[0];
  if (!fs.existsSync(validGlbPath)) {
    throw new Error(`Sample GLB missing at ${validGlbPath}`);
  }
  const validBuffer = fs.readFileSync(validGlbPath);

  // ----------------------------------------------------
  console.log('1. Binary Header Validation Tests (Android & Core)');
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
  console.log('\n2. Deep Model & Geometry Inspection Tests (Android & Core)');
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
  const chairPaths = [
    path.resolve(process.cwd(), 'sample-models/paya-chair.glb'),
    path.resolve(process.cwd(), '../sample-models/paya-chair.glb'),
  ];
  const chairPath = chairPaths.find((p) => fs.existsSync(p)) || chairPaths[0];
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
  console.log('\n3. iOS GLB-to-USDZ Conversion & Quick Look Engine Tests');
  // ----------------------------------------------------
  // Test USDZ container validator with bad buffers
  const badUsdz = validateUsdzBinary(Buffer.from('not a zip archive at all'));
  assert(badUsdz.valid === false, 'Rejects invalid USDZ signature');

  // Convert valid cube GLB to USDZ
  const usdzCubeRes = await convertGlbToUsdz(validBuffer);
  assert(usdzCubeRes.success === true, 'GLB to USDZ conversion succeeds for cube');
  assert(Boolean(usdzCubeRes.usdzBuffer && usdzCubeRes.usdzBuffer.length > 500), 'Generated non-empty USDZ archive (>500 bytes)');

  if (usdzCubeRes.usdzBuffer) {
    const valRes = validateUsdzBinary(usdzCubeRes.usdzBuffer);
    assert(valRes.valid === true, 'Generated USDZ passes container structure verification');
  }

  // Convert multi-material chair GLB to USDZ
  if (fs.existsSync(chairPath)) {
    const chairBuf = fs.readFileSync(chairPath);
    const usdzChairRes = await convertGlbToUsdz(chairBuf);
    assert(usdzChairRes.success === true, 'GLB to USDZ conversion succeeds for multi-material chair');
    assert(Boolean(usdzChairRes.usdzBuffer && usdzChairRes.usdzBuffer.length > 2000), 'Generated multi-material USDZ archive (>2000 bytes)');
  }

  // ----------------------------------------------------
  console.log('\n4. Storage & Security Tests (GLB + USDZ)');
  // ----------------------------------------------------
  const saved = StorageService.saveModel(validBuffer);
  assert(Boolean(saved.modelId && saved.filePath), 'GLB Model saved with secure UUID');
  assert(fs.existsSync(saved.filePath), 'Saved GLB model file exists on disk');

  if (usdzCubeRes.usdzBuffer) {
    const savedUsdz = StorageService.saveUSDZ(saved.modelId, usdzCubeRes.usdzBuffer);
    assert(Boolean(savedUsdz && fs.existsSync(savedUsdz.filePath)), 'USDZ asset saved with same model UUID');
    assert(StorageService.hasUSDZ(saved.modelId) === true, 'hasUSDZ reports true');
    assert(StorageService.getUSDZPath(saved.modelId) === savedUsdz?.filePath, 'getUSDZPath returns correct path');
  }

  const retrievedPath = StorageService.getModelPath(saved.modelId);
  assert(retrievedPath === saved.filePath, 'Model path retrieved correctly via valid UUID');

  // Path traversal test
  const traversalPath = StorageService.getModelPath('../../../etc/passwd');
  assert(traversalPath === null, 'Rejects path traversal injection attempts on GLB');
  const traversalUsdz = StorageService.getUSDZPath('../../../etc/passwd');
  assert(traversalUsdz === null, 'Rejects path traversal injection attempts on USDZ');

  const deleted = StorageService.deleteModel(saved.modelId);
  assert(deleted === true, 'Storage successfully cleans up model assets (GLB + USDZ)');
  assert(StorageService.getModelPath(saved.modelId) === null, 'GLB model no longer accessible after deletion');
  assert(StorageService.getUSDZPath(saved.modelId) === null, 'USDZ model no longer accessible after deletion');

  // ----------------------------------------------------
  console.log('\n5. Summary');
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
