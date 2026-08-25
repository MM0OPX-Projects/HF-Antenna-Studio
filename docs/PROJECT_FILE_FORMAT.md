# HF Antenna Studio project files

Status: implemented browser-local project-management subset, extended 2026-08-25

## Purpose and boundaries

HF Antenna Studio uses a human-readable UTF-8 JSON project file with the `.hfas` extension. A project stores the inputs required to reconstruct a template model, Wire Editor model, four-model comparison, parameter sweep, or optimiser definition. Solver results are derived cache data and the Project Management page deliberately does not store them in the canonical local record.

The implementation is entirely local:

- named projects are stored in the current browser profile's `localStorage` under `hfas.project-library.v1`;
- the most recent unsaved workspace is journalled separately under `hfas.project-recovery.v1`;
- no account, cloud service, telemetry endpoint, or network transfer is involved;
- `.hfas` export is the portable backup and interchange mechanism.

Browser storage is not encryption and is not a backup. Anyone with access to the Windows account/browser profile may be able to read it, and clearing site data deletes it. Export important designs regularly.

## File encoding and top-level schema

- Encoding: UTF-8 JSON.
- Extension: `.hfas`.
- Legacy imports accepted: `.antennasim` and `.json`.
- Current model schema: `version: 5`.
- Application version: `app_version`.
- Timestamps: ISO 8601 UTC strings.
- Model mode: `simulator`, `editor`, `model-comparison`, `parameter-sweep`, or `antenna-optimiser`.

A minimal current simulator file is structurally equivalent to:

```json
{
  "version": 5,
  "app_version": "1.0.0",
  "created_at": "2026-08-06T12:00:00.000Z",
  "mode": "simulator",
  "simulator": {
    "templateId": "dipole",
    "params": {
      "frequency": 14.1,
      "length": 10.1,
      "height": 10,
      "wireDiameter": 0.002
    },
    "ground": { "type": "average" },
    "frequencyRange": { "start_mhz": 14, "stop_mhz": 14.35, "steps": 15 },
    "frequencySegments": []
  },
  "result": null
}
```

The `params` keys are owned by the referenced template. SI values are stored without applying the current display-unit preference. Schema v4 added explicit `frequencyRange` and `frequencySegments` to simulator projects so a manual sweep override is reproducible.

An editor file contains:

- exact wire endpoints, radii, tags and segment counts;
- manual-segmentation and length-lock intent where set;
- excitation, load, and transmission-line definitions;
- persistent endpoint junctions;
- ground and explicit `GE` behaviour;
- primary and multi-block frequency ranges;
- the design frequency used for segmentation;
- retained imported NEC source/card diagnostics when the model originated from a supported NEC import.

Schema v5 adds three reproducibility-input modes. `modelComparison` stores exactly four slot definitions, common conditions, impedance-sweep settings, and the complete radial-system identity. `parameterSweep.definition` and `antennaOptimiser.definition` store their schema-v2 definitions, including ground constants and radial topology. Point results, solver caches, optimiser history, and plots are intentionally recalculated rather than treated as canonical project input.

## Schema history and migration

| Version | Relevant model change | Migration behaviour |
|---|---|---|
| 1 | Initial simulator/editor model | Editor junctions are added as an empty list. |
| 2 | Persistent editor junctions | Missing source/load/TL and frequency-segment collections are added as empty lists. |
| 3 | Expanded editor and NEC-import state | Migrates to v4 without inventing simulator sweep intent that was never stored. |
| 4 | Explicit simulator frequency range and segments | Migrates unchanged to v5. |
| 5 | Comparison, parameter-sweep, and optimiser project modes with explicit radial identity | Current write format; v1-v4 inputs are retained without inventing workflow state. |

Migration operates on a detached JSON copy. Import retains the exact source text in memory during review, reports every applied migration, and does not add or open the migrated project until the user confirms **Import and open**. A newer unknown schema is rejected. The source file is never rewritten.

