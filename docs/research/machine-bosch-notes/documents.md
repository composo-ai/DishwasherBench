# Bosch SMV4HAX40G/13: what the official documents say (research notes, angle "Official documents")

Researcher angle: user manual, quick reference guides, installation instructions, product data sheet, EU energy-label product information sheet (EPREL), manufacturer product page and official planning data. Written 2026-10-08.

Everything below was read this session from the files named in section 15 (most were downloaded in an earlier run of this research that was interrupted; I re-opened every one, re-rendered the pages I rely on, and checked that the local files have the same byte size as the live files on the BSH media server). Cross-links to the other three angles (hardware, programme, photographs) are marked "Cross-link".

## 0. How to read this

### 0.1 Tags

- [VERIFIED] = seen this session in the source text, or read off a rendered page or image of the source this session. The source and the place in it are given.
- [RECALLED] = from memory, source not opened.
- [ESTIMATED] = my derivation; the arithmetic is shown.

Each number carries one tag. "Not found" means I looked in every official document listed in section 15 and it is not there.

### 0.2 The seven things that matter most for the simulator

1. This machine has a **cutlery basket in the lower basket and no third rack**. The top spray level is **not an arm**: the official parts list for E-Nr SMV4HAX40G/13 has a "Shower, roof-spinning top" (00611388, German "Brause Dachkreisel") fed by a rear "feeding pipe with sprinkler disk" (11003118). SPOT-60's third rack and 135 mm top arm must both go. (sections 3.2, 8.3)
2. **Drying is condensation on the tub with a heat exchanger and a closed door**. There is no automatic door opening on this model. SPOT-60's "heat_exchanger_plus_auto_open" is wrong for it. (section 3.2)
3. **Rackmatic has three positions 25 mm apart**. Maximum plate diameter: top basket 22 / 24.5 / 27 cm, bottom basket 30 (31 in one marked position) / 27.5 / 25 cm. Top plus bottom is 52 cm at every level. (section 6.1)
4. **Two foldable tine rows per basket**, not four: in the lower basket the two rear rows, in the upper basket one line on the right split into a front and a rear segment. Official product data, the bill of materials and the owner's photographs agree. (section 6.2, 6.3)
5. The tablet falls from the door dispenser into a **tablet collecting tray at the front centre of the upper basket**; nothing may sit in or in front of it. Dispenser marks: 15 / 25 / 50 ml; 20 to 25 ml is the manual's dose for normal soiling. (section 7.1)
6. Filter: three parts. Official part dimensions: coarse filter 79 mm diameter by 131 mm, micro filter 71 mm diameter by 92 mm. The machine reports clogged filters itself (error E:92-40). (section 8.1)
7. The official loading plan for 13 place settings is **not published**. BSH supplies it to test institutes by e-mail against the E-Nr and FD; the owner has both. (section 6.8)

## 1. Identity

### 1.1 Rating plate (owner's photograph IMG_9079, rotated 90 degrees; not published: it shows the serial number)

Laser-etched on the top edge of the inner door, directly above the programme labels. Read from the photograph this session:

| Field | Value | Tag |
|---|---|---|
| Maker | Robert Bosch Hausgeräte GmbH, Carl-Wery-Straße 34, 81739 München, GERMANY | [VERIFIED] |
| E-Nr. | SMV4HAX40G/13 | [VERIFIED] |
| FD | 0106 | [VERIFIED] |
| Z-Nr. | present on the plate (not reproduced here; not needed) | [VERIFIED] |
| Type | SD6PW1B | [VERIFIED] |
| Second line | "SMV4HAX40G" followed by a long number that embeds part of the product's EAN (not reproduced) | [VERIFIED] |
| Electrical | 220 - 240 V, 50 - 60 Hz, 2000 - 2400 W, 10 - 16 A | [VERIFIED] |
| Marks | Made in Germany, VDE, CE, WEEE, www.bosch-home.com | [VERIFIED] |

The panel carries Eco 50° among its programme buttons [VERIFIED, same photograph].

Production date: FD 0106 decodes as June 2021 (first two digits plus 20 give the year, last two the month) [RECALLED]. Consistent with EPREL: model placed on the Union market from 01/03/2021 to 31/12/2024 [VERIFIED, EPREL fiche p.2], and with "New for 2021" on the Irish spec sheet [VERIFIED].

### 1.2 What the codes mean

| Code | Meaning | Tag |
|---|---|---|
| SD6PW1B | BSH type designation used in the EU declaration of conformity, which covers "SD6PW1B, SI6PW1B, SL6PW1B" as radio equipment (Home Connect). Not the sales name. | [VERIFIED] EU DoC No. 244B p.1 |
| GV 640 / GV 64x | Platform name printed in the header of both installation sheets: "GV 640 Voll-I - 81,5 cm - k. SW" (9001594147) and "GV 64x Voll-I - 81,5 cm - k. SW" (9001902261). "Voll-I" = fully integrated, 81.5 cm height class. | [VERIFIED] |
| 650 V5, 650/642 V1 | Platform and user-interface codes in document footers: user manual "9001937295 (050422) 650 V5"; sister quick guide "9001462502 (0003) 650/642 V1" | [VERIFIED] |
| "HEX 6xx", "GV6xx/4xx Entry/Value 7-Segment" | Variant names inside the interactive manual's data: final-rinse temperatures are stored under variant "HEX 6xx" (heat-exchanger 6xx), the settings under "Entry/Value 7-Segment" (the display type) | [VERIFIED] interactive manual 9001575819, raw JSON |

### 1.3 Which documents belong to the owner's index /13

The Bosch UK service page for SMV4HAX40G/13 assigns these documents [VERIFIED, source 13 in section 15]:

| Type on the page | Document | What it is |
|---|---|---|
| Interactive user manual | 9001575819 | web manual (source 15) |
| User manual | 9001937295_B | "Information for Use SMV4HAX40G", 52 pages, footer "(050422) 650 V5", PDF created 22 April 2025 |
| Short instructions | 9001643502_B | "Quick reference guide", 2 pages, footer "(020402)" |
| Installation instruction | 9001594147_C | poster, 2 pages, "GV 640 Voll-I - 81,5 cm", footer "(0205)" |
| Home Connect | 9001700647_D | quick start, no technical content |
| Supplement | 9001459881_A | **loading leaflet**, 2 pages of 4 drawings each, footer "(0003)" |
| Supplement | 9000300601_E | pointer sheet to installation instructions plus accessory hose and cable part numbers |
| Supplement | 8001227627_A | UK declaration of conformity note (radio) |
| Others | spec sheet en-GB, EU DoC, GB DoC, statement of compliance, kitchen-planning data (KPL zip) | |

The current product page (latest index) additionally lists: quick reference guide 9001937296_A (footer "(040529)"), installation instructions 9001902261_A ("(0311)"), installation supplement 9001888654_D, the energy label and the EU data sheet. The programme figures in 9001643502_B (2022) and 9001937296_A (2024) are identical [VERIFIED, both read].

Index /10 exists with fewer documents; index /01 returns an error page [VERIFIED, saved pages].

## 2. Headline data

