# New Eden

The EVE Online space as a board of its own, over the same engine as Delta and the same frame.

This app is one board and one project: `projects/eve/`, which carries the capture, the mapping, the importer, the run and
the sphere. The rest of the app is the frame's: a project is a record model, and nothing here knows what the space is
beyond what the project's bundle declares.

## Running it

```bash
npm install
npm run dev        # http://localhost:5274/
npm run build
npm test
```

`npm run board` reassembles `projects.json` from the project folders; `npm run place` re-derives the place's units from
`projects/eve/capture/systems.json` and `projects/eve/capture/fleet.json`.

The data, its endpoints and their pins are documented in `projects/eve/README.md`. The numbers are ESI's; the question and
the finding are this board reading them. EVE Online data is provided by CCP hf. via EVE Ref, and this board is not
affiliated with or endorsed by CCP.