File import validates the structural schema separately from RF calculation validity. A structurally complete draft with temporarily invalid ranges or geometry is restored unchanged so the user can correct it; the destination laboratory then displays its normal preflight errors and blocks NEC until they are resolved. This avoids silently repairing inputs or making an invalid in-progress project impossible to reopen.

For simulator schemas 1-3, an explicit overridden sweep cannot be recovered because those versions did not store it. The restored model therefore uses the referenced template's frequency behaviour and the import review states this limitation. This is deliberate; inventing a sweep would be silent model alteration.

## Local library and autosave

The local library has its own storage schema (`schemaVersion: 1`). Each record contains:

- a generated local ID;
- name;
- created, updated, and last-opened timestamps;
- monotonic revision;
- one current-schema project model.

The collection is replaced with one `localStorage.setItem` operation. If quota or browser policy rejects the write, the previous value is retained and the UI instructs the user to export. Each named-project save checks its expected revision, preventing a stale tab from silently overwriting a newer revision. The current implementation limits the library to 100 projects.

Model changes are checked every 800 ms. An unnamed project is written to the separate recovery journal. A named project is autosaved with a revision increment; its recovery journal is cleared only after that save succeeds. `pagehide` and hidden-page handling synchronously preserve a final changed snapshot where browser policy permits.

Recovery is always explicit: the Projects page offers **Recover** or **Discard**. Recovery never silently replaces the currently loaded model. A recovery journal records the named project's revision; if that revision no longer matches the library, the recovered model becomes unnamed and must be saved explicitly rather than overwriting the newer record.

## Operations

- **New** resets the selected Template Simulator, Wire Editor, Model Comparison, Parameter Sweep, or Antenna Optimiser workspace to a known default and creates an unnamed recovery copy.
- **Save** updates the current named record or creates it after the user supplies a name.
- **Save As** always creates a new ID and leaves the prior record intact.
- **Open** restores the complete stored model and clears stale solver results.
- **Recent projects** are ordered by last-opened timestamp.
- **Duplicate** deep-copies the model into a new record.
- **Rename** changes library metadata without changing the model.
- **Delete** requires an explicit browser confirmation.
- **Export** downloads a `.hfas` JSON file.
- **Import** parses and reviews a `.hfas`, legacy `.antennasim`, or `.json` project before saving a new local record.

## Tested compatibility

Automated tests cover:

- v1 editor through v5 migration;
- v3 simulator through v5 migration with the missing-sweep limitation reported;
- immutable source objects and exact source-text retention during review;
- current-schema JSON round trips for simulator, editor, comparison, parameter-sweep, and optimiser models;
- exact real-ground radial-system identity across capture, JSON round trip, restore, autosave route mapping, and browser reopen;
- explicit simulator frequency and multi-band sweep persistence;
- create/save/rename/duplicate/delete and recent-list operations;
- stale-revision conflicts, rejected writes, corrupt indexes, and recovery round trips;
- browser lifecycle flows for save/open/export/delete, reload recovery, and confirmed legacy import.

## Known limitations

- Browser `localStorage` quotas vary by browser/profile. The library is intended for canonical models, not large result arrays.
- The web build cannot provide a persistent arbitrary Windows filesystem path with universal browser support. **Save As** creates a new local-library record; **Export** creates the portable file.
- Project names are local-library metadata and are represented by the export filename, not embedded in the v5 model document.
- Comparison, parameter-sweep, and optimiser inputs are embedded in `.hfas`; their calculated results retain separate evidence exports and are recalculated after open. Measurement-comparison and other specialist laboratory state is not yet a canonical `.hfas` mode.
- Import rejects unsupported extensions and source text over 5,000,000 characters, but runtime validation is not yet a complete finite-number/range/aggregate-array schema audit. Broader untrusted-input and fuzz testing remain Phase 4 work.
- Schema v5 follows documented SI field conventions but does not yet carry the future canonical contract's explicit top-level unit declaration, document UUID, title, or notes.
- Native packaged atomic filesystem writes, backup rotation, Windows path/encoding tests, and cross-browser quota testing are not claimed.