| Quantity | Value | Source | Tag |
|---|---|---|---|
| Rated capacity | 13 place settings | manual p.48; EPREL fiche; spec sheet | [VERIFIED] |
| Energy efficiency class | D (scale A to G) | energy label; EPREL | [VERIFIED] |
| Energy efficiency index | 49.9 | EPREL fiche p.1 | [VERIFIED] |
| Eco energy | 0.836 kWh per cycle; 84 kWh per 100 cycles | EPREL fiche; spec sheet | [VERIFIED] |
| Eco water | 9.5 litres per cycle | EPREL fiche; spec sheet | [VERIFIED] |
| Eco duration | 4:55 h:min (295 min in the EPREL record) | EPREL fiche and API | [VERIFIED] |
| Cleaning performance index | 1.121 | EPREL fiche p.1 | [VERIFIED] |
| Drying performance index | 1.061 | EPREL fiche p.1 | [VERIFIED] |
| Noise | 46 dB(A) re 1 pW, class C | EPREL; spec sheet | [VERIFIED] |
| Standby / delay start / networked standby | 0.50 W / 4.00 W / 2.00 W | EPREL fiche p.1 | [VERIFIED] |
| Appliance H x W x D | 815 x 598 x 550 mm | spec sheet p.1; installation sheet panel 1 | [VERIFIED] |
| Height range on feet | 815 to 875 mm (feet 0 to 60 mm) | installation sheet panels 1 and 4; line drawing | [VERIFIED] |
| Niche H x W x D | 815-875 x 600 (max. 608) x 550 (min.) mm | installation sheet panels 1 and 2b; line drawing | [VERIFIED] |
| Depth with door open 90 degrees | 1150 mm | spec sheet p.1 | [VERIFIED] |
| Furniture door | height 655 to 725 mm, width 594 mm, weight 2.5 to 8.5 kg | line drawing; installation sheet panels 5 and 6 | [VERIFIED] |
| Plinth | height min. 90, max. 220 mm; recess 100 mm | line drawing MCZ_006754 | [VERIFIED] |
| Rear bottom recess | 89 mm high, 53 mm deep | line drawing MCZ_006754 | [VERIFIED] |
| Packed H x W x D | 880 x 660 x 670 mm | product page specification table | [VERIFIED] |
| Net weight | 33.9 kg (spec sheet) or 33.6 kg (product page): see conflicts | spec sheet p.1; product page | [VERIFIED] |
| Gross weight | 36.0 kg | spec sheet p.1 | [VERIFIED] |
| "Weight Max." in the manual | 60 kg (a platform-wide ceiling, not this model's mass) | manual p.48 | [VERIFIED] |
| Voltage, frequency | 220 - 240 V, 50 Hz or 60 Hz | manual p.48; rating plate | [VERIFIED] |
| Power rating | 2000 - 2400 W | manual p.48; rating plate | [VERIFIED] |
| Fuse | 10 - 16 A | manual p.48; rating plate | [VERIFIED] |
| Water pressure | min. 50 kPa (0.5 bar), max. 1000 kPa (10 bar) | manual p.9 and p.48; installation panel 11 | [VERIFIED] |
| Inlet rate | min. 10 l/min at the tap | manual p.48, p.40; installation panel 11 | [VERIFIED] |
| Water temperature | cold water; hot water max. 60 °C | manual p.48 | [VERIFIED] |
| Supply cord | 175.0 cm (1.75 m), GB plug | spec sheet; installation panel 1 | [VERIFIED] |
| Inlet hose / outlet hose | 165 cm / 190 cm | spec sheet p.1 | [VERIFIED] |
| Drain connection height | min. 280 mm, max. 1.1 m above floor; standpipe 38 mm diameter (GB); spigot min. 18 mm | installation panel 11 | [VERIFIED] |
| Hose reach left / right | inlet 1500 / 1200 mm, drain 1700 / 1500 mm; socket 1200 / 1600 mm (extension kit: 3700 / 3400 and 3700 / 3500) | line drawing 16027521 | [VERIFIED] |
| Inlet thread | G 3/4" (26.4 mm) | installation panel 11 | [VERIFIED] |
| Altitude limit | up to 4000 m above sea level | manual p.4 | [VERIFIED] |
| Tub and base material | stainless steel | product page ("Tub material"); spec sheet p.2 "Stainless steel interior" | [VERIFIED] |

Official planning model (KPL zip, file `SMV4HAX40G.obj`, read this session): body 598 wide, 813.5 high, 515.5 deep; inner door slab from 519.9 to 550.4 mm depth (30.5 thick), 589 wide, from 165.5 to 803.5 mm height; control strip up to 810.8; a 23 mm furniture door in front (550.4 to 573.4), from 160 to 813.5 mm height; rear bottom recess 53 deep up to 77 to 88 mm height; front plinth zone set back to 451.5 mm depth up to 94.8 mm height [VERIFIED, all read from the vertex list]. It is a simplified envelope: it contains no tub, baskets or arms.

Hinge constraint [ESTIMATED]: with the door open 90 degrees the top edge reaches 1150 mm depth. If the hinge axis is at depth z_h and height y_h and the door top is at 813.5 mm, then z_h + (813.5 - y_h) = 1150. For z_h between 515 (body front) and 550 (door front) this gives y_h between 178 and 213 mm above the floor at minimum foot height.

## 3. Features

### 3.1 The official feature list

Spec sheet en-GB p.2 [VERIFIED, all lines]: Eco 50 °C among its programmes; Silence on Demand (via app); Flex basket system; 3 stage Rackmatic height-adjustable top basket; low friction wheels on bottom basket; Rack Stopper; 2 foldable plate racks in top basket; 2 foldable plate racks in bottom basket; knife rack in top basket; moveable cutlery basket in lower rack; upper rack cup shelf; Home Connect ready on WLAN; heat exchanger; DosageAssist detergent dispenser; EcoSilence BLDC drive; automatic detergent detection; AquaMix glass protection system; AquaSensor III; push button top edge controls; InfoLight (red); acoustic end-of-cycle indicator, time remaining indicator (min), water inlet indicator; time delay; AquaStop; self-cleaning filter system with 3 piece corrugated filter; large item spray head, incl. steam protection for worktop; stainless steel interior.

Product page specification table (structured data in the page, extracted this session) [VERIFIED]:

| Key | Value |
|---|---|
| Cutlery system | Cutlery basket |
| 3rd Rack | N/A (Irish page: "None") |
| Basket system | Practical loading with Flex basket |
| Number of flip tines in upper rack / lower rack | 2 / 2 |
| Adjustable upper basket | Rackmatic 3-stage |
| Anti-slip protection in the upper basket | no |
| Drying system | Heat exchanger |
| Door-opening sensor | no |
| aquasensor | yes |
| Detergent detection | yes |
| SilentPowerDrive (EcoSilence drive) | yes |
| Precise Glass Protection (raw-water valve) | no |
| Water management system (storage tank) | no |
| Child safety devices | No |
| Start delay time max | 24 h |
| Program status indication | Program Status Light (InfoLight); end of program audible |
| Home Connect | yes; Remote Monitoring and Control; add-on function Silence on Demand |

The German sister SMV4HAX48E carries the same basket data (cutlery basket, no third level, 2 + 2 flip tines, Rackmatic 3-stage) and its page adds two entries: two cup shelves in the upper basket, and no glass support bar in the lower basket [VERIFIED, bosch-home.com/de product page for SMV4HAX48E]. It differs in noise only: 44 dB, class B.

### 3.2 What each feature physically is

| Feature | What it is (summarised from the sources named in the last column) | Present on SMV4HAX40G? | Tag |
|---|---|---|---|
| Cutlery basket | A movable cutlery basket for the lower basket (spec sheet). Official part 11057829 (successor of 00668270): a flexible basket with six cutlery compartments and dividers, which stands on the grid of the lower basket | Yes | [VERIFIED] spec sheet; part page |
| Third-level cutlery drawer | not fitted ("3rd Rack: N/A") | **No** | [VERIFIED] product page |
| Top spray level | Parts list for /13: "Shower, Roof-spinning top" (00611388; German page "Brause Dachkreisel") and "Tube, feeding pipe with sprinkler disk for 81,5cm, new docking system" (11003118; "Zuführrohr mit Dachkreisel"). A small rotating sprinkler on the tub ceiling fed by the rear pipe. The user manual never mentions it: its overview lists only a lower and an upper spray arm. | Yes, as a roof sprinkler | [VERIFIED] spare-parts list and part pages re-fetched |
| Upper spray arm | Washes the load in the top basket; mounted under the top basket, unscrews and pulls down. Official part 11010054 (upper spray arm with inlet pipe): width 460 mm, pipe length 270 mm | Yes | [VERIFIED] manual p.13, p.39; part page re-fetched |
| Lower spray arm | Washes the load in the bottom basket; pulls straight up off its hub, clicks back | Yes | [VERIFIED] manual p.13, p.39 |
| Baking sheet spray head | Replaces the top basket for trays and grilles: inserted in the middle one of three docking ports on the rear feed pipe and turned to the right. Max. 2 baking sheets and 2 grilles. The manual requires the appliance always to be run with either the top basket or this head fitted. Part 00612114 | Yes ("Large item spray head") | [VERIFIED] manual p.21 and its figures; spec sheet |
| Rackmatic (3-stage) | Top basket height set with side levers left and right, three levels; the product page gives the travel as up to 5 cm and says the basket can be tilted to one side; works fully loaded | Yes | [VERIFIED] manual p.18-19; product page |
| Flex baskets | The product page presents the height-adjustable upper basket as the way to make room for larger items; this is the entry basket system (2 + 2 foldable rows) | Yes | [VERIFIED] product page |
| DosageAssist | The tablet or powder leaves the door dispenser and lands in a tray on the top basket made for it, where it dissolves fully (product page). The 2017 catalogue adds that water jets are aimed at the tray | Yes | [VERIFIED] product page; AU catalogue 2017, PDF p.8 |
| AquaSensor | An optical turbidity sensor: a light barrier that measures how cloudy the rinsing water is (interactive manual). Spec sheet calls it "AquaSensor III". Part 00611323 "Sensor Aquasensor" is in the /13 parts list | Yes | [VERIFIED] interactive manual 9001575819; spec sheet; parts list |
| Load sensor | 2021 NZ brochure (PDF p.2), range-level text: the LoadSensor infers the weight of the load from a rotary speed sensor that responds to the water level. **Not listed** in this model's spec sheet or product page. The manual nevertheless lists the quantity of tableware among the things the running time depends on | Not claimed for this model | [VERIFIED] absence checked in spec sheet and product page |
| Automatic detergent detection | With a combined detergent the washing programme adapts itself for the best washing and drying result (manual). 2017 catalogue (older name AutoBrilliance): the temperature is adapted for multi-function tablets so that their rinse aid is fully used | Yes | [VERIFIED] manual p.27; AU catalogue 2017, PDF p.8 |
| Heat exchanger | Residual heat is used for rinsing and drying; the catalogue credits it with saving energy, reducing temperature shock and, because no outside air is drawn into the machine, hygienically clean results. Part 00770952, a complete heat exchanger with a 325 V DC valve, described as including the regeneration dosing | Yes | [VERIFIED] AU catalogue 2017, PDF p.8; part page (saved by earlier run) |
| Drying principle | Condensation drying: the inner walls of the tub collect the moisture of the air as condensate, which drains down and leaves with the pumped-out water; the manual attributes water droplets left in the tub to this principle | Yes | [VERIFIED] interactive manual 9001575819, troubleshooting |
| Automatic door opening (EfficientDry and similar) | Not in the spec sheet; no such basic setting among H, r, d, A, I, b, Cn, rc, rE; "Door-opening sensor: no" | **No** | [VERIFIED] manual p.32-34; product page |
| Zeolith drying | not listed | **No** | [VERIFIED] spec sheet |
| EcoSilence / SilentPower drive | A brushless motor, presented as much lower in friction (product page); 2017 catalogue: both the wash pump and the drain pump are brushless | Yes | [VERIFIED] product page; AU catalogue 2017, PDF p.8 |
| Self-cleaning filter | A three-piece corrugated filter (spec sheet). 2017 catalogue: an extra nozzle in the spray arm cleans the tub floor and breaks food down so that it passes the filter without blocking it | Yes | [VERIFIED] spec sheet; AU catalogue 2017, PDF p.8 |
| Glass protection | Spec sheet: "AquaMix - Glass protection system". Product page: "Precise Glass Protection: no" (no raw-water valve). Mechanism not explained in any document for this model | Basic form only | [VERIFIED] the two listings; mechanism not found |
| AquaStop | When its sensor finds a leak the machine stops, pumps the water out and closes the separate valve next to the tap (product page). The valve is in the plastic housing on the supply hose; it only works with power connected | Yes | [VERIFIED] product page; manual p.5, p.11 |
| Water softener | Ion exchanger with salt dispenser in the tub floor; 8 settings H00 to H07 | Yes | [VERIFIED] manual p.22-24 |
| Home Connect | WLAN 2.4 GHz and 5 GHz; Remote Start; Smart Start; Silence on Demand; favourites; filter-cleaning notice from the app | Yes | [VERIFIED] manual p.34-35, p.38, p.49 |
| Silence on Demand | Lowers the noise as far as it can for a period of up to 30 minutes, whenever it is asked for; app only | Yes | [VERIFIED] product page |
| InfoLight | red spot projected on the floor while a programme runs; flashes if the door is not fully closed | Yes | [VERIFIED] manual p.32-33 |
| HygienePlus, IntensiveZone, TimeLight, child lock, water storage tank | none of these appears in the manual's programme or option tables or the spec sheet | **No** | [VERIFIED] absence |
| Sensor-sensitivity setting | A same-generation generic BSH manual (9001442770_A) has a basic setting "Sensor setting SE:00 - SE:02". This model's basic settings have no such entry | **No** (not user-adjustable at the panel) | [VERIFIED] manual p.32-34 |

### 3.3 Control panel

Official product photograph (source 18, shot 16580356), left to right on the door's top edge [VERIFIED, read from the image]: BOSCH logo; on/off button with "Reset 4 sec." beneath; six programme buttons, Eco 50° first, with an indicator bar that is lit red on the selected one (Eco in the photograph); a seven-segment display in "h:mm" form with symbols for salt, rinse aid, Wi-Fi and water supply above it; then the option buttons (with "Setup 3 sec." printed below the last), and "Start"; a "Silence" badge at the far right. The time shown in that photograph ("0:40") is a mock-up, not a programme duration.

The manual's control overview (p.14-15) lists 13 items: on/off and reset; programme buttons; salt refill indicator; rinse-aid refill indicator; WLAN display; water supply display; programme buttons and additional functions; Start; the Setup button (hold 3 s for basic settings); Remote Start; timer programming; door handle; display (remaining running time, or the basic settings) [VERIFIED].

### 3.4 Basic settings (manual p.32-34) [VERIFIED, whole table]

| Setting | Factory | Range | Description (summarised) |
|---|---|---|---|
| Water hardness | H04 | H00 - H07 | H00 switches the softener off |
| Rinse aid dispensing | r05 | r00 - r06 | r00 switches the rinse-aid system off |
| Intensive drying | d00 | d00 - d01 | Raises the final-rinse temperature for a better drying result; the run time may rise slightly. In effect a permanent Extra Dry |
| Hot water | A00 | A00 - A01 | cold or hot connection; a hot supply should be at least 40 °C and at most 60 °C |
| InfoLight | I01 | I00 - I01 | |
| Tone volume | b02 | b00 - b03 | |
| Wi-Fi | Cn0 | Cn0 - Cn1 | available after pairing |
| Remote Start | rc1 | rc0 - rc2 | |
| Factory setting | rE | | reset |

## 4. Scope of supply and installation

Delivered with the appliance (manual p.10) [VERIFIED]: dishwasher, operating instructions, installation instructions, further information documents, installation material, steam protection (a vapour-barrier plate for the worktop underside), salt filling funnel (only with some appliance specifications), mains cable, quick reference guide.

Installation sheet 9001594147_C (rendered at 4x) [VERIFIED]: accessory list with a 1.75 m mains lead, screws 4x15, 4x42 and 4x36 mm; niche 600 (max. 608) wide, 815-875 high, 550 deep; service cut-out about 100 x 50 mm in the neighbouring cabinet; feet adjustable 0 - 60 mm (front feet with a 13 mm spanner, rear foot from the front with a 10 mm tool); door front max. 725 x 594 mm, 2.5 - 8.5 kg, 2 mm pilot holes about 12 mm deep; tap must deliver 10 l/min; inlet fitting torque max. 10 Nm; supply 0.05 - 1 MPa (0.5 - 10 bar), max. 60 °C; a leak check is called for after the first wash cycle. Nothing in it describes the tub interior, baskets or hydraulics.

The supplement 9000300601_E names the extension parts: hose extension set 00350564 (drain hose extension 2 m of 22 mm diameter, total drain length max. 4 m; inlet extension 2.2 m) and a 5 m mains cable 12022522 [VERIFIED].

Not relevant to the simulation but recorded: the appliance must not be installed under a hob or near heat sources; at least 5 cm from installation lines (manual p.5, p.9) [VERIFIED].

## 5. Programmes

### 5.1 Eco 50, summarised from the user manual (9001937295_B p.16) [VERIFIED]

| Programme | For which tableware | For which soiling | Sequence (temperatures as printed) |
|---|---|---|---|
| Eco 50° | Mixed tableware and cutlery | Ordinary household residues, lightly dried on | Presented as the most economical programme: pre-rinse; cleaning at 50 °C; intermediate rinse; final rinse at 61 °C; drying |

Notes printed around the table (p.15-17), summarised [VERIFIED]:

- The running time depends on how much tableware is loaded, how soiled it is, and the temperature of the water. Running time and energy consumption both rise when the rinse-aid system is switched off or needs refilling.
- The consumption values are in the quick reference guide. They are stated for what the manual calls normal conditions, with water of 16 - 20 °E hardness; factors such as water temperature or pipe pressure can shift them.
- The manual explains the long running time of Eco 50° by longer soaking and drying times.
- Eco 50° is the default at switch-on and is the programme the manual names as showing conformity with the EU Ecodesign Directive (p.30).

### 5.2 Consumption, values from the quick reference guide (9001937296_A p.1, and identically short instructions 9001643502_B p.1) [VERIFIED]

The guide's header says that the programme data were measured in the laboratory to EN 60436, and that the running time changes when the rinse-aid system is switched off or needs refilling.

| Programme | Duration [h:min] | Energy consumption [kWh] | Water [l] |
|---|---|---|---|
| Eco 50° | 4:55 | 0.836 | 9.5 |

The same Eco figures appear in the 2020 generic quick guide of the free-standing sister SMS4HAI48E (9001462502_A, "650/642 V1"), which I decoded from its shifted font encoding [VERIFIED]. The table is therefore common to the 13-place heat-exchanger variants of the platform, not specific to the UK model.

### 5.3 Options and their printed effects

Manual p.17-18 [VERIFIED]:

| Option | Printed effect (summarised) |
|---|---|
| Extra Dry | The final-rinse temperature is raised and the drying phase extended, for a better drying result; recommended above all for plastic. Energy consumption rises slightly and the running time is longer. |
| Half Load | For small loads; the manual recommends less detergent than for a full load. The running time is shorter and both water and energy consumption fall. |
| SpeedPerfect+ | The run time is shortened "by 15% to 75% depending on the rinse programme". It can be switched on before the start or at any time during the run. Energy and water consumption rise. |

Other official statements about the same options: the official UK image tile for this model says SpeedPerfect+ cuts the wash and drying time by up to half [VERIFIED, source 18, image 17757736]; the Home Connect API says VarioSpeedPlus reduces the run time "by up to 66%", describes HalfLoad as economical cleaning of smaller loads with less energy, water and time and with items allowed in both baskets, ExtraDry as better drying for glasses and plastic, and SilenceOnDemand as an extra-quiet mode for a chosen period [VERIFIED, api-docs.home-connect.com].

Other time-affecting facts [VERIFIED]:

- Timer: start can be delayed by up to 24 hours (manual p.31).
- Softener regeneration: every 6 washing programmes at the factory setting, adding at most 7 minutes, 5 litres and 0.05 kWh; in every programme it is done before the end of what the manual calls the "main rinse cycle" (manual p.24; the values were determined with the Eco 50° programme and the factory hardness setting of 16 - 20 °E).
- Cancelling: hold Reset about 4 s; the programme then ends after about 1 minute. The interactive manual adds that the display shows "0h:01m" and that the remaining water is pumped out. So a full drain takes about one minute.
- Transport instruction: start the hottest programme and cancel it after about 4 minutes to drain. By four minutes the machine has taken in its first fill.
- The appliance switches off 1 minute after the end; the end is shown as "0h:00m".
- Interrupted and reopened hot: the door is to be left slightly ajar for a few minutes before it is closed, to avoid pressure build-up.

### 5.4 What the printed totals imply about fills [ESTIMATED throughout; inputs are the VERIFIED figures of 5.1 and 5.2]

- The manual prints one cold bath at 4.0 l in 15 min; one fill is therefore about 4.0 l. Its 0.050 kWh over 0.25 h is an average of 200 W with no heating, an upper bound on pump plus electronics.
- Eco 50° prints four water phases and 9.5 l. Four fresh baths would be 2.4 l each; three fresh baths give 3.2 l each. This fits the AquaSensor text: pre-rinse water kept for the cleaning phase.
- So: about 3.2 to 4.0 l per fresh fill. This replaces nothing in machine.md by itself, but it bounds the water inventory: SPOT-60's 3.8 / 2.9 / 2.8 l is the right order.
- Drain: a full bath leaves in about one minute (5.3), so at least 3.5 to 4 l/min averaged; compatible with SPOT-60's 55 s pattern.

## 6. Loading

### 6.1 Basket heights (manual p.21) [VERIFIED]

The manual's table for an appliance 81.5 cm high with a cutlery basket:

| Level | Top basket, max. diameter | Bottom basket, max. diameter |
|---|---|---|
| 1 | 22 cm | 30 cm / 31 cm (the 31 cm refers to the arrangement shown on p.19-20) |
| 2 | 24.5 cm | 27.5 cm |
| 3 | 27 cm | 25 cm |

Level 1 is the highest position of the top basket: the loading leaflet 9001459881 p.1 labels the three latch positions 1, 2, 3 from top to bottom [VERIFIED, drawing].

Derived [ESTIMATED]:

- Step between levels: 24.5 - 22 = 27 - 24.5 = 2.5 cm, total travel 5 cm, matching the travel of up to 5 cm given on the product page.
- Top plus bottom maximum is 52 cm at all three levels. The combined usable item height of the two baskets is fixed; Rackmatic only moves the split.
- Check values for the owner's tape measure: the gap from the lower basket's plate support to the underside of the upper spray arm should be a little over 300 / 275 / 250 mm, and from the upper basket's plate support to the ceiling (or roof sprinkler) a little over 220 / 245 / 270 mm.

Why sister models with a cutlery drawer must not be used for upper-basket limits: the same-generation generic BSH manual 9001442770_A (p.27) prints all four tables. 81.5 cm with cutlery basket: 22 / 24.5 / 27 cm top, 31 / 27.5 / 25 cm bottom. 81.5 cm with cutlery drawer: 16 / 18.5 / 21 cm top, same bottom. (86.5 cm appliances: 24 / 26.5 / 29 with basket, 18 / 20.5 / 23 with drawer; bottom 34 / 30.5 / 28.) The drawer costs exactly 6 cm of top-basket height [VERIFIED]. The free-standing sister SMS4HAI48E manual prints the same cutlery-basket table as ours [VERIFIED, 9001453806_C p.23].

### 6.2 Top basket

Summarised from the manual (p.18-19) [VERIFIED]: cups, glasses and small items go in the top basket, and its height can be changed to make room for larger items. Height adjustment: pull the basket out, hold it by the top edge at the side, press in the levers on the right and left on the outside of the basket, raise or lower evenly, check that it sits level on both sides, release; the basket clicks into position.

Fittings, from official data:

| Fitting | Evidence | Tag |
|---|---|---|
| Knife shelf along the left side (for knives and long items of cutlery) | manual p.18-19 figures (label "a" on the left); spec sheet "Knife rack in top basket"; BOM 11037806 (knife-shelf insert, plastic, grey); owner photo IMG_9083 and the official product photograph both show a grey plastic shelf on the left | [VERIFIED] |
| Cup shelf ("Etagere") on the right, in two parts: a long and a short one, both can be folded up and are described as lowerable | manual p.19 (it calls this the cutlery shelf): the shelf and the space under it take small cups and glasses or large cutlery such as cooking spoons and serving cutlery, and the shelf folds up when not needed; BOM 12005548 (cup shelf for the upper basket, lowerable, long, grey) and 12005549 (the same, short); German sister page: a two-part cup shelf in the upper basket | [VERIFIED] |
| Two foldable tine segments, both on the right: one front, one rear | product page "Number of Flip Tines in Upper Rack: 2"; BOM 12033302 (folding tines, upper basket, right, front, dark grey) and 12033291 (folding tines, upper basket, right, rear, dark grey); owner photo IMG_9083: the only dark-grey tine line is right of centre, with a hinge clip at mid-depth; the two tine rows left of centre are basket-coloured (fixed) | [VERIFIED] |
| Tablet collecting tray at the front centre, below the handle | manual p.12-13 overview; owner photo IMG_9083; official product photograph | [VERIFIED] |
| Handle with red stripe at the front | owner photo IMG_9080; BOM 12033368 "Basket handle" | [VERIFIED] |
| Upper spray arm underneath, fed by a 270 mm pipe to the rear feed tube | part 11010054: width 460 mm, pipe length 270 mm | [VERIFIED] |

Folding prongs (manual p.20) [VERIFIED], summarised: upright, the prongs hold tableware such as plates securely; folded down, they make room for pans, bowls and glasses. To fold, push the lever forwards and fold the prongs down; folded back up, they click audibly into position.

The manual's example picture of a loaded top basket (p.18) shows, from the front: knife shelf on the left with two knives and a ladle; a row of about eight saucers or dessert plates with a shallow bowl in the left-centre tines; four tall tumblers in the centre; cups on and under the cup shelf on the right; small bowls and cups along the front; the tablet tray empty at the front centre [VERIFIED as a description of the drawing; it is an illustration, not a rated load].

### 6.3 Bottom basket

Summarised from the manual (p.19-20) [VERIFIED]: pans and plates go in the bottom basket, and large plates up to 31 cm in diameter fit there in the arrangement the manual draws. The picture (p.20) shows four large plates standing at one side of the basket between the side tine rows, with the rest of the basket empty and no cutlery basket. The loaded example (p.19) shows a large pot, a casserole and a pan on the left, dinner and soup plates in the rear rows, a serving bowl on the right, and the cutlery basket at the front centre-right.

Foldable rows: product page "Number of Flip Tines in Lower Rack: 2" and spec sheet "2 foldable plate racks in bottom basket"; BOM 12033326 (folding tines for the lower basket, rear, dark grey, one piece). Owner photo IMG_9081 shows two full-width dark-grey tine rows at the rear on hinge bearings with a fold lever marked by an arrow at the right-hand end; the short side rows towards the front are basket-coloured (fixed) [VERIFIED].

Other fittings [VERIFIED]: low-friction wheels on the bottom basket and a "Rack Stopper" that keeps it from derailing (spec sheet); handle with red stripe at the front (owner photo IMG_9080). The leaflet drawing shows four wheels on the visible side.

### 6.4 Cutlery basket

Manual p.20 [VERIFIED]: cutlery goes into the cutlery basket unsorted, with sharp points down. Safety chapter p.6: knives and other sharp utensils go points down in the cutlery basket, or on the knife shelf (or in a cutlery drawer, where there is one). Official part text: six compartments with dividers; the basket stands on the grid of the lower basket; long pointed items and knives belong on the knife shelf [VERIFIED, bosch-home.com/de part 11057829]. The spec sheet calls it "moveable": it has no fixed position. In the owner's photographs it stands at the front centre with its carrying handle running front to back.

### 6.5 Baking sheet spray head (manual p.21) [VERIFIED]

The head is for large items such as trays, grilles and plates. At most 2 baking sheets and 2 grilles go in, arranged as drawn so that the jet reaches every part. Fitting: remove the top basket, insert the head in the holder and turn to the right until it clicks; remove by turning anticlockwise. One drawing shows three ports one above another on the rear feed pipe, the head going into the middle one, and a head with about 20 round outlet holes. Two sheets and two grilles lean against the left and right sides of the lower basket in the other drawing. The three ports are the docking positions for the three Rackmatic levels ("new docking system" in the part name).

### 6.6 The loading leaflet 9001459881_A

Eight isometric line drawings, clearly drawn from CAD. It is a generic leaflet for the basket family, so not every drawn feature is on this machine.

Page 1 [VERIFIED as descriptions]:

- Top left: empty top basket with movable parts in blue. A knife shelf on the left marked with a shopping-trolley symbol (sold as an accessory where not fitted; on this model it is fitted). Fold arrows on tine rows and on the two-tier cup shelf on the right. A blue latch at the side with levels 1, 2, 3 marked top to bottom and an arrow showing the lever being pressed in. The tablet tray hangs at the front.
- Top right: top basket loaded with small plates and saucers in the left-centre row, dessert plates behind, mugs along the left under the knife shelf, tumblers between the rows, cups on and under the cup shelf, a stem glass leaning on the cup shelf, long knives and a ladle on the knife shelf. A strip of glass silhouettes heads the drawing.
- Bottom left: top basket with rows folded, holding a tall pot, a glass bowl, glasses and cups.
- Bottom right: bottom basket on the open door with the cutlery basket near the front, four tine rows across the width each with a "0 / 1" (up / folded) symbol, and a blue fold-down rack at the rear right.

Page 2 [VERIFIED as descriptions]: a bottom basket variant whose rear rows have four positions "0 / 1 / 2 / 3" and front rows "0 / 1"; one drawing with plates and tall stem glasses held by a glass support; one with a stockpot, pans, a bowl and plates.

Reading it for this machine: the leaflet's bottom baskets have four or more foldable rows and a fold-down rack; the owner's basket has two foldable rear rows and no such rack (6.3; the German sister's data say there is no glass support bar in the lower basket). Use the leaflet for the top basket layout and for proportions, not for the count of foldable rows.

### 6.7 All the loading advice in the manual

Manual p.29-30, the section on arranging tableware [VERIFIED, summarised from the manual; two sentences the simulator relies on are quoted]:

- Nothing may stick out of the baskets so far that it gets in the way of the closing door. An item that sticks out can push the door open during the programme and let steam and water out.
- Loading the rated number of place settings (the standard load of tableware and cutlery) is what saves energy and water.
- Items with curves or hollows are to stand at an angle so that water runs off them; this helps both washing and drying.
- Large food remnants are to be scraped off. Pre-rinsing under the tap is discouraged as a waste of resources.
- Heavily soiled items such as pans belong in the bottom basket. The manual gives the reason: "The more powerful the spray jet, the better the dishwashing result will be."
- Everything must stand stably and be unable to tip over, or it may be damaged.
- Cutlery goes in with points and sharp edges down, against injury.
- Containers go in open side down, so that no water collects in them.
- "Do not block the spray arms - make sure that they can turn freely."
- No small parts in the tablet collecting tray, and no tableware blocking it: either would obstruct the lid of the detergent dispenser.
- Unloading: bottom basket first, then upwards, so that no water drips onto the tableware below.
- Not dishwasher-safe (p.28): wooden items, decorated glassware, antique and hand-crafted tableware, plastic not resistant to heat, copper or tin, items soiled with ash, wax, lubricating grease or paint, very small items.

Failure causes the manual itself names (troubleshooting p.43-45, plus the interactive manual 9001575819) [VERIFIED, summarised]. These are a ready-made list of loading faults the simulator should reproduce:

| Symptom | Cause the manual names (summarised) |
|---|---|
| Remnants of food | Items standing too close together, or an overfilled basket: the jets have to reach the surfaces, and the remedy given is "Avoid points of contact." |
| Remnants of food | Spray arm unable to rotate; spray arm nozzles blocked; filters soiled; filters wrongly inserted or not engaged |
| Remnants of food | "Tall narrow receptacles in corner areas are not rinsed adequately." The remedy given is not to stand them at too steep an angle and not in the corners |
| Remnants of food | The right and left sides of the top basket set to different heights |
| Remnants of food | A programme too weak for the load; or the sensors chose a weaker programme after pre-rinsing by hand |
| Detergent residue in the final rinse | The dispenser lid is blocked by tableware and cannot open fully: the top basket is to be loaded so that the tablet collecting tray stays clear, and neither tableware nor a fragrance dispenser may be put in the tray |
| Detergent residue in dispenser or tray | Tableware stopped the spray arms, so the detergent stayed where it was; or the dispenser was damp when it was filled |
| Detergent residue (interactive manual) | The lid is blocked by the tablet itself: the tablet is to lie crosswise, not upright. |
| Not dry (interactive manual) | Water standing in hollows of tableware or cutlery; plastic, which stores less heat and so dries less well; cutlery touching, where droplets form at the points of contact; unloading sooner than 30 minutes after the end of the programme |
| Knocking or rattling (interactive manual) | A spray arm striking tableware; with a small load, jets hitting the tub directly; light items moving about during the wash |
| Door will not close or opens (interactive manual) | The top basket pressing against the inner door; items projecting beyond the basket |
| Tea or lipstick marks (interactive manual) | Washing temperature too low |
| Water left at the end (interactive manual) | A blockage in the filter system or beneath the filters |

Bosch UK's web page "How to properly load a dishwasher" (fetched this session) adds [VERIFIED]: cups, glasses and small bowls in the top basket with space between them; dishwasher-safe plastics in the top basket away from the heat; large items below; serving plates and chopping boards at the side, because large items can block the spray arms and the flow of water; mix forks and spoons in the cutlery basket so they do not nest; do not let dishes overlap; no pre-rinsing, but scrape off large pieces because they can block the filter. The same page contradicts itself on knives (edge down in one place, handle up in another).

### 6.8 The loading pattern "for test institutes"

Manual p.16-17 [VERIFIED], summarised: test institutes can obtain information for comparability tests, for example to EN 60436. What they get is the conditions for running the tests, not results or consumption values. The request goes by e-mail to dishwasher@test-appliances.com and must state both the E-Nr. (product number) and the FD (production number).

No loading plan for the rated 13 place settings is printed in the manual, the quick guides, the leaflet or on the product page, and I could not find one published anywhere (web searches in English and German; test-appliances.com refuses connections). It is obtainable only by that e-mail. The owner holds both required numbers: E-Nr SMV4HAX40G/13 and FD 0106. Fallback: the EN 60436 standard load for 13 place settings arranged by judgement using the manual's example pictures (6.2, 6.3).

## 7. Detergent, rinse aid, softener

### 7.1 Detergent dispenser and tablet tray

Location and construction [VERIFIED]: on the inner door, drawn in the manual's overview (p.12) left of centre with the rinse-aid dispenser immediately to its right; in the official 3/4 product photograph (source 18, shot 17757776) it sits in the upper part of the door near the control-panel edge. One combined unit, official part 00755073 (a combined dosing unit for detergent and rinse aid), envelope 120 x 105 x 65 mm (part page re-fetched; orientation of the three dimensions not stated).

Operation (manual p.27-28) [VERIFIED], summarised:

- The lid opens when the locking latch is pressed. Detergent goes into a dry chamber. The lid is closed until it clicks.
- Fill marks in the chamber: 15 ml, 25 ml, 50 ml.
- One tablet is enough; it is laid in horizontally.
- 20 ml to 25 ml of detergent is enough for normal soiling; a little less usually does for lightly soiled tableware.
- The dispenser opens by itself during the programme; the manual says only that this happens "at the optimum time". Powder or liquid then spreads around the tub and dissolves there. A tablet falls into the tablet collecting tray and dissolves there. Nothing else may be put in the tray, so that the tablet dissolves evenly.
- Tip in the manual: with powder detergent and a programme that has a pre-rinse, a little detergent may also be put on the inside of the door.
- Half Load: less detergent recommended (p.18).
- Adding dishes mid-cycle: the tablet collecting tray is not to be used as a handle for the top basket, because the hand may touch the partly dissolved tablet (p.31).
- Safety: children can catch their fingers in the slots of the tablet collecting tray (p.8). The tray is slotted.

Detergent types (p.26-27) [VERIFIED], summarised: liquid acts faster and may leak out of the closed dispenser. Modern detergents are described as low-alkaline with enzymes; oxygen bleach is for coloured marks. Combined products work up to a water hardness of 26 °E; salt and rinse aid are recommended from 17 °E. Hand washing-up liquid causes frothing; chlorine detergents are not to be used.

When the lid opens is not stated.

### 7.2 Rinse aid (manual p.24-26) [VERIFIED]

Dispenser next to the detergent chamber: press the catch on the lid, lift, fill to the "max" mark, close until it clicks. Rinse aid spilled outside the dispenser can make the wash foam heavily. Setting r00 to r06, factory r05: a low setting doses less rinse aid and reduces streaking; a higher setting doses more, reduces water marks and improves the drying result. r00 switches the system and its refill lamp off. With combined detergents the manual says the function of rinse aid is limited. Running time and energy rise when the system is off or empty (p.15).

Not printed: the dose in millilitres per setting, the reservoir volume, the moment of release.

### 7.3 Water softener (manual p.22-24) [VERIFIED]

The manual requires water harder than 9 °E to be softened, to avoid damage to the appliance. (°E here is the Clarke degree used in the UK manual.)

| Water hardness °E | Range | mmol/l | Setting |
|---|---|---|---|
| 0 - 8 | Soft | 0 - 1.1 | H00 |
| 9 - 10 | Soft | 1.2 - 1.4 | H01 |
| 11 - 12 | Medium | 1.5 - 1.8 | H02 |
| 13 - 15 | Medium | 1.9 - 2.1 | H03 |
| 16 - 20 | Medium | 2.2 - 2.9 | H04 (factory) |
| 21 - 26 | Hard | 3.0 - 3.7 | H05 |
| 27 - 38 | Hard | 3.8 - 5.4 | H06 |
| 39 - 62 | Hard | 5.5 - 8.9 | H07 |

Salt: dispenser in the tub floor at the front left (manual figures; owner photo IMG_9082 shows the grey screw cap with an "S" symbol). On first use fill the dispenser with water, then with special salt; the salt displaces the water, which runs out. Add salt just before a programme so that spilled brine is washed away (corrosion). No salt tablets (the manual says the sensor does not detect them), no table salt, never detergent.

Regeneration: the appliance regenerates the softener at regular intervals, in every programme before the end of the "main rinse cycle", and this raises the run time and the consumption values. Maximum additions: after 6 washing programmes; 7 minutes; 5 litres; 0.05 kWh (Eco 50°, factory hardness setting). Note "main rinse cycle" is the manual's English for the main wash phase; the German original was not checked.

## 8. Filter system, spray arms, pump

### 8.1 Filter system (manual p.37-38) [VERIFIED]

The filter system keeps coarse soiling out of the circulating wash water. Three parts: 1 micro filter (a pleated cylinder hanging below the plate), 2 fine filter (the flat plate on the tub floor), 3 coarse filter (a slotted cylinder inserted from above through the centre of the plate, with two locking catches).

Handling, which reveals the construction: the filters are to be checked for residue after each wash. Turn the coarse filter anticlockwise and lift the whole system out (taking care that nothing falls into the sump); pull the micro filter down off the assembly; press the two locking catches together and lift the coarse filter out; rinse under running water; clean the rim between the coarse and the fine filter of dirt; reassemble, insert, turn clockwise until the arrow on the coarse filter meets the arrow on the plate.

Official part dimensions (part 00645038, in the /13 parts list as "Filter-micro"; German page re-fetched) [VERIFIED]: a two-part filter set (coarse filter plus micro filter): the fine cylinder is 71 mm in diameter and 92 mm high, the coarse filter 79 mm in diameter and 131 mm high. (The German text calls the pleated cylinder "Feinsieb"; the English manual calls it the micro filter.) The flat plate is a separate part, 00645037 "Filter-fine"; no dimensions are given for it.

Flat plate size from the owner's photograph IMG_9082 [ESTIMATED]: scaled against the 79 mm coarse-filter collar the plate comes out 300 to 350 mm wide; scaled against an assumed 545 mm tub width it comes out about 276 mm. Take 300 mm plus or minus 40 mm until measured. (The collar stands above the plate, which biases the first figure upward.)

The same photograph shows what the drawings show: plate of perforated metal with rounded corners in front of the lower-arm hub, a slotted plastic cover with diagonal ribs behind it, the salt cap to the left [VERIFIED].

Self-diagnosis [VERIFIED]: error E:92-40 means the filters are soiled or blocked and need cleaning (manual p.42). The Home Connect app announces when the filters need cleaning (p.38).

### 8.2 Wastewater pump (manual p.45-46) [VERIFIED]

Under the filter system a pump cover can be prised off with a spoon and lifted inwards at an angle; the impeller can then be reached by hand. The cover presses back until it clicks. E:61-02: pump blocked or cover loose; E:61-03: water not drained (siphon closed, hose kinked or blocked).

### 8.3 Spray arms (manual p.39) [VERIFIED]

Scale and dirt carried by the wash water can clog the spray arms' nozzles and bearings. Upper arm: unscrewed and pulled down (a threaded collar under the basket). Lower arm: pulled straight up; on refitting it clicks into position. Check the outlet nozzles under running water.

The drawings are schematic: the upper arm is drawn with three nozzles per side, the lower arm with three on one side and about five on the other plus a tip opening. Do not take nozzle counts from them; the owner's photographs are the evidence (Cross-link: hardware and photograph angles).

Official dimensions [VERIFIED, part page 11010054 re-fetched]: upper spray arm width 460 mm (tip radius 230 mm), inlet pipe length 270 mm. SPOT-60's mid-arm tip radius of 232 mm is confirmed to within 2 mm. No official dimension for the lower arm was found on its part page (00668148). Caution: do not place the upper arm's axis by adding the 270 mm pipe length to the feed pipe's offset from the back wall. A 230 mm radius arm must sit at least 230 mm from both the back wall and the door liner, so in a tub about 500 mm deep its axis is within a few centimetres of mid-depth; the 270 mm is a part length that evidently includes the docking end [ESTIMATED reasoning; the axis position needs a tape measure].

### 8.4 Error codes that describe the machine's own monitoring [VERIFIED; manual p.40-42 and interactive manual 9001575819]

E:20-60 calcified heating element detected (the heater is in the water path); E:30-00 and E:31-00 water protection system activated; E:32-00 no water supply; E:34-00 water runs in continuously; E:61-02, E:61-03 drain faults; E:90-01 mains voltage too low; E:92-40 filters blocked; E:01-00 to E:90-10 other technical faults.

## 9. Mapping to machine.md section 12.1

"Generic" is SPOT-60. Only quantities touched by official documents are listed; everything else stays generic until the hardware angle or the owner supplies it.

| machine.md parameter | Generic | SMV4HAX40G from official documents | Tag |
|---|---|---|---|
| machine | "13 place settings, 3 arms, third rack" | 13 place settings, 2 arms plus roof sprinkler, cutlery basket, no third rack | [VERIFIED] |
| frame.tub | 546 x 500 x 650 interior | no official interior dimension; exterior 598 x 550 x 815 | [VERIFIED] exterior only |
| door hinge | y = -262, z = -20 in machine frame | constraint only: hinge depth plus door length above hinge = 1150 mm (section 2) | [ESTIMATED] |
| filter.coarse_cup | diameter 60, height 105 | diameter 79, height 131 | [VERIFIED] |
| filter.micro | mesh 0.20, area 190 cm2 | pleated cylinder, diameter 71, height 92; mesh not stated | [VERIFIED] dimensions |
| filter.flat_plate.size_xy | 260 x 220 | width about 300 plus or minus 40; depth not measured | [ESTIMATED] |
| dispenser | lid 95 x 60, keep-out 62 | unit envelope 120 x 105 x 65; marks 15 / 25 / 50 ml; position upper door, left of centre | [VERIFIED] |
| racks.third | present | delete | [VERIFIED] |
| racks.cutlery_basket.cells | 7 | 6 | [VERIFIED] |
| racks.upper.grid_top_z_options | 350 / 375 / 400 | three levels, 25 mm apart (absolute heights not official) | [ESTIMATED] from the printed table |
| racks.upper.cup_shelves.count | 4 | 2 (one long, one short), on the right; knife shelf on the left | [VERIFIED] |
| racks.upper foldable rows | not specified | 2 segments, right side, front and rear | [VERIFIED] |
| racks.lower.foldable_rows | rows 5, 6, 7, 8 (four) | 2 rows, at the rear | [VERIFIED] |
| stack-up, max item heights | section 2.6 baseline | top basket 220 / 245 / 270 mm; bottom basket 300 (310 in the marked position) / 275 / 250 mm | [VERIFIED] |
| arms.mid.tip_radius | 232 | 230 (width 460) | [VERIFIED] |
| arms.top | arm, tip radius 135 | not an arm: roof sprinkler ("Dachkreisel") on the feed pipe | [VERIFIED] |
| hydraulics.pump speed | range 1400 to 3400 rpm | brushless drive | [VERIFIED] |
| hydraulics.inventory, fills | 3.8 / 2.9 / 2.8 l (Eco) | about 3.2 to 4.0 l per fresh fill; one cold bath 4.0 l | [ESTIMATED] section 5.4 |
| hydraulics.drain | 16 l/min, 55 s pattern | about one minute for a bath | [VERIFIED] statement |
| thermal.heater_W | 2000 | rating 2000 - 2400 W at 220 - 240 V behaves as about 24.1 ohm: 220^2 / 2000 = 24.2, 240^2 / 2400 = 24.0; at 230 V about 2195 W for the whole appliance, so roughly 2100 W of heater | [ESTIMATED] |
| thermal.T_inlet_C | 15 | cold fill is the factory setting (A00); hot fill 40 to 60 °C possible | [VERIFIED] |
| dosing.detergent | 20 g | 20 - 25 ml powder or liquid for normal soiling, or one tablet | [VERIFIED] |
| dosing.release time | 60 s after circulation | not stated | not found |
| dosing.rinse_aid | 3 ml at 40 °C | setting r05 of r00 - r06; volume and timing not stated | [VERIFIED] setting only |
| softener | not modelled in 12.1 | H04 factory; regeneration every 6 cycles, at most +5 l, +7 min, +0.05 kWh | [VERIFIED] |
| drying.method | heat_exchanger_plus_auto_open, 25 min, 100 mm gap | heat exchanger, condensation on tub walls, **door stays closed** | [VERIFIED] |
| programme | section 7.3 | Eco 50° | [VERIFIED] |
| programme temperatures | section 7.3 | cleaning / final rinse: Eco 50 / 61 °C | [VERIFIED] |
| programme totals | section 8 | table in 5.2 | [VERIFIED] |

### 9.1 The same, as an overlay on the 12.1 data block

Only keys that an official document supports are given. V = [VERIFIED], E = [ESTIMATED]; "keep" means leave the SPOT-60 value until it is measured.

```yaml
machine: BOSCH-SMV4HAX40G/13       # type SD6PW1B, platform GV640, FD 0106; 13 place settings (V)
frame:                              # mm
  exterior: {w: 598, d: 550, h_min: 815, h_max: 875}          # V spec sheet, installation sheet
  tub: keep                          # no official interior dimension
  door: {open_reach_from_rear: 1150, inner_slab_thickness_planning_model: 30.5}   # V spec sheet; V KPL model
  filter:
    flat_plate: {width: 300, width_tolerance: 40}             # E owner photo IMG_9082; depth keep
    coarse_cup: {diameter: 79, height: 131}                   # V part 00645038
    micro: {diameter: 71, height: 92, pleated: true}          # V part 00645038; mesh keep
    blockage_alarm: E:92-40                                   # V manual p.42
  dispenser: {unit_envelope: [120, 105, 65], chamber_marks_ml: [15, 25, 50],
              position: "inner door, upper part, left of centre; rinse-aid chamber to its right"}   # V
racks:
  third: null                                                 # V no third rack
  cutlery_basket: {cells: 6, location: lower, movable: true}  # V
  upper:
    levels: 3                                                 # V
    level_step: 25                                            # E from 22 / 24.5 / 27 cm
    max_item_height_by_level: [220, 245, 270]                 # V level 1 = highest position
    foldable_segments: 2                                      # V right-hand line, front and rear
    cup_shelves: {count: 2, sizes: [long, short], side: right}          # V
    knife_shelf: {count: 1, side: left}                       # V
    tablet_tray: {position: front_centre, slotted: true}      # V
  lower:
    max_plate_diameter_by_upper_level: [300, 275, 250]        # V; 310 in the side position shown on p.20
    foldable_rows: 2                                          # V the two rear rows
    wheels: 8                                                 # E four drawn on one side in leaflet 9001459881
arms:
  lower: keep                                                 # pulls up off the hub (V); no official dimensions
  mid: {tip_radius: 230, feed_pipe_length: 270, docking_ports_on_rear_pipe: 3, mount: screw_collar}   # V
  top: {type: roof_sprinkler, part: "00611388"}               # V replaces the SPOT-60 top arm
  accessory: {baking_sheet_spray_head: {port: middle, max_sheets: 2, max_grilles: 2}}                 # V
hydraulics:
  pump: {drive: brushless}                                    # V
  fresh_fill_L: [3.2, 4.0]                                    # E from the printed totals
  drain_time_s: 60                                            # V a cancelled programme ends after about 1 minute
  tap_requirement: {min_L_per_min: 10, pressure_bar: [0.5, 10]}   # V
thermal:
  appliance_rating_W: [2000, 2400]                            # V at 220 to 240 V
  heater_W_at_230V: 2100                                      # E 230^2 / 24.1 ohm = 2195 W total, less pump and electronics
  T_inlet: cold                                               # V factory setting A00; hot fill up to 60 C possible
dosing:
  detergent: {powder_or_liquid_ml: [20, 25], tablets: 1, release_time: keep}   # V
  rinse_aid: {setting: r05, range: [r00, r06], dose_ml: keep}                  # V
  softener: {setting: H04, regeneration_every_cycles: 6, extra_L_max: 5, extra_min_max: 7, extra_kWh_max: 0.05}   # V
drying: {method: heat_exchanger_condensation, auto_open: false}                # V
programme:                                                    # V; duration h:min, energy kWh, water L
  eco_50:        {phases: [pre_rinse, clean_50, intermediate_rinse, final_rinse_61, dry], t: "4:55", e: 0.836, w: 9.5}
```

## 10. Conflicts between sources

1. **Net weight**: 33.9 kg (spec sheet en-GB and en-IE PDFs) against 33.6 kg (bosch-home.co.uk and bosch-home.ie product pages). German sister: 34.4 against 34.2 kg in the same way. Use 33.9; the difference is immaterial.
2. **Fuse and connected load**: spec sheet "Fuse protection: 10 A", "Connection rating: 2400 W"; rating plate and manual "10 - 16 A", "2000 - 2400 W".
3. **Basket name**: "Flex basket system" (spec sheet, product page) against "VarioFlex Basket (13 place settings)" on an official image tile for the same model. The tile is generic artwork; the data say Flex.
4. **Foldable rows**: product data say 2 upper, 2 lower. The replacement baskets now supplied as spare parts are described as "Oberkorb ... 4 Klappstacheln" (20001992, successor of 20001986) and "Unterkorb ... 6 Klappstacheln" (20007406, successor of 20001979), and the loading leaflet draws four or more foldable rows in the bottom basket. The owner's photographs show 2 and 2. The owner's basket is the truth for this machine; the successor parts are a richer variant.
5. **Timer**: spec sheet p.2 "Time delay (3, 6 or 24 hours)"; manual p.31 and product page: any delay up to 24 hours.
6. **Hose length**: inlet hose 165 cm (spec sheet), AquaStop hose "1,68 m" to the fixing plate (part page 00668113, saved by the earlier run), reach 1500 mm (line drawing).
7. **Height**: 815 mm (spec sheet), 813.5 mm (planning model), "82 cm" (EPREL, rounded).
8. **AquaSensor text**: present in both interactive manuals and in the sister PDF manual, absent from this model's 2025 PDF manual. The sensor itself is confirmed by the spec sheet, the product page and the parts list.
9. **Against machine.md's SPOT-60** (not errors, but replacements): third rack and top arm, automatic door opening, coarse filter size, cup-shelf count, foldable-row count, cutlery-basket cells. All listed in section 9.
10. **Bosch UK loading page** contradicts itself on knife orientation; the manual is unambiguous: points and sharp edges down.

## 11. Not found in any official document

| Quantity | Fallback from machine.md |
|---|---|
| Tub interior width, depth, height; floor slope | 546 x 500 x 650 mm, 4 degrees |
| Absolute heights of basket support planes and spray arms | grid tops 50 and 350 / 375 / 400 mm |
| Basket outer sizes, wire diameters, grid and tine pitches, tine heights | section 12.1 racks block |
| Cutlery basket outer size; tablet tray size; knife shelf and cup shelf sizes | 240 x 135 x 215 mm basket |
| Lower spray arm length; all nozzle positions, shapes and sizes; roof sprinkler size | section 3.2 tables |
| Pump curve, pump speeds, arm pressures, flow rates, arm rotation speed, diverter pattern | section 12.1 hydraulics block |
| Fill volume per phase (only programme totals are printed) | 3.8 / 2.9 / 2.8 l |
| Time at which the dispenser lid opens | 60 s after circulation starts |
| Rinse-aid dose per setting and release point; reservoir capacity | 3 ml at 40 °C |
| Heater rating separate from the appliance rating; pump electrical power | 2000 W |
| Heat exchanger volume and control | none |
| Softener resin capacity, salt container volume, water used per regeneration (only "at most 5 l") | none |
| Filter mesh sizes and open areas; flat plate dimensions | 0.8 mm holes, 0.20 mm mesh |
| Official loading plan for 13 place settings | EN 60436 standard load |
| How the glass-protection ("AquaMix") function works on this model | none |
| Whether this model senses load, and how | generic model has no load sensing |

## 12. Cross-links to the other angles

- Hardware: the official part pages give more than the manuals do. Already read here: 11010054 (upper arm 460 mm, pipe 270 mm), 00645038 (filter dimensions), 00755073 (dispenser envelope), 11057829 (six-compartment cutlery basket), 00611388 and 11003118 (roof sprinkler and feed pipe with three docking ports). Saved by the earlier run and worth mining: 00611317 "Durchfluss-Sensor, Reedschalter für Flügelradzähler" (the fill is metered by an impeller flow meter), 00644996 "Wasserweiche für Heizpumpe" (water diverter on the heating pump), 12014980 "Heizpumpe" (circulation pump with integrated heater), 12026873 softener "mit Schwimmer", 00631200 drain pump.
- Hardware and programme: a 69-page BSH service document "GV640A dishwasher platform training" is listed on elektrotanya.com (only its preview pages were seen, by the earlier run). It was not obtained. It is the most likely place for fill volumes, the programme charts and sensor logic.
- Photographs: reference dimensions that are official and visible in the owner's photographs, usable for scaling: upper spray arm 460 mm tip to tip (IMG_9083), coarse filter 79 mm (IMG_9082), appliance width 598 mm (IMG_9080), dispenser unit 120 x 105 mm.
- Consumer tests: Forbrugerrådet Tænk tested the built-under sisters SMU4HAW48S (January 2023) and SMU4HAI48S, 13 place settings with cutlery basket, and reports time, energy and water; the values are behind a membership wall. Which? and Stiftung Warentest results for this exact model were not found.

## 13. What the owner could measure or do, most valuable first

1. **Read the display for Eco 50 without starting.** Switch on, select Eco 50 and note or photograph the time shown. Also note the basic settings H, r, d and A (hold Setup 3 s) and whether rinse aid and salt are filled, since all four change the running time.
2. **Log one complete Eco 50 run.** Plug-in power meter with logging at 10 s or better (heater on-times give the phases, heater power and total kWh), a stopwatch note of every fill, drain and the dispenser click, the display time at start and at each jump, and the actual end time. If the machine is paired, the Home Connect app's remaining time and progress during the run. A phone left recording sound captures fills, drains and pump-speed changes.
3. **Water per run and per fill.** Read the house water meter before and after with nothing else running, or drain into a marked bucket. Compare with 9.5 litres.
4. **Ask BSH for the test-institute information.** E-mail dishwasher@test-appliances.com with E-Nr SMV4HAX40G/13 and FD 0106 and request the EN 60436 comparability-test conditions, in particular the loading plan for 13 place settings. The manual invites exactly this.
5. **Vertical stack-up with a tape measure**, at each of the three Rackmatic levels: tub floor to the lower basket's plate support; plate support to the underside of the upper spray arm (expect a little over 300 / 275 / 250 mm); upper basket plate support to the ceiling and to the roof sprinkler (expect a little over 220 / 245 / 270 mm); height of the roof sprinkler below the ceiling.
6. **Tub interior** width, depth (back wall to door liner with the door shut, by measuring to the front flange and adding the liner offset) and height; position of the lower-arm axis from the back wall and side walls.
7. **Spray arms.** Lower arm tip-to-tip length; confirm the upper arm's 460 mm; for each arm a ruler-in-frame photograph of both faces, with nozzle positions from the hub, shapes and sizes (calipers, or drill shanks as pin gauges). Diameter and hole pattern of the roof sprinkler and of the baking sheet spray head.
8. **Baskets.** Outer length, width and height; wire diameters (calipers); grid pitch; tine pitch, height and lean for each row; exact position of the foldable rows; cutlery basket outer size and cell sizes; tablet tray size and its position relative to the door dispenser; knife shelf and cup shelf sizes and heights. Weigh each basket empty on a kitchen scale (thermal mass).
9. **Dispenser.** Distance of the detergent lid from the door's top edge and left edge; lid size; which way it moves; and, with a small action camera or an old phone in the upper basket, the minute at which it opens.
10. **Filter.** Width and depth of the flat plate; hole size (macro photograph with a ruler); pleat count and mesh of the micro filter; slot size of the coarse filter; depth of the sump with the filter out; water left in the sump after a finished cycle (sponge it out and weigh it).
11. **Temperatures.** A logging thermometer or thermocouple in the upper basket through an Eco 50 run: peak wash temperature and final-rinse temperature. Cold-tap temperature and mains voltage on the day.
12. **Door geometry.** Hinge axis height above the floor and the length of the open door from hinge to top edge (checks the 1150 mm figure), and the gap between the closed door liner and the front of each basket.

## 14. Method notes

- PDF text was extracted with PyPDF2; pages with figures or tables I relied on were rendered with a CoreGraphics helper left by the earlier run at 3x to 12x and read as images. The renders and crops are working files, not in the repository.
- The product page's specification table and feature texts are embedded as structured data in the page HTML; I extracted them with a small script (a working file, not in the repository). A plain page fetch shows the table headings only.
- The sister quick guide 9001462502_A uses a font whose characters are shifted by 29 code points; I decoded it before reading the figures.
- File-size check against the live server (media3.bsh-group.com) passed for every BSH PDF in section 15.

## 15. Sources

Each source is given by its public address. The copies read for these notes are working files, not in the repository.

Documents for SMV4HAX40G

1. User manual "Information for Use SMV4HAX40G", 9001937295_B, 52 p. https://media3.bsh-group.com/Documents/9001937295_B.pdf
2. Quick reference guide 9001937296_A (2024). https://media3.bsh-group.com/Documents/9001937296_A.pdf
3. Short instructions (quick reference guide) 9001643502_B (2022). https://media3.bsh-group.com/Documents/9001643502_B.pdf
4. Installation instructions 9001594147_C (assigned to /13). https://media3.bsh-group.com/Documents/9001594147_C.pdf
5. Installation instructions 9001902261_A (2023, current product page). https://media3.bsh-group.com/Documents/9001902261_A.pdf
6. Loading leaflet (supplement) 9001459881_A. https://media3.bsh-group.com/Documents/9001459881_A.pdf
7. Supplements 9000300601_E, 9001888654_D, 8001227627_A and Home Connect quick start 9001700647_D. https://media3.bsh-group.com/Documents/ plus the file name.
8. Product specification sheet, en-GB and en-IE. https://media3.bsh-group.com/Documents/specsheet/en-GB/SMV4HAX40G.pdf and .../en-IE/SMV4HAX40G.pdf
9. EU product information sheet (BSH copy, dated 09.10.2024). https://media3.bsh-group.com/Documents/eudatasheet/en-GB/SMV4HAX40G.pdf
10. Energy label. https://media3.bsh-group.com/Documents/energylabel/en-GB/SMV4HAX40G.pdf
11. EPREL record 365247: https://eprel.ec.europa.eu/qr/365247 ; fiche https://eprel.ec.europa.eu/fiches/dishwashers2019/Fiche_365247_EN.pdf ; data https://eprel.ec.europa.eu/api/products/dishwashers2019/365247
12. Product page. https://www.bosch-home.co.uk/en/product/SMV4HAX40G (re-fetched 2026-10-08). Irish page https://www.bosch-home.ie/en/mkt-product/SMV4HAX40G
13. Service page for the owner's index. https://www.bosch-home.co.uk/en/productservice/SMV4HAX40G-13
14. Spare-parts list for SMV4HAX40G/13. https://www.bosch-home.co.uk/en/spare-parts-list/SMV4HAX40G-13 (re-fetched 2026-10-08).
15. Interactive user manual 9001575819 (assigned to /13). https://www.bosch-home.co.uk/manual/9001575819?productCode=SMV4HAX40G/13 . Newer edition: 9001937297, at the same address with that number.
16. Kitchen-planning data (3D model). https://media3.bsh-group.com/3D_Asset/17013994_SMV4HAX40G_KPL.zip
17. Dimension drawings. https://media3.bsh-group.com/Line_Drawings/MCZ_006754_SMV50M00EU_en-GB.jpg and https://media3.bsh-group.com/Line_Drawings/16027521_6xx_EU_with_Aquastop_en-GB.jpg
18. Official product photographs and image tiles. https://media3.bsh-group.com/Product_Shots/16580356_SMV4HAX40G_STP_def.webp and 17757736, 17757737, 17757739, 17757770, 17757775, 17757776, 17757777, 17757779, 17757793 under the same path.
19. EU declaration of conformity No. 244B for SD6PW1B, SI6PW1B, SL6PW1B. https://media3.bsh-group.com/Documents/18273715_EU%20DoC_Bosch_SD6PW1B_SI6PW1B_SL6PW1B.pdf . Also the GB declaration of conformity 155B (document 25852349) and the statement of compliance 130B (document 24783343), both listed on the service page (source 13).

Official part pages (Bosch shops)

20. 11010054 upper spray arm: https://www.bosch-home.com/de/de/product/11010054 . 00645038 filter set: https://www.bosch-home.com/de/de/product/00645038 . 00755073 dispenser: https://www.bosch-home.com/de/de/product/00755073 . 11057829 cutlery basket: https://www.bosch-home.com/de/de/product/11057829 . 00611388 roof sprinkler: https://www.bosch-home.co.uk/en/product/00611388 . 11003118 feed pipe: https://www.bosch-home.co.uk/en/product/11003118 . Further part pages were saved by the earlier run (see the hardware notes, `hardware.md`).

Sister models and range documents

21. SMS4HAI48E user manual 9001453806_C and quick guide 9001462502_A. https://media3.bsh-group.com/Documents/9001453806_C.pdf , https://media3.bsh-group.com/Documents/9001462502_A.pdf
22. SMV4HAX48E spec sheet (de-DE) and product page. https://media3.bsh-group.com/Documents/specsheet/de-DE/SMV4HAX48E.pdf , https://www.bosch-home.com/de/de/product/SMV4HAX48E
23. Same-generation generic BSH manual "SM... SB..." 9001442770_A (basket-height tables for all four variants; sensor setting). https://media3.bosch-home.com/Documents/9001442770_A.pdf
24. Older generic BSH manual 9001353471_B (AquaSensor and remaining-time wording). https://media3.bosch-home.com/Documents/9001353471_B.pdf
25. Bosch Australia dishwashing catalogue 2017 (feature definitions). https://media3.bosch-home.com/Documents/MCDOC02269689_BH_3207_B_-_Dishwashing_Catalogue_Ed_1_2017_FA.pdf
26. Bosch New Zealand dishwashing brochure 2021 (AquaSensor and LoadSensor text). https://media3.bosch-home.com/Documents/MCDOC02344627_Bosch_NZ_Dishwashing_Brochure.pdf

Other official pages

27. Home Connect API, programmes and options. https://api-docs.home-connect.com/programs-and-options/
28. Bosch UK, "How to properly load a dishwasher". https://www.bosch-home.co.uk/customer-service/get-support/dishwashers/loading-tips
29. Bosch UK, dishwasher symbols guide. https://www.bosch-home.co.uk/experience-bosch/using-your-appliance/dishwasher-symbols-guide
30. BSH corporate history wiki, "AquaSensor". https://wiki.bsh-group.com/de/wiki/AquaSensor/en

Not official, cited once

32. Forbrugerrådet Tænk test pages for sisters (values behind a membership wall). https://taenk.dk/test/opvaskemaskiner/bosch-smu4haw48s , https://taenk.dk/test/opvaskemaskiner/bosch-smu4hai48s

Owner's photographs

33. `docs/reference/owner-photos/`: IMG_9079 (rating plate, panel labels; not published: it shows the serial number), IMG_9080 (front view), IMG_9081 (lower basket), IMG_9082 (tub floor, filter), IMG_9083 (upper basket). The crops made from them are working files, not in the repository.
