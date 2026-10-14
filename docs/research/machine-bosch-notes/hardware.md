# Bosch SMV4HAX40G/13: hardware, geometry and hydraulics (research notes)

Researcher angle: hardware, geometry and hydraulics. Date of research: 2026-10-08.
Machine: Bosch Serie 4 fully integrated 60 cm dishwasher, E-Nr. SMV4HAX40G/13, FD 0106, type SD6PW1B, 220-240 V, 2000-2400 W (owner's rating plate, IMG_9079).
Purpose: replace the generic SPOT-60 estimates of `docs/research/machine.md` (sections 2, 3, 4, 5 and the data block 12.1) with facts about this machine, in the same parametric form.

## 0. How to read these notes

### 0.1 Tags

Every quantitative value carries exactly one tag.

- [VERIFIED]: seen this session in the text of a fetched source, or measured this session from a fetched image. The source is named. Where the page was downloaded by the earlier (interrupted) attempt on the same day and read from the saved copy, the tag is still [VERIFIED] and the saved file is named in section 15.
- [RECALLED]: from memory, source not opened.
- [ESTIMATED]: my derivation; the derivation and the likely error are given.

"Sister" means the figure comes from another BSH part or model of the same platform; the part or model is named.

### 0.2 The single most useful finding about sources

The installation instructions shipped for this exact E-Nr. are headed "GV 640 Voll-I - 81,5 cm - k. SW 9001594147" [VERIFIED: text of 9001594147_C, the installation instruction listed for SMV4HAX40G/13]. BSH therefore treats this machine as a member of its GV640 platform, and the spare-parts list confirms it: the sump, water switch, lower spray arm, filters, heat exchanger and softener carry the part numbers used on GV640 machines since about 2009. Service documentation for the GV640 platform therefore applies to the hydraulics of this machine. The best such document that is openly reachable is the Küppersbusch service manual H7-71-07 "Einbau-Geschirrspülautomaten Baureihe 640" (125 pages, 13.10.2010), which states that it describes "die Funktionsweise der Geräteserie GV 640" and is compiled from BSH repair instructions (58300000149122 and others) [VERIFIED: pages 2 and 8 of that manual]. Küppersbusch sold BSH-built GV640 machines; the parts retailer cross-references almost every part of the owner's machine to a Küppersbusch number (for example lower spray arm 00668148 = Küppersbusch 436713). Caveat: that manual is from 2010 and the owner's machine was built in 2021 (FD 0106). Parts that are unchanged (same part number) can be taken as described; control behaviour may have changed.

### 0.3 Coordinate frame (same as machine.md)

Origin on the lower spray arm axis at tub floor level; x to the right seen from the front, y to the back, z up. "Floor level" here is the top surface of the flat filter and sump cover, the lowest part of the floor.

### 0.4 What I measured from images

Dimensions scaled from photographs are given with the reference dimension and an error. The crops, gridded zooms and rendered pages of the service manual that I relied on are working files, not in the repository.

### 0.5 Cross-links to the other researchers

- Photographs: the scale references in section 2.1, the nozzle counts and radii in sections 5.2 and 5.3 and the floor layout in section 2.2 are meant to be checked against the owner's pictures. A warning from my own quick attempt: in IMG_9080 the handle of the upper basket (listed as 215 mm long) gives 0.162 mm per original pixel at the front plane; with that scale the wire body of the upper basket reads about 478 mm at its front rim and the gap between the front frame edges only about 500 mm [ESTIMATED, +/- 15 mm]. A 500 mm opening cannot be right, because the lower basket is 525 mm wide over its wheels (four sister baskets, section 3) and rolls out through it. Either the edges I picked are not the frame or the handle is longer than listed, so the handle should not be used as a scale without checking it, and the interior width of 545 mm in section 2.1 rests on the basket widths, not on a photograph.
- Programme: sections 6.1 to 6.3 hold what the platform service manual says about filling, the stored final-rinse water, the heating rate, the AquaSensor's active phases and the service test programme; section 6.3 lists the water figures of every programme of this model.
- Chemistry and dosing: rinse aid is dosed in 1 ml pulses (factory setting 5), the detergent chamber is marked 15 / 25 / 50 ml, and the softener regenerates every 6 cycles at the factory setting.

## 1. Identity, platform and bill of materials

| Item | Value | Tag and source |
|---|---|---|
| Platform | BSH "GV 640", fully integrated ("Voll-I"), 81.5 cm | [VERIFIED] header of installation instructions 9001594147_C |
| Outer dimensions H x W x D | 815 x 598 x 550 mm; niche 815-875 x 600 x 550; depth with door open 1150 mm | [VERIFIED] UK spec sheet SMV4HAX40G |
| Carcass depth without door / inner door zone / door front | 515.5 mm / 519.9 to 550.4 mm / 573.4 mm with furniture panel; inner door spans 165.5 to 803.5 mm above the floor and 4.5 to 593.5 mm across | [VERIFIED] vertex coordinates of BSH's kitchen-planning model SMV4HAX40G.obj (exterior only; no interior geometry in the model) |
| Net / gross weight | 33.9 kg / 36.0 kg | [VERIFIED] UK spec sheet |
| Capacity | 13 place settings | [VERIFIED] UK spec sheet, user manual p. 48 |
| Connection rating | 2400 W, fuse 10 A (spec sheet); 2000-2400 W, 10-16 A (rating plate, manual) | [VERIFIED] spec sheet; manual p. 48; IMG_9079 |
| Basket system | "Flex basket system"; 3-stage Rackmatic top basket; 2 foldable plate racks in top basket; 2 foldable plate racks in bottom basket; knife rack in top basket; moveable cutlery basket in lower rack; upper rack cup shelf; low-friction wheels and rack stopper on bottom basket | [VERIFIED] UK spec sheet |
| Technology list | Heat exchanger; DosageAssist; EcoSilence BLDC drive; AquaSensor III; "self-cleaning filter system with 3 piece corrugated filter"; "Large item spray head"; stainless steel interior | [VERIFIED] UK spec sheet |
| Tub / base material | "Innenbehälter/ Boden: Edelstahl/Edelstahl" | [VERIFIED] German spec sheet of sister SMV4HAX48E (same hardware, German market) |

Spare-parts list for E-Nr. SMV4HAX40G/13 (bosch-home.co.uk; position numbers refer to the BSH exploded diagrams listed in the sources). All [VERIFIED] from the saved parts list and part pages.

| Pos. | Part no. (current) | BSH name | Notes |
|---|---|---|---|
| 0201 | 00755073 | Dispenser | detergent + rinse aid combination |
| 0203 | 00611574 | Sensor | optical rinse-aid level sensor |
| 0210 | 00680311 | Door-inner | stainless inner door |
| 0220 | 00630627 | Door sensor | |
| 0301 | 00984444 | Stainless steel container | the tub |
| 0320 | 00263096 | Seal-door | three-sided tub seal |
| 0345 | 00668097 | Rack guide rail | upper basket rails, left and right |
| 0410 | 00668102 | Sump | |
| 0411 | 00611320 | Valve-non return | in the sump drain outlet |
| 0413 / 0414 | 00611321 / 00611322 | Cover / Lid | suction cap of circulation pump / drain pump cover |
| 0415 | 00611323 | Sensor | AquaSensor (turbidity) |
| 0420 | 00668104 | Hose | sump to heat exchanger, 580 mm |
| 0430 / 0431 | 00644996 / 00611329 | Altern. water distributor / Water switch motor | the diverter |
| 0440 | 12038407 (was 00645036) | Cover | perforated sump cover behind the flat filter |
| 0441 | 00645037 | Filter-fine | flat stainless filter |
| 0442 | 00645038 | Filter-micro | coarse filter + corrugated micro filter cylinder |
| 0450 | 12014980 | Heat pump | circulation pump with integrated heater |
| 0455 | 00631200 | Pump-drain | |
| 0460 | 11003118 | Tube | rear feed pipe, two channels |
| 0461 | 00611388 | Shower | roof spinner |
| 0465 | 00668148 | Spray arm bottom | |
| 0470 | 11010054 (replaces 11003122) | Spray arm top | with feed tube and docking piece |
| 0480 | 00612114 | Spray head | baking-sheet spray head (accessory) |
| 0500 | 00770952 | Heat exchanger | side water tank with inlet path |
| 0503 | 11033896 (was 00631199) | Valve-outlet | heat exchanger outlet valve |
| 0504 | 00611317 | Flow-through sensor | impeller + reed |
| 0510 / 0513 | 00668113 / 00645701 | Aquastop / Valve-aquastop | |
| 0520 | 00668114 | Outlet hose | |
| 0530 | 12026873 (was 12023297) | Water softener | |
| 0531 | 10007258 | Sensor | salt level |
| 0534 | 00611916 | Valve-regeneration | |
| 0615 / 0616 | 00622035 / 00622036 | Float switch / Float | base-pan safety system |
| 0660 | 12034731 | Power module programmed | |
| 0710, 0810 | 12033368 | Basket handle | same part on both baskets |
| 0720 | 20007406 (was 20001979) | Lower crockery basket | |
| 0721 / 0722 | 10014039 / 10014040 | Wheel | stopper wheel / plain wheel |
| 0741, 0743 | 10014124 | Bearing plate | bearings of folding tine rows |
| 0750 | 12033326 | Flip tine | lower basket folding row |
| 0770 | 11057829 (was 00668270) | Cutlery basket | |
| 0820 | 20001992 (was 20001986) | Upper crockery basket | |
| 0852 / 0853 | 12033302 / 12033291 | Flip tine | upper basket folding rows |
| 0860 / 0861 | 12005549 / 12005548 | Cup rack | short / long cup shelf |
| 0862 | 11037806 | Insert | knife rack |

There is no third rack (cutlery drawer) and no zeolite container in this bill of materials; drying is by the side heat exchanger only.

## 2. Tub, door, dispenser, heat exchanger, roof

### 2.1 Tub interior dimensions: not published; best estimates

No BSH document, retailer page or patent that I opened states the interior width, depth or height. The values below are derived, and all three are on the owner's measurement list (section 14, item 3).

| Quantity | Estimate | Tag, derivation, error |
|---|---|---|
| Interior width | 545 mm | [ESTIMATED] sister lower baskets measure 515 to 528 mm in plan over their wheels (section 3) and need about 10 to 15 mm clearance per side; sister upper baskets are 515 to 520 mm over their roller plates and run on rails fixed to the side walls; lower spray arm span is 460 mm; inner door part is 575 mm wide over its flanges. Error about +/- 10 mm, and see section 0.5 for a photograph that does not confirm it. Fallback machine.md: 546. |
| Interior depth, rear wall to front flange plane | 500 mm | [ESTIMATED] carcass depth without door is 515.5 mm in BSH's planning model; subtract rear wall build-up. Error +/- 15 mm. Fallback machine.md: 500. |
| Extra depth in the recess of the inner door | about 35 mm | [ESTIMATED] the inner door pressing is 55 mm deep overall (retailer listing: "Höhe 55 mm, Tiefe 55 mm"); sister lower baskets are 525 mm deep and must fit between rear wall and door. Error +/- 10 mm. |
| Opening height, sill to roof | 625 mm | [ESTIMATED] inner door part length 625 mm; inner door 638 mm high in the planning model; three-sided tub seal 1800 mm long = 2 x height + width, giving about 622 mm for a 555 mm wide seal line. Error +/- 10 mm. |
| Height, floor at the sump to roof | 665 mm | [ESTIMATED] the rear feed pipe is 680 mm long from the ends of its floor stubs to the top of its roof run, and its side view in BSH's photograph is to scale (2427 px for 680 mm, 988 px for the listed 275 mm); the stubs reach roughly 10 to 25 mm below floor level. Cross-check with the manual's basket table in section 10. Error +/- 15 mm. Fallback machine.md: 650. |
| Arm axis to rear wall | 255 mm | [ESTIMATED] floor foot of the feed pipe is about 220 mm long in the scaled side view and its stubs sit about 25 to 45 mm behind the arm axis in the sump cover; the upper-arm feed tube is 270 mm long. The two routes give 230 to 255 mm and 275 to 305 mm, so +/- 25 mm. |
| Floor shape | Stainless pressing with a recessed central field around the sump, raised side ledges for the basket wheels, salt cap at front left, pressed ribs in the side walls | [VERIFIED] owner's IMG_9082 and IMG_9080 (qualitative) |
| Floor slope | not found | fallback machine.md 4 degrees |

Scale references that the photo-measuring researcher can use, all published: lower spray arm 460 mm tip to tip; flat filter 260 x 130 mm with a 54 mm opening; sump cover 259 x 95 mm; salt cap 90 x 92 mm; basket handle 215 x 52 x 47 mm; cutlery basket 230 mm long; wheels 35 mm; upper spray arm 460 mm; knife rack 389 x 119 mm (sources in sections 3 to 7).

### 2.2 Sump and filter position

| Quantity | Value | Tag and source |
|---|---|---|
| Sump | plastic "Pumpentopf" 00668102 set from below into a circular opening of the tub floor, fixed with 4 screws from inside, sealed by a ring | [VERIFIED] Küppersbusch manual p. 73-74 |
| Attachments on the sump | drain pump; connection of lower spray arm; connection of feed pipe for roof spinner; connection of feed pipe for upper spray arm; water switch with motor and pulse generator; heat pump; AquaSensor; drain pump cover; suction cap; non-return flap in the drain outlet | [VERIFIED] Küppersbusch manual p. 73 |
| Sump top flange diameter | about 200 mm | [ESTIMATED] from BSH's photo of 00668102, scaled against the 70 mm drain pump socket; +/- 25 mm |
| Layout on the floor | perforated plastic cover at the rear (arc edge to the rear, straight edge to the front), flat stainless filter in front of it, filter cylinder in the middle of the flat filter, lower arm axis through the large hole of the cover | [VERIFIED] owner's IMG_9082; BSH photos of 12038407 and 00645037; Küppersbusch manual p. 72 figure |
| Lower arm axis to straight (front) edge of the cover | about 25 mm | [ESTIMATED] 27 mm from the position of the 30 mm hole in BSH's top view of the cover (cover depth 95 mm); about 18 mm from the stem and filter edge in the owner's IMG_9082 with an assumed camera elevation of 40 degrees; +/- 8 mm |
| Filter cylinder axis | x about 0, y about -90 mm | [ESTIMATED] 25 mm + half of the 130 mm flat filter; the opening is centred in the flat filter in BSH's photo; +/- 12 mm. machine.md had (0, -40). |
| Flat filter footprint | x -130 to +130, y -155 to -25 mm; sump cover behind it from y -25 to about +70 mm | [ESTIMATED] from the two rows above |
| Salt cap | front left of the filter; cap 90 x 92 x 19 mm; centre very roughly x -190, y -110 mm | cap size [VERIFIED] retailer listing 00611319; position [ESTIMATED] from IMG_9082, +/- 30 mm |

### 2.3 Inner door and detergent dispenser

| Quantity | Value | Tag and source |
|---|---|---|
| Inner door 00680311 | stainless steel, 625 x 575 x 55 mm, 2903 g, "für 81 cm Gerät" | [VERIFIED] ersatzteilshop.de listing; Bosch DE shop |
| Shape | deep rectangular recess over most of the height; two raised blocks at the top left and right; dispenser cut-out between them | [VERIFIED] BSH photo MCSA00955943 |
| Dispenser position | "in der Mitte der Türe an der Türoberseite" | [VERIFIED] Küppersbusch manual p. 82 |
| Dispenser cut-out | about 133 mm wide x 90 mm high, centre about 138 mm below the top edge of the inner door, on the door centreline | [ESTIMATED] scaled from BSH photo of 00680311 against 575 x 625 mm; +/- 10 mm |
| Dispenser centre in the tub frame | x 0, door plane, z about 515 mm | [ESTIMATED] 625 - 138 = 487 mm above the lower edge of the inner door, lower edge about 20 to 40 mm above floor level; +/- 25 mm |
| Dispenser unit 00755073 | 120 x 105 x 65 mm, 217 g; detergent chamber on the left with level marks, rinse-aid reservoir on the right | [VERIFIED] Bosch DE shop "Maße: 120 x 105 x 65 mm"; ersatzteilshop.de; BSH photo |
| Detergent chamber marks | 15 ml, 25 ml, 50 ml | [VERIFIED] quick reference guide 9001643502 |
| Lid | a flat spring-loaded cover that slides in the plane of the door; in the manual's drawing (door open, seen from the door's top edge) the open lid is parked on the near side and the chamber lies beyond it, so with the door closed the lid slides upwards and uncovers a chamber that faces into the tub; released by a coil via a lever, "springt auf" | [VERIFIED] user manual p. 27 drawing; BSH photo of 00755073; Küppersbusch manual p. 79 |
| Left / right | detergent chamber on the left part of the unit, rinse-aid reservoir on the right, seen from the front of the machine; chamber centre about 20 mm left of the door centreline | layout [VERIFIED] user manual p. 12 and p. 27 drawings; offset [ESTIMATED] from the 120 mm wide unit, +/- 10 mm |
| Coil | pulse voltage 195-254 V, 11 kOhm +/- 1.5 kOhm | [VERIFIED] Küppersbusch manual p. 80 |
| Tablet path | "Tabs fallen in die Griffschale (Dosierassistent)"; the upper spray arm sprays the tray "gezielt von unten" | [VERIFIED] Küppersbusch manual p. 79, 82; user manual p. 28 |
| Rinse aid | reservoir 80 ml; 1 ml per coil pulse; the setting (factory r05) is the number of pulses | [VERIFIED] Küppersbusch manual p. 80; user manual p. 25 |
| Tablet collecting tray | the basket handle of the upper basket, part 12033368, 215 x 52 x 47 mm, 77 g | [VERIFIED] ersatzteilshop.de listing; user manual p. 13 |

