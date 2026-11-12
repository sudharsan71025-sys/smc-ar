# PAYA 2 VR – Universal Web-Based Augmented Reality Platform

**PAYA 2 VR** is a mobile-first, browser-based Augmented Reality (AR) platform built from the ground up with an independent architecture. It provides an intuitive, frictionless 3D-to-real-world workflow: upload a 3D model, automatically validate and detect AR compatibility, and place it directly into the physical environment using the mobile device camera.

---

## 1. Core Workflow & State Machine

```
   ┌─────────────────────────────────────────────────────────────┐
   │                          INITIAL                            │
   │  "PAYA 2 VR" Brand + "Upload 3D Model" Primary Button       │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ User selects .glb file
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │             UPLOADING ➔ PROCESSING ➔ VALIDATING             │
   │  Binary Header Validation ➔ glTF-Transform Mesh Inspection  │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ Successful Validation
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                   CHECKING_COMPATIBILITY                    │
   │  WebXR immersive-ar Check ➔ Scene Viewer Fallback Check    │
   └──────────────┬───────────────────────────────┬──────────────┘
                  │ Supported                     │ Incompatible
                  ▼                               ▼
   ┌─────────────────────────────┐ ┌─────────────────────────────┐
   │            READY            │ │            ERROR            │
   │   "Open Camera" Replaces    │ │  Case-specific clear error  │
   │        Upload Button        │ │   with "Try Again" action   │
   └──────────────┬──────────────┘ └─────────────────────────────┘
                  │ User clicks "Open Camera"
                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                     AR CAMERA LAUNCH                        │
   │  - Primary: WebXR immersive-ar (Three.js + Hit-Test)        │
   │  - Fallback: Google Scene Viewer Native Intent (Android)    │
   │  - Surface detection, reticle indicator, tap-to-place       │
   └─────────────────────────────────────────────────────────────┘
```

---

## 2. Design System & UI Restrictions

The UI follows a strict, distraction-free minimalist aesthetic:

- **Color Palette**:
  - Primary: `#2563EB` (Professional Blue)
  - Primary Hover: `#1D4ED8`
  - Background: `#FFFFFF` (Clean White)
  - Secondary Background: `#F5F8FF`
  - Text Primary: `#111827`
  - Text Secondary: `#64748B`
  - Border: `#E2E8F0`
- **Strict UI Rules**:
  - Exactly **two** primary buttons exist across the lifecycle:
    1. `Upload 3D Model` (Initial state)
    2. `Open Camera` (Appears ONLY after successful verification and compatibility detection, replacing the upload button)
  - Never display both buttons simultaneously.
  - No sidebars, navigation bars, model galleries, dashboards, or extraneous action buttons.

---

## 3. AR Compatibility & Execution Paths

The platform automatically evaluates device and browser capabilities:

### Path A: WebXR Immersive-AR (Primary)
- Verifies `window.isSecureContext` (HTTPS or localhost).
- Checks `navigator.xr.isSessionSupported('immersive-ar')`.
- Requests `immersive-ar` session with `hit-test` and `dom-overlay`.
- Provides a Three.js surface-detection reticle, touch tap-to-place, rotation gestures, pinch-to-scale, and soft contact shadows.

### Path B: Google Scene Viewer (Android Native Fallback)
- If WebXR is unsupported or fails to initialize, the platform checks for Android with Chrome/compatible browser.
- Launches Google Scene Viewer via the official intent:
  `intent://arvr.google.com/scene-viewer/1.0?file=<ENCODED_HTTPS_URL>&mode=ar_only&resizable=true#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=...;end;`
- Allows native ARCore handling of environmental tracking and surface placement.

### Path C: Incompatible Device
- If neither WebXR nor Scene Viewer is supported, displays:
  *"AR is not supported on your current device or browser. Your device cannot use either of the supported AR modes. Please try a compatible Android device and browser."*

---

## 4. Failure Handling Specifications

