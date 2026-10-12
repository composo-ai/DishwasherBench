// Every interface and type alias that docs/design/sim-core.md gives in a `ts` code block must
// exist in the simulation packages under the same name, declared once, with every member and
// parameter name the contract gives it. The contract is read from the document; the code is
// read from the package sources (types do not exist at run time).
import { describe, expect, it } from 'vitest';
import {
  extractContractDeclarations,
  extractDeclarations,
  stripComments,
  type ContractDeclaration,
} from './contract-document.ts';
import { readContract, readPackageSources } from './node/workspace.ts';
import { MODULE_OF_PACKAGE } from './record-layouts.ts';

const contractDeclarations = extractContractDeclarations(readContract());

interface CodeDeclaration extends ContractDeclaration {
  readonly package: string;
  readonly file: string;
}

/** Every declaration of every simulation package except this one. */
const codeDeclarations: CodeDeclaration[] = Object.keys(MODULE_OF_PACKAGE)
  .filter((pkg) => pkg !== 'sim-verify')
  .flatMap((pkg) =>
    readPackageSources(pkg).flatMap(([file, text]) =>
      extractDeclarations(stripComments(text)).map((d) => ({ ...d, package: pkg, file })),
    ),
  );

/**
 * Contract declarations that the code holds under another name. The contract writes one
 * function, `wash(input, env)`, which is typed as `ContractWash`. And where the first build
 * (docs/design/scope.md, which outranks the contract) took a contract name for the type that
 * runs (`WashInput`, `WashResult`, `ExposureSet`, ...), the transcription of the contract's
 * declaration is kept as `Contract<Name>`, so that the full design stays written down in code
 * and this test keeps holding it to the document.
 */
const RENAMED: Readonly<Record<string, string>> = {
  wash: 'ContractWash',
  WashInput: 'ContractWashInput',
  WashResult: 'ContractWashResult',
  Provenance: 'ContractProvenance',
  ItemWashResult: 'ContractItemWashResult',
  MachineWashResult: 'ContractMachineWashResult',
  ExposureSet: 'ContractExposureSet',
};

