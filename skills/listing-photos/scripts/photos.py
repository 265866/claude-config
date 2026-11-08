# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "geocalib @ git+https://github.com/cvg/GeoCalib@1dedb29f94fc11b896c5f572005978aeebccd67f",
#   "torch>=2.11",
#   "torchvision>=0.26",
#   "opencv-python>=4.10",
#   "numpy>=2",
#   "pillow>=12",
#   "pillow-heif>=1",
# ]
#
# [tool.uv.sources]
# torch = [{ index = "pytorch-cu128", marker = "sys_platform != 'darwin'" }]
# torchvision = [{ index = "pytorch-cu128", marker = "sys_platform != 'darwin'" }]
#
# [[tool.uv.index]]
# name = "pytorch-cu128"
# url = "https://download.pytorch.org/whl/cu128"
# explicit = true
# ///
"""Prepare marketplace listing photos without inventing pixels.

analyze: convert inputs to sRGB, measure tilt, write grid previews and a plan to fill in.
render:  apply the filled-in plan and write metadata-free JPEGs plus before/after sheets.
"""

import argparse
import io
import json
import math
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageCms, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tif", ".tiff"}
SHOTS = {"standing", "overhead", "closeup"}
SLUG = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")
LONG_EDGE = 2048
MAX_BYTES = 5_000_000

# Thresholds measured on synthetic tilts and the first 20 real listing photos:
# GeoCalib is trustworthy only on standing shots with low roll uncertainty, and
# the edge estimate is only trustworthy on overhead shots with a dominant peak.
# Roll uncertainty also gates keystone: pitch uncertainty runs 2.6-4.3 degrees
# even on shots where 60% keystone correction checked out visually.
MIN_ROTATE, MAX_ROTATE_STANDING, MAX_ROTATE_OVERHEAD = 0.7, 15.0, 10.0
MAX_UNCERTAINTY, MAX_PITCH, KEYSTONE = 3.0, 25.0, 0.6
MIN_EDGE_CONF = 0.4
# Colton chose this look from side-by-sides. It also lightens dark printing
# (navy reads lighter and bluer), so it must match across an item's photos.
DEFAULT_LIFT = 0.25
MAX_PHOTOS_PER_ITEM = 10


def load_srgb(path: Path) -> Image.Image:
    im = ImageOps.exif_transpose(Image.open(path))
    icc = im.info.get("icc_profile")
    if im.mode in ("I", "I;16", "I;16B", "I;16L", "F"):
        a = np.asarray(im, dtype=np.float64)
        im = Image.fromarray(
            np.clip(a / (257 if a.max() > 255 else 1), 0, 255).astype(np.uint8)
        )
    if im.mode == "P":
        im = im.convert("RGBA")
    if im.mode in ("RGBA", "LA", "PA"):
        base = "L" if im.mode == "LA" else "RGB"
        flat = Image.new(base, im.size, "white")
        flat.paste(im.convert(base), mask=im.getchannel("A"))
        im = flat
    if im.mode not in ("RGB", "CMYK", "L"):
        im, icc = im.convert("RGB"), None
    if icc:
        try:
            src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            im = ImageCms.profileToProfile(
                im, src, ImageCms.createProfile("sRGB"), outputMode="RGB"
            )
        except ImageCms.PyCMSError as err:
            print(f"warning: {path.name}: color profile ignored ({err})", flush=True)
    return im.convert("RGB")


def expand_inputs(inputs: list[str]) -> list[Path]:
    files: list[Path] = []
    for raw in inputs:
        p = Path(raw)
        if p.is_dir():
            files += sorted(
                f for f in p.iterdir() if f.suffix.lower() in IMAGE_SUFFIXES
            )
        elif p.is_file():
            files.append(p)
        else:
            sys.exit(f"input not found: {p}")
    if not files:
        sys.exit("no images found in the inputs")
    return files


