import { useEffect, useRef, useState } from 'react';
import { getHandTracker, HAND_CONNECTIONS } from '../lib/handTracker';
import { resultToFrame } from '../lib/landmarks';

/**
 * Webcam + live hand tracking.
 * Calls onFrame(frame, time) for every processed video frame. frame = RAW list of hands (D4),
 * time = performance.now() in milliseconds.
 * The video and overlay are mirrored so it feels like a mirror to the signer.
 */
export default function Camera({ onFrame, children }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  const [status, setStatus] = useState('Loading hand-tracking model…');
  const [fps, setFps] = useState(0);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    let stream;
    let rafId;
    let stopped = false;
    let lastVideoTime = -1;
    let frames = 0;
    let fpsTimer = performance.now();

    async function start() {
      let tracker;
      try {
        tracker = await getHandTracker();
      } catch (e) {
        setStatus('Could not load the hand-tracking model. Check your internet connection and refresh.');
        console.error(e);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
      } catch (e) {
        setStatus('Camera access was blocked or no camera was found. Allow camera access in your browser and refresh.');
        console.error(e);
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop()); // page was left while the camera was starting
        return;
      }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setStatus('');

      const loop = () => {
        if (stopped) return;
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const now = performance.now();
          const result = tracker.detectForVideo(video, now);
          draw(result);
          onFrameRef.current?.(resultToFrame(result), now);
          frames++;
          if (now - fpsTimer > 1000) {
            setFps(Math.round((frames * 1000) / (now - fpsTimer)));
            frames = 0;
            fpsTimer = now;
          }
        }
        rafId = requestAnimationFrame(loop);
      };
      loop();
    }

    function draw(result) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      (result.landmarks || []).forEach((hand, i) => {
        const color = i === 0 ? '#22c55e' : '#3b82f6';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        for (const { start, end } of HAND_CONNECTIONS) {
          const a = hand[start];
          const b = hand[end];
          ctx.beginPath();
          ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
          ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        for (const p of hand) {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="camera">
      <video ref={videoRef} playsInline muted className="mirror" />
      <canvas ref={canvasRef} className="mirror overlay" />
      {status && <div className="camera-status">{status}</div>}
      {!status && <div className="fps">{fps} fps</div>}
      {children}
    </div>
  );
}