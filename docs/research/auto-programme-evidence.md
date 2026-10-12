# Spotless research dossier: what a Bosch Auto 45-65 run does (evidence for the owner's SMV4HAX40G)

> **Record of the build, kept as written (10 October 2026).** Research on the Auto 45-65
> programme, written when the game was to be scored on it. The game is scored on Eco 50 only
> (`docs/design/scope.md`); Auto remains in the machine data, uncalibrated. Working files this
> note cites are not in the repository. The index of the documents is `docs/README.md`.

Specialist: appliance engineer, desk research. Date: 2026-10-10. Status: nothing measured on the owner's machine; no step chart of Auto 45-65 for this platform was found. This dossier adds evidence to `docs/research/machine-bosch-smv4hax40g.md` section 4 ([-> machine]) and proposes changes to `BOSCH_AUTO_145_OPTIONS` (`packages/machine/src/data/bosch-programmes.ts`). Nothing under `packages/` was changed. Fact-checked the same day: section 9 lists what was confirmed, corrected and downgraded; corrections in the text are marked "[fact-check]".

## 0. How to read this dossier

### 0.1 Tags

- [VERIFIED]: read this session in the opened source (text extracted from the downloaded file, or a figure read off a downloaded image). On a sister machine, an older platform or a patent the tag certifies what the source says, not that the owner's machine does it.
- [RECALLED]: from memory or from a search-result snippet; source not opened.
- [ESTIMATED]: my derivation. The inputs and the likely error are given.

Source keys (`A#`) are in section 8. Keys in square brackets with other letters ([K1], [T1], [F1], [PA7] ...) are the keys of [-> machine] section 9; where I re-opened one of those this session it also has an `A#` key.

### 0.2 The findings that matter

1. **No public document gives the course of Auto 45-65 on the 2021 platform.** The owner's manual and quick guide print only the envelope: 1:40 to 2:45, 0.900 to 1.500 kWh, 7.0 to 15.5 L [VERIFIED, A1, A2]. The turbidity thresholds are "in der Elektronik hinterlegt" [VERIFIED, A4]. Everything below is inference from older platform documents, one patent, one published power trace of an unidentified machine, and test-institute results.
2. **On the documented platform, 65 C is the heavy structure, not the normal one.** The 2008 BSH-platform service manual names three Auto structures: wash 50 C with one intermediate rinse; pre-rinse plus wash 55 C with one intermediate rinse; wash 65 C with two intermediate rinses. Its other variant ends the wash at 45 C (little soil) or 50 / 55 C (much soil), 55 C when the pre-rinse water was exchanged [VERIFIED, A3]. The current model's normal branch (65 C with one rinse) is a combination that manual does not contain. [fact-check] The heading overstates it. The 65 C structure of that list has no pre-rinse and two rinses, which on this machine's volumes is 4.0 + 3 x 2.5 = 11.5 L, the water the laboratory measured on the sisters for normal soiling (11.2 to 11.9 L); the pre-rinse structure with a 55 C wash reaches the same 11.5 L only with a partial exchange the 2008 manual does not describe (13.0 L with a full one). The documents therefore do not put 65 C outside a normally soiled run.
3. **The wash is heated in stages and then left unheated.** The 2008 manual has the sensor decide the wash's end temperature during the wash, which requires a pause on the way up [VERIFIED, A3, inference mine]. A BSH patent of 2010 states as the general practice that the heater is switched off when the maximum is reached and the liquor "slowly cools" [VERIFIED, A5]. The one published power trace of an automatic programme I could read (make not stated, so weak) shows four heater bursts spread over 46 minutes, then 21 minutes without heating [VERIFIED as a trace, A6]. Nothing found shows a wash held at temperature by reheating.
4. **In that trace the wash peaks near 53 C (48 to 58) and the final rinse near 68 C (62 to 74)** [ESTIMATED from heater minutes, section 2.3]. The final rinse takes almost as much heater time (13.5 min) as the whole wash (14.6 min).
5. **The energy of the two laboratory-measured sisters cannot tell a 55 C wash from a 65 C wash.** The thermal model's own sensitivity is 0.008 kWh per kelvin of wash target ([-> machine] 4.5: 0.96 kWh at 55 C, 1.04 at 65 C), because heat not put into the wash has to be put into the final rinse. The 0.08 kWh between 55 and 65 C is no larger than what the model's heat capacity (+-0.05 kWh) or 3 K of final-rinse target (0.04 kWh) leave open. The argument by which [-> machine] 4.4 chose 65 C does not hold. [fact-check] Confirmed with the repository's thermal model: 1.038 kWh for the course as written and 0.963 kWh for the staged 55 C course of section 3.2. Against the sisters' 1.06 to 1.11 kWh that is 2 to 7 % low at 65 C and 9 to 13 % low at 55 C: inside the model's uncertainty, and leaning to the hotter wash if anything.
6. **Test institutes find Auto cleans as well as Eco on these machines.** KONSUMENT / Stiftung Warentest 10/2021: both class-D sisters of the owner's machine score "sehr gut" for cleaning in Eco and "sehr gut" in Auto, the Auto grade covering normally and heavily soiled loads [VERIFIED, A7, A8]. Which? 2024, three unnamed big-brand machines: cleaning 83 % on the main (auto) programme against 79 % on Eco [VERIFIED, A10]. The simulation's verdict (every egg and milk item at 0 on Auto) contradicts both.
7. **Recommended default for the normal branch: staged heat-up with a plateau at 45 C, wash target 55 C (range 50 to 65), heater off after the target, one intermediate rinse, final rinse 69 C (range 63 to 72).** With it the liquor spends about 50 minutes at or above 45 C and none above 60 C, against 35 minutes above 60 C in the model as written. Confidence: low to moderate; one logged run on the owner's machine replaces it (section 6). [fact-check] Downgraded to low: the wash target is undetermined between 50 and 65 C (section 9), and the recommendation of `docs/research/auto-recommendation.md` is to keep 65 C as the default until that run exists and to carry this course as a named alternative.

---

## 1. What the documents say

### 1.1 The owner's model

