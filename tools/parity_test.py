"""Checks that ml/landmarks.py and web/src/lib/landmarks.js give IDENTICAL features (D6 v2).

Run from the project folder:   python tools/parity_test.py
Needs Node.js installed (the same one you use for the web app).
"""
import json
import random
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ml"))
from landmarks import static_features, dynamic_features, PER_FRAME, SEQ_LEN  # noqa: E402

TOLERANCE = 1e-9


def random_hand(rng, wrist_x=None):
    hand = [[round(rng.random(), 4), round(rng.random(), 4), round(rng.uniform(-0.1, 0.1), 4)] for _ in range(21)]
    if wrist_x is not None:
        hand[0][0] = wrist_x
    return hand


def make_cases(rng):
    cases = []
    for k in range(300):
        n_frames = rng.choice([1, 2, 29, 30, 31, 45, 60]) if k > 5 else [1, 30, 31, 2, 60, 17][k]
        frames = []
        for _ in range(n_frames):
            n_hands = rng.choices([0, 1, 2, 3], weights=[1, 4, 4, 1])[0]
            if rng.random() < 0.1 and n_hands >= 2:      # two hands with the same wrist x (tie)
                frames.append([random_hand(rng, 0.5), random_hand(rng, 0.5)])
            else:
                frames.append([random_hand(rng) for _ in range(n_hands)])
        cases.append({"frames": frames})
    # edge case: all 21 points identical (max distance 0)
    cases.append({"frames": [[[[0.3, 0.3, 0.0]] * 21]]})
    return cases


def main():
    rng = random.Random(0)
    cases = make_cases(rng)
    with tempfile.TemporaryDirectory() as tmp:
        inp, out = Path(tmp) / "in.json", Path(tmp) / "out.json"
        inp.write_text(json.dumps(cases))
        try:
            subprocess.run(["node", str(ROOT / "tools" / "parity_js.mjs"), str(inp), str(out)], check=True)
        except FileNotFoundError:
            sys.exit("Node.js not found. Install it (or open a terminal where `node -v` works) and try again.")
        js = json.loads(out.read_text())

    worst = 0.0
    for i, (case, j) in enumerate(zip(cases, js)):
        py_static = static_features(case["frames"][0])
        py_dynamic = dynamic_features(case["frames"])
        assert len(j["static"]) == PER_FRAME, f"case {i}: JS static length {len(j['static'])}"
        assert py_dynamic.shape == (SEQ_LEN, PER_FRAME), f"case {i}: Python dynamic shape {py_dynamic.shape}"
        assert len(j["dynamic"]) == SEQ_LEN, f"case {i}: JS dynamic length {len(j['dynamic'])}"
        worst = max(worst, abs(py_static - j["static"]).max())
        for r in range(SEQ_LEN):
            worst = max(worst, abs(py_dynamic[r] - j["dynamic"][r]).max())

    print(f"Checked {len(cases)} test cases. Largest difference between Python and JS: {worst:.2e}")
    if worst > TOLERANCE:
        sys.exit("FAIL - the two feature files do not match. Did you change only one of them?")
    print("PASS")


if __name__ == "__main__":
    main()