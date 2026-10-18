---
name: listing-photos
description: "Prepares item photos for a Facebook Marketplace listing: straightens tilt and keystone, brightens shadows, converts to sRGB, strips metadata, blurs plates and addresses, picks the cover and order, and flags missing shots, without generating pixels. Use when the user hands over item photos (chat attachments or a folder) to fix, straighten, brighten, clean up, or get ready for a listing. Companion to marketplace-listing."
---

# Listing photos

Turn the user's phone photos into listing-ready JPEGs that still show exactly the item they own.
Claude judges each photo; the bundled script does every pixel change with plain geometry and
tone math. Buyers decide on what the photos show, so a photo that misrepresents the item is a
defect, however good it looks.

## Never

- Generate, inpaint, or relight pixels with an AI image model. Labels, packaging text, and box
  shape drift under every generative editor, and Meta may tag the photo "AI info".
- Change the item: no hiding dents, tears, scuffs, glare, or tape, and no cleanup of labels.
- Change the count. In a lot photo, a crop that cuts off units misstates the quantity.
- Add text, prices, borders, badges, or watermarks.
- Touch the originals. The script reads them and writes new files.

## 1. Gather

Photos arrive as chat attachments (their saved paths are in the message) or as a folder of
originals, including iPhone HEIC. Create a scratch directory with `mktemp -d` for the work files.
Final photos go under `<folder>/listing/` for folder input, or under
`~/Pictures/Listings/<YYYY-MM-DD>/` for attachments, one subfolder per item.

## 2. Analyze

```bash
uv run --script "${CLAUDE_SKILL_DIR}/scripts/photos.py" analyze --work <scratch> <files or folders...>
```

This converts each photo to sRGB with its orientation applied, measures camera roll and pitch with
GeoCalib (GPU when CUDA is present, about 1 s a photo on CPU), and measures box-edge angles. It
writes `analysis.json`, `plan.json`, and `preview/NN.jpg` with a labeled 10% grid. The first run
downloads torch and the GeoCalib weights, roughly 3 GB, and can take a few minutes. Torch has no
build for Intel Macs, so the script runs on Windows, Linux, and Apple Silicon only.

## 3. Fill in the plan

View every preview, then edit `plan.json`. List order is listing order. For each entry:

- **`shot`** (required): `standing` when the camera faces the side of the item from about its
  height; `overhead` when it looks down at the top, with the ground filling the frame; `closeup`
  for labels, UPCs, model plates, and details. The shot type picks the straightening method.
  GeoCalib's gravity estimate is accurate on standing shots and wrong on overhead ones, so getting
  this right matters more than any other field.
- **`item`** (required): a short slug per distinct product, such as `tcl-h6w23w`. Each item gets
  its own subfolder, numbered from `01.jpg`, and a batch often mixes several products.
- **Order and `include`**: the cover comes first, then the other sides, the label or UPC close-up,
  and the quantity shot. Set `include: false` on near-duplicates, keeping the sharper, brighter
  shot. Keep at most 10, Facebook's per-listing limit according to seller guides (Meta does not
  publish it).
- **Cover**: the whole item face-on, showing the front panel with the product picture, with
  nothing important outside the center square, because the feed crops to a square. For a lot, use
  the group shot when the product stays recognizable in it; otherwise lead with one unit and put
  the group shot second.
- **`blur`**: background privacy only. Read `[x0, y0, x1, y1]` fractions off `preview/NN.jpg`,
  always that file, because blur is applied before straightening. Blur only what a stranger could
  actually read or recognize at full size: license plates, house numbers, street signs, faces, and
  labels carrying the user's name or address. An already out-of-focus plate gains nothing from
  blur, and every blurred patch is a visible edit. Leave retail
  shipping and distribution-center labels alone; they show the box came from retail stock. Never
  blur the item's own labels.
- **`lift`**: defaults to 0.25, the brightening Colton picked from side-by-sides. It lifts dark
  areas, including the item's own dark printing (navy reads lighter and bluer), so leave it
  identical across an item. Set an item to 0 only when the user asks for its original tones.
- **`wb: true`** only under indoor tungsten or fluorescent light with a visible cast. Daylight
  iPhone white balance is already right; automatic correction changed 14 of 20 daylight test
  photos.
- **Same tone across an item.** `lift` and `wb` must match on every photo of an item, because
  buyers see them side by side. The script rejects a plan that mixes them.
- Leave `rotate`, `keystone`, and `crop` at their defaults on the first pass.

## 4. Render and check

```bash
uv run --script "${CLAUDE_SKILL_DIR}/scripts/photos.py" render --work <scratch> --out <final folder>
```

It rejects an invalid plan before touching any output. Then, for each photo, it:

1. Applies the blur boxes.
2. Straightens standing shots by GeoCalib roll and removes 60% of their keystone. Overhead shots
   are squared to the box edges when the edges agree. Close-ups are left unrotated.
3. Crops to the valid area.
4. Applies a small linked levels stretch that cannot shift hues.
5. Applies the optional white balance, then the shadow lift.
6. Resizes to at most 2048 px and writes a metadata-free JPEG under 5 MB. It exits with an error if
   any metadata survives.

View every `compare/*.jpg`: the original on the left, the result on the right with a level grid and a
magenta square showing the feed crop. Accept a result only when:

- Box edges and verticals sit within about 2° of the grid lines.
- The whole item, every unit of a lot, and all four box edges are still in frame. Straightening
  crops the frame, and a large keystone correction crops the most.
- The box face is readable and the sky is not blown out.
- Printed colors match the original: navy stays navy and black stays black.
- Every blur box fully covers its target.
- On the cover, the item sits inside the magenta square.

Fix a failure by editing that entry, then re-render. Rendering replaces the numbered files.

- `rotate`: degrees to turn clockwise, negative for counterclockwise. Overrides the measurement.
- `keystone`: fraction of the measured pitch to remove, 0 to 1, standing shots only. Lower it
  first when straightening clips the item.
- `lift`: 0 to 0.5, one value per item.
- `crop`: `[x0, y0, x1, y1]` fractions read off `straight/<item>-NN.jpg`, the straightened frame
  before cropping.

When the item cannot fit the cover's magenta square, as with a tall stack shot close up, choose
another cover or flag a reshoot from farther back. Never pad the frame with a border.

When no edit beats the original, set `rotate: 0, keystone: 0, lift: 0`; the photo still gets
sRGB conversion, levels, and metadata stripping.

## 5. Flag gaps

Say what the set is missing or cannot fix, so the user can reshoot before posting:

- No whole-item, face-on shot to serve as cover.
- No readable model plate, UPC, or serial close-up.
- For a lot, no shot that shows the full count. Two faces with different printing, labels, or
  stickers are usually opposite sides of one box; ask the user rather than counting them as
  separate units.
- Glare or blur over text a buyer needs. Glare needs a reshoot from another angle.
- Visible damage that the description should mention.

Read the model number and UPC from close-ups and report them. Step 1 of the **marketplace-listing**
skill can identify the product from them.

## 6. Report

Give the output folder or folders and, for each photo, its number, shot, and edits in one line.
Then list the flags. Embed the cover's compare sheet and any sheet with a notable change, using
its absolute path. Mention once that the photos need to reach the phone if the user posts from
there.