| # | Finding | Value | Source | Tag |
|---|---|---|---|---|
| 1 | Printed envelope of Auto 45-65 | 1:40 to 2:45; 0.900 to 1.500 kWh; 7.0 to 15.5 L | quick reference guide 9001937296_A, programme table [A2] | [VERIFIED] |
| 2 | Printed sequence of Auto | "Sensor-controlled: Optimised by sensors depending ..." (no phases, no temperatures) | user manual 9001937295_B [A1] | [VERIFIED] |
| 3 | Printed sequences of the fixed programmes | Eco 50: wash 50 C, final rinse 61 C; Silence: 50 / 63 C; Intensive: 70 / 69 C; Express 65: 65 / 69 C | [-> machine] 4.1, from [A1]; not re-read line by line this session | [VERIFIED] by the earlier dossier |
| 4 | Sensors and a pre-cleaned load | For tableware pre-cleaned too thoroughly the manual says "The sensors chose a weaker programme", so that stubborn soiling cannot be removed entirely; its remedy is to remove only large food remnants and not to pre-rinse. | user manual [A1], troubleshooting table | [VERIFIED] |
| 5 | Same-generation US manual (SHP78CM5N), AquaSensor | With heavy soiling the washing water is drained and replaced by fresh water; with lighter soiling it is kept for the next rinse, which saves 3 to 6 litres. Then, in the manual's words: "In the Auto cycles the temperature and run time are additionally adjusted to the level of soiling." | [A9] p. 10 | [VERIFIED] sister |
| 6 | Same manual, sensor sensitivity | three settings: SE:00, which the manual calls the best choice for mixed loads and for heavily soiled dishes and which saves energy and water; SE:01, for removing food remnants well even when the load is only lightly soiled; SE:02, for hard conditions such as stubborn, dried-on remnants, and recommended with organic or ecological detergents that are low in active agents | [A9] p. 10 | [VERIFIED] sister |
| 7 | Same manual, Auto | sequence "Sensor controlled"; 1:45 to 2:05; 0.820 to 0.860 kWh; 3.4 to 5.4 gal; the cycle time displayed is, the manual says, "an average value". Its fixed cycles print temperatures (Heavy: wash 151 to 160 F, final rinse 151 F; Normal: 127 to 136 F / 136 F; Speed60: 122 F / 158 F); Auto prints none | [A9] p. 15-16 | [VERIFIED] sister (US platform: hot fill, zeolite) |
| 8 | Zeolite sister SMS6ZDW48E, printed Auto envelope | 1:40 to 2:40; 0.680 to 1.300 kWh; 7.0 to 15.5 L; Eco 3:55, 0.736 kWh, 9.5 L | quick reference guide 9001643171_A [A11] | [VERIFIED] sister |

Rows 4 to 6 matter to the game: the programme the machine chooses depends on the whole load's soil, and a load of mostly clean dishes with a few egg plates is exactly the case the manual warns about.

### 1.2 The platform, 2008 and 2010 (re-opened this session)

| # | Finding | Source | Tag |
|---|---|---|---|
| 9 | "Auto 55 / 65 (je nach Variante)": depending on the Aquasensor's decision the programme is one of three structures: wash at 50 with one intermediate rinse; wash at 65 with two intermediate rinses; or pre-rinse, wash at 55 and one intermediate rinse. Each ends with a final rinse at 65 and drying. | [A3] p. 9 | [VERIFIED] sister, 2008 |
| 10 | Aquasensor II in the automatic programme: (1) infrared, in the pre-rinse: water exchanged (much soil) or kept. (2) green, "im Reinigen": an end temperature of 45 C with little soil, or 50 or 55 C with much; if the Aquasensor chose a water change in the pre-rinse, the wash temperature is raised from 50 to 55 C; a wash at 50 or 55 C is followed by a flush of the filter. (3) green, in the first intermediate rinse: a further rinse (much soil) or only a filter flush. "Im Automatik-Programm sind 48 Programmstrukturen moeglich." Failed calibration: reading set to "trueb", "ein maximaler Programmablauf findet statt" | [A3] p. 19 | [VERIFIED] sister, 2008 |
| 11 | Fixed programmes of 2008 for comparison: Normal 65: wash 65, two intermediate rinses, final rinse 69; Eco 50: wash 50, one intermediate rinse, final rinse 66; Intensive 70: pre-rinse 50, wash 70, two to three rinses, final rinse 70. Until the temperature is reached, only the lower basket is sprayed | [A3] p. 8 | [VERIFIED] sister, 2008 |
| 12 | GV 640 (2010): the measurement is evaluated in turbidity ranges whose values are stored in the electronics ("in der Elektronik hinterlegt"); "Der Aquasensor ist im Vorspuelen, im Reinigen und am Ende des Reinigens aktiv"; the automatic programme allows widely differing programme structures. | [A4] p. 82 | [VERIFIED] sister, 2010 |
| 13 | GV 640: heater to warm the water at 2.5 K/min; tank filled during the wash to pre-warm the next bath; final rinse expects 2.5 L of the tank's 3.1 L | [A4] p. 67, 91, 92 | [VERIFIED] sister, 2010 |
| 14 | BSH patent DE102010043330A1 (2010), background: in intensive programmes the liquor is heated to, for example, 70 to 80 C; once that maximum is reached the heater is switched off ("deaktiviert"), with the result that the liquor "langsam abkuehlt". Embodiment: after "einem teilweisen oder vollstaendigen Abpumpen" of the pre-rinse water the wash is heated to a maximum and "anschliessend bei abgestellter Heizung wieder langsam abkuehlt"; the invention (reheating to stay above a fat-release temperature) is the exception it proposes | [A5] | [VERIFIED] BSH patent |
| 15 | Bosch customer service, relayed by a forum member about a 2003-era Bosch with automatic programmes: the automatic programme heats in a different pattern from the fixed ones and does better on starches, in the relayed words "because the enzymes are given longer to work at 45 degrees before ramping up to 65 degrees." | [A12] post 21 | [VERIFIED] as a quotation; hearsay as fact |
| 16 | Forum observer of current BSH machines: maximum Auto is a warm pre-wash, main wash 65 C "full duration", two unheated interim rinses, heated final rinse; minimum is wash, rinse, heated rinse, dry; "The second interim rinse is barely ever triggered"; "anywhere from 3 to 10 different main wash versions"; partial drains seen between pre-rinse and main wash; interim rinse, final rinse and dry take "something between 1h and 1:20h" | [A13] posts 4, 10 | [VERIFIED] as quotations; unverified as fact |

Reading. Rows 9 and 10 are the only documents that tie a wash temperature to a soil decision on any BSH platform. In both, the middle structures wash at 50 or 55 C and reach 65 C only together with the second intermediate rinse, which the observer of row 16 says is rarely triggered on current machines. Row 10 has the sensor read "im Reinigen" and then fix the end temperature, so the heat-up pauses at or below 45 C for a reading; rows 15 and 16 and the 2014 owner quoted in [-> machine] 4.2 ("I can hear the heater click on and off throughout the main wash") agree. Rows 13 and 14 say the heater is not used to hold the wash. The platform is two generations older than the owner's machine and its range was 45-55 or 55-65, not 45-65; none of this is a statement about 2021 firmware.

