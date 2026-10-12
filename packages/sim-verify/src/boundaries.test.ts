// The places where the typed contract crosses a boundary the dependency table draws: types a
// module declares for a package it may not depend on, records declared below the module that
// owns them, the re-export chain that makes every dependency closure importable, and the
// catalogue data the simulation mirrors. Some of these checks are made by the type checker
// (an assignment that must compile); each has a run-time assertion beside it.
import {
  FLAT_WARE_TAGS,
  getMaterial,
  HOLLOW_WARE_TAGS,
  LIQUOR_CLASSES,
  SOIL_CLASSES,
  SOIL_HEAT_HISTORIES,
} from '@spotless/catalogue';
import type { Contact } from '@spotless/physics';
import * as simCore from '@spotless/sim-core';
import * as simFilm from '@spotless/sim-film';
import * as simGpu from '@spotless/sim-gpu';
import * as simHydraulics from '@spotless/sim-hydraulics';
import * as simJets from '@spotless/sim-jets';
import * as simLiquor from '@spotless/sim-liquor';
import * as simParams from '@spotless/sim-params';
import * as simRigid from '@spotless/sim-rigid';
import * as simScene from '@spotless/sim-scene';
import * as simSoil from '@spotless/sim-soil';
import * as simSpray from '@spotless/sim-spray';
import * as simTimeline from '@spotless/sim-timeline';
import { describe, expect, it } from 'vitest';
import { extractDeclarations, stripComments } from './contract-document.ts';
import { requiredDependencies } from './dependency-table.ts';
import { readContract, readPackageSources } from './node/workspace.ts';

type Namespace = Readonly<Record<string, unknown>>;

const NAMESPACES: Readonly<Record<string, Namespace>> = {
  'sim-gpu': simGpu,
  'sim-params': simParams,
  'sim-scene': simScene,
  'sim-hydraulics': simHydraulics,
  'sim-jets': simJets,
  'sim-spray': simSpray,
  'sim-film': simFilm,
  'sim-soil': simSoil,
  'sim-liquor': simLiquor,
  'sim-timeline': simTimeline,
  'sim-rigid': simRigid,
  'sim-core': simCore,
};

/** Members of a declaration in the sources of a package. */
function membersOf(pkg: string, name: string): string[] {
  for (const [, text] of readPackageSources(pkg)) {
    const found = extractDeclarations(stripComments(text)).find((d) => d.name === name);
    if (found) return [...found.members];
  }
  throw new Error(`${pkg} declares no ${name}`);
}

