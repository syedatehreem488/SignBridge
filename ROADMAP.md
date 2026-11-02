# SignBridge — Roadmap

Work through the milestones in order. Each one has a **"Done when"** test; don't move on until it passes.

## M1 — Setup
- [ ] Run the web app (`web/`), allow the camera and see the hand skeleton on your hands.
- [ ] Create the Supabase project; run `supabase/schema.sql` then `supabase/seed.sql`.
- [ ] Both team members sign up in the app; make one account admin (see README).
- [ ] Python venv for `ml/` and `api/` installed.

**Done when:** the app shows "Supabase connected", you can log in, and the Reverse Mode page lists the starter signs.

## M2 — Feature format (D6 v2)
- [ ] Read `ml/landmarks.py` and `web/src/lib/landmarks.js` and be able to explain every line.
- [ ] Run `python tools/parity_test.py`.

**Done when:** the parity test prints `PASS`.

## M3 — Data collection, round 1 (10 signs)
- [ ] Learn the 10 starter signs from a proper PSL source. Check each sign's `sign_type` (static / dynamic) in the `signs` table, and add 2–3 alphabet letters (static) if you want the static model too.
- [ ] Record **at least 20 samples per sign per person**, from **at least 3 people** (S01–S03). 5 people (S01–S05) is better.
- [ ] Vary lighting, background and distance. Fill in the lighting and background fields honestly.

**Done when:** `python ml/export_data.py` shows every starter sign with ≥ 60 samples from ≥ 3 signers.

## M4 — First models
- [ ] `python ml/train_dynamic.py` (LSTM) and `python ml/train_static.py` (Random Forest vs MLP).
- [ ] Read the reports in `ml/reports/`: accuracy, precision / recall / F1, confusion matrix.

**Done when:** a test-signer accuracy is reported for both models, and you can explain the confusion matrix (which signs get mixed up, and why).

## M5 — Live translation
- [ ] Start the API (`uvicorn main:app --reload` in `api/`) and open Live Translate.
- [ ] Tune the threshold (D8) if words appear too easily or not at all.

**Done when:** a person whose samples weren't used for training can sign 5 of the 10 words and most appear correctly.

## M6 — Reverse Mode, History, speech
- [ ] Admin uploads a reference video or image for each sign.
- [ ] Saving a translation shows it on the History page.
- [ ] Urdu speech works: browser voice, or the gTTS fallback through the API.

**Done when:** typing "Assalam-o-Alaikum, shukriya" shows both sign videos, and a saved translation appears in History.

## M7 — Grow the vocabulary
- [ ] Add signs up to 30–50 words plus the alphabet letters you choose (give each a `model_label`).
- [ ] Record with more signers; retrain.

**Done when:** the test-signer accuracy is still acceptable with the full vocabulary (write down the number).

## M8 — Evaluation, report and viva
- [ ] Final run with the signer split; save the reports and confusion matrices.
- [ ] Write up: problem, method (D6 features, models), results, limitations (isolated signs only, small dataset, few signers).
- [ ] Practise the demo. Have a backup video of it working, in case the lab internet fails.

**Done when:** you can explain every decision in `decisions.md` without notes.