---

## 2. Measurements

### 2.1 Laboratory figures for automatic programmes on BSH machines

KONSUMENT (VKI, Austria) publishes the full tables of the tests it runs with Stiftung Warentest. All rows [VERIFIED] in the archived tables [A7]; Auto figures are "Angaben fuer normale Verschmutzung".

| Test | Machine | Eco: kWh / L / h:min | Auto: kWh / L / h:min | Short: kWh / L / h:min | Cleaning, Eco | Cleaning, Auto | Auto's adaptation to soil and load |
|---|---|---|---|---|---|---|---|
| 10/2021 | Constructa CG5VX00HCD (class D, 14 ps) | 0.81 / 9.3 / 4:50 | 1.06 / 11.2 / 2:13 | 1.11 / 10.0 / 0:57 | sehr gut | sehr gut | gut |
| 10/2021 | Siemens SN65EX57CE (class D, 14 ps) | 0.74 / 9.4 / 4:31 | 1.11 / 11.9 / 2:14 | 1.19 / 10.1 / 1:02 | sehr gut | sehr gut | weniger zufriedenstellend |
| 10/2021 | Bosch SMV6ZCX49E (zeolite, class C) | 0.68 / 9.2 / 3:48 | 0.88 / 10.7 / 2:11 | 1.06 / 11.2 / 1:28 | sehr gut | sehr gut | durchschnittlich |
| 10/2021 | Siemens SN87YX01CE (zeolite, class B) | 0.65 / 9.5 / 3:51 | 0.87 / 11.6 / 2:14 | 1.05 / 11.4 / 1:29 | gut | gut | durchschnittlich |
| 10/2021 | Bosch SPV6ZMX23E (45 cm, zeolite) | 0.58 / 9.3 / 3:27 | 0.67 / 8.9 / 1:55 | 0.82 / 10.5 / 1:25 | sehr gut | gut | nicht zufriedenstellend |
| 10/2020 | Bosch SMV46MX04E (previous generation) | 0.86 / 9.5 / 3:12 | 1.21 / 14.9 / 2:33 | 1.23 / 10.4 / 1:01 | sehr gut | gut | gut |
| 10/2020 | Siemens SN658X02PD (previous generation) | 0.75 / 9.3 / 3:12 | 0.99 / 12.9 / 2:13 | 1.33 / 10.3 / 1:05 | gut | gut | weniger zufriedenstellend |
| 1/2020 | Neff S516T80X1E, Bosch SMV67MX01E, Constructa CG4A54V8, Siemens SN636X03IE (previous generation) | 0.72 to 0.85 / 9.4 to 9.5 / 3:10 to 3:24 | 0.97 to 1.08 (water and time rows not re-read) | not read | sehr gut (all four) | sehr gut (all four) | weniger zufriedenstellend (three), gut (Constructa) |