describe('declarations of the contract', () => {
  it('are read from its code blocks: seventy-one types and one function', () => {
    expect(contractDeclarations.filter((d) => d.kind !== 'function')).toHaveLength(71);
    expect(contractDeclarations.filter((d) => d.kind === 'function').map((d) => d.name)).toEqual([
      'wash',
    ]);
    // Spot checks of the reader against the document as printed.
    const combo = contractDeclarations.find((d) => d.name === 'ComboId');
    expect(combo?.members).toEqual(['diverter', 'pumpClass', 'liquor', 'arms']);
    const tick = contractDeclarations.find((d) => d.name === 'MachineTick');
    expect(tick?.members).toEqual([
      'index',
      'combo',
      'label',
      'dt_s',
      'pumpRpm',
      'sV',
      'sQ',
      'fH',
      'heaterOn',
      'step',
      'events',
    ]);
  });

  it.each(contractDeclarations.map((d) => [d.name, d] as const))(
    '%s exists in one package, with every member the contract names',
    (name, declaration) => {
      const codeName = RENAMED[name] ?? name;
      const homes = codeDeclarations.filter((d) => d.name === codeName);
      expect(homes.length, `${codeName} is not declared`).toBeGreaterThan(0);
      expect(
        [...new Set(homes.map((h) => h.package))],
        `${codeName} must be declared in one package`,
      ).toHaveLength(1);

      // A member the contract nests inside the interface may live in a named type of the same
      // file (the sub-jets of `HydraulicPoint.nozzles` are `NozzleJet`; the environment of
      // `wash` is `WashEnv`).
      const own = new Set(homes.flatMap((h) => h.members));
      const sameFile = new Set(
        codeDeclarations
          .filter((d) => homes.some((h) => h.package === d.package && h.file === d.file))
          .flatMap((d) => d.members),
      );
      const missing = declaration.members.filter((m) => !own.has(m) && !sameFile.has(m));
      expect(missing, `${codeName} in ${homes[0]?.package}/${homes[0]?.file}`).toEqual([]);
    },
  );

  it('keeps the members of the plain records in the declaration itself', () => {
    // For the records that cross module boundaries every member the contract names must be in
    // the declaration itself, not moved to another type. (The owner of a record may add
    // members; the contract's own are the floor.)
    const records = [
      'StackString',
      'FieldDef',
      'KernelDef',
      'ParamDef',
      'ParamSet',
      'ClosureTable',
      'WashItem',
      'PatchDesc',
      'Basin',
      'GapReservoir',
      'ContactLink',
      'LineGraph',
      'SegmentBatch',
      'ComboId',
      'LiquorProps',
      'MachineTick',
      'ControllerFeedback',
      'FootprintTable',
      'ItemLoads',
      'Wrench',
      'JetRecordSet',
      'SourceTable',
      'WallStateTable',
      'ParcelPlan',
      'DepositionTable',
      'FilmBuffers',
      'SolvePlan',
      'WettingSummary',
      'WetParams',
      'FilmState',
      'PilotResult',
      'PeriodicResult',
      'DrainDownResult',
      'StateSummary',
      'SoilRelease',
      'LiquorState',
      'TabletSupply',
      'DepositSinks',
      'RateTables',
      'TimelineResult',
      'GapState',
      'TimelineFlags',
      'PoolState',
      'RigidResult',
      'ExposureSet',
      'WashResult',
      'Provenance',
      'ItemWashResult',
      'MachineWashResult',
    ];
    for (const name of records) {
      const inContract = contractDeclarations.find((d) => d.name === name);
      const inCode = codeDeclarations.find((d) => d.name === (RENAMED[name] ?? name));
      expect(inContract, name).toBeDefined();
      const own = new Set(inCode?.members ?? []);
      expect(
        (inContract?.members ?? []).filter((m) => !own.has(m)),
        name,
      ).toEqual([]);
    }
  });

  it('gives the names the first build took to the types that run', () => {
    // Each renamed contract type has a first-build type of the contract's own name: the
    // exposure set the stages of the exposure side produce, and the input and result of `wash`.
    const firstBuild: Readonly<Record<string, string>> = {
      ExposureSet: 'sim-film',
      WashInput: 'sim-core',
      WashResult: 'sim-core',
      ItemWashResult: 'sim-core',
      MachineWashResult: 'sim-core',
    };
    for (const [name, pkg] of Object.entries(firstBuild)) {
      const homes = codeDeclarations.filter((d) => d.name === name);
      expect(
        homes.map((h) => h.package),
        name,
      ).toEqual([pkg]);
    }
  });

  it('declares each type in the module the contract assigns it to, or in a lower one', () => {
    // Where a module below the owner uses a type, the type is declared in the lowest module
    // that all its users reach, and the owner re-exports it. The moves, each reported as a
    // contract issue:
    const moved: Readonly<Record<string, string>> = {
      // M4's records that M9 (which depends on M2 only) takes in `LiquorModel.step`:
      ArmState: 'sim-params',
      ComboId: 'sim-params',
      MachineTick: 'sim-params',
      // M8's record that M9 takes, and M9's record that M8 takes:
      SoilRelease: 'sim-params',
      RateTables: 'sim-params',
      // M5's record that M8 reads; M7's record that M8 writes:
      JetRecordSet: 'sim-scene',
      WettingSummary: 'sim-scene',
      // Section 5.1 names no module; M10 is the lowest that needs it:
      ExposureSet: 'sim-timeline',
    };
    for (const [name, pkg] of Object.entries(moved)) {
      const codeName = RENAMED[name] ?? name;
      expect(codeDeclarations.find((d) => d.name === codeName)?.package, name).toBe(pkg);
    }
  });
});
