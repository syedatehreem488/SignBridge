"""SignBridge feature format - D6 v2 (see decisions.md).

web/src/lib/landmarks.js does EXACTLY the same maths. Change both files together,
then run:  python tools/parity_test.py

RAW frame (D4) = list of hands; each hand = 21 [x, y, z] points (MediaPipe order).
"""
import math

import numpy as np

NUM_POINTS = 21
PER_HAND = NUM_POINTS * 3 + 2   # 63 shape numbers + wrist x, wrist y = 65
PER_FRAME = PER_HAND * 2        # 2 hand slots = 130
SEQ_LEN = 30                    # frames per dynamic sign


def hand_features(hand):
    """One hand (21 points) -> 65 numbers."""
    pts = np.asarray(hand, dtype=np.float64)
    wrist = pts[0]                                   # point 0 = wrist
    rel = pts - wrist
    max_dist = np.sqrt((rel ** 2).sum(axis=1)).max()
    if max_dist < 1e-6:                              # avoid dividing by zero
        max_dist = 1.0
    shape = (rel / max_dist).reshape(-1)             # 63 shape numbers
    position = [wrist[0] - 0.5, wrist[1] - 0.5]      # where the hand is (image centre = 0, 0)
    return np.concatenate([shape, position])


def frame_features(frame):
    """One RAW frame (list of 0, 1 or 2 hands) -> 130 numbers."""
    # slot 0 = hand with the smaller wrist x (further left in the image), slot 1 = the other.
    # One hand always goes in slot 0. sorted() is stable, like JavaScript's Array.sort.
    hands = sorted(frame or [], key=lambda h: h[0][0])[:2]
    zeros = np.zeros(PER_HAND)
    slot0 = hand_features(hands[0]) if len(hands) > 0 else zeros
    slot1 = hand_features(hands[1]) if len(hands) > 1 else zeros
    return np.concatenate([slot0, slot1])


def pick_frames(frames, count=SEQ_LEN):
    """Pick `count` frames evenly: index i = floor(i*(n-1)/29 + 0.5)."""
    n = len(frames)
    if n == 0:
        return []
    return [frames[math.floor(i * (n - 1) / (count - 1) + 0.5)] for i in range(count)]


def dynamic_features(frames):
    """Dynamic sign: list of RAW frames -> array of shape (30, 130)."""
    return np.stack([frame_features(f) for f in pick_frames(frames)])


def static_features(frame):
    """Static sign: one RAW frame -> array of shape (130,)."""
    return frame_features(frame)


def has_hands(frame):
    return isinstance(frame, list) and len(frame) > 0