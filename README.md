# New Eden

The EVE Online space as a board of its own, over the same engine as Delta and the same frame.

The board is The Forge as ESI answers it: ninety systems, and a project is one of them. A project's place is that system's
own space, with its star at the middle and whatever stands there (a fleet in Akkio, the market's station in Jita). Its run
carries what ESI answers for the system: security, gates and stations. The frame's minimap is the travel between systems,
because every other system is another project on the same shell.

```
capture/     the pinned ESI reads: ninety systems, two killmails, the Jita market
src/         the sphere this app draws beside the shell, its camera, its hulls and the mapping
tools/       systems.ts writes a project a system from the capture; board.mjs assembles projects.json
projects/    ninety folders, one a system: project.json and the run beside it
```

## Running it

```bash
npm install
npm run dev        # http://localhost:5274/
npm run build
npm test
npm run systems    # rewrite the ninety projects and the board from capture/
npm run board      # reassemble projects.json from the folders
```

`npm run systems` parses every run before it keeps the folder, so a run whose counts do not derive fails there. The data,
the endpoints and their pins are in [DATA.md](DATA.md); the contract a hull meets is in [MESH.md](MESH.md).

The numbers are ESI's; the question and the finding are this board reading them. EVE Online data is provided by CCP hf.
via EVE Ref, and this board is not affiliated with or endorsed by CCP.
