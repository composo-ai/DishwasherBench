# Writes build/clips.js: where the clips are and how many frames each has (and any item tracks).
#   python3 manifest.py [<clips directory>]      (default: .spotless/video/clips at the repository root)
import os, json, glob, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
C = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(os.environ.get('SPOTLESS_VIDEO_CLIPS', REPO / '.spotless/video/clips')).resolve()
counts, tracks = {}, {}
for d in sorted(os.listdir(C)):
    if not (C / d).is_dir(): continue
    counts[d] = len(glob.glob(f'{C}/{d}/*.jpg'))
    m = C / d / 'meta.json'
    if m.exists():
        t = json.load(open(m)).get('tracks')
        if t: tracks[d] = t
(HERE / 'build').mkdir(exist_ok=True)
(HERE / 'build/clips.js').write_text('export const CLIPS_URL = ' + json.dumps(C.as_uri() + '/') + ';\nexport default ' + json.dumps(counts) + ';\nexport const TRACKS = ' + json.dumps(tracks) + ';\n')
print(counts)
