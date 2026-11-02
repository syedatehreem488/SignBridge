# SignBridge — Decisions

These are the project's fixed decisions. **Don't change one without discussing it first**, and record every change here with the date.

| # | Decision | Why |
|---|---|---|
| D1 | **Scope:** isolated signs only (one sign at a time): the PSL alphabet plus 30–50 common words. Start with ~10 signs. "Sentences" = recognized words joined together. No continuous signing, no PSL grammar. | Achievable in one semester and easy to evaluate. |
| D2 | **Frontend:** React.js (Vite). Pages: Live Translate, Reverse Mode, Record Samples, History. | Team knows JavaScript; Vite is simple and fast. |
| D3 | **Hand tracking:** MediaPipe `HandLandmarker` (`@mediapipe/tasks-vision`) in the browser, up to 2 hands, 21 points (x, y, z) each. **Video never leaves the user's computer.** | Free, fast, works on normal laptops, protects privacy. |
| D4 | **Raw data format:** each sample stores RAW points as `[frame][hand][21][x,y,z]`, hands in MediaPipe's order. Features are computed later. | Lets us improve the features without re-recording data. |
| D5 | **Frames are never flipped.** The video is mirrored on screen with CSS only. | Recording and translation see identical data. |
| D6 | **Feature format v2** (2026-10-23: added wrist position) — identical in `ml/landmarks.py` and `web/src/lib/landmarks.js`:<br>• each hand: subtract the wrist point (point 0), divide by the largest distance from the wrist → 63 numbers; then add `(wrist x − 0.5, wrist y − 0.5)` → **65 per hand**<br>• each frame: 2 hand slots → **130 numbers**; slot 0 = hand with the smaller wrist x (further left in the image), slot 1 = the other; missing hand = 65 zeros; one hand → slot 0<br>• static sign = 1 frame (130); dynamic sign = 30 frames picked evenly (30 × 130), index `i` = `floor(i*(n-1)/29 + 0.5)`<br>• `tools/parity_test.py` checks that Python and JS give identical numbers | Shape numbers ignore hand size and distance from the camera; the 2 wrist numbers keep *where* the sign is made (e.g. chin vs chest). |
| D7 | **Models:** Random Forest vs MLP (scikit-learn) compared on **static** signs; **LSTM** (TensorFlow/Keras) for **dynamic** (movement) signs. | Classic ML vs neural network comparison for the report; LSTM handles sequences. |
| D8 | **Accepting a prediction:** confidence threshold (start 0.8) plus smoothing: majority vote over the last 10 predictions. | Stops flickering and wrong words. |
| D9 | **Evaluation:** train / validation / test split **by signer** (e.g. S01–S03 / S04 / S05). Report accuracy, confusion matrix, precision / recall / F1. Never test on people the model trained on. | Honest accuracy on new people; no data leakage. |
| D10 | **Database:** Supabase (PostgreSQL), **Row Level Security on every table**, Supabase Auth for login, Storage bucket `sign-media` for reference videos and images. Only the **anon** key in the frontend; the service_role key is used only by `ml/export_data.py` on our own laptops. | Free hosted Postgres with built-in security. |
| D11 | **Training:** Python 3.11, NumPy, Pandas, scikit-learn, TensorFlow/Keras. Google Colab if a laptop is too slow. | Standard, well documented tools. |
| D12 | **Serving: Option B, FastAPI** (decided 2026-10-23). The browser computes the 130 features and sends **only numbers** to the API, which runs the models. | scikit-learn models can't run in the browser; one server for all models is simplest. |
| D13 | **Speech:** Web Speech API; fallback gTTS (through the API) for Urdu. Urdu shown right-to-left in Noto Nastaliq Urdu. | Free; works without extra setup in most browsers. |

## Change log
- 2026-10-23: D6 v1 → v2 (65 numbers per hand instead of 63; 130 per frame instead of 126).
- 2026-10-23: D12 decided: FastAPI (Option B).
