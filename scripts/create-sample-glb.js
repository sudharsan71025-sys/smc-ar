import { Document, NodeIO } from '@gltf-transform/core';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(process.cwd(), 'sample-models');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Create a valid GLB cube
const doc = new Document();
const buffer = doc.createBuffer();

// Position accessor: 8 vertices for a 0.3m x 0.3m x 0.3m cube
const positions = new Float32Array([
  // Front
  -0.15, -0.15,  0.15,
   0.15, -0.15,  0.15,
   0.15,  0.15,  0.15,
  -0.15,  0.15,  0.15,
  // Back
  -0.15, -0.15, -0.15,
  -0.15,  0.15, -0.15,
   0.15,  0.15, -0.15,
   0.15, -0.15, -0.15,
  // Top
  -0.15,  0.15, -0.15,
  -0.15,  0.15,  0.15,
   0.15,  0.15,  0.15,
   0.15,  0.15, -0.15,
  // Bottom
  -0.15, -0.15, -0.15,
   0.15, -0.15, -0.15,
   0.15, -0.15,  0.15,
  -0.15, -0.15,  0.15,
  // Right
   0.15, -0.15, -0.15,
   0.15,  0.15, -0.15,
   0.15,  0.15,  0.15,
   0.15, -0.15,  0.15,
  // Left
  -0.15, -0.15, -0.15,
  -0.15, -0.15,  0.15,
  -0.15,  0.15,  0.15,
  -0.15,  0.15, -0.15,
]);

// Indices for 6 faces (12 triangles)
const indices = new Uint16Array([
   0,  1,  2,   0,  2,  3, // Front
   4,  5,  6,   4,  6,  7, // Back
   8,  9, 10,   8, 10, 11, // Top
  12, 13, 14,  12, 14, 15, // Bottom
  16, 17, 18,  16, 18, 19, // Right
  20, 21, 22,  20, 22, 23, // Left
]);

const posAccessor = doc.createAccessor()
  .setType('VEC3')
  .setArray(positions)
  .setBuffer(buffer);

const idxAccessor = doc.createAccessor()
  .setType('SCALAR')
  .setArray(indices)
  .setBuffer(buffer);

// Create material
const mat = doc.createMaterial('PayaBlueMaterial')
  .setBaseColorFactor([0.145, 0.388, 0.921, 1.0]) // #2563EB
  .setMetallicFactor(0.2)
  .setRoughnessFactor(0.4);

// Create Primitive
const prim = doc.createPrimitive()
  .setAttribute('POSITION', posAccessor)
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
console.log(`Created sample GLB at ${outPath} (${glbBuffer.byteLength} bytes)`);

