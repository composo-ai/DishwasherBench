# Redactions in the reference photographs

The photographs under `owner-photos/`, `calibration_runs/2026-10-10_egg_plates/` and the
`IMG_9131-overlay-*.jpg` files under `machine-drawings/` are the owner's photographs of the
dishwasher, its parts and the test plates. They are published with the owner's permission under the
repository's MIT licence, for the measurements that were read from them and for the wash results
they record, and for nothing else.

Before publication:

- **All metadata was removed** from every photograph (camera, date, position and embedded previews).
  Only what a viewer needs to show the picture correctly remains: the orientation flag, the
  colour-sample position tag and the colour profile.
- **One photograph is withheld**: the picture of the rating plate, because it shows the machine's
  serial number. The model number, the type designation and the production code (FD) quoted in the
  research notes were read from that photograph; the serial number appears nowhere in this
  repository.
- **Parts of 26 photographs were covered**, as listed below.

## What was covered, and how

- **Bare skin** is pixelated wherever it shows: fingers, palms, backs of hands, wrists and forearms.
  The area is replaced by coarse blurred cells, so that the shape of the hand that holds the part
  stays readable and no detail of the skin does. The cells are 48 pixels across on most fingers
  and palms that lie against the subject of the photograph, and 256 pixels across on forearms,
  wrists, backs and edges of hands, a thumb nail, and wherever the skin carries a mark.
- **Three finger marks** in the dried film on one spray arm are pixelated in the same way.
- **A view through glass to the outside**, and a reflection in glass, is covered with flat grey.
- **A label or a printed slip** that has nothing to do with the measurements is covered with flat
  grey.

Each cover is a polygon drawn round the thing covered, and takes in every 16-pixel block of the
picture that the polygon touches. Where a hand lies against the subject, the border of the cover
runs along the subject's edge. In places a cover therefore takes up to one such block of the plain
edge of a spray arm, of the edge of a tape measure or of the shaft of the probe; in a few
photographs it takes part of the shaft or the handle end of the probe where a thumb or finger lay
over it, and in three it takes the ends of some millimetre ticks or part of a figure on a tape
measure beside a thumb, away from where the reading was taken. No nozzle, no tip of the probe or of
the drill and no moulded lettering is covered.

| File | What was covered | How |
| --- | --- | --- |
| `calibration_runs/2026-10-10_egg_plates/IMG_9120.JPG` | a label | flat grey |
| `owner-photos/2026-10-10-lower-basket-loaded-by-owner.jpg` | a view through glass | flat grey |
| `owner-photos/IMG_9080-front-view-lower-basket-pulled-out.jpg` | a view through glass | flat grey |
| `owner-photos/IMG_9083-upper-basket-from-above.jpg` | the contents of a bin beside the basket, with a printed slip | flat grey |
| `owner-photos/IMG_9086.JPG` | forearm, wrist, hand and fingers | pixelation |
| `owner-photos/IMG_9087.JPG` | forearm, hand and fingers; a view through glass | pixelation; flat grey |
| `owner-photos/IMG_9088.JPG` | forearm, wrist, hand and fingers; a view through glass | pixelation; flat grey |
| `owner-photos/IMG_9089.JPG` | forearm, wrist, hand and fingers; a view through glass | pixelation; flat grey |
| `owner-photos/IMG_9090.JPG` | forearm, wrist, hand and fingers; a view through glass | pixelation; flat grey |
| `owner-photos/IMG_9091.JPG` | forearm, wrist, hand and fingers; a view through glass | pixelation; flat grey |
| `owner-photos/IMG_9092.JPG` | forearm, wrist, hand and fingers | pixelation |
| `owner-photos/IMG_9093.JPG` | wrist, hand and thumb | pixelation |
| `owner-photos/IMG_9094.JPG` | palm, thumb and fingers | pixelation |
| `owner-photos/IMG_9095.JPG` | palm, thumb and fingers | pixelation |
| `owner-photos/IMG_9096.JPG` | palm, thumb and fingers | pixelation |
| `owner-photos/IMG_9098.JPG` | a pale band at the edge of the picture that may be glass, covered to be safe | flat grey |
| `owner-photos/IMG_9099.JPG` | palm, thumb and fingers; a small sticker | pixelation; flat grey |
| `owner-photos/IMG_9102.JPG` | finger marks in the dried film on the spray arm | pixelation |
| `owner-photos/IMG_9104.JPG` | a view through glass | flat grey |
| `owner-photos/IMG_9105.JPG` | a view through glass | flat grey |
| `owner-photos/IMG_9108.JPG` | forearm, wrist, palm, thumb and fingers; a small skin-coloured shape in the background, covered to be safe; a view through glass | pixelation; flat grey |
| `owner-photos/IMG_9109.JPG` | back of the hand and thumb; a line of factory-printed characters | pixelation; flat grey |
| `owner-photos/IMG_9110.JPG` | forearm, wrist, hand, thumb and fingers | pixelation |
| `owner-photos/IMG_9111.JPG` | forearm, wrist, hand, thumb and fingers; a reflection in glass | pixelation; flat grey |
| `owner-photos/IMG_9112.JPG` | palm and fingers | pixelation |
| `owner-photos/IMG_9131.JPG` | a printed label on a bag behind the basket | flat grey |

The redaction was made on the JPEG data directly, in whole 16-pixel blocks, without decoding and
re-encoding the picture. In the files listed, every block outside the covers holds exactly the data
of the owner's file, so every other pixel is as the camera recorded it; every photograph not listed
is untouched apart from its metadata. No photograph was cropped, resized or retouched for
publication, so pixel coordinates quoted elsewhere in the documentation still apply.

## What was left in view

- Retail labels on two tool cases behind the basket in `owner-photos/IMG_9131.JPG`, and in the
  drawings made from it, are out of focus and cannot be read; they were left.
- The four `IMG_9131-overlay-*.jpg` drawings are parts of `IMG_9131.JPG`, at reduced resolution,
  with the model's outline drawn over them. The label on the bag, which is covered in the
  photograph, is not covered in the `-right` and `-whole` drawings, because the drawn outline
  crosses it; it is out of focus there.
- Labels of household products at the edge of two photographs: a cable tag and a spray bottle in
  `calibration_runs/2026-10-10_egg_plates/IMG_9120.JPG`, and a bottle in a bin beside the machine
  in `owner-photos/IMG_9080-front-view-lower-basket-pulled-out.jpg`.
- Other smears and touch marks in the dried film on the spray arms.
- In a few photographs the outline of a finger nail shows as a patch inside the pixelation.
- Small reflections of a window in steel and glass tableware, which show no view.
- Loose hairs at the edge of a forearm lie outside the cover in a few photographs.

One generated picture contains a reduced copy of a photograph:
`packages/loader/loads/owner-2026-10-10-beside-photo.png` shows
`owner-photos/2026-10-10-lower-basket-loaded-by-owner.jpg` in its left panel. The same area is
covered there with the same flat grey.

If you see something in these photographs that you think should not be public, please write to
support@composo.ai rather than opening a public issue.