def edge_angle(gray: np.ndarray, tol: float = 20.0) -> tuple[float, float]:
    """Dominant near-horizontal/vertical line tilt in degrees (positive = counterclockwise) and its confidence."""
    h, w = gray.shape
    s = 1024 / max(h, w)
    if s < 1:
        gray = cv2.resize(gray, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    g = cv2.GaussianBlur(gray, (5, 5), 0)
    m = float(np.median(g))
    edges = cv2.Canny(g, int(max(0, 0.66 * m)), int(min(255, 1.33 * m)))
    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 720,
        threshold=60,
        minLineLength=int(0.08 * min(g.shape)),
        maxLineGap=6,
    )
    if lines is None:
        return 0.0, 0.0
    devs, wts = [], []
    for x1, y1, x2, y2 in lines.reshape(-1, 4).astype(float):
        dx, dy = x2 - x1, -(y2 - y1)
        a = (math.degrees(math.atan2(dy, dx)) + 90) % 180 - 90
        length = math.hypot(dx, dy)
        if abs(a) <= tol:
            devs.append(a)
            wts.append(length)
        elif abs(abs(a) - 90) <= tol:
            devs.append(a - 90 if a > 0 else a + 90)
            wts.append(length * 1.5)
    if not devs:
        return 0.0, 0.0
    d, wt = np.array(devs), np.array(wts)
    hist, bins = np.histogram(
        d, bins=int(2 * tol / 0.25), range=(-tol, tol), weights=wt
    )
    k = int(np.argmax(np.convolve(hist, np.ones(5) / 5, "same")))
    peak = (bins[k] + bins[k + 1]) / 2
    sel = np.abs(d - peak) < 1.0
    return float(np.average(d[sel], weights=wt[sel])), float(wt[sel].sum() / wt.sum())


def to_linear(rgb8: np.ndarray) -> np.ndarray:
    x = rgb8.astype(np.float64) / 255.0
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def to_srgb8(lin: np.ndarray) -> np.ndarray:
    lin = np.clip(lin, 0, 1)
    x = np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * lin ** (1 / 2.4) - 0.055)
    return np.clip(x * 255 + 0.5, 0, 255).astype(np.uint8)


def luminance(lin: np.ndarray) -> np.ndarray:
    return lin @ np.array([0.2126, 0.7152, 0.0722])


def auto_level(rgb8: np.ndarray) -> np.ndarray:
    """Stretch all channels together between shared percentiles, so the stretch cannot shift hues.

    The caps keep it a small correction: a scene with no true black or white
    (a navy box on a light floor) would otherwise get its darkest color crushed.
    """
    lo, hi = np.percentile(rgb8, [0.05, 99.95])
    lo, hi = min(lo, 10.0), max(hi, 235.0)
    if hi - lo < 1:
        return rgb8
    out = (rgb8.astype(np.float64) - lo) * 255.0 / (hi - lo)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def white_balance(rgb8: np.ndarray, threshold: float = 0.10) -> np.ndarray:
    """Neutralize a cast measured on pixels that turn neutral once corrected; unchanged when too few exist."""
    lin = to_linear(rgb8)
    c = lin[(luminance(lin) > 0.02) & (lin.max(-1) < 0.95)]
    if len(c) < 500:
        return rgb8
    bright = c[luminance(c) >= np.percentile(luminance(c), 95)].mean(0)
    gain = bright.mean() / np.maximum(bright, 1e-6)
    for _ in range(4):
        g = c * gain
        neutral = (
            np.abs(g / np.maximum(g.mean(1, keepdims=True), 1e-6) - 1).max(1) < 0.15
        )
        if neutral.sum() < max(500, 0.02 * len(c)):
            return rgb8
        ref = c[neutral].mean(0)
        gain = ref.mean() / ref
    if np.abs(np.log(gain)).max() < threshold:
        return rgb8
    return to_srgb8(lin * np.clip(gain, 0.6, 1.7))


