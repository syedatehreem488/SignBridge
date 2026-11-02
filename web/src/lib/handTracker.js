import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// The hand model (~8 MB). For offline demos, download it once into
// web/public/mediapipe/hand_landmarker.task and set VITE_HAND_MODEL_URL=/mediapipe/hand_landmarker.task
const MODEL_URL =
  import.meta.env.VITE_HAND_MODEL_URL ||
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let trackerPromise = null;

/** Returns a single shared HandLandmarker (created once, reused by every page). */
export function getHandTracker() {
  if (!trackerPromise) {
    trackerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      try {
        return await HandLandmarker.createFromOptions(vision, options('GPU'));
      } catch {
        // Some lab PCs have no usable GPU in the browser: fall back to CPU.
        return await HandLandmarker.createFromOptions(vision, options('CPU'));
      }
    })();
    trackerPromise.catch(() => {
      trackerPromise = null; // allow a retry after a failure
    });
  }
  return trackerPromise;
}

export const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;