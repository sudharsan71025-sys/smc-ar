import { Document, NodeIO } from '@gltf-transform/core';
import fs from 'node:fs';
import path from 'node:path';

async function generateChair() {
  const doc = new Document();
  const buffer = doc.createBuffer();

  // Create materials: wood seat, metal legs
  const woodMat = doc.createMaterial('WoodMaterial')
    .setBaseColorFactor([0.76, 0.60, 0.42, 1.0])
    .setRoughnessFactor(0.7)
    .setMetallicFactor(0.0);

  const metalMat = doc.createMaterial('MetalMaterial')
    .setBaseColorFactor([0.2, 0.2, 0.22, 1.0])
    .setRoughnessFactor(0.2)
    .setMetallicFactor(0.9);

  // Helper to create box primitive
  function createBoxPrim(w: number, h: number, d: number, ox: number, oy: number, oz: number, mat: any) {
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;

    const positions = new Float32Array([
      // Front
      ox - hw, oy - hh, oz + hd,  ox + hw, oy - hh, oz + hd,  ox + hw, oy + hh, oz + hd,  ox - hw, oy + hh, oz + hd,
      // Back
      ox - hw, oy - hh, oz - hd,  ox - hw, oy + hh, oz - hd,  ox + hw, oy + hh, oz - hd,  ox + hw, oy - hh, oz - hd,
      // Top
      ox - hw, oy + hh, oz - hd,  ox - hw, oy + hh, oz + hd,  ox + hw, oy + hh, oz + hd,  ox + hw, oy + hh, oz - hd,
      // Bottom
      ox - hw, oy - hh, oz - hd,  ox + hw, oy - hh, oz - hd,  ox + hw, oy - hh, oz + hd,  ox - hw, oy - hh, oz + hd,
      // Right
      ox + hw, oy - hh, oz - hd,  ox + hw, oy + hh, oz - hd,  ox + hw, oy + hh, oz + hd,  ox + hw, oy - hh, oz + hd,
      // Left
      ox - hw, oy - hh, oz - hd,  ox - hw, oy - hh, oz + hd,  ox - hw, oy + hh, oz + hd,  ox - hw, oy + hh, oz - hd,
    ]);

    const normals = new Float32Array([
      0,0,1, 0,0,1, 0,0,1, 0,0,1,
      0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
      0,1,0, 0,1,0, 0,1,0, 0,1,0,
      0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
      1,0,0, 1,0,0, 1,0,0, 1,0,0,
      -1,0,0, -1,0,0, -1,0,0, -1,0,0,
    ]);

    const indices = new Uint16Array([
       0,  1,  2,   0,  2,  3,
       4,  5,  6,   4,  6,  7,
       8,  9, 10,   8, 10, 11,
      12, 13, 14,  12, 14, 15,
      16, 17, 18,  16, 18, 19,
      20, 21, 22,  20, 22, 23,
    ]);

    const pos = doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer);
    const norm = doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer);
    const idx = doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer);

    return doc.createPrimitive()
      .setAttribute('POSITION', pos)
      .setAttribute('NORMAL', norm)
      .setIndices(idx)
      .setMaterial(mat);
  }

  // Seat: 0.45m x 0.04m x 0.45m at y = 0.45m
  const seatPrim = createBoxPrim(0.45, 0.04, 0.45, 0, 0.45, 0, woodMat);
  // Backrest: 0.45m x 0.40m x 0.03m at y = 0.67m, z = -0.21m
  const backPrim = createBoxPrim(0.45, 0.40, 0.03, 0, 0.67, -0.21, woodMat);
  // 4 Legs: 0.03m x 0.43m x 0.03m at y = 0.215m
  const leg1 = createBoxPrim(0.03, 0.43, 0.03, -0.19, 0.215, -0.19, metalMat);
  const leg2 = createBoxPrim(0.03, 0.43, 0.03,  0.19, 0.215, -0.19, metalMat);
  const leg3 = createBoxPrim(0.03, 0.43, 0.03, -0.19, 0.215,  0.19, metalMat);
  const leg4 = createBoxPrim(0.03, 0.43, 0.03,  0.19, 0.215,  0.19, metalMat);

  const mesh = doc.createMesh('ChairMesh')
    .addPrimitive(seatPrim)
    .addPrimitive(backPrim)
    .addPrimitive(leg1)
    .addPrimitive(leg2)
    .addPrimitive(leg3)
    .addPrimitive(leg4);

  const node = doc.createNode('ChairNode').setMesh(mesh);
  const scene = doc.createScene('PayaChairScene').addChild(node);
  doc.getRoot().setDefaultScene(scene);

  const io = new NodeIO();
  const glb = await io.writeBinary(doc);
  const outPath = path.resolve(process.cwd(), '../sample-models/paya-chair.glb');
  fs.writeFileSync(outPath, Buffer.from(glb));
  console.log(`[PAYA 2 VR] Generated multi-material sample GLB at ${outPath} (${glb.byteLength} bytes)`);
}

generateChair().catch(console.error);

