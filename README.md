# Batch Photo Editor

Upload one photo, dial in your edits, lock it in as a template, then upload more, edits apply automatically to every image in the batch.

## Motivation

I take a lot of photos and often end up with a set from the same shoot that all need the same adjustments: same lighting fix, same warmth, same style. Doing that one by one in any editor is tedious. I wanted something minimal: edit the desired look on one photo, hit apply, choose more photos, done.

## How it works

1. **Upload your first photo** — this becomes the template for the batch
2. **Adjust the sliders** — brightness, contrast, warmth, tint, etc. You see a live preview as you drag
3. **Add more photos** — upload the rest of the batch; edits from the template are applied automatically
4. **Fine-tune individuals** — if one photo needs a slightly different brightness, you can override just that slider without affecting the others
5. **Download** — once processing is done, get all the edited images as a ZIP

## Features

- **Template-based editing** — tune one photo, propagate settings to all others
- **Per-image overrides** — fine-tune individual images without breaking the batch template
- **Live preview** — CSS filters mirror the Python worker output in real time
- **Batch download** — client-side ZIP via JSZip
- **Limits** — up to 25 images per batch, 20 MB per file (JPEG, PNG, WebP)

## Edit Controls

| Slider | Range | Default | Notes |
|---|---|---|---|
| Brightness | 0.5 – 2.0 | 1.0 | Multiplicative |
| Contrast | 0.5 – 2.0 | 1.0 | Multiplicative |
| Saturation | 0.0 – 3.0 | 1.0 | |
| Warmth | −100 – 100 | 0 | Shifts R/B channels |
| Hue | 0 – 360 | 0 | Degrees |
| Tint | −180 – 180 | 0 | Negative = green, positive = magenta |
| Black Point | 0 – 100 | 0 | Lifts shadows via Look-up Table |

## Architecture

```
Browser (Next.js)
  │  upload original → Supabase Storage (originals bucket)
  │  write image row  → Supabase DB (status: pending)
  │
  ├── /edit/[batchId]   live preview with CSS filters, saves edit_settings to batch
  └── /results/[batchId] polls every 3 s, shows processed images, ZIP download

Python Worker (worker/worker.py)
  │  polls DB for status=pending rows every 3 s
  │  downloads original from Storage
  │  applies edits with OpenCV (BGR pipeline)
  │  uploads result → Supabase Storage (edited bucket)
  └── updates image row: status=done, edited_url=<new url>
```

### Settings resolution

Each image's final settings are resolved per-field at processing time:

```
final = { ...batch.edit_settings, ...image.image_override_settings }
```

"Apply to all" merges changed fields into every image's `image_override_settings` and resets each image's status to `pending`, triggering a reprocess.

### Live preview vs. worker parity

The browser preview uses CSS `filter` and a tint overlay div. The Python worker replicates the same math in OpenCV. Warmth, tint, and black point are particularly tricky to match:

- **Warmth** — R/B channel multiplication (no easy CSS filter equivalent exists; the preview approximates with `sepia` and `hue-rotate`)
- **Tint** — CSS uses an RGBA overlay div; Python blends against a magenta/green flat color
- **Black point** — `brightness` bump in CSS; LUT-based shadow lift in Python

### Distributed locking

The worker immediately marks a row `status = processing` before doing any input or output. This prevents two worker instances from picking up the same image. On startup, the worker resets any rows stuck in `processing` for more than 10 minutes back to `pending`.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Auth / DB / Storage | Supabase (anonymous auth + RLS) |
| Image processing | Python 3, OpenCV, NumPy |
| Client-side ZIP | JSZip |

## Project Structure

```
app/
  page.tsx                  # Upload first photo, create batch
  edit/[batchId]/page.tsx   # Template editor + per-image adjust mode
  results/[batchId]/page.tsx # Results grid with polling + download
components/
  EditPreview.tsx            # Live CSS filter preview
  SliderPanel.tsx            # All edit sliders
  ResultsGrid.tsx            # Processed image grid
  ZipDownloadButton.tsx      # Client-side ZIP
lib/
  supabase.ts               # Browser Supabase client singleton
  filterString.ts           # CSS filter string + tint overlay color
  applyToAll.ts             # Batch settings propagation
  zipDownload.ts            # JSZip bundle logic
types/index.ts              # EditSettings, Batch, ImageRow interfaces
worker/
  worker.py                 # OpenCV processing loop
  requirements.txt
supabase/
  schema.sql                # Tables, RLS policies, 25-image limit
```

## Setup

### 1. Supabase project

1. Create a new project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL editor
3. Create two **public** storage buckets: `originals` and `edited`
4. Copy your project URL and API keys from **Settings -> API**

### 2. Frontend environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

### 3. Python worker

Create `worker/.env`:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_KEY=<your-service-role-key>
```

> Use the **service role** key here (not the anon key); the worker bypasses RLS to update image rows.

Install dependencies and start the pythonworker:

```bash
cd worker
pip install -r requirements.txt
python worker.py
```

### Running both together

```
Terminal 1:  npm run dev          # Next.js at localhost:3000
Terminal 2:  cd worker && python worker.py
```

## Database Schema

```
batches
  id             uuid primary key
  user_id        uuid - auth.users
  created_at     timestamptz
  edit_settings  jsonb - batch template

images
  id                      uuid primary key
  batch_id                uuid - batches
  original_url            text
  edited_url              text (nullable)
  image_override_settings jsonb (nullable)  -  per-image overrides
  status                  text  pending | processing | done | failed
  created_at              timestamptz
