# SignBridge 🤟

**AI Pakistan Sign Language (PSL) → Urdu / English translator.**
CMPE-341L Artificial Intelligence, UET Lahore. Syeda Tehreem Fatima (2024-CE-86) and Tooba Iftikhar (2024-CE-114).

- Fixed decisions: [`decisions.md`](decisions.md)
- What to do next: [`ROADMAP.md`](ROADMAP.md)

## How it works

```
 BROWSER (React)                                              API (FastAPI, Python)
 webcam ─► MediaPipe: 21 points per hand ─► landmarks.js ─► 130 numbers per frame ──►  static model  (RF / MLP)
                                            (D6 v2)        (30 frames for moving     dynamic model (LSTM)
                                                            signs)                        │
 Urdu + English text, speech ◄── majority vote (D8) ◄─────── sign + confidence ◄─────────┘
```

The video never leaves the computer: only the numbers are sent to the API.

| Folder | What's inside |
|---|---|
| `web/` | React app: Live Translate, Reverse Mode, Record Samples, History |
| `api/` | FastAPI server that runs the trained models |
| `ml/` | Training: `landmarks.py` (features), `export_data.py`, `train_static.py`, `train_dynamic.py` |
| `supabase/` | `schema.sql` (tables + security rules), `seed.sql` (34 starter words) |
| `tools/` | `parity_test.py` (Python = JS check), `make_test_data.py` (fake data for testing) |

---

## Setup (Windows, VS Code, PowerShell)

You need **Node.js 20+** and **Python 3.11**. Check with `node -v` and `py -3.11 --version`.

### 1. Web app
```powershell
cd web
npm install
npm run dev
```
Open http://localhost:5173 and allow the camera. You should see the hand skeleton on your hands.

### 2. Python (one venv for both `ml/` and `api/`)
In a **new** terminal, from the `signbridge` folder:
```powershell
py -3.11 -m venv venv
venv\Scripts\activate
pip install -r ml\requirements.txt -r api\requirements.txt
```
> If PowerShell says "running scripts is disabled", run this once, then try `activate` again:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

Using **one** venv matters: the API must load models with the same scikit-learn and TensorFlow versions they were trained with.

### 3. Supabase
1. Create a free project at https://supabase.com.
2. Open **SQL Editor**. Paste and run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Go to **Project Settings → API**. Copy `web/.env.example` to `web/.env` and paste the **Project URL** and the **anon public** key.
4. Restart `npm run dev`. The top bar should say "Supabase connected".
5. Both of you sign up in the app (History page). Then, in the SQL Editor, make one account admin:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'your@email.com');
   ```
6. Optional: to make sign-up faster during development, turn off "Confirm email" in **Authentication → Providers → Email**.

Only the **anon** key goes in `web/.env`. The **service_role** key bypasses all security rules, so it goes **only** in `ml/.env`, on your own laptop (decision D10). Never commit `.env` files.

---

## Daily workflow

### Record samples (web → Record Samples)
- **Signer code:** each person always uses the same code (Tehreem = S01, Tooba = S02, friends S03, S04, S05…).
- Pick a sign, set lighting and background honestly, and press **Start recording**.
- Moving signs are recorded for 1.5 s, still signs for 0.5 s (set in `web/src/lib/config.js`).
- Only signs with a `model_label` are trained. Admins can add signs and give them labels.

### Train (ml folder, venv active)
```powershell
cd ml
copy .env.example .env       # then paste SUPABASE_URL and SUPABASE_SERVICE_KEY into ml\.env
python export_data.py        # downloads samples; shows a table of samples per sign and signer
python train_dynamic.py      # LSTM for moving signs  (+ Random Forest baseline)
python train_static.py       # Random Forest vs MLP for still signs
```
- The split is **by signer** (D9). By default the last signer code is the test set and the second-to-last is the validation set. To choose yourself: `python train_dynamic.py --val S04 --test S05`.
- With only 1 signer the scripts refuse to give an accuracy, because it wouldn't be honest. With 2 signers they work but print a warning.
- Results are saved in `ml\reports\`: accuracy, precision / recall / F1 per sign, and a confusion matrix picture.
- Models are saved in `ml\models\`.

### Run the API (api folder, venv active)
```powershell
cd api
uvicorn main:app --reload
```
- Open http://127.0.0.1:8000/docs to try the endpoints by hand.
- After training new models, load them without restarting: in `/docs`, run **POST /reload**.
- Quick self-test: `python test_api.py`.

### Check the feature format (after ANY change to landmarks.py or landmarks.js)
```powershell
python tools\parity_test.py     # must print PASS
```

### Try the whole pipeline without real data
```powershell
python tools\make_test_data.py          # FAKE samples from 5 fake signers
cd ml ; python train_static.py ; python train_dynamic.py ; cd ..
python tools\make_test_data.py --clean  # remove the fake data before using real data!
```
After training on fake data, delete everything in `ml\models\` too.

---

## API endpoints

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/health` | – | which models are loaded |
| GET | `/labels` | – | model output index → sign |
| POST | `/reload` | – | reloads models from `ml/models/` |
| POST | `/predict/static` | `{"features": [130 numbers]}` | `{sign, confidence, top3}` |
| POST | `/predict/dynamic` | `{"features": [[130 numbers] × 30]}` | `{sign, confidence, top3}` |
| GET | `/tts?text=...&lang=ur` | – | MP3 Urdu speech (gTTS, needs internet) |

---

## Project structure
```
web/src/
  lib/landmarks.js     feature format D6 v2 (must match ml/landmarks.py)
  lib/recognizer.js    calls the API + majority vote (D8)
  lib/config.js        threshold, vote window, sign durations, API URL
  lib/supabase.js      all database calls (anon key only)
  lib/api.js, speech.js, handTracker.js, useSession.js
  components/          Camera.jsx (webcam + MediaPipe), Login.jsx
  pages/               Translate.jsx, ReverseMode.jsx, RecordSamples.jsx, History.jsx
api/main.py            FastAPI server
ml/                    landmarks.py, data.py (loading, signer split, reports), export_data.py,
                       train_static.py, train_dynamic.py, models/, reports/, data/
supabase/              schema.sql, seed.sql
tools/                 parity_test.py (+ parity_js.mjs), make_test_data.py
```

## Known limits (good to mention in the viva)
- Isolated signs only (D1). No continuous signing or PSL grammar.
- Accuracy depends on how many **different people** recorded. A model trained on 2–3 people may struggle with a new person.
- The 34 starter words have `sign_type` guessed as dynamic. Check each one in a proper PSL source.
- Reverse Mode matches English and Urdu text. Roman Urdu (e.g. "shukriya") isn't matched, because the `signs` table has no Roman Urdu column.
