import sys, glob
from PIL import Image, ImageDraw
d, prefix = sys.argv[1], sys.argv[2]
files = sorted(glob.glob(d + '/t*.png'))
per, cols, w, h = 8, 4, 405, 506
for k in range(0, len(files), per):
    chunk = files[k:k + per]
    sheet = Image.new('RGB', (cols * w + (cols - 1) * 6, 2 * h + 6), 'white')
    dr = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        x, y = (i % cols) * (w + 6), (i // cols) * (h + 6)
        sheet.paste(Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS), (x, y))
        dr.rectangle((x, y, x + 70, y + 18), fill='black'); dr.text((x + 4, y + 3), f.split('/t')[-1][:-4], fill='white')
    out = f'{prefix}-{k // per + 1}.jpg'
    sheet.save(out, quality=90); print(out)
