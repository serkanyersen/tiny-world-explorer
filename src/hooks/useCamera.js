import { useState, useEffect, useRef, useCallback } from 'react';

export const useCamera = () => {
  const [stream, setStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Enumerate devices
  const getDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);

      // If we don't have a selected device yet, pick the first one
      if (!selectedDeviceId && videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  }, [selectedDeviceId]);

  // Initial device scan
  useEffect(() => {
    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, [getDevices]);

  // Update device list labels once we have permission (stream active)
  useEffect(() => {
    if (stream && !devices.some(d => d.label)) {
        getDevices();
    }
  }, [stream, devices, getDevices]);

  /* Debug & Recovery */
  const [compatibilityMode, setCompatibilityMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  // Monitor stream health
  useEffect(() => {
    if (!stream) {
        setDebugInfo(null);
        return;
    }

    const interval = setInterval(() => {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            const settings = videoTrack.getSettings();
            setDebugInfo({
                readyState: videoTrack.readyState,
                muted: videoTrack.muted,
                enabled: videoTrack.enabled,
                width: settings.width,
                height: settings.height,
                frameRate: settings.frameRate,
                label: videoTrack.label
            });
        }
    }, 1000);

    return () => clearInterval(interval);
  }, [stream]);

  // Stream Management
  useEffect(() => {
    console.log("Stream Effect Triggered. Device:", selectedDeviceId, "Compat:", compatibilityMode);
    if (!selectedDeviceId) return;

    let mounted = true;
    let newStream = null;

    const startStream = async () => {
      try {
        console.log(`Requesting stream for ${selectedDeviceId}...`);

        const constraints = compatibilityMode
            ? {
                deviceId: { exact: selectedDeviceId },
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 30 }
              }
            : {
                deviceId: { exact: selectedDeviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
              };

        try {
            newStream = await navigator.mediaDevices.getUserMedia({ video: constraints });
        } catch (err) {
            console.warn("Primary constraints failed", err);
            // hard last resort: minimal constraints
            newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selectedDeviceId } } });
        }

        if (mounted) {
            console.log("Stream acquired:", newStream.id);
            // Stop OLD stream only after acquiring new one?
            // NOTE: Some cameras fail if you try to open a second stream before closing the first.
            // But if the user says "disconnect causes weirdness", maybe the GAP is the problem.
            // However, "Device already in use" is a common error on Windows/Exclusive access.
            // Let's stick to: We have new stream -> Set it -> Cleanup old via state change.
            // BUT: We need to manually stop the previous stream ref if we are replacing it.

            setStream(prevStream => {
                if (prevStream) {
                    prevStream.getTracks().forEach(track => track.stop());
                }
                return newStream;
            });
            setError(null);
        } else {
            // Unmounted during request
            newStream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.error("Error starting stream:", err);
        if (mounted) {
            setError(`Failed to connect: ${err.message}`);
            setStream(null);
        }
      }
    };

    // If we already have a stream for this device and we are just rerendering, SKIP?
    // No, selectedDeviceId changed, so we must switch.
    // We do NOT stop the stream immediately here. We wait until the new one is ready
    // OR we stop it if we think exclusive access is required?
    // User complaint: "is your camera logic disconnect in anyway during initialization?"
    // The previous code did: getUserMedia (perm check) -> Stop -> getUserMedia (actual).
    // Now we removed the perm check. So it should be: getUserMedia (actual). One single connection.

    startStream();

    return () => {
        mounted = false;
        // NOTE: We do NOT stop the stream here on cleanup, because that causes "blinking" on re-renders.
        // We let the setStream callback handle the cleanup of the *replaced* stream.
        // OR we trust the "newStream" logic to close the old one.
    };
  }, [selectedDeviceId, compatibilityMode]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [stream]);

  const refreshStream = useCallback(() => {
      // Force a re-run of the effect by briefly clearing selection??
      // Or better, just move the startStream logic to a function we can call.
      // For simplicity, let's just trigger a re-selection logic.
      const current = selectedDeviceId;
      setSelectedDeviceId('');
      setTimeout(() => setSelectedDeviceId(current), 100);
  }, [selectedDeviceId]);

  const takePhoto = useCallback((videoElement) => {
    if (!videoElement) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');

    // Check if we need to mirror (for front cameras usually, but let's keep it raw for microscope)
    // For microscopes, usually direct feed is best.
    ctx.drawImage(videoElement, 0, 0);

    return canvas.toDataURL('image/png');
  }, []);

  const startRecording = useCallback(() => {
    if (!stream) return;
    recordedChunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start();
    setIsRecording(true);
    mediaRecorderRef.current = mediaRecorder;
  }, [stream]);

  const stopRecording = useCallback(async () => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) return resolve(null);

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        setIsRecording(false);
        resolve(window.URL.createObjectURL(blob));
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  return {
    stream,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    error,
    takePhoto,
    startRecording,
    stopRecording,
    isRecording,
    refreshStream: () => setCompatibilityMode(prev => !prev), // Temporary hack: Refresh now toggles compat mode for testing
    compatibilityMode,
    setCompatibilityMode,
    debugInfo
  };
};