def shadow_lift(
    rgb8: np.ndarray, strength: float, max_stops: float = 1.0, mid: float = 0.18
) -> np.ndarray:
    """Edge-aware local lift of dark regions toward mid grey; bright regions such as sky keep their values."""
    if strength <= 0:
        return rgb8
    lin = to_linear(rgb8)
    log_y = np.log2(np.clip(luminance(lin), 1e-5, 1)).astype(np.float32)
    h, w = log_y.shape
    s = max(1, max(h, w) // 256)
    base = cv2.bilateralFilter(
        cv2.resize(
            log_y, (max(1, w // s), max(1, h // s)), interpolation=cv2.INTER_AREA
        ),
        d=-1,
        sigmaColor=1.0,
        sigmaSpace=12,
    )
    base = cv2.resize(base, (w, h), interpolation=cv2.INTER_LINEAR)
    gain = (2 ** np.clip(strength * (np.log2(mid) - base), 0, max_stops))[..., None]
    out = lin * gain
    rolled = out / (1 + np.maximum(out - 0.85, 0) * 2.0)
    return to_srgb8(np.where(gain > 1.0001, np.maximum(rolled, lin), lin))


def upright(
    rgb8: np.ndarray, rotate_cw: float, pitch: float, vfov: float
) -> np.ndarray:
    """Rotate clockwise by rotate_cw degrees, undo `pitch` degrees of keystone, then crop to the largest valid centered rectangle."""
    h, w = rgb8.shape[:2]
    f = (h / 2) / math.tan(math.radians(vfov) / 2)
    k = np.array([[f, 0, w / 2], [0, f, h / 2], [0, 0, 1.0]])
    p, r = math.radians(pitch), math.radians(rotate_cw)
    rx = np.array(
        [[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]]
    )
    rz = np.array(
        [[math.cos(r), -math.sin(r), 0], [math.sin(r), math.cos(r), 0], [0, 0, 1]]
    )
    hom = k @ rx @ rz @ np.linalg.inv(k)
    c = hom @ np.array([w / 2, h / 2, 1])
    hom = (
        np.array([[1, 0, w / 2 - c[0] / c[2]], [0, 1, h / 2 - c[1] / c[2]], [0, 0, 1]])
        @ hom
    )
    out = cv2.warpPerspective(
        rgb8, hom, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )
    valid = cv2.warpPerspective(
        np.full((h, w), 255, np.uint8), hom, (w, h), flags=cv2.INTER_NEAREST
    )
    valid = cv2.erode(valid, np.ones((5, 5), np.uint8))

    def window(s: float) -> tuple[int, int, int, int]:
        cw, ch = int(w * s), int(h * s)
        return (w - cw) // 2, (h - ch) // 2, cw, ch

    def fits(s: float) -> bool:
        x0, y0, cw, ch = window(s)
        return valid[y0 : y0 + ch, x0 : x0 + cw].min() == 255

    lo, hi = 0.3, 1.0
    if not fits(lo):
        sys.exit(
            f"rotation {rotate_cw:+.1f} with keystone {pitch:+.1f} leaves under 30% of the frame"
        )
    for _ in range(20):
        s = (lo + hi) / 2
        lo, hi = (s, hi) if fits(s) else (lo, s)
    x0, y0, cw, ch = window(lo)
    return out[y0 : y0 + ch, x0 : x0 + cw]


def box_px(
    box: list[float], w: int, h: int, pad: float = 0.0
) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = box
    px, py = pad * (x1 - x0), pad * (y1 - y0)
    return (
        int(max(0, x0 - px) * w),
        int(max(0, y0 - py) * h),
        math.ceil(min(1, x1 + px) * w),
        math.ceil(min(1, y1 + py) * h),
    )


def blur_boxes(rgb8: np.ndarray, boxes: list[list[float]]) -> np.ndarray:
    """Defocus each box like out-of-focus background, fading into its surroundings.

    Sigma is a quarter of the box's short side, so lettering that fills the box
    cannot survive. The soft edge avoids the pasted-rectangle look of a mosaic.
    """
    out = rgb8.astype(np.float32)
    h, w = rgb8.shape[:2]
    for box in boxes:
        x0, y0, x1, y1 = box_px(box, w, h, pad=0.15)
        short = max(4, min(x1 - x0, y1 - y0))
        fade = short
        rx0, ry0 = max(0, x0 - fade), max(0, y0 - fade)
        rx1, ry1 = min(w, x1 + fade), min(h, y1 + fade)
        region = out[ry0:ry1, rx0:rx1]
        rh, rw = region.shape[:2]
        k = max(1, short // 32)  # blur a downscaled copy; same look, far faster
        size = (max(1, rw // k), max(1, rh // k))
        blurred = cv2.GaussianBlur(
            cv2.resize(region, size, interpolation=cv2.INTER_AREA),
            (0, 0),
            short / 4 / k,
        )
        # An ellipse through the box corners: square-cornered patches read as pasted on.
        mask = np.zeros((size[1], size[0]), np.float32)
        center = (((x0 + x1) / 2 - rx0) / k, ((y0 + y1) / 2 - ry0) / k)
        axes = ((x1 - x0) / 2 / k * 1.42, (y1 - y0) / 2 / k * 1.42)
        cv2.ellipse(mask, (center, (2 * axes[0], 2 * axes[1]), 0), 1.0, -1)
        soft = np.maximum(
            mask, cv2.GaussianBlur(mask, (0, 0), max(1.0, fade / 2 / k)) * 2
        ).clip(0, 1)
        blurred = cv2.resize(blurred, (rw, rh), interpolation=cv2.INTER_LINEAR)
        soft = cv2.resize(soft, (rw, rh), interpolation=cv2.INTER_LINEAR)[..., None]
        out[ry0:ry1, rx0:rx1] = region * (1 - soft) + blurred * soft
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def draw_grid(bgr: np.ndarray, labels: bool, square_guide: bool = False) -> np.ndarray:
    out = bgr.copy()
    h, w = out.shape[:2]
    overlay = out.copy()
    for i in range(1, 10):
        x, y = int(w * i / 10), int(h * i / 10)
        cv2.line(overlay, (x, 0), (x, h), (0, 255, 255), 1)
        cv2.line(overlay, (0, y), (w, y), (0, 255, 255), 1)
        if labels:
            for pos in ((x + 3, 16), (x + 3, h - 6)):
                cv2.putText(
                    out, f".{i}", pos, cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 3
                )
                cv2.putText(
                    out, f".{i}", pos, cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1
                )
            for pos in ((3, y - 4), (w - 28, y - 4)):
                cv2.putText(
                    out, f".{i}", pos, cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 3
                )
                cv2.putText(
                    out, f".{i}", pos, cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1
                )
    if square_guide:
        side = min(w, h)
        x0, y0 = (w - side) // 2, (h - side) // 2
        cv2.rectangle(
            overlay, (x0, y0), (x0 + side - 1, y0 + side - 1), (255, 0, 255), 2
        )
    return cv2.addWeighted(overlay, 0.6, out, 0.4, 0)


def fit(bgr: np.ndarray, long_edge: int) -> np.ndarray:
    h, w = bgr.shape[:2]
    s = long_edge / max(h, w)
    return (
        cv2.resize(bgr, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
        if s < 1
        else bgr
    )


def rgb_to_bgr(a: np.ndarray) -> np.ndarray:
    return np.ascontiguousarray(a[..., ::-1])


def analyze(args: argparse.Namespace) -> None:
    import torch
    from geocalib import GeoCalib

    work = Path(args.work)
    for sub in ("src", "preview"):
        (work / sub).mkdir(parents=True, exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = GeoCalib().to(device)
    items, plan = [], []
    for i, path in enumerate(expand_inputs(args.inputs), 1):
        pid = f"{i:02d}"
        src = work / "src" / f"{pid}.png"
        load_srgb(path).save(src)
        with torch.no_grad():
            r = model.calibrate(model.load_image(src).to(device))
        roll, pitch = (math.degrees(float(x)) for x in r["gravity"].rp[0])
        rgb8 = np.asarray(Image.open(src))
        bgr = rgb_to_bgr(rgb8)
        edge, conf = edge_angle(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY))
        items.append(
            {
                "id": pid,
                "source": str(path.resolve()),
                "width": rgb8.shape[1],
                "height": rgb8.shape[0],
                "geocalib": {
                    "roll": round(roll, 2),
                    "pitch": round(pitch, 2),
                    "vfov": round(math.degrees(float(r["camera"].vfov[0])), 2),
                    "roll_uncertainty": round(
                        math.degrees(float(r["roll_uncertainty"][0])), 2
                    ),
                },
                "edges": {"angle": round(edge, 2), "confidence": round(conf, 2)},
            }
        )
        plan.append(
            {
                "id": pid,
                "item": None,
                "include": True,
                "shot": None,
                "rotate": None,
                "keystone": None,
                "lift": DEFAULT_LIFT,
                "wb": False,
                "blur": [],
                "crop": None,
            }
        )
        write_jpg(
            work / "preview" / f"{pid}.jpg", draw_grid(fit(bgr, 1200), labels=True)
        )
        print(
            f"{pid} {path.name}: roll {roll:+.1f} pitch {pitch:+.1f} unc {items[-1]['geocalib']['roll_uncertainty']:.1f}"
            f" | edges {edge:+.1f} conf {conf:.2f}",
            flush=True,
        )
    (work / "analysis.json").write_text(
        json.dumps({"device": device, "items": items}, indent=1), encoding="utf-8"
    )
    (work / "plan.json").write_text(json.dumps(plan, indent=1), encoding="utf-8")
    print(
        f"wrote {work / 'analysis.json'}, {work / 'plan.json'}, previews in {work / 'preview'}"
    )


def auto_geometry(entry: dict, a: dict) -> tuple[float, float, str]:
    """Return (rotate_cw, keystone_pitch, reason) from the shot type, unless the plan overrides them."""
    g, e, shot = a["geocalib"], a["edges"], entry["shot"]
    rotate, pitch, why = 0.0, 0.0, []
    if (
        shot == "standing"
        and g["roll_uncertainty"] < MAX_UNCERTAINTY
        and MIN_ROTATE <= abs(g["roll"]) <= MAX_ROTATE_STANDING
    ):
        rotate = g["roll"]
        why.append(f"gravity roll {g['roll']:+.1f}")
    elif (
        shot == "overhead"
        and e["confidence"] >= MIN_EDGE_CONF
        and MIN_ROTATE <= abs(e["angle"]) <= MAX_ROTATE_OVERHEAD
    ):
        rotate = e["angle"]
        why.append(f"box edges {e['angle']:+.1f} (conf {e['confidence']:.2f})")
    trusted_pitch = (
        shot == "standing"
        and g["roll_uncertainty"] < MAX_UNCERTAINTY
        and abs(g["roll"]) <= MAX_ROTATE_STANDING
        and abs(g["pitch"]) <= MAX_PITCH
    )
    if trusted_pitch:
        pitch = g["pitch"] * KEYSTONE
    if entry.get("rotate") is not None:
        rotate = float(entry["rotate"])
        why = [f"override {rotate:+.1f}"]
    if entry.get("keystone") is not None:
        pitch = g["pitch"] * float(entry["keystone"])
    return rotate, pitch, "; ".join(why) or "no rotation"


def validate_plan(plan: list[dict], analysis: dict) -> list[dict]:
    """Reject the whole plan before any output is touched."""
    chosen = [p for p in plan if p.get("include", True)]
    problems = []
    for p in chosen:
        pid = p.get("id")
        if pid not in analysis:
            problems.append(f"{pid}: unknown id")
            continue
        if p.get("shot") not in SHOTS:
            problems.append(f"{pid}: shot must be one of {sorted(SHOTS)}")
        if not SLUG.fullmatch(p.get("item") or ""):
            problems.append(f"{pid}: item must be a lowercase-hyphen slug")
        if p.get("keystone") is not None and (
            p.get("shot") != "standing" or not 0 <= float(p["keystone"]) <= 1
        ):
            problems.append(
                f"{pid}: keystone is a 0-1 fraction for standing shots only"
            )
        lift = DEFAULT_LIFT if p.get("lift") is None else float(p["lift"])
        if not 0 <= lift <= 0.5:
            problems.append(f"{pid}: lift must be 0-0.5")
        for box in [*(p.get("blur") or []), *([p["crop"]] if p.get("crop") else [])]:
            if len(box) != 4 or not (
                0 <= box[0] < box[2] <= 1 and 0 <= box[1] < box[3] <= 1
            ):
                problems.append(f"{pid}: box must be [x0, y0, x1, y1] fractions: {box}")
    # One item's photos sit side by side in a listing, so a tone edit on only some
    # of them shows as a color mismatch between photos of the same box.
    for item in {p.get("item") for p in chosen}:
        tones = {
            (
                DEFAULT_LIFT if p.get("lift") is None else float(p["lift"]),
                bool(p.get("wb")),
            )
            for p in chosen
            if p.get("item") == item
        }
        if len(tones) > 1:
            problems.append(
                f"{item}: use the same lift and wb on every photo of an item"
            )
    if problems:
        sys.exit("plan.json problems:\n  " + "\n  ".join(problems))
    return chosen


def write_jpg(path: Path, bgr: np.ndarray) -> None:
    if not cv2.imwrite(str(path), bgr, [cv2.IMWRITE_JPEG_QUALITY, 85]):
        sys.exit(f"could not write {path}")


def save_clean_jpeg(rgb8: np.ndarray, dest: Path) -> int:
    im = Image.fromarray(rgb8, "RGB")
    for quality in (90, 85, 80, 75):
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=quality, optimize=True)
        if buf.tell() <= MAX_BYTES:
            break
    dest.write_bytes(buf.getvalue())
    with Image.open(dest) as check:
        leaked = [
            k
            for k in ("exif", "icc_profile", "xmp", "photoshop", "comment")
            if k in check.info
        ]
        if leaked or check.getexif():
            sys.exit(f"metadata survived in {dest}: {leaked or 'exif'}")
    return dest.stat().st_size


def render(args: argparse.Namespace) -> None:
    work, out = Path(args.work), Path(args.out)
    analysis = {
        a["id"]: a
        for a in json.loads((work / "analysis.json").read_text(encoding="utf-8"))[
            "items"
        ]
    }
    chosen = validate_plan(
        json.loads((work / "plan.json").read_text(encoding="utf-8")), analysis
    )
    for sub in ("compare", "straight"):
        (work / sub).mkdir(exist_ok=True)
        for stale in (work / sub).glob("*.jpg"):
            stale.unlink()
    folders = {entry["item"] for entry in chosen}
    for folder in sorted(folders):
        count = sum(entry["item"] == folder for entry in chosen)
        if count > MAX_PHOTOS_PER_ITEM:
            print(
                f"warning: {folder} has {count} photos; Facebook shows {MAX_PHOTOS_PER_ITEM}",
                flush=True,
            )
    for folder in folders:
        (out / folder).mkdir(parents=True, exist_ok=True)
        for stale in (out / folder).glob("[0-9][0-9].jpg"):
            stale.unlink()
    report, counts = [], dict.fromkeys(folders, 0)
    for entry in chosen:
        folder = entry["item"]
        counts[folder] += 1
        n = counts[folder]
        a = analysis[entry["id"]]
        rgb8 = np.asarray(
            Image.open(work / "src" / f"{entry['id']}.png").convert("RGB")
        )
        before = rgb8
        if entry.get("blur"):
            rgb8 = blur_boxes(rgb8, entry["blur"])
        rotate, pitch, why = auto_geometry(entry, a)
        if rotate or pitch:
            rgb8 = upright(rgb8, rotate, pitch, a["geocalib"]["vfov"])
        label = f"{folder}-{n:02d}"
        write_jpg(
            work / "straight" / f"{label}.jpg",
            draw_grid(fit(rgb_to_bgr(rgb8), 1200), labels=True),
        )
        if entry.get("crop"):
            x0, y0, x1, y1 = box_px(entry["crop"], rgb8.shape[1], rgb8.shape[0])
            rgb8 = rgb8[y0:y1, x0:x1]
        rgb8 = auto_level(rgb8)
        if entry.get("wb"):
            rgb8 = white_balance(rgb8)
        lift = DEFAULT_LIFT if entry.get("lift") is None else float(entry["lift"])
        rgb8 = shadow_lift(rgb8, lift)
        scale = LONG_EDGE / max(rgb8.shape[:2])
        if scale < 1:
            size_px = (round(rgb8.shape[1] * scale), round(rgb8.shape[0] * scale))
            rgb8 = np.asarray(
                Image.fromarray(rgb8).resize(size_px, Image.Resampling.LANCZOS)
            )
        dest = out / folder / f"{n:02d}.jpg"
        size = save_clean_jpeg(rgb8, dest)
        left = fit(rgb_to_bgr(before), 900)
        right = draw_grid(fit(rgb_to_bgr(rgb8), 900), labels=False, square_guide=True)
        hl, hr = left.shape[0], right.shape[0]
        right = cv2.resize(right, (round(right.shape[1] * hl / hr), hl))
        sheet = np.hstack([left, np.full((hl, 12, 3), 255, np.uint8), right])
        write_jpg(work / "compare" / f"{label}.jpg", sheet)
        row = {
            "output": str(dest),
            "id": entry["id"],
            "shot": entry["shot"],
            "rotate_cw": round(rotate, 2),
            "keystone_pitch": round(pitch, 2),
            "geometry": why,
            "lift": lift,
            "wb": bool(entry.get("wb")),
            "blurred": len(entry.get("blur") or []),
            "size": f"{rgb8.shape[1]}x{rgb8.shape[0]}",
            "bytes": size,
        }
        report.append(row)
        print(
            f"{label} <- {entry['id']} {entry['shot']}: {why}; keystone {pitch:+.1f}; {row['size']} {size // 1024} KB",
            flush=True,
        )
    (work / "render.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(
        f"wrote {len(report)} photos under {out}; before/after sheets in {work / 'compare'}"
    )


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser(
        "analyze", help="convert inputs, measure tilt, write previews and plan.json"
    )
    a.add_argument("--work", required=True, help="scratch directory for this batch")
    a.add_argument("inputs", nargs="+", help="image files or folders")
    r = sub.add_parser("render", help="apply plan.json and write the final photos")
    r.add_argument("--work", required=True)
    r.add_argument(
        "--out", required=True, help="destination folder for the numbered JPEGs"
    )
    args = ap.parse_args()
    analyze(args) if args.cmd == "analyze" else render(args)


if __name__ == "__main__":
    main()