Consequence for the model: the SPOT-60 "lid swing 110 degrees, keep-out depth 62 mm" does not apply. The lid slides, nothing swings into the load, and the release test becomes "is the path from the dispenser mouth down into the handle tray of the upper basket free, and is the tray empty".

### 2.4 Heat exchanger and other fittings on the side wall

| Quantity | Value | Tag and source |
|---|---|---|
| Part 00770952 | transparent plastic tank on the outside of the left side wall, 670 x 435 x 42 mm, 1246 g | [VERIFIED] Bosch DE shop; ersatzteilshop.de; Küppersbusch manual ("Seitenwand links demontiert") |
| Stored volume | "Wärmetauscher voll (enthält 3,1 l Wasser)"; "(2,5 l von 3,1 l Füllmenge)" expected for the final rinse | [VERIFIED] Küppersbusch manual p. 120 and p. 92 |
| BSH patent example | tank about 2 cm thick, 40 to 50 cm high and deep, "Behältervolumen von beispielsweise 3 bis 4 l" | [VERIFIED] DE102009026876A1 |
| Functions inside the tank moulding | inlet channel with flow sensor and "freie Fliessstrecke" (air gap), storage chamber, drain channel with float-operated vent, expansion opening to the tub, outlet valve at the bottom | [VERIFIED] Küppersbusch manual p. 90, 104, 107-109 |
| Fittings through the left tub wall | water inlet nozzle with splash cap and the expansion (steam) opening with screw cap | [VERIFIED] Küppersbusch manual p. 105-106 |
| Thermal contact | the tank lies against the tub wall; three latches; poor contact reduces condensation area | [VERIFIED] Küppersbusch manual p. 116 |

### 2.5 Roof

The roof carries the forward run of the feed pipe and the roof spinner at its end (section 5.4). There is no third arm and no cutlery drawer. Roof spinner centre about 250 mm in front of the rear wall [ESTIMATED: the roof run of the pipe is 275 mm long in the listing and 277 mm in the scaled photo, less half the 52 mm spinner; +/- 15 mm].

## 3. Lower basket and cutlery basket

### 3.1 What is published

The original basket of this machine is 20001979; BSH now supplies 20007406 in its place. Neither BSH's shop pages nor the retailer give dimensions for either number [VERIFIED: pages opened, no dimension fields]. The retailer titles 20007406 "Unterkorb silber, 6 Klappstacheln", which does not match this machine (2 folding rows), so the replacement part is not a reliable picture of the owner's basket.

