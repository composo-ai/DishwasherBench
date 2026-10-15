# A demo video for social media

`dishwasherbench-linkedin.mp4` is a demo of DishwasherBench for posting on LinkedIn and the
like: 2 minutes 11 seconds, 1080 × 1350 (4:5), 30 fps, H.264 (BT.709) and AAC, −16 LUFS, 36.5 MB.
The text is burned in, because such feeds play video muted. `post.md` is text to post with it.

The video tells one story: the problem (a badly loaded machine), then three chapters named above
every caption (what we built; how it works: load it, wash it, score it; the AI test), then an
invitation to play. It says what was done and leaves the limits to the repository's README. It
is paced to be read: one new piece of text at a time, each on screen for at least 1.2 s plus
0.4 s a word (3 s at the least) before the next one comes. `timeline.js` reports any scene that
is too short for that.

## What is on screen, and where it comes from

Every shot of the game is the game itself: the page of `apps/web` and the game server, filmed in
headless Chromium. Loads were placed through the server's own actions, with its physics, and
the page was stepped one frame at a time, so the falls, the settling and the sliding baskets are
as the physics ran them. Nothing was drawn by hand. Footage plays at whole speeds (1x or 2x) or
held, and slow motion repeats frames; only the slow camera move over the dinner-party load is
blended between frames.

| On screen | Source |
|---|---|
| The bad and the good load of the same seven tutorial items | The placements of `apps/web/scripts/play-wash.ts`, sent to a new session each; every action was accepted. In the bad load the glass, placed upright, falls onto its side |
| The real machine, "photographed, measured… test-washed with egg yolk" | `docs/reference/owner-photos/IMG_9109.JPG`; the test wash of four egg-yolk plates, `docs/reference/calibration_runs/2026-10-10_egg_plates/IMG_9121.JPG` and `IMG_9127.JPG`, cropped so that the plates' lettering is out of frame |
| The dinner party, 49 of 62 pieces, under "rebuilt as DishwasherBench" | `packages/loader/loads/dinner-party-careful.json` (the scripted careful player) replayed into a session, with no difference in any state hash |
| Their washes ("Eco 50, quick simulation"): the mouth-up mug with 319 ml of water in it, not clean, 0 of 6 points; the same mug loaded mouth down, clean, 6 of 6; 14 and 34 of the 44 points the seven items are worth, the difference being the mug, the bowl and the glass | Washes of those two sessions at the quick-preview tier (the fast tier, which is not the scored result), run by the simulation for the video. Points and verdicts are those of `apps/web/screenshots/wash/verification.json`: in both loads the two plates and the cutlery score the same, and the 20 points between them are the three hollow pieces. The result hashes differ, as they may across machines (README, Requirements) |
| What a model asked to see, through 13 tools | `docs/benchmark/first-runs/course/astra-dinner-party/images/0091, 0052`; the thirteen tools are listed in the README, Run a model |
| The frying pan: the cutlery basket taken out, the reply `"blocked_by":["frying_pan_01"]`, the pan taken out | `sol-breakfast/images/0027, 0064` and `record.json` seq 25–27 and 64–67 |
| Two models, six games, no mug or bowl mouth up; both above the careful player on level 7 (260 and 274 against 250 of 367, one game each) | README, Results; `docs/benchmark/first-runs/course/README.md`. The picture is `sol-tutorial/images/0029`. The models are not named on screen and not ranked against each other |
| End card: v0.1.0, MIT, the disclaimer, the music | `CITATION.cff` and `LICENSE`; the page's own disclaimer (`apps/web/src/how-to.ts`); *The Budding of Consciousness* by Yoiyami, CC0 (`apps/web/public/audio/LICENSES.md`), started so that its two big entries fall on the cut to the test wash and on "The AI test" |

The washes for the video ran on Linux (Ubuntu 24.04, Node 22, x86-64) with WebGPU on Mesa's
software Vulkan driver (lavapipe), in 169 s and 150 s. The tutorial's careless reference load,
washed the same way, scored 58 of 64, as in the README.

## Making it again

It needs, besides the repository's own requirements: a Chrome or Chromium (named in
`SPOTLESS_CHROME`; without it, Google Chrome where macOS installs it), the fonts Inter, Inter
Display and DejaVu Sans Mono installed on the system, ffmpeg with libx264, Python 3 with Pillow,
and bash. The video is made in three steps from the root of the repository, the first two with
the game server running (`pnpm --filter @spotless/web play`).

```sh
docs/media/linkedin-demo/capture/capture-all.sh     # the clips, into .spotless/video/clips (about two hours)
docs/media/linkedin-demo/compose/make.sh            # the video, into compose/build/ (about ten minutes)
cp docs/media/linkedin-demo/compose/build/dishwasherbench-linkedin.mp4 docs/media/linkedin-demo/
```

The third step publishes it. The published file is pinned by its SHA-256 in `ALLOWED_UNINSPECTED`
of `scripts/check-hygiene.mjs`, so after replacing it run `pnpm hygiene`, which prints the line to
put there, and update the length and size above and in `docs/README.md`.

- `capture/` films the page. `lib.mjs` opens it on a session, takes over its clock and frame loop
  so that every captured frame is exactly 1/30 s of page time, hides the panels so that the 3D view
  fills the frame, and sets the camera; `play.mjs` places a load while filming it, then starts its
  wash; `shoot.mjs` films a session as it stands (an orbit, or an item turning in the "Look
  closely" inspector); `replay.mjs` replays a saved load; `wait-wash.mjs` waits for the washes.
  An action the server refuses stops the capture. `frame-test.mjs` prints the page's own camera
  views and shoots one frame for each trial framing given to it, for choosing a framing.
- `compose/` builds the video. `engine/` lays out every frame as a function of time in a page, and
  `render.mjs` photographs the frames in parallel and encodes them; `timeline.js` is the video,
  scene by scene; `prep.py` crops the photographs; `mix_audio.sh` mixes the music to the scene
  times of the timeline. `render.mjs --stills 1.5,40` writes single frames, and `sheets.py`
  lays them out in contact sheets for review.

The timeline names frames of the clips by number. A new capture can come out a few frames longer
or shorter where the server was slow to answer; each clip's `meta.json` says what every frame
shows, which is how to find the same moment again.
