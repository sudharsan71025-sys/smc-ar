# SMC - AR (PAYA 2 VR) – Universal Web-Based Augmented Reality Platform

**SMC - AR** is a production-oriented, mobile-first Web-Based Augmented Reality (AR) visualization platform supporting both **Android** and **Apple iOS/iPadOS** from a single unified codebase.

A user uploads **one 3D model in GLB format**. The platform automatically validates the asset, converts it to USDZ for Apple devices, detects device and browser capabilities, and launches the appropriate native AR experience (WebXR / Google Scene Viewer on Android, or Apple AR Quick Look on iOS).

---

## 1. Cross-Platform Unified Architecture

```
                               ┌─────────────────────────────┐
                               │     USER UPLOADS .GLB       │
                               └──────────────┬──────────────┘
                                              │
                                              ▼
                               ┌─────────────────────────────┐
                               │  DEEP ASSET VALIDATION      │
                               │  glTF-Transform Inspection  │
                               └──────────────┬──────────────┘
                                              │
                                              ▼
                               ┌─────────────────────────────┐
                               │  AUTOMATIC USDZ GENERATION  │
                               │  glTF ➔ Pixar/Apple USDZ    │
                               └──────────────┬──────────────┘
                                              │
                                              ▼
                               ┌─────────────────────────────┐
                               │  UNIFIED PLATFORM ROUTER    │
                               │   (arPlatformRouter.ts)     │
                               └──────┬───────────────┬──────┘
                                      │               │
                     ┌────────────────┴────┐     ┌────┴────────────────┐
                     │   ANDROID CLIENT    │     │     IOS CLIENT      │
                     └─────────┬───────────┘     └─────────┬───────────┘
                               │                           │
                   ┌───────────┴───────────┐               │
                   │ WebXR (Primary)       │               ▼
                   │ Scene Viewer Fallback │     ┌─────────────────────┐
                   └───────────────────────┘     │ Apple AR Quick Look │
                                                 │ <a rel="ar"> (USDZ) │
                                                 └─────────────────────┘
```

---

## 2. Platform Pipelines

### Android Pipeline
- **Primary Mode**: **WebXR `immersive-ar`**
  - Hit Test API for horizontal real-world surface detection.
  - Three.js WebGL renderer with contact shadows.
  - Interactive tap-to-place, drag rotation, and pinch-to-scale.
- **Fallback Mode**: **Google Scene Viewer**
  - Native intent launch: `intent://arvr.google.com/scene-viewer/1.0?file=...&mode=ar_only...`
  - Automatic redirect to Google Play Services for AR (ARCore) if required.

### iOS / iPadOS Pipeline
- **Engine**: **Apple AR Quick Look**
  - Automatically converts uploaded `.glb` files to `.usdz` on the backend.
  - Preserves PBR materials (`UsdPreviewSurface`), textures, UV coordinates, and physical meter scales (`metersPerUnit = 1`, `upAxis = "Y"`).
  - Feature-detects Safari Quick Look support via `anchor.relList.supports('ar')`.
  - Served with standard MIME type `model/vnd.usdz+zip`.
  - Launches native Apple AR Quick Look with real-world surface placement, lighting estimation, and pinch-to-scale.

---

## 3. Strict Minimalist UI & State Machine

The interface strictly contains **two primary interaction buttons** across its entire lifecycle:
1. `Upload 3D Model` (Initial state)
2. `Open Camera` (Appears **only** after verification and compatibility detection pass, replacing the Upload button)

### Processing Status Progression
- **Android**: `Uploading` ➔ `Processing Model` ➔ `Validating Geometry` ➔ `Checking Materials` ➔ `Checking AR Compatibility` ➔ `Ready`.
- **iOS**: `Uploading` ➔ `Validating GLB` ➔ `Preparing USDZ` ➔ `Validating USDZ` ➔ `Checking AR Compatibility` ➔ `Ready`.

---

## 4. Backend Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check and platform verification |
| `POST` | `/api/upload` | Validates GLB, converts to USDZ, saves both, returns `modelUrl` and `usdzUrl` |
| `GET` | `/api/models/:id/model.glb` | Streams binary GLB for Android (`model/gltf-binary`) |
| `GET` | `/api/models/:id/model.usdz` | Streams binary USDZ for iOS (`model/vnd.usdz+zip`) |
| `GET` | `/api/models/:id/assets` | Returns unified asset descriptor (GLB + USDZ URLs) |
| `POST` | `/api/models/:id/prepare-ios` | On-demand USDZ conversion endpoint |

---

## 5. Automated Test Suite (53 Tests)

Run the full unified test suite covering Android, iOS, and Core pipelines:

```bash
npm test
```

### Coverage:
- **Binary Header Validation**: Magic number, version, declared length bounds, chunk offsets.
- **Deep Model Inspection**: Mesh count, vertex count, triangle count, normals, UVs, dimensions.
- **iOS USDZ Conversion Engine**: glTF-to-USDZ conversion, USDZ container verification, multi-material USDZ conversion.
- **Storage & Security**: UUID validation, path traversal guards, combined cleanup.
- **HTTP REST API Integration**: Android GLB streaming, iOS USDZ streaming, assets descriptor, error responses.

---

## 6. Real-Device Testing Instructions

### iOS (iPhone & iPad)
1. Open the live HTTPS URL in **Safari**:
   ```
   https://gibraltar-auditor-posing-advisor.trycloudflare.com
   ```
   *(or your custom Render HTTPS domain)*
2. Tap **Upload 3D Model** and pick `paya-cube.glb` or `paya-chair.glb`.
3. The UI will show: `Uploading` ➔ `Validating GLB` ➔ `Preparing USDZ` ➔ `Validating USDZ` ➔ `Checking AR Compatibility` ➔ `Ready`.
4. Tap **Open Camera** to launch Apple AR Quick Look in your room!

### Android
1. Open the live HTTPS URL in **Chrome**:
   ```
   https://gibraltar-auditor-posing-advisor.trycloudflare.com
   ```
2. Tap **Upload 3D Model** and pick your `.glb` file.
3. Tap **Open Camera** to launch WebXR AR with surface hit testing.