| Quantity | Value | Tag and source |
|---|---|---|
| Outer size, sister lower basket 20002434 | 525 x 520 x 145 mm, 1942 g. The retailer states its convention for this listing: 525 = article width, 520 = article depth, 145 = article height | [VERIFIED] Bosch DE and Neff DE shop pages ("Länge: 525 mm, Breite: 520 mm, Höhe: 145 mm"); ersatzteilshop.de listing of 20002434 |
| Outer size, sister 20002125 | 528 x 520 x 140 mm, 1760 g | [VERIFIED] Bosch DE shop page; ersatzteilshop.de |
| Outer size, sister 20006942 (with 4 folding rows, sold with cutlery basket 11057829) | 528 x 515 x 210 mm, basket only; 2300 g | [VERIFIED] ersatzteilshop.de listing of 20006942 |
| Outer size, sister 20003053 (6 folding rows, glass bar, cup shelves, "8 Korbrollen") | 525 x 515 x 190 mm, 2443 g | [VERIFIED] Bosch DE shop page; ersatzteilshop.de |
| Adopted outer size for this machine | about 525 wide x 520 deep x 145 mm high (frame without accessories); mass about 1.8 to 2.0 kg | [ESTIMATED] the four sister baskets agree within 13 mm in plan; which figure is width and which is depth is stated only for 20002434; +/- 8 mm |
| Folding tine rows | 2 (part 12033326 twice), hinged in bearing plates 10014124 (80 x 57 x 17 mm, 12 g) with clips 10014092 and 10014119; these are the two rear rows in the owner's IMG_9081 | [VERIFIED] exploded diagram aet 007; spec sheet "2 foldable plate racks in bottom basket"; owner's photo |
| Fold mechanism | push the lever forwards and fold the prongs down; they click back up | [VERIFIED] user manual p. 20 |
| Wheels | plain wheel 10014040: 35 x 35 x 25 mm, 7 g; stopper wheel with holder 10014039: 38 x 35 x 22 mm, 9 g; wheel diameter 35 mm, thickness 8 mm on sister upper basket 00778368 | [VERIFIED] ersatzteilshop.de; Bosch DE shop |
| Number of wheels | 8 | [ESTIMATED] the exploded diagram shows 4 positions on one side (3 x 0722, 1 x 0721); sister basket 20003053 is listed with "8 Korbrollen" [VERIFIED for the sister] |
| Handle | 12033368, 215 x 52 x 47 mm | [VERIFIED] ersatzteilshop.de |
| Largest plate | 31 cm "as shown" (30 cm otherwise) with the top basket at level 1 | [VERIFIED] user manual p. 19, 21 |
| Wire diameters, base grid pitch, tine pitch, tine height, lean | not published | fallback machine.md: rim 5.0, grid 3.4, tine 3.4 mm, coating 0.4 mm, tine pitch 25 mm, height 62 to 75 mm, lean 8 degrees. Owner measurement, section 14 item 4. |

### 3.2 Cutlery basket

| Quantity | Value | Tag and source |
|---|---|---|
| Part | 11057829 (was 00668270), accessory reference SMZ5100 / SZ73100 / Z7863X0 | [VERIFIED] Bosch DE shop |
| Size | article width 230 mm, article depth 128 mm, article height 220 mm (with handle); 338 g; grey plastic; two hinged lid grids | [VERIFIED] ersatzteilshop.de listing of 11057829 (the listing explains which figure is which) |
| Size, second listing | "Maße Besteckkorb: 231 x 210 x 158 mm" for the same basket 11057829 | [VERIFIED] ersatzteilshop.de listing of lower basket 20006942; conflict in the third figure (128 against 158 mm), see section 12. In the owner's IMG_9081 the plan aspect is about 1.6, i.e. about 143 mm for a 230 mm length [ESTIMATED], between the two |
| Compartments | "sechs Besteckfächern" on the spare-part page; "sieben Besteckfächern" on the accessory page SMZ5100 | [VERIFIED] both Bosch DE pages; conflict, see section 12 |
| Where it sits | "Stellen Sie den Besteckkorb auf das Gitter der unteren Geschirrkörbe"; can also stand on folded tine rows; in the owner's photos it stands at the front centre | [VERIFIED] Bosch DE shop; IMG_9080, IMG_9081 |
| Loading rule | cutlery unsorted, points down | [VERIFIED] user manual p. 20 |

machine.md assumed 240 x 135 x 215 mm with 7 cells. The published length (230 mm) and height with handle (210 to 220 mm) are firm; the depth is 128 or 158 mm depending on the listing and should be measured.

## 4. Upper basket, Rackmatic, inserts, tablet tray, docking

| Quantity | Value | Tag and source |
|---|---|---|
| Part | 20001992 (was 20001986); no dimensions published for either | [VERIFIED] pages opened |
| Outer size, sister 00778368 "Geschirrkorb oben mit RackMatic" | 527 x 515 x 162 mm, 2364 g; wheel diameter 35 mm, wheel thickness 8 mm | [VERIFIED] Bosch DE shop; ersatzteilshop.de |
| Outer size, sister 20000272 | 520 (article width) x 520 (article depth) x 185 mm, 2316 g | [VERIFIED] Bosch DE shop ("Maße: 520 x 520 x 185 mm"); ersatzteilshop.de |
| Outer size, sister 00770441 | 525 x 475 x 190 mm (width apparently without the roller plates) | [VERIFIED] Bosch DE shop |
| Adopted | about 520 wide over the roller plates x 520 to 527 deep x about 165 mm high; wire body about 480 mm wide; mass about 2.3 kg | [ESTIMATED] from the sister values; +/- 8 mm |
| Rackmatic | 3 positions, total travel "bis zu 5 cm", side levers, adjustable when loaded | [VERIFIED] Bosch DE shop text for 00770441 / 00778368; user manual p. 18-19 |
| Level table | level 1: top basket max 22 cm, bottom basket 30/31 cm; level 2: 24.5 / 27.5 cm; level 3: 27 / 25 cm ("appliance height 81.5 cm with cutlery basket") | [VERIFIED] user manual p. 21 |
| Step between levels | 25 mm | [VERIFIED] differences in the manual's table; the scaled photo of the docking ports gives 26.7 mm (section 5.3) |
| Mechanism | metal Rackmatic plates pressed into the basket sides, three rollers visible per side in BSH's photo of 20001992, dark release lever; the basket can also be set tilted left or right | [VERIFIED] BSH photo 22207763; Küppersbusch manual p. 44 |
| Guide rails | 00668097, 460 mm long, 51 x 16 mm section, left and right | [VERIFIED] ersatzteilshop.de |
| Folding tine rows | 2: 12033302 (insert 200 x 91 x 32 mm, 48 g) and 12033291 | [VERIFIED] ersatzteilshop.de; exploded diagram aet 008 (drawn with 5 and 6 tines) |
| Cup shelves | long 12005548: 252 x 97 x 22 mm; short 12005549: 200 x 100 x 18 mm, 43 g; both fold; the sister spec sheet calls them "Tassenablage im Oberkorb (2-teilig)" | [VERIFIED] ersatzteilshop.de; SMV4HAX48E spec sheet |
| Knife rack | 11037806, 389 x 119 x 57 mm, 150 g, grey plastic, on the left side in the owner's IMG_9083 | [VERIFIED] ersatzteilshop.de; owner's photo |
| Tablet tray | the handle 12033368 at the front centre (215 x 52 x 47 mm) | [VERIFIED] section 2.3 |
| Upper spray arm attachment | arm and its 270 mm feed tube are clipped under the basket by two hooks on the tube; the tube runs from a docking piece at the rear to an elbow above the arm hub; the arm hangs below the tube and is unscrewed downwards | [VERIFIED] BSH photos of 11010054; owner's IMG_9083; user manual p. 39 |
| Wire diameters, grid pitch, tine pitch and height | not published | fallback machine.md: grid 3.2, tine 3.0 mm, tine height 40, pitch 22 mm |

## 5. Spray system

### 5.1 Architecture

"Das Sprühsystem besteht aus 3 Sprühebenen: Dem unteren und oberen Sprüharm sowie einer Dachbrause." The upper arm and the roof spinner are fed through a pipe on the inside of the rear wall that "hat 2 getrennte Wasserkanäle. Dadurch kann der obere Sprüharm und die Dachbrause getrennt angesteuert werden." [VERIFIED: Küppersbusch manual p. 102]. The owner's parts confirm it: feed pipe 11003118 has two floor stubs (BSH photo MCSA02588576), and the sump cover has two sockets of different size next to the lower-arm hole.

### 5.2 Lower spray arm, part 00668148

| Quantity | Value | Tag and source |
|---|---|---|
| Span | 460 mm ("Sprüharmbreite: 460 mm"), so tip radius 230 mm | [VERIFIED] ersatzteilshop.de original-part listing |
| Overall height with stem | 75 mm; stem ("Rohrlänge") 60 mm on the pattern part | [VERIFIED] ersatzteilshop.de (original: 75 mm; pattern part 10110265: 463 x 78 x 58 mm, stem 60 mm) |
| Mass | 69 g (pattern part) | [VERIFIED] ersatzteilshop.de listing of 10110265 |
| Material | marked ">PP-TD20<" (polypropylene, 20 % talc) on the underside; also "9000.523.537" and a mould code | [VERIFIED] read from BSH photos MCSA091315 and MCSA01860097 |
| Planform | a shallow bow (both halves curve to the same side), wider at the hub, with a domed hub cap on top and a conical stem below | [VERIFIED] BSH photos; owner's IMG_9082 |
| Mounting | plugged with its bearing directly onto the sump; pulled up to remove; clicks in | [VERIFIED] Küppersbusch manual p. 102; user manual p. 39 |
| Stem / passage | passes through a hole of about 30 mm in the sump cover | [ESTIMATED] scaled from BSH top view of the cover (259 mm long); +/- 3 mm |
| Top-face openings | 10: six plain round nozzles with raised rims, one hooded round nozzle, one hooded slot, and a hooded slot at each tip | [VERIFIED] counted in BSH photos MCSA01860095 and 16260430, and again on the owner's arm in IMG_9082 (same count and pattern) |
| Underside | one nozzle in a rectangular boss near one tip | [VERIFIED] BSH photos MCSA091315, MCSA092356, MCSA01860096; "Er hat an der Unterseite eine Düse um das Flächensieb zu reinigen und Schmutz ins Siebsystem zu spülen" (Küppersbusch manual p. 102) |