Method [VERIFIED, A8, A14]: eco, automatic and short programme tested "in Anlehnung an" IEC / DIN EN 60436 with household dishes (pots, porcelain, glasses, bowls, cutlery, some pieces replaced by plastic), commercial phosphate-free single-function tablets, the standard's rinse aid, softener salt; the machine loaded with the maximum number of place settings the maker names; drying then cleaning judged 30 minutes after the end. Automatic programme: cleaning and drying were tested with normally soiled and with heavily soiled dishes; a further test looked at how the programme adapts when heavily and normally soiled dishes are washed and when the machine is only half full. The soils the article names (in German): dried-on porridge, spinach remains or burnt-on minced meat, and tea rings in cups or traces of milk in glasses [A8]; egg yolk and margarine are the other two soils of EN 60436 ([-> standards]) and are not named in the article. The article's own summary: with most models the cleaning performance is nothing to worry about, "und das unabhaengig vom verwendeten Programm." The heavy-soil consumption figures are not in the public tables (Stiftung Warentest's are behind its paywall).

Which? [VERIFIED, A10]: tests "primarily using their main or auto program"; soils named on its method page "milk, coffee, eggs, pasta, spinach and margarine", baked on in a heated cabinet. Its 2024 snapshot of three unnamed big-brand machines: cleaning 83 % on the main programme, 79 % on eco, 74 % on quick wash; water 10.79 / 8.88 / 10.46 L; main programme about 2 h 30 min on average across its tests, eco 3 h 55 min.

What this establishes: on current BSH machines without zeolite a normally soiled standard load on Auto takes 2:13 to 2:14, 11.2 to 11.9 L and 1.06 to 1.11 kWh, and comes out as clean as on Eco (top grade in both). The grade for adaptation differs between two machines of one platform (gut against weniger zufriedenstellend), so the sensor's response is either model-specific or not very repeatable.

### 2.2 What the energy figures can and cannot say about the wash temperature

[ESTIMATED] throughout. Heat capacities as [-> machine] 4.5: wash bath 4.0 L with load and machine 53.7 kJ/K, final-rinse bath 49.1 kJ/K.

- Heat not delivered in the wash is largely owed in the final rinse, because the load and the machine start that rinse colder. [-> machine] 4.5 gives 0.96 / 1.00 / 1.04 kWh for a wash target of 55 / 60 / 65 C: 0.008 kWh/K. The same table gives 0.013 kWh/K for the final-rinse target and +-0.05 kWh for the machine's heat capacity. The sisters' 1.06 and 1.11 kWh (for a 14 place-setting load) therefore fit a 55 C wash with a 69 to 72 C final rinse as well as a 65 C wash with a 65 to 69 C final rinse.
- The printed minimum (0.900 kWh, 7.0 L, 1:40) is reproduced by hand with a 45 C wash and a 69 C final rinse that starts from about 35 C: 53.7 x 26 + 49.1 x 34 = 3.07 MJ = 0.85 kWh of heating plus about 0.06 kWh of pumping. The model's 0.76 kWh for the light branch probably starts its final rinse too warm.
- The printed maximum (1.500 kWh, 15.5 L, 2:45) is not reached by a cold pre-rinse, a 65 C wash from fresh water and a 69 C final rinse (about 1.2 to 1.25 kWh by hand). The missing 0.25 to 0.3 kWh is the size of a pre-wash warmed by about 20 K, which is what the forum observer describes for the maximum programme [A13]. So the 65 C wash very likely belongs with a heated pre-wash and two rinses, at 1.3 to 1.5 kWh, and not with the 1.06 to 1.11 kWh the laboratory measured for normal soiling.
- The sisters used 0.05 to 0.08 kWh less on Auto than on their one-hour programme, in spite of about 70 minutes more circulation (about 0.07 kWh). If their one-hour programme is the 65 / 69 C sequence the owner's manual prints for Express 65 (not verified for those two models), Auto put 0.12 to 0.15 kWh less into heating than a 65 / 69 C programme does. A wash about 10 K cooler accounts for 0.08 kWh of that; a smaller first bath for the rest.

Conclusion: energy and water place the normal branch between the printed extremes and exclude the heavy structure; they do not fix the wash target within 55 to 65 C.

### 2.3 The one published power trace of an automatic programme

Source [A6]: a German home-automation article of September 2026, Shelly AZ Plug, Home Assistant history graph and a table written by the author. **The make and model of the dishwasher are not stated.** It is a built-in machine with a heater of about 2.0 kW that falls to exactly 0 W at the end; the author says its automatic programme takes "zwischen zwei und drei Stunden". That description fits BSH and several other makers. Weight it accordingly.

Author's table [VERIFIED]: pre-rinse with circulation about 3 min at 15 to 80 W; four heating phases of 2 to 5 min at 1,900 to 2,000 W; washing between them 10 to 20 min at 30 to 100 W; several 40 s pauses at 3 to 8 W before the final rinse; final rinse with heating 14 min at up to 2,050 W; drying 25 min at 2 to 6 W with one 20 W blip; then 0 W. Whole run 2 h 11 min, 1.0 kWh (meter 1.619 to 2.625 kWh).

My reading of the graph [VERIFIED as pixel positions on the downloaded 1980 x 1281 image; 9.77 px per minute between the 10:00 and 13:00 ticks; +-0.3 min]:

| Minutes from the start (10:48) | Event | Heater on (min) |
|---|---|---|
| 0 to 2.5 | fill, pump starts | |
| 2.5 to 6.8 | heater, about 1,950 W | 4.3 |
| 6.8 to 25.1 | pump only, about 75 W; one short dip at 22 min | |
| 25.1 to 28.5 | heater | 3.4 |
| 28.5 to 30.8 | pump only | |
| 30.8 to 33.1 | heater | 2.3 |
| 33.1 to 43.5 | pump only | |
| 43.5 to 48.1 | heater, stepping from about 1,900 to 2,000 W | 4.6 |
| 48.1 to 69 | pump only (21 min) | |
| 69 to 71 | pauses near 0 W (drain, refill) | |
| 71 to 83 | pump only: one intermediate rinse of about 12 min | |
| 83 to 85.5 | pause, refill | |
| 85.5 to 99 | heater, about 2,020 W: final rinse | 13.5 |
| 99 to 100.5 | pump, then drain | |
| 100.5 to 131 | 2 to 6 W: drying, about 30 min by the graph (25 min in the author's table) | |

Heater on-time: 14.6 min in the wash, 13.5 min in the final rinse; 28.1 min x about 2.0 kW = 0.94 kWh, with about 0.10 kWh of pumping: consistent with the metered 1.0 kWh.

Temperatures from the heater minutes [ESTIMATED; one lumped node of bath, load and machine, 60 W of pump heat, 3 W/K to a 23 C room; script `lump.py`, a working file that is not in the repository]:

| Assumed heat capacity (kJ/K), start (C) | After bursts 1, 2, 3, 4 (C) | Minutes at or above 45 / 50 / 55 C |
|---|---|---|
| 48, 21 | 32, 41, 47, 58 | 37 / 24 / 22 |
| 53.7, 21 | 31, 39, 44, 54 | 25 / 23 / 0 |
| 53.7, 18 | 28, 36, 42, 52 | 24 / 22 / 0 |
| 60, 18 | 27, 35, 39, 48 | 23 / 0 / 0 |

Final rinse, 13.5 min at 2,020 W on 45 to 56 kJ/K from a start of 33 to 42 C: 62 to 77 C, 66 to 71 C for the central values.

What the trace says, if the machine is of the owner's kind: no cold pre-rinse in that run (heating begins 2.5 min after the start, so either the first burst is a warmed pre-wash whose water is kept, or the wash starts at once); a wash that climbs in four steps over 46 minutes to a peak of about 53 C (48 to 58), spending roughly 15 minutes near 30 C, 10 minutes near 43 C and then 21 minutes cooling from the peak; one unheated intermediate rinse; a final rinse hotter than the wash by 10 to 20 K; drying of 25 to 30 minutes. What it does not say: whose machine it is, what the load was, or what the liquor temperature really was.

---

## 3. The best-supported course for the run the owner sees (2 h 25 min at the start)

### 3.1 Which branch, and how hot

| Question | Answer | Basis | Tag |
|---|---|---|---|
| Is "2:25" a branch? | It is a forecast shown before any sensing: "an average value" in the same generation's US manual [A9]; the 2008 platform showed the last run's time ([-> machine] 4.2). The owner's actual runs will end earlier or later. | [A9] | [VERIFIED] sister; unresolved for this model |
| Normal-soil water, energy, time | 11.2 to 11.9 L, 1.06 to 1.11 kWh, 2:13 to 2:14 | two class-D sisters [A7] | [VERIFIED] sister |
| Wash target on the normal branch: 65 C or lower? | [fact-check] Undetermined between 50 and 65 C; see section 9.2. As written: **Lower is better supported: 55 C, range 50 to 65.** For 50 to 55 C: the 2008 structures (rows 9, 10), the trace (2.3), the printed maximum needing the 65 C wash together with a warmed pre-wash (2.2). For 60 to 65 C: nothing I found, once the energy argument is set aside (2.2). | sections 1.2, 2.2, 2.3 | [ESTIMATED] |
| Heated once, or held? | Neither as modelled: heated in two to four steps with pauses, the first plateau at or below 45 C, then left unheated ("Nachwaschphase") until the drain. No reheating to hold. | rows 10, 13, 14, 15; trace 2.3; [-> machine] 4.2 ([PA7], [F2]) | mechanism [VERIFIED] sister; step temperatures and pause lengths [ESTIMATED] |
| Intermediate rinses | one; a second only on the heavy branch | rows 9, 10, 16; trace | [VERIFIED] sister |
| Final rinse | 69 C, range 63 to 72. 65 C in every Auto structure of 2008 (row 9); 69 C printed for this model's Intensive and Express, 61 and 63 C for its two label-driven programmes (row 3); the trace suggests 66 to 71 C | rows 3, 9; 2.3 | [ESTIMATED] |
| Water exchange after the pre-rinse | unresolved: none, partial (2.5 L) or full (4.0 L). The manual and the 2008 platform describe all or nothing; the patent of row 14 and the forum observer mention partial drains | rows 5, 10, 14, 16 | open |

### 3.2 Recommended course against `BOSCH_AUTO_145_OPTIONS`

Durations are chosen to keep 145 minutes. All recommended values are [ESTIMATED]; the basis column says what they lean on.

| Option (model) | Current | Recommended default | Range | Basis |
|---|---|---|---|---|
| `firstBathL` | 4.0 | 4.0 | 3.5 to 4.2 | unchanged ([-> machine] 4.2) |
| `preRinseMin` | 11.5 | 11.5 | 0 to 15 | unchanged; the pre-rinse "can either be done or not" [A13]; the trace has none |
| `exchangeL` | 2.5 | 2.5 | 0, 2.5 or 4.0 | unchanged; unresolved (3.1) |
| `washTarget` | 65 | **55** | 50 to 65 | 3.1 |
| heat-up (no option today) | one block, 18 min | **staged**: to 45 C (about 11 min at 2.5 K/min from 18.5 C), pause 10 min, then to the target (about 4 min per 10 K) | first plateau 30 to 45 C; pause 5 to 20 min; one to three pauses | rows 10, 15; trace (pauses of 18, 2 and 10 min); needs a new programme option |
| `holdMin` (unheated post-wash) | 46 | **39** (wash from the first heating to the drain stays 64 min: 11 + 10 + 4 + 39). [fact-check] In the repository's model the two heat-ups are shorter and 39 gives 141.7 min in all; 42 gives 144.7 | 20 to 45 | total duration; trace 21 min; the tank fill 15 min before the drain as now |
| `reheatBand` | undefined | undefined | | rows 13, 14: no holding |
| `flush` | false | false | | row 10 has a filter flush after a 50 / 55 C wash; kept false because a full rinse follows |
| `intermediateRinses` | 1 | 1 | 1 or 2 | rows 9, 10, 16; trace |
| `rinseMin` | 7.5 | **10** | 7 to 12 | trace 12 min with its fill; [A13] |
| `finalTarget` | 69 | 69 | 63 to 72 | 3.1 |
| final-rinse heat-up (output) | 9 min from 45 C | about 13 min from about 37 C | 9 to 14 | follows from the cooler wash; trace 13.5 min |
| `finalHoldMin` | 3 | **1** | 0 to 5 | trace: 1.5 min from heater-off to the drain |
| `dryMin` | 40 (machine default) | **35.5** | 25 to 45 | balances the 145 min; trace 25 to 30 min; [A13] 30 to 40 min on zeolite models |
| declared energy | 1.04 kWh | about 1.08 kWh by hand (wash 53.7 x 36.5 = 1.96 MJ; final rinse 49.1 x 32 = 1.57 MJ; pump 0.09; other 0.01), to be recomputed by the thermal model. [fact-check] Recomputed: the thermal model gives 0.96 kWh for this course, not 1.08 (the hand figure heats the whole lumped capacity to both targets) | 0.95 to 1.15 | sisters 1.06 and 1.11 |
| declared water | 11.5 L | 11.5 L | 11.2 to 11.9 measured on sisters | unchanged |

Liquor temperature under the recommended course [ESTIMATED, same lumped node as 2.3, so about 2 K optimistic against the project's three-node model]: 46 C at 12 min after the first heating, 46 C through the plateau (12 min in this calculation), 57 C at 28 min, about 56 C when the tank fills at 49 min, 49 C at the drain. Minutes at or above 45 / 50 / 55 / 60 C: about 53 / 24 / 22 / 0. The same node for the model as written gives 53 / 51 / 34 / 16, and the project's own model 48 minutes above 55 C and 35 above 60 C ([-> machine] 4.4). This is the difference that matters to the protease question: on the recommended course the liquor never reaches the 63 to 65 C at which the placeholder kinetics kill the enzyme.

The other branches, restated with the same evidence:

| Branch | Course | Water, energy, time | Tag |
|---|---|---|---|
| Light | no exchange; staged to 45 C and no further; short post-wash; filter flush in place of the rinse; final rinse 69 C | 7.0 L, 0.900 kWh, 1:40 printed | envelope [VERIFIED]; course [ESTIMATED] from row 10 |
| Normal | as the table above | 11.2 to 11.9 L, 1.06 to 1.11 kWh, 2:13 measured on sisters | [VERIFIED] sister; course [ESTIMATED] |
| Heavy | pre-wash warmed (to about 35 to 40 C) and replaced in full; staged to 65 C; long post-wash; two intermediate rinses; final rinse 69 C | 15.5 L, 1.500 kWh, 2:45 printed | envelope [VERIFIED]; course from rows 9, 16 and the arithmetic of 2.2 [ESTIMATED]. The model's heavy branch has a cold pre-rinse and reaches only 1.15 kWh |

### 3.3 What decides the branch: a rule the simulation can apply

Documented decision points (rows 5, 10, 12): the turbidity of the pre-rinse liquor decides the water exchange; a reading during the wash decides its end temperature and length; a reading at the end of the wash or in the first rinse decides a second rinse. A failed calibration gives the maximum programme. A pre-cleaned load gives "a weaker programme" (row 4). The sensor's thresholds, their units and the time of each reading are not public for any generation.

Proposed rule, every threshold a registered parameter with status unknown:

| Parameter | Meaning | Default | Range | Tag |
|---|---|---|---|---|
| `auto.turbidityRef` | sensor reading (optical attenuation of the sump liquor, as [-> machine] 4.3) that the EN 60436 soil of a full 13 place-setting load gives at the end of the pre-rinse; defines the unit: X = reading / reference | 1 by definition | | definition |
| `auto.d1.keepBelow` | X at the end of the pre-rinse below which the water is kept | 0.3 | 0.1 to 0.8 | [ESTIMATED], unknown |
| `auto.d1.fullAbove` | X above which the water is replaced in full; between the two, the partial exchange if the machine has one | 2.0 | 1.2 to 4 | [ESTIMATED], unknown |
| `auto.d2.readAtC` | liquor temperature of the plateau at which the wash reading is taken | 45 | 30 to 45 | row 10; trace |
| `auto.d2.steps` | wash target by X at the plateau: below `t45` 45 C; below `t55` 50 C if the water was kept and 55 C if it was exchanged; above `t65` 65 C with the long post-wash | t45 = 0.3, t55 = 2.0, t65 = 2.0 | each a factor 3 either way | structure from rows 9, 10 [VERIFIED] sister; numbers [ESTIMATED], unknown |
| `auto.d3.secondRinseAbove` | X of the first intermediate rinse above which a second follows | 0.3 of the wash reading | 0.1 to 1 | [ESTIMATED], unknown |
| `auto.sensitivity` | user setting SE:00 / 01 / 02 (standard, sensitive, very sensitive): scales all thresholds down | 1 / 0.5 / 0.25 | | setting [VERIFIED] sister (row 6); factors [ESTIMATED] |

Anchors for the thresholds: the standard soil on a full load must give the normal branch (11.2 to 11.9 L on the sisters), a pre-rinsed load the light branch, and Stiftung Warentest's "stark verschmutzt" the heavy one. Note what the rule implies for play: a load in which only a few items carry dried egg or milk and the rest is clean reads well below 1 and gets the 45 C programme, which is what the manual's troubleshooting entry describes.

---

## 4. What this means for the two unchecked assumptions

- The machine half of the Auto verdict (a 65 C wash held for 46 minutes) is the less supported of the alternatives. The evidence favours a wash that sits near 45 C for 10 to 20 minutes and peaks at 50 to 58 C on the normal branch.
- That alone may not rescue egg and milk: `docs/calibration/anchoring.md` 5.4 reports that even an assumed heat-stable protease leaves them dirty. The enzyme half is another specialist's brief. What this dossier adds to it is the temperature history to test against, and the test institutes' result that it should come out clean.
- The test institutes' "clean on Auto as on Eco" is for the standard soil dried as the standard prescribes, with a commercial tablet, on a full load. It is a constraint on the model at that condition, not at the oven-dried and microwaved soils of the game.

---

## 5. Conflicts with the existing dossier

| [-> machine] says | This dossier | Why |
|---|---|---|
| 4.4: "the model comes within 2 to 6 % of the sisters' energy only at the top of the wash range" | not a usable argument | 0.008 kWh/K against +-0.05 kWh from heat capacity alone; the same model is 15 to 23 % under the printed extremes (2.2) |
| 4.4 row A4: one heating block of 18 min | staged heat-up | rows 10, 15; trace; listed in [-> machine] 4.6 as the alternative "Staged heat-up" |
| 4.6 H: heavy branch with a cold pre-rinse, 1.15 kWh | warmed pre-wash | arithmetic of 2.2; [A13] |
| 4.3 D2: "a monotone map ... to a temperature step in {45, 50, 55, 60, 65}" | steps 45, 50 / 55, 65, tied to the exchange decision and the rinse count | rows 9, 10 |

---

## 6. What the owner can measure in one run, and how to read it

One normally loaded Auto run, tablet as usual, with three instruments. Note the display at the start and whenever passing.

1. **Smart plug or plug-in meter logging power at 10 s or faster** (13 A rated; the heater draws about 2.1 to 2.3 kW at 230 to 240 V). Reading it:
   - Time from the start to the first heater block: the length of the cold pre-rinse (model: 13 min). Heating within 3 minutes means no cold pre-rinse.
   - Number and length of heater blocks before the long unheated stretch: the staging. Sum of their minutes x 2.5 K/min (or x kW x 60 / 53.7 kJ/K) = the temperature rise from about 18 to 21 C. About 11 min in all means a 45 C wash, 15 to 16 min means 55 C, 19 to 21 min means 65 C. The gaps between blocks are the plateaux.
   - Short heater bursts (under a minute) recurring through the post-wash: the wash is held. None: it is not.
   - Dips to a few watts with 20 to 40 W blips: drains. One or more before the first heating: the pre-rinse water was exchanged. Count the dips between the wash and the last heater block: that number minus one is the number of intermediate rinses.
   - The last long heater block: the final rinse. Its minutes x 2.5 to 2.7 K/min, added to a start of about 35 to 45 C, is the final-rinse temperature (9 min from 45 C or 13 min from 37 C both mean about 69 C: the logger of item 2 removes the ambiguity).
   - Last heater-off to 0 W: drying. Total kWh: against 0.95 to 1.15.
2. **A dishwasher-safe temperature logger in the upper basket** (an iButton-type thermologger or a food-safe data logger rated to 85 C, 30 s interval or faster), mouth down in a cup position so spray reaches it. It lags the liquor by a few kelvin and a minute or two. Read the plateau temperatures of the wash, its peak, the temperature at the wash drain, the final-rinse peak and the cooling in drying. With the plug's heater energy this also gives the machine's effective heat capacity (kJ delivered per kelvin of rise), which calibrates the thermal model.
3. **A phone recording sound on the worktop.** Fills hiss for about 60 s per 2.5 L and 95 s per 4 L at the valve's 2.5 to 2.75 L/min; drains are a different, lower tone. This settles the exchange volume after the pre-rinse (none, about 60 s, or about 95 s of filling before the first heating) and the number of rinses, independently of the plug.

Decision table:

| Observation | Conclusion | Change to the model |
|---|---|---|
| wash heater minutes 14 to 17, logger peak 52 to 58 C | normal branch washes at 55 C | adopt 3.2 |
| wash heater minutes 19 to 21, peak 62 to 66 C | 65 C after all | keep `washTarget` 65; still adopt the staging if the blocks are separate |
| one block, no pause | no staging | keep the single heat-up |
| pauses present | staging | add the option; set the plateau temperature and length from the logger |
| recurring short bursts in the post-wash | held wash | set `reheatBand` |
| final-rinse peak | `finalTarget` | as read, plus 1 to 2 K for the logger's lag |

A second run with a heavily soiled load and a third with clean dishes, each logged the same way, bracket the thresholds of 3.3.

---

## 7. Looked for and not found

- A phase list, temperature trace or power trace of Auto 45-65 from an identified BSH machine of the 2021 generation (or of any generation). The only trace found is of an unnamed machine [A6].
- A BSH service or training document newer than the 2010 GV 640 manual. The Kueppersbusch service-manual directory holds 24 dishwasher manuals; the two BSH-platform ones are A7_014 (2008) and A7_018 (2010); A7_019 to A7_024, which I downloaded, cover Electrolux-built EDW series and a later IGV model, not this platform.
- Any turbidity threshold, in any unit, or the times at which the sensor is read on the current platform.
- A BSH patent that ties a turbidity reading to a wash temperature with numbers. Google Patents queries for BSH with Truebungssensor and Reinigungstemperatur returned seven documents; the ones opened concern grease redeposition (DE102010043330A1, used above), a reference measurement around detergent dosing (DE102011004949A1, no temperatures), cleaning of a storage tank (DE102014215903B4) and heat-pump machines (DE102015203532A1: wash 44 to 50 C, final rinse about 60 C, a different product). Further queries were refused by the server.
- Stiftung Warentest's per-model figures for the automatic programme with heavy soiling, and any measured programme temperatures from a test institute (paywalled or not published).
- The study of Brueckner and Stamminger on testing automatic programmes (Energy Efficiency, about 2015): two searches did not find it. [RECALLED] only.
- Whether the sisters' one-hour programme measured by KONSUMENT is a 65 / 69 C programme.
- Whether this model has the sensor-sensitivity setting documented for the US sister (the UK manual's text has no such entry in the words I searched; the earlier dossier reports it as an app setting).
- What the start display's 2:25 assumes on this model.

---

## 8. Sources

Opened and read this session (the downloaded copies were working files and are not in the repository):

- [A1] Bosch, user manual SMV4HAX40G, 9001937295_B. https://media3.bsh-group.com/Documents/9001937295_B.pdf . Sequence text for Auto; troubleshooting entry on pre-cleaned tableware.
- [A2] Bosch, quick reference guide 9001937296_A. https://media3.bsh-group.com/Documents/9001937296_A.pdf . Programme table: Auto 1:40 to 2:45, 0.900 to 1.500 kWh, 7.0 to 15.5 L; Eco 4:55, 0.836 kWh, 9.5 L.
- [A3] Kueppersbusch service manual H7-71-05, "Einbau-Geschirrspuelautomaten Baureihen 634 mit Automatikprogrammen", 2008 ([K1] of [-> machine]). http://tds.kueppersbusch.de/kb-technik/service_manuals/Geschirr/DE/A7_014DE.pdf . Pages 8, 9, 10, 19.
- [A4] Kueppersbusch service manual H7-71-07, "Baureihe 640", 2010 ([K2]). http://tds.kueppersbusch.de/kb-technik/service_manuals/Geschirr/DE/A7_018DE.pdf . Pages 47-49, 67, 82, 91, 92. Directory listing: http://tds.kueppersbusch.de/kb-technik/service_manuals/Geschirr/DE/ (A7_019 to A7_024 opened: not BSH platform).
- [A5] BSH, DE102010043330A1, "Geschirrspuelmaschine, insbesondere Haushalts-Geschirrspuelmaschine", priority 2010-11-03. https://patents.google.com/patent/DE102010043330A1/de . Background and embodiment paragraphs on heater-off after the maximum temperature and on partial or full draining after the pre-rinse.
- [A6] raspberry.tips, "Spuelmaschine oder Waschmaschine fertig? Push-Benachrichtigung mit Home Assistant und einer Shelly-Steckdose", September 2026 ([T2] of the programme notes). https://raspberry.tips/?p=17708 ; graph https://cdn.raspberry.tips/2026/09/spuelmaschine-leistungskurve-automatik-programm-home-assistant.png . Phase table, totals, the power curve digitised in 2.3. Dishwasher make not stated.
- [A7] Verein fuer Konsumenteninformation, KONSUMENT test tables. 10/2021: https://archiv.vki.at/konsument/tabellen/318926318976_4.html (fully integrated 60 cm), _5 (semi-integrated), _6 and _7 (45 cm). 10/2020: https://archiv.vki.at/konsument/tabellen/318921921596_4.html . 1/2020: https://archiv.vki.at/konsument/tabellen/318917242228_3.html . Consumption, duration and grades per programme.
- [A8] KONSUMENT, "Geschirrspueler - Neu ist nur das Label", 10/2021. https://www.konsument.at/test-geschirrspueler-102021 . Test criteria; soils named; summary sentences.
- [A9] Bosch US, use and care manual SHP78CM5N, 9001641455_C. https://media3.bosch-home.com/Documents/9001641455_C.pdf . Pages 10, 15-17: AquaSensor, sensor settings SE:00 to SE:02, cycle table.
- [A10] Which?, "How we test dishwashers" https://www.which.co.uk/reviews/dishwashers/article/how-we-test-dishwashers-aaVzw8e0VrkY and "Eco vs quick wash - which dishwasher program is cheapest and best?" https://www.which.co.uk/news/article/main-vs-quick-vs-eco-wash-which-dishwasher-program-is-the-best-akubJ2t3A6gi . Soils, programmes tested, the 2024 snapshot figures.
- [A11] Bosch, quick reference guide SMS6ZDW48E, 9001643171_A. https://media3.bosch-home.com/Documents/9001643171_A.pdf . Auto 1:40 to 2:40, 0.680 to 1.300 kWh, 7.0 to 15.5 L.
- [A12] automaticwasher.org, "automatic programmes in dishwashers", thread 14642. https://automaticwasher.org/threads/automatic-programmes-in-dishwashers.14642 . Post 21 (Bosch customer service on the automatic programme's heating pattern); post 3 (Which? on sensor programmes, second-hand).
- [A13] automaticwasher.org, "does Auto 45-65 on BSH dishwashers choose between two fixed degrees, or is it variable?", thread 97583 ([F1]). https://automaticwasher.org/threads/does-auto-45-65-on-bsh-dishwashers-choose-between-two-fixed-degrees-or-is-it-variable.97583/ . Posts 3, 4, 6, 10.
- [A14] Stiftung Warentest, "Geschirrspueler im Test: Unsere Pruefungen vor 2025". https://www.test.de/Geschirrspueler-im-Test-4685888-6136083/ . Test method for the eco, automatic and short programmes; results are paywalled.
- [A15] BSH Hausgeraete Oesterreich, press release of 2 September 2024 on the Stiftung Warentest dishwasher test. https://media3.bsh-group.com/Documents/25439552_AT_BSH_PI_Stiftung_Warentest_Geschirrspueler.pdf . "Alle getesteten Geschirrspueler der BSH haben die Bewertung 'Sehr gut' beim Reinigen im Sparprogramm"; top grades in the automatic programme for the models named. A maker's summary; not used for numbers.

Opened, nothing used: automaticwasher.org threads 19202, 44631, 19793, 36933, 84821; BSH patents DE102011004949A1, DE102014215903B4, DE102015203532A1, DE102015226481A1, DE102020200254A1, EP1968423B1, DE102016208530A1, DE102008040380A1, DE102010038689B4; Whirlpool patents DE10253017B4 and EP1457152B1 (turbidity in the pre-rinse, not BSH); LG patent EP2166914B1; test.de overview pages.

Project documents: `docs/research/machine-bosch-smv4hax40g.md` sections 4.1 to 4.7, 6, 7, 8; `docs/research/machine-bosch-notes/programme.md`; `docs/calibration/anchoring.md` section 5.4; `packages/machine/src/data/bosch-programmes.ts`.

---

## 9. Fact-check (2026-10-10, second reader)

Scripts and outputs: `rec/derive.py` (derived figures) and `rec/auto.ts` with its outputs (whole washes and the thermal model's energy for each course); these were working files and are not in the repository. Nothing under `packages/` was changed.

### 9.1 Sources re-opened

| Claim | Result |
|---|---|
| A2: Auto 45-65 printed 1:40 to 2:45, 0.900 to 1.500 kWh, 7.0 to 15.5 L | Confirmed in the saved guide |
| A1: the troubleshooting entry on tableware pre-cleaned too thoroughly ("The sensors chose a weaker programme.") | Confirmed |
| A3 p. 9: the three Auto structures (50 + one rinse; 65 + two rinses; pre-rinse + 55 + one rinse; final rinse 65 in all), "Auto 55 / 65 (je nach Variante)" | Confirmed against the German text |
| A3 p. 19: Aquasensor II, end temperature 45 or 50 / 55 C, 50 raised to 55 after a water change, filter flush, second rinse, 48 structures, maximum programme after a failed calibration | Confirmed against the German text |
| A5: heater "deaktiviert" at the maximum, liquor "langsam abkuehlt", "teilweisen oder vollstaendigen Abpumpen" after the pre-rinse; applicant BSH | Confirmed. The patent's example maximum is 70 C and its subject is intensive programmes and grease; it describes practice in 2010, not Auto |
| A6: 2 h 11 min, 1.619 to 2.625 kWh, four heating phases of 2 to 5 min, heated final rinse 14 min, drying 25 min, make not stated | Confirmed on the live page (dated 25 September 2026). The author's text counts five heating phases with the final rinse. The graph was not digitised again; the heater minutes are the researcher's reading |
| A7: Constructa CG5VX00HCD 0.81 / 9.3 / 4:50 eco, 1.06 / 11.2 / 2:13 auto, 1.11 / 10.0 / 0:57 short; Siemens SN65EX57CE 0.74 / 9.4 / 4:31, 1.11 / 11.9 / 2:14, 1.19 / 10.1 / 1:02; cleaning "sehr gut" in eco and auto on both; adaptation "gut" and "weniger zufriedenstellend"; the two zeolite models | Confirmed on the live table. Short-programme cleaning is "gut" on both class-D sisters |
| A8, A14: IEC 60436:2015 "in Anlehnung", commercial phosphate-free single tablets, Auto with normally and heavily soiled dishes and half load, the soils named, "unabhaengig vom verwendeten Programm"; 20 % weights since 2023 | Confirmed |
| A10: 83 % main / auto, 79 % eco, 74 % quick; 10.79 / 8.88 / 10.46 L; three unnamed machines | Confirmed (published 19 January 2026; a 2024 snapshot) |
| A12 post 21, A13 posts 4 and 10 | Confirmed as quotations. The service quotation ends "before ramping up to 65 degrees": it supports a pause at 45 C and, as far as it goes, 65 C as the end of the ramp |
| A4, A9, A11, 10/2020 and 1/2020 tables | Not re-opened; the tags stand on the researcher's reading |

### 9.2 What does not follow from the evidence

1. **"65 C is the heavy structure."** See the note in 0.2: on this machine's volumes the 2008 structure with a 65 C wash draws the 11.5 L measured for normal soiling. `[-> machine]` 4.6 already carries it as "N-keep" (1.09 kWh in the thermal model, inside the sisters' 1.06 to 1.11). The other variant of the same manual (45 / 50 / 55 C) and the unidentified trace point lower. The wash target is undetermined between 50 and 65 C; no default is better supported than the other.
2. **Energy.** The model's 0.96 kWh at 55 C and 1.04 kWh at 65 C are confirmed; the hand figure of 1.08 kWh for the 55 C course is withdrawn. The printed 1.500 kWh maximum is out of reach of either (confirmed by hand: about 1.26 kWh for a cold pre-rinse, a 65 C wash and a 69 C final rinse).
3. **Staging.** That the sensor decides the end temperature "im Reinigen" (2008) needs a reading on the way up, not a pause. A pause is supported by the service quotation (hearsay, 2003-era machine), by one owner's report in `[-> machine]` 4.2 and by a trace of an unknown machine. Three weak hints in one direction and none against: [ESTIMATED], worth an option and an alternative programme, not yet the primary course.
4. **The rule of section 3.3.** The decision points are documented; every number is invented and tagged so. They are placeholders for a mechanism, not evidence.

### 9.3 Derived figures

- The trace: heater 14.6 min in the wash and 13.5 min in the final rinse give 0.93 kWh of the metered 1.006. One lumped node gives a wash peak of 48.3 to 57.8 C and a final rinse of 62 to 77 C over the stated capacities and starts: the dossier's 53 (48 to 58) and 68 (62 to 74) reproduce.
- Minutes of the main wash at or above 45 / 55 / 60 C in the repository's model: as written 55 / 49 / 35; staged to 55 C 47 / 0 / 0 (the liquor touches 55.0 C and cools); staged to 65 C 47 / 42 / 28.
- Which?: the article's annual costs (71.01, 52.13 and 73.93 pounds at 260 washes and 27.69 p/kWh) imply 0.99, 0.72 and 1.03 kWh per cycle for main, eco and quick, if the cost is electricity only [ESTIMATED]. The dossier listed these as not found.

### 9.4 One more source on the programme

Searched for a measured temperature or power log of an identified BSH automatic programme (German and English, forums and home-automation sites) and for the Bonn study on automatic programmes: nothing with numbers. Opened: a Bosch operating manual of 2009 (9000 460 846) with three automatic programmes, "Auto 35-45", "Auto 45-65" and "Auto 65-75", each "optimised according to the soiling with the aid of sensors", and the statement that in these programmes the temperature and the running time, too, can follow how soiled the load is [VERIFIED]: the name is the range of the wash temperature, nothing more. Oeko-Test (14 June 2024) repeats a maker's figures for an unnamed machine: Auto about 1 kWh, 11.25 L and "etwas ueber zwei Stunden" on average [VERIFIED as a maker's statement]. A forum thread on mikrocontroller.net (topic 512199, "BSH Geschirrspueler Auto vs Eco") sits behind a bot check and was not read.

### 9.5 Whole washes on the candidate courses

`docs/research/auto-recommendation.md` section 3. In short: with detergent D at the anchored level the egg yolk left falls from 57 % (as written) to 25 % (staged to 65 C) and 1.4 % (staged or single ramp to 55 C); in none of them is an egg item or a milk glass clean. The dossier's caution in section 4 ("that alone may not rescue egg and milk") is confirmed.