describe('re-export chain', () => {
  it('lets every package import its whole dependency closure from its direct dependencies', () => {
    // A package lists exactly the dependencies of its row of the table, so it reaches the
    // modules below them only if each simulation package re-exports the simulation packages it
    // depends on. Every run-time export of a dependency must be the same object upstream.
    const required = requiredDependencies();
    let checked = 0;
    for (const [pkg, namespace] of Object.entries(NAMESPACES)) {
      for (const dep of required.get(pkg) ?? []) {
        const lower = NAMESPACES[dep];
        if (!lower) continue; // a platform package: not re-exported
        for (const [name, value] of Object.entries(lower)) {
          expect(namespace[name], `${pkg} must re-export ${name} of ${dep}`).toBe(value);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('exports each record under the module the contract assigns it to', () => {
    // Declared lower, importable from the owner: a value per case, the types in the block below.
    expect(simJets.JET_EXPOSURE_LAYOUT).toBe(simScene.JET_EXPOSURE_LAYOUT);
    expect(simFilm.S_FILM_LAYOUT).toBe(simSpray.S_FILM_LAYOUT);
    expect(simFilm.K_HOT_LAYOUT).toBe(simSpray.K_HOT_LAYOUT);
    expect(simFilm.H_RES_LAYOUT).toBe(simJets.H_RES_LAYOUT);
    expect(simTimeline.TIMELINE_BLOCK_LAYOUT).toBe(simSoil.TIMELINE_BLOCK_LAYOUT);
    expect(simTimeline.EFFECTIVE_EXPOSURE_LAYOUT).toBe(simSoil.EFFECTIVE_EXPOSURE_LAYOUT);
    expect(simSoil.RELEASE_CLASSES).toBe(simParams.RELEASE_CLASSES);
    expect(simHydraulics.TICK_LABELS).toBe(simParams.TICK_LABELS);

    // Compile-time: each of these types is importable from the owner named by the contract.
    const tick = null as unknown as simHydraulics.MachineTick;
    const sameTick: simParams.MachineTick = tick;
    const release = null as unknown as simSoil.SoilRelease;
    const sameRelease: simParams.SoilRelease = release;
    const rates = null as unknown as simLiquor.RateTables;
    const sameRates: simParams.RateTables = rates;
    const jet = null as unknown as simJets.JetRecordSet;
    const sameJet: simScene.JetRecordSet = jet;
    const wetting = null as unknown as simFilm.WettingSummary;
    const sameWetting: simSoil.WettingSummary = wetting;
    const block = null as unknown as simTimeline.TimelineBlock;
    const sameBlock: simSoil.TimelineBlock = block;
    expect([sameTick, sameRelease, sameRates, sameJet, sameWetting, sameBlock]).toHaveLength(6);
  });
});

describe('boundary types', () => {
  it('lets a physics contact be passed to SceneBuilder.move', () => {
    // M3 may not depend on @spotless/physics, so it declares the part of `Contact` it reads.
    const contact: Contact = {
      a: 'lower_rack',
      b: 'plate_03',
      partA: 'tine_row_2',
      partB: 'body',
      points: 2,
      normalForceN: 1.9,
      maxPenetration: 0,
      position: [0.1, 0.05, 0.08],
      normal: [0, 0, 1],
    };
    const forScene: simScene.SceneContact = contact;
    expect(forScene.partB).toBe('body');
    for (const member of membersOf('sim-scene', 'SceneContact')) {
      expect(Object.keys(contact), member).toContain(member);
    }
  });

  it('lets the rigid coupler of M11 be passed to the timeline of M10', () => {
    // M10 may not depend on M11, so it declares the part of `RigidCoupler` it calls.
    const asPort = (coupler: simRigid.RigidCoupler): simTimeline.RigidCouplerPort => coupler;
    const asEpisode = (result: simRigid.RigidResult): simTimeline.RigidEpisodeResult => result;
    expect([asPort.length, asEpisode.length]).toEqual([1, 1]);
    const coupler = membersOf('sim-rigid', 'RigidCoupler');
    for (const member of membersOf('sim-timeline', 'RigidCouplerPort')) {
      expect(coupler, member).toContain(member);
    }
    const result = membersOf('sim-rigid', 'RigidResult');
    for (const member of membersOf('sim-timeline', 'RigidEpisodeResult')) {
      expect(result, member).toContain(member);
    }
    // The four additions M11 needs are the ones the contract names in its prose.
    const prose = readContract();
    for (const name of simRigid.PHYSICS_ADDITIONS) expect(prose, name).toContain('`' + name + '(');
  });
});

describe('catalogue data the simulation mirrors', () => {
  it('numbers the soil classes as the catalogue lists them', () => {
    expect([...simSoil.SOIL_CLASS_IDS]).toEqual([...SOIL_CLASSES]);
  });

  it('takes the heat histories of a soil record from the catalogue', () => {
    const histories: simScene.ItemSoilRecord['heat_history'][] = [
      'none',
      'warm',
      'cooked',
      'baked',
      'burnt',
    ];
    expect(histories).toEqual([...SOIL_HEAT_HISTORIES]);
  });

  it('has one contact-angle column in the catalogue per liquor class', () => {
    // W, D, R read the columns clean_water, main_wash, rinse_aid.
    expect(simParams.LIQUOR_CLASS_IDS).toHaveLength(LIQUOR_CLASSES.length);
    expect([...LIQUOR_CLASSES]).toEqual(['clean_water', 'main_wash', 'rinse_aid']);
  });

  it('classes materials and shapes as the film-class rule of section 3.4 needs', () => {
    // S1: "a rivulet-prone material (...: polypropylene, PTFE, silicone)".
    for (const id of ['polypropylene', 'aluminium_nonstick', 'silicone']) {
      expect(getMaterial(id).wetting.class, id).toBe('rivulet_prone');
    }
    // S2: "a partially wetting material (...: stainless steel, melamine, SAN, copolyester,
    // polyethylene)".
    for (const id of ['stainless_steel', 'melamine', 'san', 'tritan', 'polyethylene']) {
      expect(getMaterial(id).wetting.class, id).toBe('partially_wetting');
    }
    // "continuous-film materials (glass, glazed ceramic, porcelain, ...)".
    for (const id of ['glass_soda_lime', 'stoneware_glazed', 'porcelain_glazed']) {
      expect(getMaterial(id).wetting.class, id).toBe('continuous_film');
    }
    // "hollow ware (shape tags cup, mug, glass, stemware, bowl, jug, pot, pan, container, lid)";
    // "flat ware (plate, saucer, platter, flat dish)".
    expect([...HOLLOW_WARE_TAGS]).toEqual(
      'cup, mug, glass, stemware, bowl, jug, pot, pan, container, lid'.split(', '),
    );
    expect([...FLAT_WARE_TAGS]).toEqual(['plate', 'saucer', 'platter', 'flat_dish']);
    expect(simScene.FILM_CLASSES).toEqual(['S1', 'S2', 'K2', 'LINE']);
  });
});
