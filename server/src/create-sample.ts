import { Document, NodeIO } from '@gltf-transform/core';
import fs from 'node:fs';
import path from 'node:path';

async function generateSample() {
  const outDir = path.resolve(process.cwd(), '../sample-models');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Create a valid GLB 3D cube model (30cm x 30cm x 30cm - realistic tabletop size)
  const doc = new Document();
  const buffer = doc.createBuffer();

  // 24 vertices for 6 faces with proper normals & UVs
  const positions = new Float32Array([
    // Front face
    -0.15, -0.15,  0.15,   0.15, -0.15,  0.15,   0.15,  0.15,  0.15,  -0.15,  0.15,  0.15,
    // Back face
    -0.15, -0.15, -0.15,  -0.15,  0.15, -0.15,   0.15,  0.15, -0.15,   0.15, -0.15, -0.15,
    // Top face
    -0.15,  0.15, -0.15,  -0.15,  0.15,  0.15,   0.15,  0.15,  0.15,   0.15,  0.15, -0.15,
    // Bottom face
    -0.15, -0.15, -0.15,   0.15, -0.15, -0.15,   0.15, -0.15,  0.15,  -0.15, -0.15,  0.15,
    // Right face
     0.15, -0.15, -0.15,   0.15,  0.15, -0.15,   0.15,  0.15,  0.15,   0.15, -0.15,  0.15,
    // Left face
    -0.15, -0.15, -0.15,  -0.15, -0.15,  0.15,  -0.15,  0.15,  0.15,  -0.15,  0.15, -0.15,
  ]);

  const normals = new Float32Array([
    // Front
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    // Back
    0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
    // Top
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    // Bottom
    0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
    // Right
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    // Left
    -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
  ]);

  const uvs = new Float32Array([
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
  ]);

  const indices = new Uint16Array([
     0,  1,  2,   0,  2,  3, // Front
     4,  5,  6,   4,  6,  7, // Back
     8,  9, 10,   8, 10, 11, // Top
    12, 13, 14,  12, 14, 15, // Bottom
    16, 17, 18,  16, 18, 19, // Right
    20, 21, 22,  20, 22, 23, // Left
  ]);

  const posAccessor = doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer);
  const normAccessor = doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer);
  const uvAccessor = doc.createAccessor().setType('VEC2').setArray(uvs).setBuffer(buffer);
  const idxAccessor = doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer);

  // Material: Paya Blue (#2563EB)
  const mat = doc.createMaterial('PayaBlueMaterial')
    .setBaseColorFactor([0.145, 0.388, 0.921, 1.0])
    .setMetallicFactor(0.15)
    .setRoughnessFactor(0.35);

  const prim = doc.createPrimitive()
    .setAttribute('POSITION', posAccessor)
    .setAttribute('NORMAL', normAccessor)
    .setAttribute('TEXCOORD_0', uvAccessor)
    .setIndices(idxAccessor)
    .setMaterial(mat);

  const mesh = doc.createMesh('PayaCubeMesh').addPrimitive(prim);
  const node = doc.createNode('PayaCubeNode').setMesh(mesh);
  const scene = doc.createScene('PayaScene').addChild(node);
  doc.getRoot().setDefaultScene(scene);

  const io = new NodeIO();
  const glbBuffer = await io.writeBinary(doc);

  const outPath = path.join(outDir, 'paya-cube.glb');
  fs.writeFileSync(outPath, Buffer.from(glbBuffer));
  console.log(`[PAYA 2 VR] Generated sample GLB at ${outPath} (${glbBuffer.byteLength} bytes)`);
}

generateSample().catch(console.error);