```

RLS ensures users can only read and write their own batches and images. The 25-image limit is enforced by a `count_batch_images` security-definer function called in the insert policy.

## Architecture Decisions & Tradeoffs

### Trigger mechanism: DB polling over job queue

The Python worker polls Supabase every 3 seconds for `status = pending` rows rather than using webhooks or a dedicated job queue.

**Why:** No additional infrastructure; Supabase is already the data store. Easy to inspect and debug. Trivial retries (reset `status = pending`). Sufficient for async batch workloads.

**Tradeoff:** Up to 3-second delay before processing starts. Acceptable here. If sub-second latency ever matters, migrate to webhooks.

---

### `status = processing` as a distributed lock

The worker sets `status = processing` immediately on pickup before doing any work.

**Why:** Without this, a second worker instance or the next poll cycle (if processing takes longer than the poll interval) could pick up the same image and process it twice. `processing` acts as a lightweight lock.

If the worker crashes mid-job, rows get stuck in `processing` forever. Fix: on startup, reset any rows stuck in `processing` for more than 10 minutes back to `pending`.

---

### Live preview: CSS filters over canvas pixel manipulation

The edit preview uses CSS `filter` on an `<img>` tag rather than canvas.

**Why:** Zero latency (GPU-accelerated, no JS computation). Brightness, contrast, saturate, and hue-rotate map directly to CSS filter functions.

**Tradeoff:** Warmth, tint, and black point cannot be expressed precisely in CSS — they are approximated (warmth via `sepia()`, tint via a color overlay `<div>`, black point via a brightness increase). The Python worker applies mathematically correct versions via OpenCV regardless. Preview is approximate; output is accurate.

---

### Image processing: OpenCV over Pillow

The worker uses OpenCV and NumPy instead of Pillow.

**Why:** Hue rotation is first-class in OpenCV — convert to HSV, shift the H channel as a NumPy array, convert back. Fully vectorized, runs in C++. Pillow has no native HSV support; hue rotation would require a slow per-pixel Python loop (`colorsys`) or custom NumPy HSV math.

**Tradeoff:** `opencv-python` wheel is ~15–30 MB larger than Pillow. OpenCV uses BGR channel order (not RGB) so all loads and saves must account for this.

---

### Settings resolution: per-field merge

`final_settings[field] = image_override_settings?.[field] ?? batch_template[field]`

**Why:** Users should be able to override just one slider on a single image without losing all the other batch settings. A full object replace would be too destructive.

**"Apply to all" behavior:** Only the changed fields propagate. Each image's other existing overrides are preserved. The last write wins per field.

---

### ZIP download: client-side JSZip

The ZIP is assembled in the browser using JSZip rather than a server-side API route.

**Why:** Edited images are already public Storage URLs, so there is no need to proxy them through a server. Avoids a backend route that would need to handle large payloads.

---

### Auth: anonymous sessions + RLS

No registration required. Supabase anonymous sign-ins give each browser session a unique `auth.uid()`. RLS policies isolate `batches` and `images` per user.

**Tradeoffs:** Session is tied to browser cookies, clearing cookies loses access to the batch. Storage URLs are public: anyone who guesses the URL can view an image (acceptable for non-sensitive creative work).

**Migration path:** Supabase supports converting anonymous sessions to full accounts if I decide login should be added later.

---

### Worker auth: service role key

The worker uses the Supabase service role key, which bypasses RLS, because it is a trusted backend process that needs to read and write image rows regardless of which user owns them.

The service role key should never be in `.env.local` or committed to git. It lives only in the worker's environment, and make sure to put the file with that env variable in .gitignore.

---

### Deployment split: Vercel + Railway

Next.js frontend on Vercel, Python worker on Railway.

**Why split:** Vercel only runs JS/TS serverless functions with a max timeout, so an infinite polling loop is not possible there. Railway supports persistent long-running processes.
The two processes never talk to each other directly. Supabase is the middleman.

---

## Key Learnings

**The DB is the queue.** `status = pending` is the queue entry; `status = done` is the acknowledgment. No queue infrastructure needed.

**Two independent pollers.** The Python worker polls Supabase to find work. The Next.js frontend polls Supabase to display results. They serve different purposes and run independently; neither knows about the other.

**`status = processing` is not optional.** Even with a single worker, the next poll cycle can double-process a row if processing takes longer than the poll interval. Always set `processing` immediately on pickup.

**CSS filters are sufficient for live preview.** For image editing, users need instant feedback, not pixel-perfect accuracy in the preview. CSS filters give that for free. The server does the accurate math.

**RLS policy cannot query its own table.** A subquery inside an RLS policy that reads the same table causes Postgres to throw "infinite recursion detected." Fix: wrap the subquery in a `SECURITY DEFINER` function, which runs as the DB owner and is exempt from RLS. The user's session stays unprivileged throughout.

**Upload before insert, not insert before upload.** Creating a DB row with `status = pending` before the file upload completes is a race condition — the worker can pick up the row before `original_url` is set. Fix: generate the UUID client-side with `crypto.randomUUID()`, upload first, then insert the fully-populated row in one step.

**"Public" bucket != writable.** A public Supabase Storage bucket only controls read access by default. Writes still require an explicit INSERT policy on `storage.objects`.

**Anonymous sign-in must be explicitly enabled.** In Supabase it is off by default. Enable it under Authentication -> Sign In / Providers -> Anonymous. Without it, `signInAnonymously()` fails and all subsequent DB/storage calls are rejected by RLS.