Nozzle table (radius from the axis). Method: two independent photographs, each scaled with the 460 mm span. (a) BSH photo MCSA01860095: a one-dimensional projective fit along the arm calibrated by the two tip ends and by the ratio of the apparent tip widths. (b) The owner's IMG_9082, where the arm lies almost square to the camera: linear scaling of each half between hub centre and tip. All values [ESTIMATED]; the two photographs agree within 5 mm, so +/- 5 mm.

| Id | Half | r from photo (a) | r from photo (b) | Adopted r (mm) | Type |
|---|---|---|---|---|---|
| A1 | A | 42 | 46 | 44 | round, raised rim |
| A2 | A | 89 | 93 | 91 | round |
| A3 | A | 112 | 116 | 114 | round |
| A4 | A | 136 | 139 | 138 | round |
| A5 | A | 183 | 184 | 184 | round with a teardrop hood (inclined), looks larger |
| A6 | A | 227 | 222 | 225 | hooded slot at the tip |
| B1 | B | 70 | 66 | 68 | round |
| B2 | B | 160 | 157 | 158 | round |
| B3 | B | 205 | 203 | 204 | hooded slot ("chimney") |
| B4 | B | 228 | 225 | 226 | hooded slot at the tip |
| U1 | not determined | | | about 200 | underside nozzle in a rectangular boss; [ESTIMATED] +/- 10 mm from MCSA092356 |

Pattern: sorted together the radii are 44, 68, 91, 114, 138, 158, 184, 204, 226 mm, an almost constant step of 22.7 mm (fit r = 44.5 + 22.7 k, k = 0 to 8, residuals within 3.3 mm). The arm is evidently designed so that each ring of equal width gets one nozzle, with the two halves interleaved [ESTIMATED: my reading of the measured radii].

Nozzle sizes, all [ESTIMATED] from dark-blob sizes in the same photos (the blob includes shadow in the recess, so these are upper bounds; error +/- 0.7 mm): round bores about 3 mm; tip slots about 5 x 2 mm. Jet directions: A6 appears to tilt radially outward, B3 and B4 tilt sideways (tangentially) and are the obvious drive nozzles; A5 and the underside nozzle are also inclined. I could not determine the angles. Rotation sense: from the tilt of B3 and B4 in photo 16260430 together with the orientation of the arm in IMG_9082 I get counter-clockwise seen from above, with low confidence [ESTIMATED]. Rotation speed: not found (fallback machine.md: 35 rpm by torque balance).

Derived checks, [ESTIMATED]: total top-face nozzle area about 89 mm2; with a discharge coefficient of 0.8 this passes 27, 33 and 38 L/min at 20, 30 and 40 kPa. Moment of inertia about 1.0e-3 kg m2 dry (55 g over 460 mm) and about 4.4e-3 kg m2 full of water (assumed internal section 35 x 12 mm); machine.md used 6.3e-3.

### 5.3 Upper spray arm, part 11010054, and the rear feed pipe 11003118

| Quantity | Value | Tag and source |
|---|---|---|
| Arm span | 460 mm ("Breite: 460 mm", "Sprüharmbreite: 460 mm"), tip radius 230 mm | [VERIFIED] Bosch DE shop page for 11010054; ersatzteilshop.de |
| Feed tube length | 270 mm ("Rohrlänge: 270 mm") | [VERIFIED] Bosch DE shop; ersatzteilshop.de |
| Arm height | 30 mm; whole assembly 495 x 460 x 75 mm, 149 g | [VERIFIED] ersatzteilshop.de |
| Docking piece on the basket | five positions in a vertical row: one open inlet in the middle and two closing plugs above and below it, so that at each of the three Rackmatic heights the inlet meets one port of the rear pipe and the plugs close the other two | [VERIFIED] BSH photo MCSA01860196 (count and arrangement); the closing function is my reading |
| Rear pipe | 680 x 275 x 55 mm, 240 g, grey plastic, "Zurführrohr [sic] mit Dachbrause bzw. Deckendusche für 81,5 cm Geräte"; flat riser on the rear wall, forward run under the roof, forward foot on the floor ending in two stubs | [VERIFIED] ersatzteilshop.de; Bosch DE shop title; BSH photos |
| Docking ports on the pipe | 3 round ports in a vertical row, protruding about 13 mm | [VERIFIED] count in BSH photos; protrusion [ESTIMATED] 47 px at 0.28 mm/px |
| Port pitch | 26.7 mm from the scaled photo; 25 mm implied by the manual | [ESTIMATED] three ports over 286 px at 0.2802 mm/px; adopt 25 +/- 2 mm |
| Port heights | centres about 345, 371 and 398 mm above the lower ends of the floor stubs, i.e. about 335, 361 and 388 mm above floor level | [ESTIMATED] from the scaled side view; +/- 12 mm |
| Top-face openings of the arm | 7: on one half a small round nozzle near the hub, two rectangular slots and a hooded tip nozzle; on the other half two rectangular slots and a hooded tip slot | [VERIFIED] counted in BSH photo MCSA01860195 and on the owner's arm in IMG_9083 (the tip of one half is hidden by the knife rack there) |
| Underside | smooth except one small hole near the hub | [VERIFIED] BSH photo MCSA01860196 |

Nozzle radii, [ESTIMATED] from the owner's IMG_9083 (hub centre to visible tip = 230 mm, 5.17 px/mm) and checked against BSH photo MCSA01860195; +/- 8 mm:

| Id | Half | r (mm) | Type |
|---|---|---|---|
| C1 | 1 | 43 | small round, about 2 to 2.5 mm |
| C2 | 1 | 132 | rectangular slot |
| C3 | 1 | 162 | rectangular slot |
| C4 | 1 | 222 | hooded nozzle at the tip |
| D1 | 2 | 87 | rectangular slot |
| D2 | 2 | 188 | rectangular slot |
| D3 | 2 | 217 | hooded slot at the tip |

