# Pre-renders the photographic stills of the video (EXIF-rotated, cropped, scaled).
from PIL import Image, ImageOps
from pathlib import Path
HERE = Path(__file__).resolve().parent
R = str(HERE.parents[3]) + '/'
A = str(HERE / 'build/assets') + '/'
Path(A).mkdir(parents=True, exist_ok=True)

def crop(path, box, out, scale_w=1080):
    im = ImageOps.exif_transpose(Image.open(R + path)).convert('RGB')
    x, y, w, h = box
    c = im.crop((x, y, x + w, y + h))
    W = scale_w; H = round(h * W / w)
    c = c.resize((W, H), Image.LANCZOS)
    c.save(A + out, quality=95)
    return c

# 'One real dishwasher': the tape measure in the real tub (displayed coordinates), with headroom
# for the push-in.
crop('docs/reference/owner-photos/IMG_9109.JPG', (1900, 2580, 2384, 2980), 'tape.jpg', 1188)

# 'One real test wash so far': an egg-yolk plate before and after the real wash. The crops leave
# out the plates' lettering.
crop('docs/reference/calibration_runs/2026-10-10_egg_plates/IMG_9121.JPG', (840, 1400, 1400, 1750), 'egg-before.jpg', 1134)
crop('docs/reference/calibration_runs/2026-10-10_egg_plates/IMG_9127.JPG', (760, 880, 1760, 2200), 'egg-after.jpg', 1134)
print('ok')
