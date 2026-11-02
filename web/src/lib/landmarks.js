// SignBridge feature format — D6 v2 (see decisions.md).
// ml/landmarks.py does EXACTLY the same maths. Change both files together,
// then run:  python tools/parity_test.py

export const NUM_POINTS = 21;                 // MediaPipe gives 21 points per hand
export const PER_HAND = NUM_POINTS * 3 + 2;   // 63 shape numbers + wrist x, wrist y = 65
export const PER_FRAME = PER_HAND * 2;        // 2 hand slots = 130
export const SEQ_LEN = 30;                    // frames per dynamic sign

/**
 * MediaPipe result -> RAW frame (D4): a list of hands, each hand = 21 [x, y, z] points.
 * Hands stay in MediaPipe's order; slots are decided later by frameFeatures().
 */
export function resultToFrame(result) {
  if (!result?.landmarks) return [];
  return result.landmarks.map((hand) => hand.map((p) => [round4(p.x), round4(p.y), round4(p.z)]));
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

/** One hand (21 points) -> 65 numbers. */
export function handFeatures(hand) {
  const [wx, wy, wz] = hand[0];                            // point 0 = wrist
  const rel = hand.map(([x, y, z]) => [x - wx, y - wy, z - wz]);
  let maxDist = 0;
  for (const [x, y, z] of rel) maxDist = Math.max(maxDist, Math.sqrt(x * x + y * y + z * z));
  if (maxDist < 1e-6) maxDist = 1;                         // avoid dividing by zero
  const out = [];
  for (const [x, y, z] of rel) out.push(x / maxDist, y / maxDist, z / maxDist); // 63 shape numbers
  out.push(wx - 0.5, wy - 0.5);                            // where the hand is (image centre = 0, 0)
  return out;
}

/** One RAW frame (list of 0, 1 or 2 hands) -> 130 numbers. */
export function frameFeatures(frame) {
  // slot 0 = hand with the smaller wrist x (further left in the image), slot 1 = the other.
  // One hand always goes in slot 0. Array.sort is stable, like Python's sorted().
  const hands = [...(frame || [])].sort((a, b) => a[0][0] - b[0][0]).slice(0, 2);
  const zeros = new Array(PER_HAND).fill(0);
  const slot0 = hands[0] ? handFeatures(hands[0]) : zeros;
  const slot1 = hands[1] ? handFeatures(hands[1]) : zeros;
  return [...slot0, ...slot1];
}

/** Pick SEQ_LEN frames evenly: index i = floor(i*(n-1)/29 + 0.5). */
export function pickFrames(frames, count = SEQ_LEN) {
  const n = frames.length;
  if (n === 0) return [];
  const out = [];
  for (let i = 0; i < count; i++) out.push(frames[Math.floor((i * (n - 1)) / (count - 1) + 0.5)]);
  return out;
}

/** Dynamic sign: list of RAW frames -> 30 x 130. */
export function dynamicFeatures(frames) {
  return pickFrames(frames).map(frameFeatures);
}

/** Static sign: one RAW frame -> 130. */
export function staticFeatures(frame) {
  return frameFeatures(frame);
}

export function hasHands(frame) {
  return Array.isArray(frame) && frame.length > 0;
}