| Condition | User-Facing Error Message |
| :--- | :--- |
| **Invalid GLB Container** | *"Invalid 3D model. Please upload a valid GLB file."* |
| **Corrupted Model / Broken Mesh** | *"Unable to process this 3D model. Please try another file."* |
| **AR Unsupported** | *"AR is not supported on your current device or browser. Your device cannot use either of the supported AR modes. Please try a compatible Android device and browser."* |
| **Camera Permission Denied** | *"Camera permission is required to start the AR experience. Please enable camera access in your browser settings."* |
| **Missing HTTPS Context** | *"Secure HTTPS access is required for the AR camera experience."* |
| **WebXR Init Failure (Android)** | Automatically invokes Google Scene Viewer fallback. |

---

## 5. Getting Started

### Prerequisites
- Node.js >= 18.0.0 (Tested on Node v24)
- npm >= 9.0.0

### Installation
Clone the repository and install dependencies:
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
cd ..
```

### Running Tests
Execute the end-to-end automated test suite:
```bash
npm test
```
The test suite covers:
- Binary header validation (magic bytes, version, length, chunk offsets).
- Deep glTF asset inspection (mesh count, vertex count, triangle count, normals, UVs, dimensions).
- Storage and path traversal security.
- HTTP REST API endpoints (`/api/health`, `/api/upload`, `/api/models/:id/model.glb`).

---

## 6. Development & Production Execution

### Running Development Mode
Run both frontend and backend concurrently:
```bash
npm run dev
```
- Client runs at: `http://localhost:3000` (proxies `/api` to port 5000)
- Backend runs at: `http://localhost:5000` (HTTP) and `https://localhost:5443` (HTTPS)

### Building for Production
```bash
npm run build
```
This builds both TypeScript server (`server/dist`) and Vite production client (`client/dist`).

### Running Production Server
```bash
npm start
```
The server serves both the static production frontend and the upload/model API endpoints.

---

## 7. Real-Device Testing on Android

WebXR requires a **Secure Context** (`HTTPS` or `localhost`). When testing on an Android phone over local Wi-Fi:

### Option 1: Direct HTTPS (Built-in)
PAYA 2 VR generates a local self-signed SSL certificate automatically on startup:
1. Connect your Android phone to the same Wi-Fi network as your computer.
2. Start the server (`npm start`).
3. Note the Network HTTPS URL displayed in the console:
   ```
   > Network: https://192.168.x.x:5443
   ```
4. Open Chrome on Android, navigate to `https://192.168.x.x:5443`, tap *Advanced* -> *Proceed to site (unsafe)*.
5. Upload a model and tap **Open Camera** to launch WebXR!

### Option 2: Chrome Remote USB Debugging (Recommended)
1. Connect your Android phone via USB and enable USB Debugging.
2. In desktop Chrome, open `chrome://inspect/#devices`.
3. Configure Port Forwarding:
   - Port `5000` -> `localhost:5000`
4. On your mobile Chrome browser, navigate to `http://localhost:5000`.
   *(Because Chrome treats `localhost` as a Secure Context, WebXR is enabled without SSL warnings!)*

### Option 3: Public Tunnel (e.g. Cloudflared / Ngrok)
For testing Google Scene Viewer across external networks:
```bash
npx localtunnel --port 5000
# or
cloudflared tunnel --url http://localhost:5000
```

---

## 8. Sample Models Included

The repository includes pre-generated, verified 3D assets in `sample-models/`:
- `sample-models/paya-cube.glb`: Standard 30cm tabletop blue cube with realistic normals, UV coordinates, and PBR materials.
- `sample-models/paya-chair.glb`: Realistic multi-material model (wood seat/back, metal frame) with 6 primitives and 144 vertices.

To generate new sample assets at any time:
```bash
npm --prefix server run build
npx --prefix server tsx server/src/create-sample.ts
npx --prefix server tsx server/src/create-chair.ts
```