Slot openings about 5 x 1.5 to 2 mm [ESTIMATED from the owner's photo, +/- 0.5 mm in width]. Rotation speed and sense: not found.

### 5.4 Top level: roof spinner, part 00611388

| Quantity | Value | Tag and source |
|---|---|---|
| Type | a small free-spinning vaned rotor ("Dachkreisel") in a clip-on cage at the end of the roof run of the feed pipe; not a spray arm | [VERIFIED] BSH photos MCSA00748273, MCSA01886352; Küppersbusch manual p. 102-103 |
| Size | 52 x 53 mm, 21 mm high, 10 g, white plastic | [VERIFIED] ersatzteilshop.de (listing titled "Deckendusche BOSCH 00611388 53mmØ") |
| Vanes | 5 curved vanes | [VERIFIED] counted in BSH photo |
| Feed | its own channel in the feed pipe and its own outlet of the water switch | [VERIFIED] Küppersbusch manual p. 73, 102 |
| Orifice size, flow | not found | owner measurement |

### 5.5 Baking-sheet spray head, part 00612114

81 x 90 x 32 mm, 28 g; inserted into the docking holder in place of the upper basket and turned to lock; for at most 2 baking sheets and 2 grilles; "the appliance is always operated with the top basket or the baking sheet spray head" [VERIFIED: ersatzteilshop.de; user manual p. 21].

## 6. Hydraulics

### 6.1 Circulation pump with heater ("Heizpumpe"), part 12014980

| Quantity | Value | Tag and source |
|---|---|---|
| Markings | "1BS3610-6AA", "9001.180.504" (older) or "9001.537.623", "730.60015.01" or "730.60020.02", "Class F" | [VERIFIED] BSH photo MCSA02881573 (label read); ersatzteilshop.de |
| Size and ports | 135 x 90 x 90 mm; inlet 35 mm, outlet 29 mm; "Anschlüsse: 3 Stück" | [VERIFIED] ersatzteilshop.de; Bosch DE shop |
| Construction | heater, temperature sensors and pump in one housing; BLDC motor; impeller ("Pumpenrad") and guide wheel ("Leitrad") that "leitet das Wasser gleichmäßig am Heizrohr entlang"; discharge to the water switch | [VERIFIED] Küppersbusch manual p. 66-67 |
| Heater type | heating tracks on a specially coated metal tube with two NTCs integrated in the tracks | [VERIFIED] Küppersbusch manual p. 67 |
| Heater power | 2100 W ("Verrohrtes Heizelement (2100 W)") | [VERIFIED] Küppersbusch manual p. 8. Supporting: a replacement heater for this pump family is sold as "2080 W, 75 mm diameter, 45 mm high" (shop-wittlich.de) [VERIFIED] |
| Heater resistance at 25 C | contacts 2-3 about 10.5 Ohm, 3-4 about 10.5 Ohm, 2-4 about 21 +/- 2 Ohm | [VERIFIED] Küppersbusch manual p. 68; "rund 20 Ohm" on a repair site (diybook.de) [VERIFIED] |
| Consistency note | 21 Ohm cold is 2519 W at 230 V; 2100 W needs 25.2 Ohm, so the track resistance must rise by about 20 % when hot | [ESTIMATED] arithmetic on the two verified figures |
| NTCs | about 10 kOhm +/- 500 Ohm each at 25 C | [VERIFIED] Küppersbusch manual p. 68 |
| Design heating rate | "Die Heizung soll das Wasser um 2,5 °C / min erwärmen"; slower heating is treated as scale (fault E:10) | [VERIFIED] Küppersbusch manual p. 67, 69, 122 |
| Over-temperature | heating off when inlet water is above 75 C (E:13) | [VERIFIED] Küppersbusch manual p. 67, 123 |
| Motor winding | about 41.5 +/- 4 Ohm or 53.5 +/- 4.5 Ohm by supplier | [VERIFIED] Küppersbusch manual p. 69 |
| State detection | the motor current reports no water, too little water, enough water, blocked pump; "Rundlaufprüfung" of the water level in pre-rinse and cleaning, with top-up if needed | [VERIFIED] Küppersbusch manual p. 67, 91 |
| Speed in operation | impeller "typisch in der Größenordnung 2000 bis 3500 Umdrehungen pro Minute" | [VERIFIED] BSH patent EP2275017A2 (priority 2009), describing the circulation pump of a household dishwasher; a typical figure for the design, not a specification of part 12014980 |
| Pressure rise across the pump | "Druckdifferenz von typisch 200 bis 400 mbar" between suction and discharge side, i.e. 20 to 40 kPa or about 2 to 4 m of water | [VERIFIED] BSH patent EP2275017A2 |
| Pump curve, speed schedule per programme, electrical power | not found | fallback machine.md: H0 5.5 m at 3000 rpm, b 1.333e-3 m/(L/min)2; its operating point of about 35 kPa at 3000 rpm lies inside the patent's range |
| Flow, indirect | "generating the cleaning power of over 4,000 litres from as little as 12.3 litres per wash" | [VERIFIED] Bosch AU catalogue 2017, p. 2 |
| Flow implied | about 31 to 40 L/min if those 4,000 L are circulated in 100 to 130 minutes of pump running | [ESTIMATED] |
| Flow, BSH patent | "eine für die Beheizung günstige Umwälzgeschwindigkeit, beispielsweise in einer Größenordnung von 20 bis 30 l/min" | [VERIFIED] EP2482702B1 |

### 6.2 Water switch (diverter), part 00644996 with motor 00611329

| Quantity | Value | Tag and source |
|---|---|---|
| Function | "Die Wasserweiche steuert den Wasserweg der 3 Sprühebenen." Drive motor with cam disc, pulse generator (switch) and a closure disc; started through a triac; the cam operates a switch that sends pulses of different length and spacing so the electronics can find the home position | [VERIFIED] Küppersbusch manual p. 99-100 |
| Disc | "Durch die Anordnung der 5 Öffnungen in der Verschlussscheibe ist die gleichzeitige oder wechselseitige Ansteuerung mehrerer Ebenen möglich"; holes of different size | [VERIFIED] Küppersbusch manual p. 100. BSH's photo of 00644996 shows six openings in the disc [VERIFIED by count] |
| Outlets | three: lower spray arm, upper spray arm, roof spinner | [VERIFIED] Küppersbusch manual p. 73; patent below |
| Positions (BSH's patent for a disc-type switch with three outlets built onto the sump) | six positions 60 degrees apart: P1 closed; P2 lower + upper arm together; P3 roof spray only; P4 upper arm only; P5 lower arm only; P6 upper arm + roof spray | [VERIFIED] WO2009068385A1 (BSH, priority 2007), description of Fig. 6. Whether production firmware uses all six is not documented. |
| Pressure loss | "beispielsweise lediglich 20 mbar"; disc thickness 5 to 20 mm, preferably about 12.5 mm | [VERIFIED] WO2009068385A1 |
| Motor | synchronous, "220/240V~ 50/60Hz 4/4.8 r/min 4 W CCW", type TYJ50-8A7 | [VERIFIED] label in BSH photo MCSA091270; retailer transcription. The Küppersbusch manual prints 5/6 min-1, 5 W, 1.05 or 1.4 kOhm (conflict, section 12) |
| Drive train | motor, gear with cam disc, second gear, disc | [VERIFIED] Küppersbusch manual p. 99 figure |
| Time per 60 degree step | about 2.5 s at 50 Hz if the disc turns at motor speed | [ESTIMATED] gear ratio not known; +/- a factor of 2 |
| Housing seal | 96 mm outer, 93 mm inner diameter | [VERIFIED] Bosch DE shop page for 00644996 |
| Service check | "If the upper and lower spray arms do not rotate alternately", replace the water switch | [VERIFIED] BSH repair instructions DIS 840 (58300000176874), p. 48, read through ManualsLib |
| Dwell times, sequence per programme | not found | fallback machine.md: 60 s / 60 s alternation, 1.5 s transition |

### 6.3 Water inlet and fill

| Quantity | Value | Tag and source |
|---|---|---|
| Supply conditions | 50 to 1000 kPa; "Inlet rate Min. 10 l/min"; cold water, hot max. 60 C | [VERIFIED] user manual p. 48 |
| Aquastop | 00668113, 1.68 m to the mounting plate (spec sheet: inlet hose 165 cm), 3/4 inch; valve Bitron "Type 88", 220/240 V, max. 10 bar; coil 4.2 kOhm +/- 1 kOhm; coarse and fine strainers with a flow limiter under them | [VERIFIED] Bosch DE shop; ersatzteilshop.de; Küppersbusch manual p. 76-77 |
| Path | Aquastop, heat exchanger inlet channel with impeller flow sensor and air gap, softener (resin or salt path), back to the heat exchanger, into the tub | [VERIFIED] Küppersbusch manual p. 90 |
| Fill rate | 2.5 L/min | [ESTIMATED] service programme step S:12: "1,5 l" in "ca. 36" s (Küppersbusch manual p. 120). machine.md had 3.0 |
| Service reference | "Testing the inlet water flow. (0.5 bar; 8 l/min)" | [VERIFIED] BSH DIS 840 p. 49 via ManualsLib |
| Start check | Aquastop driven for 5 s at programme start; flow pulses expected | [VERIFIED] Küppersbusch manual p. 90 |
| Metering | by the impeller pulses only; the quantity for the final rinse is filled during the intermediate rinse and held in the heat exchanger; no running check in intermediate and final rinse | [VERIFIED] Küppersbusch manual p. 91 |
| Fill per bath | 3.1 L (heat exchanger content, the stated "Füllmenge") | [VERIFIED] Küppersbusch manual p. 92, 120 |
| Cross-checks on this model | Eco 50: 9.5 L; one cold bath 4.0 L in 0:15 | [VERIFIED] quick reference guide 9001643502 for SMV4HAX40G |
| Reading | Eco = three baths of about 3.2 L; one stand-alone bath is 4.0 L; so baths lie between 3.1 and 4.0 L | [ESTIMATED] |
| Softener regeneration | every 6 programmes at the factory setting H04: +5 L, +7 min, +0.05 kWh | [VERIFIED] user manual p. 24 |

### 6.4 Drain

| Quantity | Value | Tag and source |
|---|---|---|
| Drain pump 00631200 | 70 x 70 x 70 mm, 229 g, bayonet fixing; BLDC motor, winding about 82 +/- 8 Ohm; the pattern part is marked "Copreci BLP3", impeller 37 mm | [VERIFIED] Bosch DE shop; ersatzteilshop.de; Küppersbusch manual p. 71 |
| Detection | by motor current: idling, too little water (pumping stops), no pressure (cover missing), blocked, blocked or kinked drain | [VERIFIED] Küppersbusch manual p. 71 |
| Path | sump outlet with non-return flap (inner diameter 23 mm), inner hose 580 mm long, drain channel of the heat exchanger with float-operated vent against siphoning, outlet hose | [VERIFIED] Küppersbusch manual p. 108-110; ersatzteilshop.de for 00611320 and 00668104 |
| Outlet hose | 190 cm (spec sheet); 19 mm inner diameter ends on the pattern part | [VERIFIED] UK spec sheet; ersatzteilshop.de |
| Flow rate | not found | fallback machine.md: 16 L/min |

### 6.5 Softener

Part 12026873: 242 x 160 x 150 mm, 946 g, in the base under the front left of the tub; ion-exchange resin with a two-way regeneration valve (coil 2 kOhm +/- 500 Ohm); salt capacity about 1.3 kg fine or 0.9 kg coarse salt; salt level by a light barrier; softened water in the machine should test at about 5 to 7 dH [VERIFIED: ersatzteilshop.de; Küppersbusch manual p. 84, 94-95, 125]. Hardness settings H00 to H07, factory H04 for 16 to 20 Clarke degrees [VERIFIED: user manual p. 22-23]. Resin volume: not found.

### 6.6 Quantities not found for the hydraulic model

Sump working volume, pipe volumes, minimum water level for the pump, carry-over after drain, branch loss coefficients, share of flow to the roof spinner. Fallbacks are the SPOT-60 values of machine.md section 12.1.

## 7. Filters

"Das 3 stufige Siebsystem": flat filter ("Flächensieb"), fine filter cylinder ("Feinsiebzylinder") and coarse filter ("Grobsieb") [VERIFIED: Küppersbusch manual p. 72]. The user manual of this machine lists "Micro filter", "Fine filter" and "Coarse filter" [VERIFIED: p. 38]; in BSH's parts list the flat sheet 00645037 is the "Filter-fine" and the cylinder set 00645038 the "Filter-micro", so the manual's fine filter is the flat sheet and its micro filter is the pleated cylinder.

| Stage | Value | Tag and source |
|---|---|---|
| Flat filter 00645037 | stainless perforated sheet, 260 x 130 x 14 mm with a turned-down rim, round opening 54 mm for the cylinder | [VERIFIED] ersatzteilshop.de ("Material: Metall", "Durchmesser Öffnung: 54 mm"); BSH photos |
| Flat filter perforation | round holes about 0.85 mm in a 60 degree staggered pattern of about 1.5 mm pitch; open fraction about 0.25 (range 0.17 to 0.35); about 16,000 holes, about 90 cm2 open | [ESTIMATED] hole centroids detected in BSH photo MCSA01868138 and converted with the image ellipse of the 54 mm opening (379 x 190 px); hole +/- 0.15 mm, pitch +/- 0.15 mm |
| Sump cover 12038407 | grey PP-TD plate, 259 x 95 x 26 mm, 51 g, arc-shaped rear edge, perforated fields between solid radial ribs; hole of about 30 mm for the lower arm, two sockets of about 21 and 16 mm for the feed pipe stubs, two screw bosses | size [VERIFIED] ersatzteilshop.de; features [VERIFIED] BSH photos; socket and hole sizes [ESTIMATED] +/- 3 mm |
| Cover perforation | holes about 1.3 mm at about 2.3 mm pitch | [ESTIMATED] from BSH photo 26144163; +/- 0.3 mm |
| Coarse filter | inner insert, 71 mm diameter, 92 mm high, with vertical bars and a bayonet ring; turned anticlockwise to remove | [VERIFIED] Bosch DE shop text for 00645038 (it calls this piece "Feinsieb"); user manual p. 38 |
| Micro filter | outer pleated mesh cylinder, 79 mm diameter, 131 mm high with its top ring | [VERIFIED] Bosch DE shop text for 00645038 (it calls this piece "Grobsieb"; the two names are swapped relative to the manual) |
| Pleating | "gewellter Feinfilterzylinder" with "1,5 fache Filterfläche" of a plain cylinder | [VERIFIED] Küppersbusch manual p. 73 |
| Micro mesh (BSH patent ranges) | apertures 0.025 to 0.06 mm2, preferably 0.035 to 0.045 mm2; open share 25 to 50 %, preferably 35 to 40 %; "Maschenweite ... zwischen 150 μm und 250 μm"; area "mehr als 14 cm2 pro Maßgedeck" | [VERIFIED] DE102009027910A1 (BSH, "optimiertes Siebsystem") |
| Micro mesh adopted | 0.20 mm square openings, open fraction 0.37, area at least 182 cm2 (13 place settings) and about 300 cm2 if a 70 x 90 mm cylinder is pleated 1.5 times | [ESTIMATED] from the patent ranges; mesh +/- 0.05 mm |
| Flow paths | water falling into the coarse filter reaches the inside of the micro cylinder and leaves radially through the mesh to the pump; a second stream passes the flat filter; dirt held inside the cylinder goes to the drain pump | [VERIFIED] DE102009027910A1; Küppersbusch manual p. 73 |
| Extra screen | 00428216, 38 mm diameter, 7 mm high, 1 g, listed as an optional insert against coarse soil | [VERIFIED] ersatzteilshop.de |
| Self-cleaning | the underside nozzle of the lower arm washes the flat filter | [VERIFIED] Küppersbusch manual p. 102; Bosch AU catalogue p. 8 |

## 8. Sensors

| Sensor | What is known | Tag and source |
|---|---|---|
| AquaSensor 00611323 | optical turbidity sensor in the sump: an infrared diode and a photodiode face each other on a board in a U-shaped translucent housing; evaluated in turbidity bands; active in pre-rinse, in cleaning and at the end of cleaning; calibrated in every run; on a failed calibration the value is set to "trüb" and the maximum programme runs. Housing 37 x 35 x 34 mm | [VERIFIED] Küppersbusch manual p. 82-83; ersatzteilshop.de |
| Temperature | two NTCs in the heater tracks of the heat pump, 10 kOhm at 25 C | [VERIFIED] Küppersbusch manual p. 67-68 |
| Water quantity | impeller with a permanent magnet and a reed switch in the inlet channel of the heat exchanger; pulses counted | [VERIFIED] Küppersbusch manual p. 88 |
| Water level / load | no level sensor in the tub; the pump electronics judge the water level from the motor current and top up. Bosch describes the load sensor as "a rotary speed sensor, which recognises the water level" | [VERIFIED] Küppersbusch manual p. 67, 91; Bosch NZ brochure p. 2. Note: the general table of the Küppersbusch manual (p. 8) says "Druckwächter + Software"; there is no pressure switch in the parts list of this machine |
| Leak safety | polystyrene float (123 mm diameter, 27 mm high) with a changeover microswitch in the base pan; switches on the drain pump and closes the Aquastop (E:15) | [VERIFIED] Küppersbusch manual p. 75-78; ersatzteilshop.de |
| Door | Hall sensor | [VERIFIED] Küppersbusch manual p. 121-122 (E:06) |
| Salt, rinse aid | light barriers | [VERIFIED] Küppersbusch manual p. 84 |
| Pulses per litre, turbidity thresholds | not found | |

## 9. Materials

| Part | Material | Tag and source |
|---|---|---|
| Tub and floor | stainless steel | [VERIFIED] UK spec sheet "Stainless steel interior"; sister spec sheet "Edelstahl/Edelstahl"; part name "Stainless steel container"; owner's photos |
| Outside of tub | bitumen layer and insulating mats | [VERIFIED] Küppersbusch manual p. 105 ("Bitumen-Isolierung"); parts 0250, 0325, 0327 "Insulating plate" |
| Inner door | stainless steel | [VERIFIED] ersatzteilshop.de ("Material: Metall", "silbern") |
| Lower spray arm | PP-TD20 | [VERIFIED] marking in BSH photo |
| Upper arm, feed pipe, sump | grey plastic ("Kunststoff"); cover marked PP-TD | [VERIFIED] retailer listings; BSH photo of 12038407 |
| Roof spinner | white plastic | [VERIFIED] retailer listing |
| Flat filter | stainless sheet | [VERIFIED] retailer listing |
| Baskets | coated steel wire, "silber" | colour [VERIFIED] retailer titles; coating type not found; polyamide powder coating is usual for BSH [RECALLED] |
| Tine tips | the tines in IMG_9083 appear to end in small thickened tips; "Ball Ends" are described as a feature of the better basket lines | [VERIFIED] owner's photo (appearance only); Küppersbusch manual p. 44 |
| Cutlery basket, knife rack, cup shelves, handles | grey plastic | [VERIFIED] retailer listings |

### 9.1 Published masses (for the thermal model)

All [VERIFIED] from the retailer listings or the spec sheet named in the sections above.

| Item | Mass |
|---|---|
| Whole appliance, net | 33.9 kg |
| Inner door 00680311 | 2903 g |
| Lower basket, sister parts 20002125 / 20002434 / 20003053 | 1760 / 1942 / 2443 g |
| Upper basket, sister parts 20000272 / 00778368 | 2316 / 2364 g |
| Cutlery basket 11057829 | 338 g |
| Knife rack 11037806 | 150 g |
| Heat exchanger 00770952, empty | 1246 g (plus 3.1 kg of stored water) |
| Softener 12026873, empty | 946 g |
| Feed pipe 11003118 | 240 g |
| Upper spray arm with tube 11010054 | 149 g |
| Lower spray arm (pattern part) | 69 g |
| Drain pump 00631200 | 229 g |
| Circulation pump, sister 12019637 | 656 g |

Sheet thickness and mass of the tub itself: not found.

## 10. Vertical stack-up

All heights are above floor level at the sump, [ESTIMATED] unless tagged otherwise.

| Level | Height (mm) | Basis |
|---|---|---|
| Lower arm, top face | 33 +/- 8 | arm 75 mm high with a 60 mm stem that plugs into the sump; needs the owner's ruler |
| Lower basket, plate rest level | 48 +/- 10 | must clear the arm |
| Docking ports of the rear pipe | 335 / 361 / 388, +/- 12 | scaled side view of 11003118 (section 5.3) |
| Upper arm, top face, at Rackmatic level 3 / 2 / 1 | about 319 / 345 / 372 | arm hangs directly under its feed tube, tube at port height |
| Upper basket floor at level 3 / 2 / 1 | about 350 / 376 / 403 | just above the tube |
| Roof | 665 +/- 15 | section 2.1 |
| Roof spinner, lower face | about 630 | 21 mm high under the roof run of the pipe |

Check against the manual's table [VERIFIED values, p. 21]: lower basket items of 250 / 275 / 300 mm need the underside of the upper arm (about 18 mm below its top face) at 303 / 328 / 353 mm, and the stack-up gives 301 / 327 / 354. Upper basket items of 270 / 245 / 220 mm reach 620 / 621 / 623 mm, below the roof spinner at about 630. The stack-up is consistent with the manual to within a few millimetres, which is better than its own error bars deserve; the absolute levels still need the owner's tape.

## 11. Parametric data block for this machine

Same form as machine.md section 12.1. Tags: V = [VERIFIED], E = [ESTIMATED], F = fallback to the SPOT-60 value because nothing was found.

```yaml
machine: BOSCH-SMV4HAX40G-13     # BSH platform GV640, type SD6PW1B, 13 place settings (V)
frame:                           # mm; origin on lower-arm axis at floor level of the sump; x right, y back, z up
  tub: {x: [-272, 272], y: [-245, 255], z: [0, 665]}      # E, +/-10, +/-25, +/-15
  door_recess_extra_depth: 35                               # E
  corner_radius_vertical: 30                                # F
  floor_slope_deg: 4                                        # F
  sump: {filter_axis_xy: [0, -90], flange_d: 200, working_volume_L: 1.2}   # E, E, F
  filter:
    flat_plate: {size_xy: [260, 130], y_range: [-155, -25], opening_d: 54,   # V, E, V
                 hole_d: 0.85, pitch: 1.5, pattern: staggered_60, open_fraction: 0.25}   # E
    sump_cover: {size_xy: [259, 95], y_range: [-25, 70], hole_d: 1.3, pitch: 2.3}        # V size, E rest
    coarse: {diameter: 71, height: 92}                                                  # V
    micro: {diameter: 79, height: 131, mesh: 0.20, open_fraction: 0.37,                  # V, V, E, E
            area_cm2: 300, pleat_factor: 1.5}                                           # E, V
  dispenser: {centre: [0, door, 515], detergent_chamber_x: -20, body: [120, 105, 65], lid: sliding,   # E, E, V, V
              tab_target: upper_basket_handle_tray, rinse_aid_ml_per_pulse: 1, rinse_aid_reservoir_ml: 80}   # V
  heat_exchanger: {wall: left_outside, size: [435, 670, 42], stored_L: 3.1}             # V
racks:
  lower: {size: [525, 520, 145], mass_kg: 1.9, wheels: 8, wheel_d: 35, folding_rows: 2, # E (sister V), E, E, V, V
          rest_level_z: 48,                                                             # E
          rim_wire: 5.0, grid_wire: 3.4, tine_wire: 3.4, coating_mm: 0.4,               # F
          tine_pitch: 25, tine_height: [62, 75], tine_lean_deg: 8}                      # F
  upper: {size: [520, 522, 165], mass_kg: 2.3, rackmatic_levels: 3, rackmatic_step: 25, # E (sister V), E, V, V
          floor_z_options: [350, 376, 403],                                             # E
          folding_rows: 2, cup_shelves: [{size: [252, 97]}, {size: [200, 100]}],        # V
          knife_rack: [389, 119, 57], handle_tray: [215, 52, 47],                       # V
          grid_wire: 3.2, tine_wire: 3.0, tine_height: 40, tine_pitch: 22}              # F
  third: none                                                                           # V
  cutlery_basket: {size: [230, 128, 220], cells: 6, mass_g: 338}                        # V; depth 128 or 158 and cells 6 or 7, see section 12
arms:
  lower: {part: "00668148", axis_xy: [0, 0], tip_radius: 230, top_face_z: 33,           # V, -, V, E
          material: PP-TD20, mass_g: 69, inertia_wet: 4.4e-3, sense: ccw,               # V, V, E, E (low confidence)
          nozzles_up:   [[A, 44, round, 3.0], [A, 91, round, 3.0], [A, 114, round, 3.0], [A, 138, round, 3.0],
                         [A, 184, hooded_round, 3.5], [A, 225, tip_slot, "5x2"],
                         [B, 68, round, 3.0], [B, 158, round, 3.0], [B, 204, hooded_slot, "5x2"], [B, 226, tip_slot, "5x2"]],   # E
          nozzles_down: [[unknown_half, 200, boss, unknown]]}                           # V existence, E radius
  upper: {part: "11010054", axis_xy: [0, 0], tip_radius: 230, feed_tube: 270,           # V, E, V, V
          top_face_z_options: [319, 345, 372], mass_g_with_tube: 149,                   # E, V
          nozzles_up: [[1, 43, round, 2.3], [1, 132, slot, "5x1.8"], [1, 162, slot, "5x1.8"], [1, 222, tip_hooded, unknown],
                       [2, 87, slot, "5x1.8"], [2, 188, slot, "5x1.8"], [2, 217, tip_hooded_slot, unknown]]}   # E
  top: {part: "00611388", type: free_spinning_rotor, diameter: 52, height: 21, vanes: 5,   # V
        axis_xy: [0, 5], z_lower_face: 630}                                               # E
hydraulics:
  pump: {type: BLDC_wet_rotor_with_heater, part: "12014980",                            # V
         N_range: [2000, 3500], dp_operating_kPa: [20, 40],                            # V (BSH patent, typical)
         N0_rpm: 3000, H0_m: 5.5, b_m_per_Lmin2: 1.333e-3}                              # F
  flow_total_L_per_min: [20, 40]                                                        # E (patent 20-30; brochure-derived 31-40)
  diverter: {positions: [off, lower+upper, top, upper, lower, upper+top],               # V (patent)
             step_deg: 60, motor_rpm: 4, transition_s: 2.5, loss_kPa: 2}                # V, V, E, V
  fill: {per_bath_L: [3.1, 4.0], rate_L_per_min: 2.5, metering: impeller_pulses,        # V, E, V
         prefill_in_heat_exchanger_L: 3.1}                                              # V
  drain: {pump: BLDC, L_per_min: 16}                                                    # V, F
  inventory: {V_min_sump_L: 0.5, carry_over_L: 0.4}                                     # F
thermal:
  heater_W: 2100                 # V (nominal); 21 ohm cold
  design_heat_rate_K_per_min: 2.5   # V
  heater_cutout_inlet_C: 75      # V
dosing: {detergent_marks_ml: [15, 25, 50], rinse_aid_ml: 5, tab_drop: handle_tray}      # V (r05 = 5 pulses of 1 ml)
softener: {regeneration_every_n_cycles: 6, extra_water_L: 5, extra_min: 7}              # V at setting H04
drying: {method: side_heat_exchanger_condensation, auto_open: none}                     # V (no door-opening module in the parts list)
```

## 12. Conflicts between sources, and with machine.md

1. Top spray level. machine.md's SPOT-60 has three rotating arms and a third rack. This machine has a lower arm, an upper arm and a small free-spinning roof rotor, no third rack, and a cutlery basket.
2. Arm radii. machine.md: 247 and 232 mm. Published span of both arms here: 460 mm, radius 230 mm.
3. Dispenser. machine.md: hinged lid swinging 110 degrees with a 62 mm keep-out. Here: sliding lid; the tablet falls into the handle tray of the upper basket.
4. Sump position. machine.md: sump centre 40 mm in front of the arm axis. Here the filter cylinder is about 90 mm in front of it.
5. Water switch disc. Küppersbusch manual: "5 Öffnungen". BSH patent WO2009068385: seven openings DO1 to DO7 and six positions. BSH's own photo of the part: six openings. A 2008 draft BSH repair manual for "GV640" (ManualsLib 159387, p. 12) still describes a disc with three openings and two outlets integrated in a flow heater, which is the previous platform's design and does not fit this machine's parts.
6. Water switch motor. Label on the part: 220/240 V, 4/4.8 r/min, 4 W. Küppersbusch manual: "Nennspannung: 120V", 5 W, "Drehzahl: 5/6 min".
7. Heater. Küppersbusch manual: 2100 W; replacement heater: 2080 W; measured resistance 21 Ohm cold, which is 2519 W at 230 V; rating plate of the whole machine 2000-2400 W; machine.md 2000 W. The first three are reconciled only if the resistance rises when hot.
8. Heat exchanger content: "enthält 3,1 l Wasser" against "2,5 l von 3,1 l Füllmenge" in the same manual.
9. Fill rate: about 2.5 L/min from the service programme timing, 3.0 L/min in machine.md, while the supply must deliver at least 10 L/min and the service test quotes 8 L/min at 0.5 bar.
10. Cutlery basket: six compartments on Bosch's spare-part page, seven on Bosch's accessory page for the same basket (SMZ5100). Size 230 x 128 x 220 mm in one retailer listing and 231 x 210 x 158 mm in another listing of the same shop for the same part number; machine.md had 240 x 135 x 215 mm.
11. Lower basket replacement: 20007406 is sold as having 6 folding rows; the machine is specified with 2 and the owner's photos show 2. The owner's basket (20001979) wins.
12. Rackmatic step: 25 mm from the manual's table, 26.7 mm from the scaled photo of the docking ports.
13. Filter names: Bosch's shop text for 00645038 calls the 71 x 92 mm inner piece "Feinsieb" and the 79 x 131 mm pleated piece "Grobsieb"; the manuals call them coarse filter and micro filter.
14. Level sensing: "Druckwächter + Software" in the general table of the Küppersbusch manual against its detailed text (pulse counting and pump-current check) and the parts list (no pressure switch).
15. Capacity: 12 place settings in the 2010 Küppersbusch manual, 13 for this model.
16. Arm axis to rear wall: 230 to 255 mm from the floor foot of the feed pipe, 275 to 305 mm from the length of the upper feed tube.
17. Lower-arm nozzle radii: a second BSH photo (16260430), analysed the same way, gives half-A radii 11 to 17 mm smaller than the adopted values; I discarded it because the owner's photo agrees with the first.

## 13. Not found

- Published interior dimensions of the tub (width, depth, height), floor slope, corner radii.
- Dimensions of the exact baskets 20001979 / 20007406 and 20001986 / 20001992; wire diameters, grid pitch, tine pitch, height and lean; coating material.
- Nozzle bore sizes and jet angles of both arms; rotation speed and sense of either arm; orifice and flow of the roof spinner.
- Pump curve, speed schedule, electrical power and measured flow of the circulation pump (only typical ranges from a BSH patent: 2000 to 3500 rpm, 200 to 400 mbar); drain pump flow.
- Water switch dwell times and sequence in Eco 50; gear ratio of the disc.
- Sump working volume, pipe volumes, minimum level, carry-over.
- Flow sensor pulses per litre; AquaSensor thresholds; softener resin volume.
- Actual mesh of the micro filter part (only patent ranges) and the slot size of the coarse filter.
- The BSH "GV640A dishwasher platform training" document (69 pages) exists on a manuals site but sits behind a captcha; I did not obtain it. The US "GV640A DW repair instruction" (58300000170749, 82 pages) is visible on Scribd only as its first three pages.

## 14. What the owner could measure, most valuable first

1. Lower spray arm (pull it up and off). Lay it on paper next to a ruler and photograph top and underside square-on. Measure each nozzle's distance from the hub centre, each bore with drill-bit shanks or pin gauges (2.0 to 4.0 mm), each slot with calipers, and note which way each hooded nozzle points. Weigh it on a kitchen scale. Hold it under a tap by the stem and note which way it turns. This replaces the estimated nozzle table of section 5.2, the highest-priority calibration item.
2. Upper spray arm (unscrew it from under the top basket): the same measurements, plus the bore of the docking inlet and the diameter of the feed tube.
3. Tub interior with a tape: width between side walls at mid height; depth from rear wall to the front flange and to the deepest part of the door liner; height from the floor beside the filter to the roof and from the door sill to the roof; distance from the centre of the lower arm hub to the rear wall and to each side wall; height above the floor of the lower arm's top face, the lower basket's wire floor, the upper arm and the upper basket floor at each of the three Rackmatic settings, and the roof spinner.
4. Baskets with calipers and a ruler: outer length, width, height; wire diameter of rim, floor grid and tines; grid pitch in both directions; for every tine row its position, pitch, height and lean, and which rows fold; wheel count and diameter; cutlery basket outer size, number of compartments, slot sizes in its floor and lid.
5. One logged Eco 50 cycle with a plug-in power meter that records at 1 s to 10 s intervals (the machine draws up to about 10 A). This gives heater power at the owner's mains voltage, heater on-times (hence heating rates and temperatures reached), pump power, drain pump events and the time of every fill and drain.
6. Water per bath: put the drain hose into a bucket on a scale for one Eco 50 cycle and weigh each discharge; note the times. Gives fill volumes, the number of baths and carry-over. If the hose cannot be reached, read the household water meter before and after each fill with no other tap in use.
7. Sound or vibration recording with a phone resting on the door during a cycle: the alternation between lower arm, upper arm and roof spinner (dwell times of the water switch), the duration of each switch-over, and arm rotation rates from the rhythm of jets hitting the door.
8. Filters: macro photo of the micro mesh against a ruler or a fine comb; pin-gauge the flat filter holes (0.7 to 1.0 mm) and count holes per 10 mm; coarse filter slot widths; cylinder diameter and height; flat filter and cover outlines.
9. Roof spinner: diameter, number of vanes, and the bore of the outlet that feeds it (pull the spinner cage off its clips).
10. Door: position of the dispenser on the inner door (from the top edge and from each side), size of the detergent chamber, and the position and inside size of the handle tray of the upper basket relative to the dispenser with the door closed, at each Rackmatic setting.
11. A logging thermometer (or a maximum thermometer in a cup) in each basket for one Eco 50 cycle: water and load temperatures to calibrate the thermal model.
12. Floor shape: depth of the floor below a straightedge laid side to side and front to back; position of the salt cap and the filter relative to the walls.
13. Salt cap, wheels and handle sizes with calipers, to confirm the scale references in section 2.1.

## 15. Sources

Opened and read this session unless marked "(snippet)". The copies read are working files, not in the repository; each source is given by its public address.

Owner's photographs (first-hand evidence)
- `docs/reference/owner-photos/IMG_9080` to `IMG_9083`, and IMG_9079 (the rating plate; not published: it shows the serial number).

BSH documents for SMV4HAX40G
- User manual 9001937295_B (en): https://media3.bosch-home.com/Documents/9001937295_B.pdf. Pages 12-13, 16, 18-21, 22-28, 37-39, 48.
- Quick reference guide 9001643502_B: https://media3.bosch-home.com/Documents/9001643502_B.pdf.
- Installation instructions 9001594147_C, header "GV 640 Voll-I - 81,5 cm": https://media3.bosch-home.com/Documents/9001594147_C.pdf.
- Spec sheet en-GB: https://media3.bosch-home.com/Documents/specsheet/en-GB/SMV4HAX40G.pdf. Sister spec sheet de-DE SMV4HAX48E: https://media3.bsh-group.com/Documents/specsheet/de-DE/SMV4HAX48E.pdf
- Kitchen-planning data SMV4HAX40G_KPL (obj, dwg, 3ds): https://media3.bsh-group.com/3D_Asset/17013994_SMV4HAX40G_KPL.zip
- Other GV640 installation sheets fetched this session: https://media3.bosch-home.com/Documents/9000901339_A.pdf, https://media3.bosch-home.com/Documents/9001170055_J.pdf.
- Spare-parts list for SMV4HAX40G/13: https://www.bosch-home.co.uk/en/spare-parts-list/SMV4HAX40G-13; exploded diagrams 58300000224138 (aet 002), 58300000224140 (003), 58300000226245 (004), 58300000224067 (005), 58300000225727 (006), 58300000224122 (007), 58300000224313 (008).
- BSH product photographs of the parts, https://media3.bsh-group.com/Product_Shots/..., in particular MCSA01860095, MCSA01860096, MCSA01860097, MCSA091315, MCSA092356, 16260430 (lower arm 00668148); MCSA01860195, MCSA01860196 (upper arm 11010054); MCSA02588552, MCSA02588576 (feed pipe 11003118); MCSA00748273, MCSA01886352 (roof spinner 00611388); MCSA01868138, MCSA01868139 (flat filter 00645037); 26144163, 26144165 (cover 12038407); 15856878, MCSA00479915 (micro filter 00645038); MCSA02881552, MCSA02881573 (heat pump 12014980); 15856104, MCSA091270 (water switch 00644996); MCSA00955943 (inner door 00680311); MCSA01669580 (dispenser 00755073); 22207753, 22207763 (upper basket 20001992); 16228785 (sump 00668102).
- Bosch DE spare-part shop pages, https://www.bosch-home.com/de/de/product/<part number> for 11010054, 12014980, 00644996, 00645038, 00770952, 00755073, 00631200, 00668113, 00680311, 11003118, 11057829, 20002434, 20002125, 20003053, 00773588, 00778368, 00770441, 20000272, 20007406, 20001992 (the last two redirect from 20001979 and 20001986 and carry no dimensions); Neff page https://www.neff-home.com/de/de/product/20002434; accessory page SMZ5100.
- Bosch brochures: AU Dishwashing Catalogue 2017 (MCDOC02269689), NZ Dishwashing Brochure (MCDOC02344627) (addresses in `documents.md`, sources 25 and 26).

Service documentation for the GV640 platform
- Küppersbusch service manual H7-71-07, "Einbau-Geschirrspülautomaten Baureihe 640", 13.10.2010, 125 pages: http://tds.kueppersbusch.de/kb-technik/service_manuals/Geschirr/DE/A7_018DE.pdf (the https address has a certificate fault). Pages 2, 8, 40-45, 66-74, 75-89, 90-110, 111-125.
- BSH "Repair Instructions - Dishwashers", DIS 840_58300000176874_ara_en_c, 2016-03-02, 157 pages, as hosted for model SPS40C12GB: https://www.manualslib.com/manual/1337144/Bosch-Sps40c12gb.html (table of contents, pages 33, 48, 49; read as an automatic paraphrase of the pages, not their own text).
- BSH "Reparaturanleitung Geschirrspülen - GV640", draft of 2008-01-11, 36 pages: https://www.manualslib.de/manual/159387/Bosch-Gv640.html (table of contents, pages 6 and 12; read as an automatic paraphrase of the pages, not their own text).
- Listing only, not obtained: https://elektrotanya.com/bosch_gv640a_dishwasher_platform_training.pdf/download.html ; https://www.scribd.com/document/894541984/Bosch-GV640A-dishwasher (first three pages visible).
- Community repair guide "Geschirrspüler Bosch/Siemens mit Heizpumpe und BLCD Laugenpumpe [GV640]", 30 pages: https://forum.teamhack.de/filebase/file/52-geschirrsp%C3%BCler-bosch-siemens-mit-heizpumpe-und-blcd-laugenpumpe-gv640/. Photographs of a teardown with qualitative text; no figures taken from it.

Patents (BSH)
- WO2009068385A1, "Wasserführendes Haushaltsgerät mit einer Wasserweiche": https://patents.google.com/patent/WO2009068385A1/de.
- DE102009027910A1, "Geschirrspülmaschine mit einem optimierten Siebsystem": https://patents.google.com/patent/DE102009027910A1/de
- DE102009026876A1, "Geschirrspülmaschine mit Wärmetauscher sowie zugehöriges Steuerungsverfahren": https://patents.google.com/patent/DE102009026876A1/de
- EP2482702B1, "Geschirrspülmaschine mit einem Flottenspeicher" (read from a saved copy of the patent text; address not recorded).
- EP2275017A2, "Geschirrspülmaschine mit einer Umwälzpumpe": https://patents.google.com/patent/EP2275017A2/de (impeller speed and pressure rise).
- DE102007030065A1, "Geschirrspülmaschine mit einer Pumpe mit einem bürstenlosen Gleichstrommotor": https://patents.google.com/patent/DE102007030065A1/de (no numbers used).

Parts retailer (dimensions, weights, printed markings)
- ersatzteilshop.de product pages, among them: https://www.ersatzteilshop.de/sprueharm-unten-kunststoff-00668148-668148-bosch-siemens-neff-kueppersbusch.html ; https://www.ersatzteilshop.de/sprueharm-unten-passend-fuer-bosch-00668148-bluparts-in-geschirrspueler-10110265.html ; https://www.ersatzteilshop.de/sprueharm-oben-bosch-11010054-mit-rohr-fuer-geschirrspueler.html ; https://www.ersatzteilshop.de/sprueharmrohr-bosch-11003118-senkrechtes-steigrohr-fuer-geschirrspueler.html ; https://www.ersatzteilshop.de/deckendusche-bosch-00611388-brause-oben-fuer-geschirrspueler.html ; https://www.ersatzteilshop.de/sieb-bosch-00645037-fuer-geschirrspueler.html ; https://www.ersatzteilshop.de/abdeckung-fuer-pumpentopf-12038407.html ; https://www.ersatzteilshop.de/heizpumpe-bosch-12014980-1bs3610-6aa-fuer-geschirrspueler.html ; https://www.ersatzteilshop.de/drehschieber-bosch-00644996-stellventil-fuer-heizpumpe-geschirrspueler.html ; https://www.ersatzteilshop.de/wassertasche-bosch-00770952-regenerierdosierung-fuer-geschirrspueler-1.html ; https://www.ersatzteilshop.de/tuere-innen-bosch-00680311-fuer-geschirrspueler.html ; https://www.ersatzteilshop.de/besteckkorb-bosch-11057829-fuer-geschirrspueler.html ; https://www.ersatzteilshop.de/salzbehaelter-bosch-12026873-fuer-geschirrspueler-00754350.html ; and the pages for 00611319, 00611320, 00611323, 00611329, 00612114, 00622036, 00631200, 00645038, 00645701, 00668097, 00668104, 00668113, 00755073, 10014039, 10014040, 10014124, 11037806, 12005548, 12005549, 12033302, 12033368, 00263096, 00428216.
- Sister baskets on the retailer site: https://www.ersatzteilshop.de/geschirrkorb-unten-neff-20002434-fuer-geschirrspueler.html ; https://www.ersatzteilshop.de/geschirrkorb-unten-bosch-20003053-fuer-geschirrspueler.html ; https://www.ersatzteilshop.de/geschirrkorb-unten-bosch-20002125-fuer-geschirrspueler.html ; https://www.ersatzteilshop.de/geschirrkorb-unten-mit-besteckkorb-bosch-20006942-fuer-geschirrspueler-bosch.html ; https://www.ersatzteilshop.de/geschirrkorb-bosch-00778368-oberkorb-mit-rackmatic-fuer-geschirrspueler-1.html ; https://www.ersatzteilshop.de/geschirrkorb-20000272.html.
- https://www.ersatzteilshop.de/heizpumpe-bosch-12019637-730-60016-06-fuer-geschirrspueler.html (sister pump).
- https://shop-wittlich.de/p/heizung-fuer-bosch-neff-siemens-heizpumpen-12014090-00755078-12019637 (replacement heater 2080 W).
- https://diybook.de/wartung-service/haushaltsgrossgeraete/bosch-geschirrspueler-fehler-e09-heizpumpe-tauschen-teil-1 (heater about 20 Ohm).

Background
- HEA Fachwissen, "Geschirrspüler: Aufbau und Funktion": https://www.hea.de/fachwissen/geschirrspueler/aufbau-und-funktion (speed sensor used for water level and load detection on Bosch and Siemens machines; generic figures only, not used for this machine).
- Generic dossier: `docs/research/machine.md` (sections 2 to 5 and 12).

Search extracts only (snippet), not used for any tabulated value: forum figures for heater resistance (19 to 26 Ohm).
