# Theoros

θεωρός: the one sent to watch, and to bring back what was seen.

A board of the EVE Online space, read from ESI. The board is The Forge as the source answers it: ninety star systems, and
a project is one of them. A project's place is that system's own space, with its star at the middle and whatever stands
there (a fleet in Akkio, the market's station in Jita). Its run carries what ESI answers for the system: security, gates
and stations. The frame's minimap is the travel between systems, because every other system is another project on the
same shell.

Built on [skene](https://github.com/ssccsorg/skene), which is a submodule pinned by commit.

## Running it

```bash
git clone --recurse-submodules https://github.com/ktema-systems/theoros.git
cd theoros
./run.sh
```

`./run.sh` takes the frame submodule when it is not there, installs the packages when the lock has moved, generates the
projects, clears the dev cache, stops whatever holds the port and serves the app at http://localhost:5274/. An existing
clone needs no setup; a run brings it up to date.

The modes are `--check` (typecheck, tests and a build), `--build`, `--preview` (a build served at 5277), `--capture`
(read the systems and their units from ESI before the mode runs), `--stop`, `--port N` and `--host`.

The npm scripts remain the manual route:

```bash
npm run dev        # http://localhost:5274/
npm test
npm run build
```

`npm run capture` reads the systems and their units from ESI and rewrites `capture/units.json`. It is a manual read and
not a build step: the capture is pinned data, and `npm run generate` is what runs on every dev, test and build.

`npm run generate` writes the ninety project folders and the board from `capture/`; the dev, build and test scripts run
it first, so a fresh clone needs nothing else. Neither `projects/` nor `projects.json` is committed, because both are
generated from the pinned captures. The data, the endpoints and their pins are in [DATA.md](DATA.md). A hull's contract
is in [MESH.md](MESH.md).

## The tree

```
capture/     the pinned ESI reads: the region, every system's units, two killmails, the Jita market
src/         the sphere this app draws beside the shell, its camera, its hulls and the mapping
tools/       capture.ts reads the units; systems.ts writes a project a system; cells.ts divides the shell
             into the systems' cells; board.mjs assembles projects.json
projects/    generated: ninety folders, one a system, from capture/
skene/       the frame, pinned as a submodule
```

## Licence

Apache-2.0; see [LICENSE](LICENSE). The built bundle carries the skene packages, which are Apache-2.0 as well.

## The data

EVE Online data provided by CCP hf. via EVE Ref. Not affiliated with or endorsed by CCP. The captures are read over public
endpoints only: this board is non-commercial and authenticates nothing. See [DATA.md](DATA.md).
