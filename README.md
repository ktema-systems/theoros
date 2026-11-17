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
npm install
npm run dev        # http://localhost:5274/
npm test
npm run build
```

An existing clone takes `git submodule update --init`.

`npm run systems` rewrites the ninety projects and the board from `capture/`. `npm run board` reassembles `projects.json`
from the folders. The data, the endpoints and their pins are in [DATA.md](DATA.md). A hull's contract is in
[MESH.md](MESH.md).

## The tree

```
capture/     the pinned ESI reads: ninety systems, two killmails, the Jita market
src/         the sphere this app draws beside the shell, its camera, its hulls and the mapping
tools/       systems.ts writes a project a system from the capture; board.mjs assembles projects.json
projects/    ninety folders, one a system: project.json and the run beside it
skene/       the frame, pinned as a submodule
```

## Licence

Apache-2.0; see [LICENSE](LICENSE). The built bundle carries the skene packages, which are Apache-2.0 as well.

## The data

EVE Online data provided by CCP hf. via EVE Ref. Not affiliated with or endorsed by CCP. The captures are read over public
endpoints only: this board is non-commercial and authenticates nothing. See [DATA.md](DATA.md).
