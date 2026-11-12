import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { X, Move } from 'lucide-react';
import { ModelMetadata } from '../lib/types';

interface WebXRViewerProps {
  modelUrl: string;
  metadata?: ModelMetadata;
  onClose: () => void;
  onError: (type: any, message: string) => void;
}

export const WebXRViewer: React.FC<WebXRViewerProps> = ({
  modelUrl,
  metadata: _metadata,
  onClose,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isSurfaceDetected, setIsSurfaceDetected] = useState(false);
  const [isPlaced, setIsPlaced] = useState(false);
  const [statusText, setStatusText] = useState('Move camera to find a flat surface');

  const sessionRef = useRef<any>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const hitTestSourceRef = useRef<any>(null);
  const placementGroupRef = useRef<THREE.Group | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  const modelLoadedRef = useRef<boolean>(false);

  // Touch tracking for rotation and scaling
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const currentScaleRef = useRef<number>(1);

  const cleanupSession = useCallback(() => {
    if (hitTestSourceRef.current) {
      try {
        hitTestSourceRef.current.cancel();
      } catch {}
      hitTestSourceRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.end();
      } catch {}
      sessionRef.current = null;
    }

    if (rendererRef.current) {
      rendererRef.current.setAnimationLoop(null);
      if (rendererRef.current.domElement && rendererRef.current.domElement.parentNode) {
        rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    if (sceneRef.current) {
      sceneRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
      sceneRef.current = null;
    }
  }, []);

  const handleExit = useCallback(() => {
    cleanupSession();
    onClose();
  }, [cleanupSession, onClose]);

  useEffect(() => {
    let isCancelled = false;

    async function initWebXR() {
      if (!navigator.xr) {
        onError('UNSUPPORTED_AR', 'WebXR is not supported on this browser.');
        return;
      }

      try {
        // Request WebXR immersive-ar session with DOM overlay and hit-test
        const sessionInit: any = {
          requiredFeatures: ['hit-test'],
          optionalFeatures: ['dom-overlay', 'light-estimation'],
        };

        if (overlayRef.current) {
          sessionInit.domOverlay = { root: overlayRef.current };
        }

        const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
        if (isCancelled) {
          session.end();
          return;
        }

        sessionRef.current = session;

        // Create Three.js Scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

        // Renderer
        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.xr.enabled = true;
        rendererRef.current = renderer;

        if (containerRef.current) {
          containerRef.current.appendChild(renderer.domElement);
        }

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(1, 4, 2);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 10;
        directionalLight.shadow.bias = -0.001;
        scene.add(directionalLight);

        // Reticle for surface hit testing
        const reticleGroup = new THREE.Mesh(
          new THREE.RingGeometry(0.12, 0.15, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0x2563eb, side: THREE.DoubleSide })
        );
        const centerDot = new THREE.Mesh(
          new THREE.CircleGeometry(0.02, 16).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0x2563eb, side: THREE.DoubleSide })
        );
        reticleGroup.add(centerDot);
        reticleGroup.matrixAutoUpdate = false;
        reticleGroup.visible = false;
        scene.add(reticleGroup);
        reticleRef.current = reticleGroup;

        // Placement parent group
        const placementGroup = new THREE.Group();
        placementGroupRef.current = placementGroup;

        // Shadow receiver plane under model
        const shadowPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2),
          new THREE.ShadowMaterial({ opacity: 0.35 })
        );
        shadowPlane.receiveShadow = true;
        shadowPlane.position.y = 0;
        placementGroup.add(shadowPlane);

        // Load 3D GLB model
        const loader = new GLTFLoader();
        loader.load(
          modelUrl,
          (gltf) => {
            if (isCancelled) return;
            const model = gltf.scene;

            // Enable shadows on all child meshes
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            // Compute bounding box to normalize model positioning & scale
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // Center model horizontally and align base exactly at y = 0
            model.position.x = -center.x;
            model.position.y = -box.min.y;
            model.position.z = -center.z;

            // Determine appropriate scale factor
            // If model is extremely large (> 1.5m) or tiny (< 0.05m), normalize to ~0.45m
            const maxDimension = Math.max(size.x, size.y, size.z);
            let normalizedScale = 1.0;

            if (maxDimension > 1.5) {
              normalizedScale = 0.5 / maxDimension;
            } else if (maxDimension < 0.05) {
              normalizedScale = 0.25 / maxDimension;
            }

            model.scale.set(normalizedScale, normalizedScale, normalizedScale);
            currentScaleRef.current = normalizedScale;

            placementGroup.add(model);
            modelLoadedRef.current = true;
          },
          undefined,
          (err) => {
            console.error('Failed to load GLTF model in WebXR:', err);
            onError('LOAD_FAILED', 'Unable to render 3D model in AR.');
          }
        );

        // Attach WebXR session to Three.js
        await renderer.xr.setSession(session);

        // Request reference spaces for hit test
        const viewerSpace = await session.requestReferenceSpace('viewer');
        const localSpace = await session.requestReferenceSpace('local');
        const hitTestSource =
          typeof (session as any).requestHitTestSource === 'function'
            ? await (session as any).requestHitTestSource({ space: viewerSpace })
            : null;
        hitTestSourceRef.current = hitTestSource;

        // Session End Handler
        session.addEventListener('end', () => {
          handleExit();
        });

        // Tap to place listener via WebXR select
        session.addEventListener('select', () => {
          if (reticleRef.current && reticleRef.current.visible && placementGroupRef.current) {
            // Place model at reticle position
            const position = new THREE.Vector3();
            position.setFromMatrixPosition(reticleRef.current.matrix);

            placementGroupRef.current.position.copy(position);

            if (!scene.children.includes(placementGroupRef.current)) {
              scene.add(placementGroupRef.current);
            }

            setIsPlaced(true);
            setStatusText('Placed! Drag to rotate • Pinch to scale');
          }
        });

        // Animation / Render loop
        renderer.setAnimationLoop((_timestamp, frame) => {
          if (!frame) return;

          if (hitTestSourceRef.current && reticleRef.current) {
            const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);

            if (hitTestResults.length > 0) {
              const hit = hitTestResults[0];
              const pose = hit.getPose(localSpace);

              if (pose) {
                reticleRef.current.visible = true;
                reticleRef.current.matrix.fromArray(pose.transform.matrix);
                setIsSurfaceDetected(true);
                if (!isPlaced) {
                  setStatusText('Surface detected! Tap screen to place.');
                }
              }
            } else {
              reticleRef.current.visible = false;
              setIsSurfaceDetected(false);
              if (!isPlaced) {
                setStatusText('Move camera to find a flat surface...');
              }
            }
          }

          renderer.render(scene, camera);
        });
      } catch (err: any) {
        console.error('WebXR session error:', err);
        if (err.name === 'NotAllowedError') {
          onError(
            'CAMERA_PERMISSION_DENIED',
            'Camera permission is required to start the AR experience. Please enable camera access in your browser settings.'
          );
        } else {
          onError(
            'SESSION_INIT_FAILED',
            'AR session initialization failed. Trying native fallback...'
          );
        }
      }
    }

    initWebXR();

    return () => {
      isCancelled = true;
      cleanupSession();
    };
  }, [modelUrl, onError, handleExit, cleanupSession, isPlaced]);

  // Touch handlers for rotating and scaling model
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!placementGroupRef.current || !isPlaced) return;

    if (e.touches.length === 1 && touchStartXRef.current !== null) {
      const deltaX = e.touches[0].clientX - touchStartXRef.current;
      placementGroupRef.current.rotation.y += deltaX * 0.01;
      touchStartXRef.current = e.touches[0].clientX;
    } else if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const factor = newDist / touchStartDistRef.current;

      const newScale = Math.max(0.05, Math.min(5.0, currentScaleRef.current * factor));
      placementGroupRef.current.scale.set(newScale, newScale, newScale);
    }
  };

  const handleTouchEnd = () => {
    touchStartXRef.current = null;
    touchStartDistRef.current = null;
    if (placementGroupRef.current) {
      currentScaleRef.current = placementGroupRef.current.scale.x;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-transparent">
      {/* 3D WebXR Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* DOM Overlay for WebXR User Controls */}
      <div
        ref={overlayRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute inset-0 w-full h-full flex flex-col justify-between p-4 pointer-events-auto select-none"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between w-full pt-safe">
          {/* Status Badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white/90 backdrop-blur-md rounded-full shadow-subtle border border-border">
            <span
              className={`w-2 h-2 rounded-full ${
                isSurfaceDetected ? 'bg-green-500 animate-pulse' : 'bg-primary'
              }`}
            />
            <span className="text-xs font-medium text-content">{statusText}</span>
          </div>

          {/* Minimal Exit Button */}
          <button
            onClick={handleExit}
            aria-label="Exit AR"
            className="flex items-center justify-center w-10 h-10 bg-white/90 backdrop-blur-md text-content rounded-full shadow-subtle border border-border active:scale-95 transition-transform"
          >
            <X className="w-5 h-5 text-content" />
          </button>
        </div>

        {/* Bottom Helper Hint */}
        <div className="flex flex-col items-center justify-center pb-safe mb-4">
          {!isPlaced ? (
            <div className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl shadow-subtle border border-border text-center">
              <p className="text-xs text-content-secondary font-medium">
                {isSurfaceDetected
                  ? 'Tap anywhere on the screen to place 3D model'
                  : 'Point camera towards the floor or a tabletop'}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl shadow-subtle border border-border">
              <Move className="w-4 h-4 text-primary" />
              <span className="text-xs text-content-secondary font-medium">
                Tap surface to reposition • Swipe to rotate
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
