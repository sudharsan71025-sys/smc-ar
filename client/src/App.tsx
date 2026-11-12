import { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { UploadButton } from './components/UploadButton';
import { StatusIndicator } from './components/StatusIndicator';
import { OpenCameraButton } from './components/OpenCameraButton';
import { ErrorCard } from './components/ErrorCard';
import { WebXRViewer } from './components/WebXRViewer';
import { preValidateGlbFile } from './lib/glbValidator';
import { detectARCompatibility } from './lib/arCompatibility';
import { launchGoogleSceneViewer } from './lib/sceneViewer';
import { AppState, ARMode, ModelMetadata } from './lib/types';

export default function App() {
  const [state, setState] = useState<AppState>('INITIAL');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [modelUrl, setModelUrl] = useState<string>('');
  const [metadata, setMetadata] = useState<ModelMetadata | undefined>();
  const [arMode, setArMode] = useState<ARMode>('none');

  // Handle file selection and validation pipeline
  const handleFileSelect = async (file: File) => {
    // Reset previous errors
    setErrorMessage('');

    // Step 2 – Client-side fast binary validation
    const preCheck = await preValidateGlbFile(file);
    if (!preCheck.valid) {
      setErrorMessage(preCheck.error || 'Invalid 3D model. Please upload a valid GLB file.');
      setState('ERROR');
      return;
    }

    try {
      // Step 3 – Uploading
      setState('UPLOADING');
      setStatusMessage('Uploading');

      const formData = new FormData();
      formData.append('model', file);

      const uploadPromise = fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      // Show processing status
      await new Promise((r) => setTimeout(r, 400));
      setState('PROCESSING');
      setStatusMessage('Processing Model');

      const response = await uploadPromise;
      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.errorType === 'INVALID_GLB') {
          setErrorMessage('Invalid 3D model. Please upload a valid GLB file.');
        } else {
          setErrorMessage('Unable to process this 3D model. Please try another file.');
        }
        setState('ERROR');
        return;
      }

      // Validating geometry & materials
      setState('VALIDATING');
      setStatusMessage('Validating Geometry');
      await new Promise((r) => setTimeout(r, 350));

      setStatusMessage('Checking Materials');
      await new Promise((r) => setTimeout(r, 350));

      // Step 4 – Automatic AR Compatibility Detection
      setState('CHECKING_COMPATIBILITY');
      setStatusMessage('Checking AR Compatibility');
      await new Promise((r) => setTimeout(r, 400));

      const compat = await detectARCompatibility();

      if (!compat.supported) {
        setErrorMessage(
          compat.reason ||
            'AR is not supported on your current device or browser. Your device cannot use either of the supported AR modes. Please try a compatible Android device and browser.'
        );
        setState('ERROR');
        return;
      }

      // Ensure modelUrl protocol matches secure page context
      let finalModelUrl = data.modelUrl;
      if (window.location.protocol === 'https:' && finalModelUrl.startsWith('http://')) {
        finalModelUrl = finalModelUrl.replace('http://', 'https://');
      }

      setModelUrl(finalModelUrl);
      setMetadata(data.metadata);
      setArMode(compat.mode);
      setState('READY');
    } catch (err) {
      console.error('Upload / validation failed:', err);
      setErrorMessage('Unable to process this 3D model. Please try another file.');
      setState('ERROR');
    }
  };

  // Handle Open Camera click
  const handleOpenCamera = async () => {
    setState('AR_INITIALIZING');
    setStatusMessage('Starting AR Experience');

    if (arMode === 'webxr') {
      setState('AR_ACTIVE');
    } else if (arMode === 'scene-viewer') {
      try {
        await launchGoogleSceneViewer(modelUrl);
        // Keep in ready state for Scene Viewer external launch
        setState('READY');
      } catch (err) {
        console.error('Scene Viewer launch failed:', err);
        setErrorMessage(
          'AR is not supported on your current device or browser. Your device cannot use either of the supported AR modes. Please try a compatible Android device and browser.'
        );
        setState('ERROR');
      }
    } else {
      setErrorMessage(
        'AR is not supported on your current device or browser. Your device cannot use either of the supported AR modes. Please try a compatible Android device and browser.'
      );
      setState('ERROR');
    }
  };

  // Reset to initial state
  const handleRetry = useCallback(() => {
    setErrorMessage('');
    setModelUrl('');
    setMetadata(undefined);
    setArMode('none');
    setState('INITIAL');
  }, []);

  // WebXR session error handler
  const handleWebXRError = (errorType: string, message: string) => {
    console.warn(`WebXR error [${errorType}]: ${message}`);

    // If WebXR fails on Android, attempt Scene Viewer fallback
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid && errorType !== 'CAMERA_PERMISSION_DENIED') {
      console.log('Attempting Scene Viewer fallback...');
      setArMode('scene-viewer');
      launchGoogleSceneViewer(modelUrl)
        .then(() => {
          setState('READY');
        })
        .catch(() => {
          setErrorMessage(
            'AR is not supported on your current device or browser. Your device cannot use either of the supported AR modes. Please try a compatible Android device and browser.'
          );
          setState('ERROR');
        });
      return;
    }

    setErrorMessage(message);
    setState('ERROR');
  };

  // WebXR session closed
  const handleWebXRClose = () => {
    setState('READY');
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Brand Header */}
        <Header />

        {/* State 1: INITIAL */}
        {state === 'INITIAL' && (
          <UploadButton onFileSelect={handleFileSelect} />
        )}

        {/* State 2, 3, 4, 5, 7: Loading & Processing Statuses */}
        {(state === 'UPLOADING' ||
          state === 'PROCESSING' ||
          state === 'VALIDATING' ||
          state === 'CHECKING_COMPATIBILITY' ||
          state === 'AR_INITIALIZING') && (
          <StatusIndicator status={statusMessage} />
        )}

        {/* State 6: READY - Open Camera button replaces Upload button */}
        {state === 'READY' && (
          <OpenCameraButton onClick={handleOpenCamera} />
        )}

        {/* State 8: AR_ACTIVE - WebXR Experience */}
        {state === 'AR_ACTIVE' && (
          <WebXRViewer
            modelUrl={modelUrl}
            metadata={metadata}
            onClose={handleWebXRClose}
            onError={handleWebXRError}
          />
        )}

        {/* State 9: ERROR */}
        {state === 'ERROR' && (
          <ErrorCard message={errorMessage} onRetry={handleRetry} />
        )}
      </div>
    </main>
  );
}
