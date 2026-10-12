# Bosch SMV4HAX40G: what the Auto 45-65 programme does (research notes, angle "programme")

Machine: Bosch Serie 4 fully integrated 60 cm dishwasher, E-Nr. SMV4HAX40G/13, FD 0106, type SD6PW1B (owner's rating plate, photo IMG_9079). Programme to simulate: Auto 45-65, shown by the owner's machine as 2:25.

Written 2026-10-08. All web sources were opened in this session unless a line says otherwise. The copies, crops and scripts made for these notes are working files, not in the repository; each source is given by its public address.

## 0. How to read these notes

### 0.1 Tags

- [VERIFIED] = I read it this session in the source text named (or measured it from a named image).
- [RECALLED] = from memory, source not opened.
- [ESTIMATED] = my derivation; the reasoning is shown.

### 0.2 Evidence classes (who the evidence is about)

| Class | Meaning |
|---|---|
| **M** | Documents for this exact model (SMV4HAX40G, KI /13), or the owner's photographs |
| **S** | Sister machines of the same 2021 generation (same programme set and label class), measured by a test laboratory or described in their manuals |
| **P** | The BSH platform: service manuals for BSH-built machines of the GV630/634 (2008) and GV640 (2010) platforms as republished by Küppersbusch, and BSH patents. The owner's machine still uses GV640-family hydraulic parts (heat pump, water switch, heat exchanger, flow sensor: see section 2.1) |
| **F** | Enthusiast-forum statements by people who watch these machines closely. Useful, unverified |
| **R** | My reconstruction |

### 0.3 The short answer

1. No public document gives the step-by-step sequence of Auto 45-65 on this platform. The manual says only that it is sensor-controlled and optimised according to how soiled the washing water is (wording in section 1.1) [VERIFIED, M].
2. The envelope for this exact model is printed: 1:40 to 2:45, 0.900 to 1.500 kWh, 7.0 to 15.5 L [VERIFIED, M].
3. The decision structure is known from a BSH-platform service manual (2008): the turbidity sensor decides (a) whether the pre-rinse water is replaced, (b) the cleaning temperature, (c) the number of intermediate rinses [VERIFIED, P].
4. Test-laboratory measurements of two sister machines of the same generation and label class give, for normal soiling: 1.06 to 1.11 kWh, 11.2 to 11.9 L, 2:13 to 2:14 [VERIFIED, S]. The owner's 2:25 sits between that and the printed maximum of 2:45.
5. My recommended "AUTO 2:25" table (section 6) is therefore the normal-soil branch: 11.5 L, about 1.0 to 1.1 kWh, 145 min. Every step duration in it is [ESTIMATED]. One smart-plug log of a real run (section 9, item 1) would replace most of those estimates.

## 1. What the documents for this exact model say (class M)

### 1.1 Programme envelope

Quick reference guide for SMV4HAX40G, "Programmes" table; the guide states that the programme data were measured in the laboratory to European standard EN 60436. Two editions (9001643502_B and 9001937296_A) print identical figures [VERIFIED] [B2].

| Programme | Duration (h:min) | Energy (kWh) | Water (L) | Programme sequence, summarised from the user manual [B1 p. 16] |
|---|---|---|---|---|
| Intensive 70 | 2:05 to 2:15 | 1.300 to 1.400 | 11.5 to 14.0 | pre-rinse, cleaning 70 C, intermediate rinse, final rinse 69 C, drying |
| **Auto 45-65** | **1:40 to 2:45** | **0.900 to 1.500** | **7.0 to 15.5** | "Sensor-controlled: Optimised by sensors depending on the soiling of the washing water." |
| Eco 50 | 4:55 | 0.836 | 9.5 | pre-rinse, cleaning 50 C, intermediate rinse, final rinse 61 C, drying |
| Silence 50 | 4:00 | 1.050 | 11.0 | pre-rinse, cleaning 50 C, intermediate rinse, final rinse 63 C, drying |
| Express 65 - 1h | 1:00 | 1.300 | 10.5 | cleaning 65 C, intermediate rinse, final rinse 69 C, drying |
| Machine Care | 2:10 | 1.350 | 15.2 | Machine Care at 70 C (empty machine) |
| Favourite (factory setting: pre-rinse) | 0:15 | 0.050 | 4.0 | cold rinsing only |

All figures [VERIFIED]. 2:25 (145 min) is 45 min above the minimum and 20 min below the maximum.

### 1.2 Other statements that bear on the timeline

| Fact | Value | Tag | Source |
|---|---|---|---|
| Rating plate | 220-240 V, 50-60 Hz, 2000-2400 W, 10-16 A; E-Nr SMV4HAX40G/13, FD 0106, type SD6PW1B (serial number not reproduced) | [VERIFIED] read from the owner's rating-plate photograph (IMG_9079, not published: it shows the serial number) | [B6] |
| Drying system | "Heat exchanger"; no automatic door opening is listed among the features or options | [VERIFIED] | [B4] |
| Technology list | Heat exchanger; DosageAssist detergent dispenser; EcoSilence BLDC drive; Automatic detergent detection; AquaMix glass protection; AquaSensor III | [VERIFIED] | [B4] |
| Options | Remote Start, Extra Dry, Half Load, SpeedPerfect+ | [VERIFIED] | [B4], [B1 p. 17-18] |
| AquaSensor | An optical device (a light barrier) that measures the turbidity of the washing water. With heavy soiling the rinsing water is drained and replaced by fresh water; with lighter soiling it is kept for the next wash phase, which saves 3 to 6 litres. Then, in the manual's words: "In the automatic programmes the temperature and running time are additionally adjusted to the level of soiling." | [VERIFIED] | [B3] (interactive manual; not in the PDF manual) |
| Running time depends on | four things: the option selected, how much tableware is loaded, how soiled it is, and the temperature of the water. Running time and energy consumption rise when the rinse-aid system is switched off or needs refilling | [VERIFIED] | [B1 p. 15] |
| Extra Dry | final-rinse temperature raised and drying phase extended | [VERIFIED] | [B1 p. 17] |
| Half Load | running time shorter; water and energy consumption lower | [VERIFIED] | [B1 p. 18] |
| SpeedPerfect+ | run time shortened by 15 % to 75 %; energy and water increased | [VERIFIED] | [B1 p. 18] |
| Softener regeneration | in every programme, before the end of what the manual calls the "main rinse cycle"; after every 6 washing programmes; adds at most 7 min, 5 L, 0.05 kWh (Eco 50, hardness setting H04 = 16-20 Clarke, the factory setting) | [VERIFIED] | [B1 p. 24] |
| Rinse-aid setting | r00 to r06, factory r05 | [VERIFIED] | [B1 p. 25, 32] |
| Detergent | 20 to 25 ml is enough for normal soiling; dispenser markings 15 / 25 / 50 ml; the dispenser opens by itself during the programme, in the manual's words "at the optimum time", and a tablet then falls into the tablet collecting tray | [VERIFIED] | [B1 p. 27-28], [B2] |
| Powder with pre-rinse | with powder detergent and a programme that has a pre-rinse, a little detergent may also be put on the inside of the door | [VERIFIED] | [B1 p. 28] |
| Combined detergents | the washing programme adapts itself automatically for the best washing and drying result | [VERIFIED] | [B1 p. 27] |
| Display | shows the remaining running time of the programme when a programme is set | [VERIFIED] | [B1 p. 30] |
| End of programme | switches off automatically 1 minute after the end; cancelling ends "after approx. 1 minute" (drain) | [VERIFIED] | [B1 p. 31] |
| Condensation drying | the inner walls of the tub collect the moisture of the air as condensate, which drains down and is pumped away; advice to unload 30 minutes after the end if dishes are not dry | [VERIFIED] | [B3] |
| Sensor weakness admitted | of tableware pre-cleaned too thoroughly: "The sensors chose a weaker programme", and stubborn soiling then cannot be removed entirely | [VERIFIED] | [B3] |
| Technical data | inlet rate min. 10 L/min at the tap, cold water, hot water max. 60 C, 13 place settings | [VERIFIED] | [B1 p. 48] |
| Eco label data | 0.836 kWh, 9.5 L, 4:55, EEI 49.9, class D, cleaning index 1.121, drying index 1.061, 46 dB | [VERIFIED] | [B5] |
| Home Connect state fields of a BSH dishwasher of this generation | `ProgramPhase` (example value `Drying`), `RemainingProgramTime` with `RemainingProgramTimeIsEstimated: True`, `EnergyForecast`, `WaterForecast`, `SensitivityTurbidity: Standard`, `RinseAid: R04`, `WaterHardness: H04`, `ExtraDry`, `HalfLoad`, `WaterheaterCalcified` | [VERIFIED] (another owner's machine, not this one) | [H1] |

Photograph evidence for this angle: IMG_9080 shows one feed pipe on the back wall to the upper spray arm, the lower spray arm, and the handle recess in the front of the upper basket that the manual calls the tablet collecting tray [VERIFIED by viewing]. The tub roof is hidden by the upper basket, so the photo does not show whether a roof spray exists; the manual's parts list names only a lower and an upper spray arm [B1 p. 12-13]. Cross-link to the spray-arm researcher: the diverter pattern below assumes two levels.

### 1.3 What "2:25" is

- Owner's statement: the Auto cycle "takes 2:25". The control-panel photo does not show the display, so this figure rests on his statement.
- Platform, 2008: "Beim Programmstart wird die Restlaufzeit, die dieses Programm beim letzten Mal benötigt hat, angezeigt" (at programme start the display shows the time this programme needed last time). "Die Restlaufzeit wird am Ende der Heizpositionen neu berechnet... Es können somit am Ende vom Reinigen und Klarspülen Zeitsprünge von bis zu 60 Minuten entstehen" (the remaining time is recalculated at the end of the heating positions; jumps of up to 60 minutes can occur at the end of cleaning and of the final rinse) [VERIFIED, P] [K1 p. 7].
- Same generation as the owner's machine, US manual (SHP78CM5N), Auto cycle: "Note: The displayed cycle time indicates an average value." [VERIFIED, S] [U1 p. 15].
- Forum, a Siemens SN63EX14VE of this generation: Eco shows 4:55 (as here) and Auto shows 2:30 [VERIFIED, F] [F5]. Forum, 2008 Bosch with Auto 55-65: the display shows 2:26 to 2:30 at start, "but most of the time it cuts the prewash, and shortens the cycle for 50-60 minutes" [VERIFIED, F] [F4].
- Reading [ESTIMATED]: 2:25 is the controller's forecast at start (last run or a stored average), not a promise. It corresponds to a middling decision path. The real run will jump at the end of the main wash and of the final rinse heat-up.

## 2. Platform process knowledge (class P unless marked)

### 2.1 Why the GV640 service manual applies

The spare-parts list for E-Nr SMV4HAX40G/13 (indexed by the hardware researcher) contains: 12014980 heat pump (print 1BS3610-6AA), 00611329 water switch motor, 00770952 heat exchanger, 11033896 valve-outlet, 00611317 flow-through sensor, 00611323 sensor, 00611916 valve-regeneration, 00631200 drain pump, 12026873 water softener, 00755073 dispenser [VERIFIED]. These are the component types described in the Küppersbusch service manual H7-71-07 (13 Oct 2010), which says it covers "die Funktionsweise der Geräteserie GV 640" and lists as its basis repair instructions numbered 58300000 149122 and following [VERIFIED] [K2 p. 2, 8]; that number format is BSH's [RECALLED]. An older manual, H7-71-05 (6 Apr 2008, series 634 "mit Automatikprogrammen"), describes the generation before, with the same BSH trade names (Aquasensor, Aqua-Stop, Aqua-Mix, VarioSpeed) [VERIFIED] [K1]. The control software of the 2021 generation is newer than both; treat programme logic from K1/K2 as the family pattern, not as this machine's firmware.

### 2.2 Verified platform facts

| Topic | Fact (quotation or close paraphrase) | Tag | Source |
|---|---|---|---|
| Auto structures (2008, "Auto 55/65") | "Im Automatikprogramm entscheidet der Aquasensor nicht nur über einen Wasserwechsel nach dem Vorspülen, sondern er bestimmt auch die Reinigungstemperatur und die Anzahl der Zwischenspülgänge." Structures named: (a) cleaning 50, one intermediate rinse, final rinse 65, drying; (b) cleaning 65, two intermediate rinses, final rinse 65, drying; (c) pre-rinse, cleaning 55, one intermediate rinse, final rinse 65, drying | [VERIFIED] | [K1 p. 9] |
| Aquasensor II decision points (variant with 45-55 range) | 1. infrared, in the pre-rinse: water exchanged (much soil) or reused (little soil). 2. green, in cleaning: end temperature 45 C (little soil) or 50/55 C (much soil); a water change after the pre-rinse raises the cleaning temperature from 50 to 55 C; cleaning at 50 or 55 C is followed by a filter flush. 3. green, in the first intermediate rinse: a further intermediate rinse (much soil) or only a filter flush | [VERIFIED] | [K1 p. 19] |
| Number of paths | "Im Automatik-Programm sind 48 Programmstrukturen möglich" | [VERIFIED] | [K1 p. 19] |
| Sensor calibration | calibrated in every run in which it is active; needs 400 ml of water; a failed calibration sets the reading to "turbid" and "ein maximaler Programmablauf findet statt" | [VERIFIED] | [K1 p. 19], repeated without the 400 ml in [K2 p. 82] |
| Sensor on GV640 | infrared diode and photodiode in a U-shaped housing in the sump; the measurement is evaluated in turbidity ranges whose values are stored in the electronics; "Der Aquasensor ist im Vorspülen, im Reinigen und am Ende des Reinigens aktiv" | [VERIFIED] | [K2 p. 82] |
| Other programmes, 2008 | Intensive 70: pre-rinse 50, cleaning 70, two to three intermediate rinses, final rinse 70. Normal 65: cleaning 65, two intermediate rinses, final rinse 69, Aquasensor inactive. Eco 50: cleaning 50, one intermediate rinse, final rinse 66, Aquasensor inactive. For these three: "bis zum Erreichen der Temperatur [wird] nur im unteren Korb gespült" (only the lower basket is sprayed until the temperature is reached) | [VERIFIED] | [K1 p. 8] |
| Half load, 2008 | achieved "durch Überfahren des Vorspülen und des zweiten Zwischenspülgangs" | [VERIFIED] | [K1 p. 8] |
| VarioSpeed, 2008 | "mehr Wasser im Spülgang und ... Wasserweiche mit Zweikorbfunktion" (more water, both baskets at once) | [VERIFIED] | [K1 p. 8] |
| Intensive drying | final rinse temperature raised by 3 K | [VERIFIED] | [K1 p. 9] |
| Combined-detergent mode | triggered by rinse-aid shortage or a deactivated rinse-aid indicator: less water in the intermediate rinses, final rinse +3 K, heat exchanger filled a second time during drying | [VERIFIED] | [K1 p. 10]; the patent behind it is [P4] |
| Hot-water detection | inlet above 45 C in the final rinse: heat exchanger not filled for drying, final rinse raised to 72 C | [VERIFIED] | [K1 p. 12] |
| Heat exchanger capacity | "Wärmetauscher voll (enthält 3,1 l Wasser)" | [VERIFIED] | [K2 p. 120] |
| Final-rinse quantity | "Für das Klarspülen wird ein gefüllter Wärmetauscher erwartet (2,5 l von 3,1 l Füllmenge)" | [VERIFIED] | [K2 p. 92] |
| When the heat exchanger is filled | "Während des Reinigens wird der Wärmetauscher befüllt. Die Füllung soll vorgewärmt werden und für den Zwischenspül- oder Klarspülvorgang bereitstehen." "Die Füllmenge für das Klarspülen wird im Zwischenspülen gefüllt und im Wärmetauscher bevorratet." "Der Wärmetauscher muss auch nach längerer Standzeit gefüllt sein." | [VERIFIED] | [K2 p. 91, 92, 115] |
| Level control | "Die Elektronik prüft im Vorspülen und Reinigen den Wasserstand im Gerät über die Heizpumpe (Rundlaufprüfung). Falls nötig wird Wasser nachgefüllt." No such check in the intermediate and final rinse; quantity there comes from flow-meter pulses only | [VERIFIED] | [K2 p. 91] |
| First fill | 200 ml more than the normal quantity, to wet the dry load (2008 platform) | [VERIFIED] | [K1 p. 22] |
| Heat-up rate | "Die Heizung soll das Wasser um 2,5 °C / min erwärmen" (service criterion) | [VERIFIED] | [K2 p. 67, 69] |
| Heater | GV640: "Verrohrtes Heizelement (2100 W)", element resistance about 21 ± 2 ohm at 25 C, two NTCs in the heating tube. 2008 platform: flow-through heater 2150 W, connected load 2.3 kW | [VERIFIED] | [K2 p. 8, 68], [K1 p. 63] |
| Circulation pump | GV640: BLDC motor; current signature distinguishes no water / too little / sufficient / blocked. 2008 platform (non-BLDC): head 3.1 m, delivery 25-30 L/min, running current 0.31 A | [VERIFIED] | [K2 p. 67], [K1 p. 63] |
| Drain pump | 2008: head 0.9 m, 10 L/min | [VERIFIED] | [K1 p. 63] |
| Fill hardware | Aquastop valve 2.75 L/min; flow sensor nominal 2.5 L/min, 208 pulses per litre, range 0.8-4.0 L/min | [VERIFIED] | [K1 p. 29, 30] |
| Water switch | GV640: "steuert den Wasserweg der 3 Sprühebenen"; disc with 5 openings of different sizes allows simultaneous or alternating supply; motor 5 rpm at 50 Hz. 2008: positions "Wechselspülen" (upper or lower basket, high pressure), "Zweikorb" (both, medium), alternation between both and throttled upper (low) | [VERIFIED] | [K2 p. 99-100], [K1 p. 44] |
| Pump speed at switch-over | pump speed is reduced while the water switch changes level, to avoid noise | [VERIFIED] | [P5] |
| Dispenser, GV640 | coil-operated. First pulse releases the detergent lid; the mechanism then switches over so later pulses drive the rinse-aid dosing pump; "Bei jedem Impuls wird 1 ml Klarspüler zugegeben. Die Einstellstufe ... entspricht den Impulsen"; opening the door resets it. Rinse-aid tank 80 ml | [VERIFIED] | [K2 p. 79-80] |
| Dispenser, 2008 | wax-motor actuator: trigger time about 2 min, reset about 3 min | [VERIFIED] | [K1 p. 24] |
| Tablet path | tablet falls into the handle recess of the upper basket; the upper spray arm sprays it from below | [VERIFIED] | [K2 p. 82] |
| Filter cleaning at drain | "Wechselpumpen": three times, 5 s circulation alternating with 5 s drain | [VERIFIED] | [K1 p. 26] |
| Regeneration | "Das Regenerieren und Durchspülen des Enthärters findet im Reinigen statt"; brine runs through the softener into the heat exchanger and tub and is pumped out; flushing in three stages | [VERIFIED] | [K1 p. 20], [K2 p. 97] |
| Programme start | Aquastop valve driven for 5 s and flow-meter pulses expected | [VERIFIED] | [K2 p. 90] |
| Sequence around the tank (BSH patent, 2009) | tank full from the previous cycle is emptied into the tub as the first liquor; cleaning: heater off once the target ("for example 40 to 60 C") is reached, pump runs on for a "Nachwaschphase"; intermediate rinse usually unheated; final rinse heated to "for example between 60 and 80 C", then pump and heater off; drying starts with the drain pump removing dripping liquor, a short drip-off pause, then the tank is filled with cold water in several portions spread over the drying time | [VERIFIED] | [P2] |
| Fill volumes in a BSH patent example (2010) | cleaning 3.9 L, intermediate rinse 2.9 L, final rinse 2.5 L; 160-180 ml stays in the sump after a normal drain, 60-100 ml after a drain with three extra 7 s pump bursts; rinse aid foams in liquor below about 35 C | [VERIFIED] | [P1] |
| Origin of the sensor programme (BSH patent, 1996) | dynamic filling of about 3.5 L then until the pump runs smoothly; "Kurznachfüllen" of 1.4 L sprayed and pumped straight out to stop carry-over; pre-rinse cold without detergent; detergent added at the start of cleaning (after warming to about 40 C in that design); intermediate rinses unheated | [VERIFIED] | [P3] |
| Marketing wording, BSH | "aquaSensor ... steuert Menge und Zeitpunkt der Frischwasserzugabe sowie die Reinigungstemperatur"; heat exchanger: fresh water in a plastic pocket on the tub wall is warmed by the tub "ohne zusätzliche Energieaufnahme" and used for the next step; during drying vapour condenses on the cooler, water-filled pocket | [VERIFIED] | [M1] |
| Marketing wording, Bosch | the AquaSensor measures the soiling "at the end of the pre-rinse cycle" and reuses the water when it can; the LoadSensor infers the weight of the load from a rotary speed sensor that responds to the water level | [VERIFIED] | [M2] |

### 2.3 Forum statements (class F, unverified but specific)

| Statement | Source |
|---|---|
| Maximum Auto on current BSH machines: warm pre-wash, main wash 65 C at full duration, two unheated interim rinses, heated final rinse; minimum: wash, rinse, heated rinse, dry. "The second interim rinse is barely ever triggered in my experience. The pre-wash can either be done or not." Main wash "anywhere from 3 to 10 different main wash versions". Partial drains seen between pre-rinse and main wash. Interim rinse plus final rinse plus drying take 1 h to 1 h 20; drying 30-40 min on zeolite models. "Whenever they transition from one cycle stage to another, they update the cycle timer." | [F1] posts 4 and 10 |
| A sensor sensitivity setting exists in the app (standard / sensitive / very sensitive) | [F1] post 6; consistent with `SensitivityTurbidity` in [H1] |
| About a quarter of an hour before the main wash is drained, cold water is let into the heat exchanger, and tub and exchanger come to the same temperature; he says this happens "during every step of the cycle but the final rinse." "I can hear the heater click on and off throughout the main wash." | [F2] posts 93 and 101 |
| Dispenser still dry after the pre-wash; pre-wash skipped on Auto when the water seemed clean | [F3] posts 21 and 26 |

## 3. Laboratory measurements of Auto on sister machines (class S)

KONSUMENT (Austrian consumer association VKI) publishes its dishwasher test tables. Method text: cleaning and drying "angelehnt an EN 50242/EN 60436"; Auto tested with normal and heavy soiling; table values are "Angaben für normale Verschmutzung" [VERIFIED] [T1].

| Test | Machine | Label class | Eco: kWh / L / h:min | Auto, normal soil: kWh / L / h:min | Short programme tested: kWh / L / h:min |
|---|---|---|---|---|---|
| 10/2021 | Constructa CG5VX00HCD (14 ps) | D | 0.81 / 9.3 / 4:50 | **1.06 / 11.2 / 2:13** | 1.11 / 10.0 / 0:57 |
| 10/2021 | Siemens SN65EX57CE (14 ps) | D | 0.74 / 9.4 / 4:31 | **1.11 / 11.9 / 2:14** | 1.19 / 10.1 / 1:02 |
| 10/2021 | Bosch SMV6ZCX49E (zeolite) | C | 0.68 / 9.2 / 3:48 | 0.88 / 10.7 / 2:11 | 1.06 / 11.2 / 1:28 |
| 10/2021 | Siemens SN87YX01CE (zeolite) | B | 0.65 / 9.5 / 3:51 | 0.87 / 11.6 / 2:14 | 1.05 / 11.4 / 1:29 |
| 10/2020 | Bosch SMV46MX04E (previous generation) | A++ old | 0.86 / 9.5 / 3:12 | 1.21 / 14.9 / 2:33 | 1.23 / 10.4 / 1:01 |
| 1/2020 | Constructa CG4A54V8 (previous generation, 13 ps) | not shown | 0.85 / 9.5 / 3:24 | 1.07 / 12.8 / 2:22 | 1.15 / 10.5 / 0:59 |
| 1/2020 | Siemens SN636X03IE (previous generation, 13 ps) | not shown | 0.84 / 9.4 / 3:24 | 1.08 / 12.6 / 2:22 | 1.14 / 10.3 / 0:59 |
| 8/2016 | Constructa CG5A50J5 (13 ps) | A++ old | 0.93 / 9.4 / 3:29 | 1.02 / 11.9 / 2:05 | 1.30 / 12.5 / 1:34 |

All rows [VERIFIED] from the archived tables [T1]. The short programme is the roughly 1 h programme on the non-zeolite machines of 2020 and 2021; on the zeolite machines and in 2016 it is a different short option (in 2016 "Eco + VarioSpeed" for the Constructa). The 8/2016 values are labelled "100 % Anschmutzung". The two class-D machines of 10/2021 are the closest relatives of the SMV4HAX40G: same generation, same label class, Eco about 4:30 to 4:50 against 4:55 here, no zeolite. Difference likely: they are rated for 14 place settings, which on BSH machines usually means a cutlery drawer instead of the basket [RECALLED], so their top spray level and load differ.

What this tells us:

- Normal-soil Auto on this generation: about 2:13, 1.06 to 1.11 kWh, 11.2 to 11.9 L. That is 1.9 to 2.5 L more than the same machines' Eco.
- The laboratory measured 1.11 to 1.19 kWh for the 1 h programme where the SMV4HAX40G guide prints 1.300 kWh for Express 65. The printed non-Eco figures may be upper values. Unresolved; see section 8.
- A user of a Siemens SN63EX14VE read these "standardised" figures from the Home Connect app: Auto with IntensivZone 2:40, 11.5 L, 0.95 kWh; Auto with VarioSpeedPlus 1:52, 14 L, 1.15 kWh; Eco 4:55, 9.5 L, 0.75 kWh [VERIFIED, F] [F5, the two table images attached to the post].

## 4. What the sensors decide

### 4.1 Decision points

Evidence: [B3] for this model; [K1], [K2] for the platform. Timing of the decision points within the run is [ESTIMATED].

| # | When | Measured | Decision | Evidence |
|---|---|---|---|---|
| D0 | first fill, clean water | sensor calibration (reference transmission) | failure: assume "turbid", run the maximum sequence | [K1 p. 19], [K2 p. 82] |
| D1 | end of the cold pre-rinse phase, about 10 to 13 min after start | turbidity of the pre-rinse liquor | keep the water for cleaning (light), or replace it with fresh water; the amount replaced is itself controlled ("Menge und Zeitpunkt der Frischwasserzugabe") | [B3], [M1], [K1 p. 19] |
| D2 | during cleaning, and at its end | turbidity of the wash liquor | cleaning temperature within 45 to 65 C and length of the cleaning step; a water change at D1 pushes the temperature up | [B3], [K1 p. 19], [K2 p. 82] |
| D3 | first intermediate rinse | turbidity of the rinse liquor | second intermediate rinse, or only a filter flush | [K1 p. 19] |
| D4 | pre-rinse and cleaning | pump running smoothly or not (BLDC current) | top up water; this is the "load sensor": more load holds more water in flight and on surfaces | [K2 p. 91], [M2] |
| D5 | whole run | rinse-aid tank empty or rinse-aid system off | combined-detergent mode: hotter final rinse, longer or different drying; "running time and energy consumption will increase" | [B1 p. 15], [K1 p. 10], [P4] |
| D6 | every N cycles | water counted against hardness setting | regeneration: +7 min, +5 L, +0.05 kWh, every 6th cycle at H04 | [B1 p. 24] |

### 4.2 Thresholds

Not public. "Die Werte sind in der Elektronik hinterlegt" [K2 p. 82]. The sensitivity is user-adjustable in three steps via the app ([F1], [H1]). For the simulator I recommend [ESTIMATED]:

- Model the sensor as optical transmission across a short gap in the sump: tau = exp(-sum_k eps_k c_k L), with c_k the suspended or dissolved concentration of soil class k in the liquor and L a path length of order 10 mm. The 2008 sensor added a green LED to see coloured but non-scattering soils "wie z.B. Tee oder Spinat" [K1 p. 19], so give coloured dissolved soils their own eps.
- Two thresholds at D1 (keep / partial exchange / full exchange), a monotone map from tau at D2 to a temperature step in {45, 50, 55, 60, 65} and a hold length, one threshold at D3.
- Calibrate the thresholds so that the EN 60436 reference soil on a full load lands on the normal branch (11.5 L, about 1.1 kWh), a clean pre-rinsed load on the light branch (7.0 L), and the test laboratories' "heavy soiling" on the heavy branch (15.5 L). That reproduces the three anchor points that exist.

### 4.3 Soil level to water, temperature, time

| Branch | Water (L) | Time | Energy (kWh) | Structure | Basis |
|---|---|---|---|---|---|
| Light | 7.0 | 1:40 | 0.900 | first fill kept for cleaning; cleaning at the low end (45 C); no full intermediate rinse (filter flush only); final rinse; drying | envelope minimum [B2]; structure [ESTIMATED] from [K1 p. 19] and the water arithmetic in 4.4 |
| Normal | about 11.5 | about 2:13 to 2:25 | about 1.05 to 1.1 | pre-rinse, part of the water replaced (or two intermediate rinses instead), cleaning 55 to 65 C, one intermediate rinse, final rinse, drying | laboratory values of sisters [T1]; owner's display; structure [ESTIMATED] |
| Heavy | 15.5 | 2:45 | 1.500 | pre-rinse fully replaced (possibly warm), cleaning 65 C at full length, two intermediate rinses, final rinse, drying | envelope maximum [B2]; structure from [K1 p. 9, 19], [F1] |

### 4.4 Water arithmetic (why I use 4.0 / 2.5 / 0.5 L)

Verified anchors: the pre-rinse programme uses 4.0 L in one fill [B2]; the heat exchanger holds 3.1 L and 2.5 L of it makes the final rinse [K2]; Intensive 70 spans 11.5 to 14.0 L, a step of exactly 2.5 L for 10 minutes and 0.1 kWh [B2].

With first fill F1 = 4.0 L, any later rinse fill R = 2.5 L, a full replacement of the first fill = 4.0 L and a filter flush of about 0.5 L, every printed total is reproduced [ESTIMATED]:

| Programme | Sum | Printed |
|---|---|---|
| Pre-rinse | 4.0 | 4.0 |
| Eco 50 | 4.0 (pre-rinse kept for cleaning) + 0.5 flush + 2.5 intermediate + 2.5 final | 9.5 |
| Auto minimum | 4.0 + 0.5 flush + 2.5 final | 7.0 |
| Auto normal | 4.0 + 2.5 + 2.5 + 2.5 | 11.2 to 11.9 measured on sisters |
| Auto maximum | 4.0 + 4.0 replacement + 2.5 + 2.5 + 2.5 | 15.5 |
| Intensive 70 | 4.0 + 2 or 3 times 2.5 + 2.5 | 11.5 to 14.0 |
| Express 65 | 5.5 (both levels at once) + 2.5 + 2.5 | 10.5 |

This is arithmetic that fits, not a measurement. The normal branch's three 2.5 L fills can be read two ways: (i) a 2.5 L partial exchange after the pre-rinse, then one intermediate rinse and the final rinse; (ii) no exchange, two intermediate rinses and the final rinse. Reading (i) matches the manufacturer's emphasis on the pre-rinse decision and the forum report that the second rinse is rare; reading (ii) matches structure (b) of the 2008 manual. The owner can settle it by counting drain events before the first heating phase (section 9).

### 4.5 Which branch shows 2:25

Time budget [ESTIMATED], using: drain plus fill about 3 min per water change; cold pre-rinse phase about 12 min (the stand-alone pre-rinse programme takes 15 min in all [B2]); heat-up at about 2.5 K/min [K2]; one intermediate rinse about 10 min (the Intensive 70 step [B2]); final rinse block about 15 to 18 min; drying about 40 min.

- Fixed parts of the normal branch: 2 (start) + 11.5 (pre-rinse) + 2 (exchange) + 15.5 (heat to 60) + 1.5 + 9 (rinse block) + 15 (final rinse block) + 40 (drying) = 96.5 min. A total of 145 min leaves about 49 min for the post-wash hold.
- The laboratory's 2:13 leaves 37 min of hold with the same blocks.
- Light branch: no exchange (-2), heat to 45 (-7), flush instead of rinse (-7.5): 100 min leaves about 19 min of hold.
- Heavy branch: full exchange (+1), heat to 65 (+2 to 3), second rinse (+9): 165 min leaves about 55 min of hold.

So 2:25 is the normal branch with a moderately long hold: neither the lightly soiled end (that is 1:40) nor the maximum (2:45). If Extra Dry had been active (basic setting d01, or the option key) part of the 2:25 would be the longer drying; the owner should check that setting.

## 5. Energy and water sanity checks

### 5.1 Envelope

Printed for this model: 0.900 to 1.500 kWh, 7.0 to 15.5 L, 100 to 165 min [B2]. Measured on class-D sisters at normal soil: 1.06 to 1.11 kWh, 11.2 to 11.9 L, 133 to 134 min [T1]. Regeneration adds 0.05 kWh and 5 L every sixth run [B1].

### 5.2 Heater power and heat-up rate

- Rating plate 2000-2400 W over 220-240 V is one fixed resistance: 2400 W at 240 V is 24.0 ohm, which gives 2017 W at 220 V and 2204 W at 230 V [ESTIMATED from the plate].
- Subtract about 70 W for the pump and electronics: heater about 2130 W at 230 V and about 2320 W at 240 V [ESTIMATED]. Platform documents say 2100 W (GV640) and 2150 W (2008) [K2], [K1]. I use 2150 W at 230 V and scale with voltage squared. A British socket is usually nearer 240 V, so about 2340 W in the owner's kitchen [ESTIMATED]; a plug-in meter will settle it.
- The service criterion of 2.5 K/min at about 2100 to 2150 W implies a total heated capacity of 2150 / (2.5/60) = 51.6 kJ/K [ESTIMATED]. machine.md's baseline for a full load is 4.0 L water (16.7 kJ/K) + load 23 kJ/K + machine 14 kJ/K = 53.7 kJ/K, which gives 2.4 to 2.5 K/min including pump heat. So machine.md's thermal masses agree with the BSH criterion, and machine.md's heater duty of 0.7 during ramps (1.6 K/min) is not needed for this machine. Replace it with duty 1.0.

### 5.3 Bottom-up model

The script and its outputs are working files, not in the repository. It is the three-node model of machine.md section 6.2 (water, load, machine) plus a heat-exchanger water node coupled to the tub wall. Inputs [ESTIMATED unless noted]: C_load 23 kJ/K (full 13 place settings), C_machine 14 kJ/K, G_water-load 600 W/K and G_water-machine 250 W/K while spraying, UA 4 W/K, heat exchanger 3.1 L [VERIFIED K2] coupled at 25 W/K when full, heater 2150 W, pump 70 W, carry-over 0.4 L, inlet 15 C, room 23 C (EN 60436 conditions [RECALLED]), tank water at room temperature at the start.

Check against programmes whose temperatures are printed:

| Programme (my timeline) | Model | Printed for this model | Laboratory, class-D sisters |
|---|---|---|---|
| Eco 50: 4.0 L kept, 50 C, long soak, flush, one rinse, final 61 C | 0.88 kWh | 0.836 | 0.74 to 0.81 |
| Intensive 70, two rinses, temperature held at 70 C for 30 min, final 69 C | 1.27 kWh (1.16 if the heater stays off in the hold) | 1.300 | none |
| Intensive 70, three rinses, temperature held | 1.37 kWh | 1.400 | none |
| Express 65: 5.5 L, 65 C, short hold, one rinse, final 69 C | 1.06 to 1.10 kWh | 1.300 | 1.11 to 1.19 |

The model is 5 % high for Eco, 2 % low for Intensive (if the 70 C is held by the heater), and 15 to 18 % low against the printed Express figure while within 1 to 11 % of the laboratory's figures for the sisters' 1 h programmes. My timelines for these programmes come out at 277, 129 to 140 and 53 min against the printed 295, 125 to 135 and 60, so their hold and drying lengths are only roughly right. Good enough for a sanity check; not a calibration.

### 5.4 Auto branches in the model

Each branch's post-wash hold was set so the total equals the printed or displayed duration.

| Branch | Assumptions | Minutes | Water (L) | Model energy (kWh) | Heater on (min) | Reference |
|---|---|---|---|---|---|---|
| N, recommended | 2.5 L exchange, wash 60 C, heater off in the hold (49 min), one rinse, final 65 C, drying 40 | 145 | 11.5 | **0.98** (heater 0.86, pump 0.11, other 0.01) | 15.4 + 8.5 | envelope 0.900 to 1.500; sisters 1.06 to 1.11 |
| N, wash 55 C | as N | 145 | 11.5 | 0.94 | 13.2 + 9.5 | |
| N, wash 65 C | as N | 145 | 11.5 | 1.02 | 17.5 + 7.5 | |
| N, temperature held, final 69 C | wash 60 C reheated during the hold | 145 | 11.5 | 1.11 | | |
| N-full | full 4.0 L exchange, wash 60 C, one rinse | 145 | 13.0 | 1.01 | 16.3 + 8.4 | |
| N-keep | no exchange, wash 65 C, two rinses | 145 | 11.5 | 1.07 | 16.9 + 9.6 | |
| N at 2:13 | as N, hold 37 min | 133 | 11.5 | 0.96 | | sisters 1.06 to 1.11 |
| L, light | no exchange, wash 45 C, hold 19 min, flush, final 65 C | 100 | 7.0 | 0.73 (0.81 with temperature held and final 69 C) | 8.4 + 10.0 | printed minimum 0.900 |
| H, heavy | full exchange, wash 65 C, hold 55 min, two rinses, final 65 C | 165 | 15.5 | 1.15 | 18.5 + 9.7 | printed maximum 1.500 |
| H, heavy with warm pre-wash | pre-wash warmed to 40 C, wash 65 C held, final 69 C | 165 | 15.5 | 1.39 | 6.3 + 14.1 + 9.1 | printed maximum 1.500 |

Sensitivity of branch N with the hold fixed at 49 min: British winter (inlet 8 C, room 19 C, 240 V so 2340 W) 1.09 kWh; summer (inlet 18 C) 0.95; half load 0.82; C_machine 10 or 18 kJ/K gives 0.93 or 1.03; UA 2.6 or 6 W/K gives 0.94 or 1.03.

Result: the recommended timeline closes inside the printed range (0.98 kWh against 0.900 to 1.500) and inside the water range (11.5 L against 7.0 to 15.5). It sits 8 to 12 % under the laboratory figures for sisters. The model does not reach the printed extremes: 0.73 to 0.81 against 0.900 at the light end, 1.15 to 1.39 against 1.500 at the heavy end. Either the real programme holds temperature with the heater during the main wash and rinses hotter than 65 C, or the printed range brackets conditions I have not modelled. A logged run decides between these.

Heating is 88 % of the modelled energy in branch N, in line with machine.md's 80 to 90 % target.

## 6. Recommended programme table: "AUTO 2:25" (branch N)

Conventions as in machine.md section 7.3. Conditions: inlet 15 C, room 23 C, full 13 place-setting load, heater 2150 W at full duty (2340 W at 240 V), carry-over 0.4 L of which 0.16 to 0.18 L is sump residue [VERIFIED P1]. "L/U a/b" is the water-switch pattern in seconds, lower then upper. Pump speeds are machine.md's generic values: no BSH speed figure was found [ESTIMATED, generic]. Temperatures in the action column are model outputs [ESTIMATED].

| Step | Clock (h:mm) | Action | Water in (L) | Target (C) | N (rpm), diverter | Duration (min) |
|---|---|---|---|---|---|---|
| A0 | 0:00 | pre-drain [ESTIMATED; start-of-programme valve test of 5 s is VERIFIED K2] | | | | 0.5 |
| A1 | 0:00.5 | fill 1: the heat exchanger's 3.1 L from the previous run (room temperature) [VERIFIED mechanism P2, K2; volume K2] plus 0.9 L from the mains; liquor about 21 C | 4.0 [ESTIMATED from the 4.0 L pre-rinse programme, B2] | | | 1 |
| A2 | 0:01.5 | cold pre-rinse; no detergent, no heating; sensor calibrated at the start, turbidity read near the end (D1); level check and top-up if the pump runs rough [VERIFIED K2] | | none | 2600; L/U 60/60 [ESTIMATED] | 11.5 [ESTIMATED] |
| A3 | 0:13 | water exchange after D1 = "soiled": partial drain of about 2.5 L and refill of 2.5 L; liquor about 18 C | 2.5 [ESTIMATED, section 4.4] | | | 2 [ESTIMATED] |
| A4 | 0:15 | detergent lid released by the first coil pulse about 30 s after circulation resumes; tablet drops into the upper-basket tray [mechanism VERIFIED K2, B1; time ESTIMATED]; heat-up at about 2.7 K/min | | 60 [ESTIMATED; range 55 to 65] | 3000; L/U 60/60 [ESTIMATED] | 15.5 [ESTIMATED from 2.5 K/min, K2] |
| A5 | 0:30.5 | post-wash hold, heater off [VERIFIED as the patent pattern, P2]; liquor drifts from 60 to about 56 C; at 1:04.5 the heat exchanger takes 2.5 L of cold water ("roughly 15 minutes before the main wash drains" [F2]) and the liquor falls to about 50 C by the end | 2.5 into the heat exchanger | | 3000; L/U 60/60 | 49 [ESTIMATED; set by the 145 min total] |
| A6 | 1:19.5 | drain, with short circulate/drain alternation to rinse the filter [VERIFIED K1 as a 2008 behaviour] | | | | 1.5 |
| A7 | 1:21 | intermediate rinse: 2.5 L from the heat exchanger at about 45 C, unheated [VERIFIED P2, P3: unheated]; the heat exchanger is refilled at once with 2.5 L for the final rinse [VERIFIED K2]; liquor about 45 C | 2.5 into the heat exchanger | none | 2600; L/U 45/45 [ESTIMATED] | 7.5 [ESTIMATED] |
| A8 | 1:28.5 | drain | | | | 1.5 |
| A9 | 1:30 | final-rinse fill: 2.5 L from the heat exchanger at about 33 C [VERIFIED quantity K2]; circulate; rinse aid 5 pulses of 1 ml at about 1:31 [pulse size VERIFIED K2; 5 pulses for setting r05 ESTIMATED]; liquor about 42 C | (from heat exchanger) | | 2800; L/U 45/45 [ESTIMATED] | 2 [ESTIMATED] |
| A10 | 1:32 | final-rinse heat-up | | 65 [ESTIMATED; other programmes on this model print 61, 63, 69, 69] | 2800; L/U 45/45 | 8.5 [ESTIMATED] |
| A11 | 1:40.5 | final-rinse hold | | | 2800 | 3 [ESTIMATED] |
| A12 | 1:43.5 | drain; load about 63 C | | | | 1.5 |
| A13 | 1:45 | drying: door closed, no fan, no door opening [VERIFIED B4: heat exchanger only]; drain pump runs briefly at the start for dripping liquor; the heat exchanger is filled with 3.1 L of cold water in about three portions and stays full for the next run [VERIFIED P2, K2]; condensate pumped out at the end [VERIFIED B3] | 3.1 into the heat exchanger | | | 40 [ESTIMATED; range 30 to 50] |
| end | 2:25 | machine switches itself off after 1 min [VERIFIED B1] | | | | |

Totals: mains water 0.9 + 2.5 + 2.5 + 2.5 + 3.1 = 11.5 L; modelled energy 0.98 kWh at EN conditions, 1.09 kWh in a British winter; 145 min.

Things the simulator should treat as parameters of this table: wash target (55 to 65), hold length (37 to 55 min), whether the heater holds temperature during A5, exchange volume at A3 (0, 2.5 or 4.0 L), number of intermediate rinses (flush only, 1 or 2), final-rinse target (61 to 69, +3 K with Extra Dry), drying length (30 to 50 min), diverter period, pump speed, and whether only the lower level is sprayed during heat-up as the 2008 manual says for other programmes.

### 6.1 Alternative readings that fit the same evidence

| Name | Change from branch N | Water (L) | Model energy (kWh) | When to prefer |
|---|---|---|---|---|
| N-keep | A3 removed; wash 65 C; a second intermediate rinse of 7.5 min plus 1.5 min drain; hold shortened to about 39 min | 11.5 | 1.07 | if a logged run shows no drain before the first heating and two unheated rinses |
| N-full | A3 becomes a full drain and 4.0 L refill | 13.0 | 1.01 | if the inlet log shows about 4 L at the second fill |
| L, light (1:40) | no A3; wash 45 C (8.5 min heat-up); hold about 19 min; A7 replaced by a 0.5 L flush (about 2 min with its drain) | 7.0 | 0.73 to 0.81 (printed 0.900) | pre-rinsed or nearly clean load |
| H, heavy (2:45) | A3 full exchange; wash 65 C (18.5 min); hold about 55 min, possibly heated; two intermediate rinses; final rinse 65 to 69 C | 15.5 | 1.15 to 1.39 (printed 1.500) | heavily soiled load, or sensor calibration failure |
| +Regeneration | about 7 min and 5 L added in the main wash, brine flushed through the heat exchanger and tub to the drain | +5 | +0.05 | every sixth run at hardness H04 |

A faithful simulator would run Auto as a branching programme (section 4) with branch N as the outcome for a normally soiled reference load, and report which branch the load triggered.

## 7. Outline of the other programmes

Printed data are in section 1.1. Reconstructions are [ESTIMATED] from the same blocks; water sums are in section 4.4.

| Programme | Reconstruction | Checks |
|---|---|---|
| Eco 50 (4:55, 0.836 kWh, 9.5 L) | 4.0 L first fill; cold pre-rinse about 15 min; same water kept; heat to 50 C; long soak with intermittent spraying (the manual attributes the length to "longer soaking and drying times"); filter flush; one 2.5 L intermediate rinse; final rinse 2.5 L to 61 C; drying of the order of 90 min. Sensors not used in Eco on the 2008 platform [K1] and by the standard's logic | model 0.88 kWh; sisters' Eco measured at 0.74 to 0.81 kWh [T1] |
| Intensive 70 (2:05 to 2:15, 1.3 to 1.4 kWh, 11.5 to 14.0 L) | 4.0 L; pre-rinse about 10 min; heat to 70 C and hold about 30 to 40 min; two or three 2.5 L intermediate rinses (sensor decides the third: +10 min, +2.5 L, +0.1 kWh, which is exactly the printed span); final rinse 69 C; drying about 35 min | model 1.27 to 1.37 kWh |
| Express 65 (1:00, 1.3 kWh, 10.5 L) | no pre-rinse; about 5.5 L with both spray levels at once (VarioSpeed logic [K1]); heat to 65 C in about 20 min; short hold; one 2.5 L rinse; final rinse 69 C; about 5 min drying. The manual warns that tablets may not dissolve fully in short programmes | model 1.06 to 1.10 kWh; laboratory 1.11 to 1.19 kWh for sisters; printed 1.300 |
| Silence 50 (4:00, 1.05 kWh, 11.0 L) | as Eco at lower pump speed with a 63 C final rinse; the extra 1.5 L and 0.21 kWh over Eco are not explained by the printed sequence | open |
| Pre-rinse (0:15, 0.05 kWh, 4.0 L) | one 4.0 L cold fill, about 11 min spraying, drain | consistent |

## 8. Conflicts and open points

1. machine.md's AUTO baseline (13.0 L, 1.15 kWh, 135 min, final rinse 62 C, auto-open at the end, fills 3.4 / 3.6 / 3.0 / 3.0 L) differs from this machine: no door opening, first fill 4.0 L, later fills 2.5 L, normal branch 11.5 L, displayed 145 min.
2. machine.md's heater: 2000 W at duty 0.7 (1.6 K/min). This platform: 2100 to 2150 W at 230 V, service criterion 2.5 K/min [K2].
3. machine.md's rinse aid: 3 ml at 40 C. This platform: 1 ml per pulse, pulses equal the setting [K2]; factory setting here r05 [B1], so 5 ml if the rule carried over. A different owner's machine reports `RinseAid: R04` [H1].
4. Printed Express 65 energy (1.300 kWh) against laboratory 1.11 to 1.19 kWh on sisters [T1]; printed Auto minimum 0.900 kWh against my model's 0.73 to 0.81. The printed non-Eco values may be rounded up or measured under other conditions.
5. Start display: "time needed last time" (2008 service manual [K1]) against "an average value" (US manual of this generation [U1]).
6. Number of intermediate rinses on the normal branch: one with a partial exchange (my table) or two with none (2008 structure b). Same water total.
7. Forum posts disagree on whether Auto with the speed option forces or can skip the pre-wash [F3].
8. Pre-wash on the heavy branch: "warm" according to a forum expert speaking of zeolite models [F1]; cold in the 2008 Auto description [K1]; unknown here.
9. The fixed programmes' printed final-rinse temperatures (61, 63, 69, 69 C) do not tell us Auto's. The 2008 manual says 65 C for every Auto structure [K1].

## 9. What the owner could measure (most valuable first)

1. **Power log of one Auto run** with a plug-in energy meter or smart plug that logs every 1 to 10 s (a 13 A plug rated for 2.4 kW). Note the display at start and at each jump. Gives: number, start and length of heating phases (wash target, final-rinse heat-up), pump power, drain events (short 30 W blips), drying length, total kWh, heater watts and socket voltage. This replaces most [ESTIMATED] durations in section 6.
2. **Home Connect log** (the machine has it): record `ProgramPhase`, `RemainingProgramTime` and `ProgramProgress` through a run (Home Assistant, or screenshots every few minutes), plus the app's energy and water forecast for Auto. Gives phase boundaries and the time jumps.
3. **Count fills and drains** from a phone audio recording left beside the machine, or better, catch the drain water: put the drain hose in a bucket on a kitchen scale and note the mass and temperature (thermometer) of each discharge. Gives per-fill volumes (the 4.0 / 2.5 / 0.5 L arithmetic), whether a water exchange follows the pre-rinse, the number of rinses, and liquor temperature at each drain.
4. **Temperature inside**: a dishwasher-safe logger (for example a thermo-button) in the cutlery basket and one taped to a plate. Gives wash and final-rinse peak temperatures, heat-up rate, hold behaviour, cooling in drying.
5. **Basic settings**: read H (hardness), r (rinse aid) and d (intensive drying) values on the display, and whether the Extra Dry key is lit. Explains part of the displayed time.
6. **Detergent release time**: open the door briefly at about 5, 14 and 18 minutes and look at the dispenser lid and the tray (hot water can splash later in the cycle; the early checks are cold).
7. **Soil response**: run Auto once with clean dishes and once with a heavily soiled load; compare total time, water and number of drains. Brackets the turbidity thresholds.
8. **Spray alternation and pump speed**: the audio recording from item 3; the level change is audible, and a spectrogram shows the pump tone. Gives the diverter period and relative speed per phase.
9. **Ask BSH**: the manual says test institutes can request the EN 60436 test information from dishwasher@test-appliances.com with E-Nr SMV4HAX40G/13 and FD 0106. That sheet may list programme conditions.
10. **Regeneration**: note when a run takes about 7 minutes longer; at H04 it should be every sixth run.

## 10. Not found

- Any programme-sequence chart for Auto 45-65 on the 2021 platform (type SD6P1B), or a BSH service manual newer than GV640.
- A logged power or temperature trace of Auto 45-65 from an identified machine of this generation. The only full Auto trace on file ([T2]: 2 h 11 min, 1.01 kWh, four short heating bursts of 1.7 to 4.1 min in a 70 min wash, a 13 min final-rinse heat-up, about 30 min of drying at 2 to 6 W, pump about 65 W, digitised from the article's chart with a script that is not in the repository) is from a machine whose make the author does not state.
- Turbidity thresholds; the mapping from sensor reading to temperature.
- Circulation pump speeds of the BSH BLDC pump; the spray-level alternation period.
- The final-rinse temperature and the drying length of Auto on this model.
- The detergent release time and the rinse-aid dose per setting step for this model.
- Whether this model's start display shows the last run or a stored value.
- The Brückner and Stamminger study of automatic programmes (Energy Efficiency 8, 2015) could not be opened; [RECALLED] only that it tested several machines' automatic programmes at different soil levels.

## Sources

- [B1] Bosch, user manual SMV4HAX40G, 9001937295_B (en). https://media3.bosch-home.com/Documents/9001937295_B.pdf (HTTP 200 checked).
- [B2] Bosch, quick reference guide SMV4HAX40G, 9001643502_B (020402) and 9001937296_A (040529). https://media3.bosch-home.com/Documents/9001643502_B.pdf and https://media3.bosch-home.com/Documents/9001937296_A.pdf (both HTTP 200). Programme table on page 1.
- [B3] Bosch, interactive user manual 9001937297 (and 9001575819) for SMV4HAX40G. https://www.bosch-home.co.uk/manual/9001937297?productCode=SMV4HAX40G (the AquaSensor paragraph and the troubleshooting chapter).
- [B4] Bosch, product specification sheet SMV4HAX40G (en-GB). https://media3.bsh-group.com/Documents/specsheet/en-GB/SMV4HAX40G.pdf
- [B5] EU product information sheet and EPREL record 365247. https://eprel.ec.europa.eu/qr/365247
- [B6] Owner's photographs: the rating plate and control panel (IMG_9079, not published: it shows the serial number) and `docs/reference/owner-photos/IMG_9080-front-view-lower-basket-pulled-out.jpg`.
- [K1] Küppersbusch Hausgeräte AG, Service Manual H7-71-05, "Einbau-Geschirrspülautomaten Baureihen 634 mit Automatikprogrammen", 6 Apr 2008. http://tds.kueppersbusch.de/kb-technik/service_manuals/Geschirr/DE/A7_014DE.pdf
- [K2] Küppersbusch Hausgeräte AG, Service Manual H7-71-07, "Einbau-Geschirrspülautomaten Baureihe 640" (GV 640), 13 Oct 2010. http://tds.kueppersbusch.de/kb-technik/service_manuals/Geschirr/DE/A7_018DE.pdf
- [P1] BSH, DE102010039611A1, "Geschirrspülmaschine mit einem manuell anpassbaren Spülprogramm", 2010. https://patents.google.com/patent/DE102010039611A1/de
- [P2] BSH, DE102009029039A1 (EP2289388B1), "Geschirrspülmaschine mit einem Wasserbehälter zur Kondensationstrocknung sowie zugehöriges Füllverfahren", 2009. https://patents.google.com/patent/DE102009029039A1/de
- [P3] BSH, DE19651297A1, "Verfahren zum Betreiben einer Geschirrspülmaschine", 1996. https://patents.google.com/patent/DE19651297A1/de
- [P4] BSH, EP1531712B1, "Verfahren zum Anpassen eines Spülprogramms in einer Geschirrspülmaschine", priority 2002. Read from the EPO publication server (address not recorded).
- [P5] BSH, EP1029496B1, "Haushalt-Geschirrspülmaschine", priority 1999. Read from the EPO publication server (address not recorded).
- [P6] BSH, EP2440107A1, "Geschirrspülmaschine mit Wärmetauscher sowie zugehöriges Steuerungsverfahren", 2009. https://patents.google.com/patent/EP2440107A1/de (background only).
- [T1] Verein für Konsumenteninformation, KONSUMENT dishwasher tests. Articles: https://www.konsument.at/test-geschirrspueler-102021 , https://www.konsument.at/test-geschirrspueler-102020 , https://konsument.at/test-geschirrspueler012020 , https://www.konsument.at/heim-garten/geschirrspueler-318869474279 . Tables: https://archiv.vki.at/konsument/tabellen/318926318976_4.html (10/2021, fully integrated 60 cm), 318921921596_4.html (10/2020), 318917242228_3.html (1/2020), 318869474279_3.html and _4.html (8/2016).
- [T2] raspberry.tips, "Spülmaschine oder Waschmaschine fertig? Push-Benachrichtigung mit Home Assistant und einer Shelly-Steckdose", Sept 2026. https://raspberry.tips/smart-home/spuelmaschine-waschmaschine-fertig-benachrichtigung-home-assistant . Machine make not stated.
- [F1] automaticwasher.org, "does Auto 45-65 on BSH dishwashers choose between two fixed degrees, or is it variable?", Feb 2025. https://automaticwasher.org/threads/does-auto-45-65-on-bsh-dishwashers-choose-between-two-fixed-degrees-or-is-it-variable.97583/
- [F2] automaticwasher.org, thread 52765, posts 93 and 101, Apr 2014. https://automaticwasher.org/threads/europe-phosphate-regulations-all-stpp-out-within-2016-in-dw-products.52765/latest
- [F3] automaticwasher.org, thread 95869 page 2, May 2024 (read through a page summary, not the raw text). https://automaticwasher.org/threads/new-dishwasher-detergent-dispensers-being-flooded.95869/page-2
- [F4] automaticwasher.org, "DW Auto programmes: do they always work?", Oct 2008. https://automaticwasher.org/threads/dw-auto-programmes-do-they-always-work.19202
- [F5] Küchen-Forum, "Verbrauchsangaben Geschirrspüler Eco vs. Auto", Mar 2024. https://www.kuechen-forum.de/forum/themen/verbrauchsangaben-geschirrspueler-eco-vs-auto.48928/
- [M1] Siemens, "Mehrwerte von A-Z, Geschirrspülen". https://media3.bsh-group.com/Documents/15825632_Siemens_Mehrwertfibel_Einbau_A4_verlinkt_highScreen_pdf_master.pdf
- [M2] Bosch Australia dishwashing catalogue 2017 (MCDOC02269689) and Bosch New Zealand dishwashing brochure 2021 (MCDOC02344627), collected by the earlier attempt. Addresses as given in `documents.md`, sources 25 and 26: https://media3.bosch-home.com/Documents/MCDOC02269689_BH_3207_B_-_Dishwashing_Catalogue_Ed_1_2017_FA.pdf and https://media3.bosch-home.com/Documents/MCDOC02344627_Bosch_NZ_Dishwashing_Brochure.pdf
- [U1] Bosch US, use and care manual SHP78CM5N, 9001641455_C. https://media3.bosch-home.com/Documents/9001641455_C.pdf (HTTP 200).
- [H1] hcpy, Home Connect local-protocol client, README with an example dishwasher state. https://github.com/hcpy2-0/hcpy
- machine.md: `docs/research/machine.md`, sections 6.2, 7.3, 12.1.
