# The data this board holds

Four pinned reads from ESI, the mapping that turns a capture into a run, and the notices the data asks for. The app's
own source is `src/`, the generator is `tools/systems.ts`, and the folders it writes are `projects/`. Those folders and
`projects.json` are generated and not committed.

## The capture

`capture/systems.json` is the region: ninety systems of The Forge with the id, name, security, gate count, station count
and galactic coordinates ESI answers, read on 2026-11-15 at server 3698585.

`capture/units.json` is what each system holds: the star, its planets with their moons and asteroid belts, and the gates
and stations, every one of them with the name and the position in the system that ESI answers. It was read on 2026-11-18
at server 3714173 and is pinned by that server. `npm run capture` reads it again. The file is committed because it is the
source the board draws; a second read is a second capture rather than a build step, and the position of a moon is not
something this repository can derive.

Each unit carries the fields its endpoint answers, rather than the few the board first had reason to draw:

| Unit | What it carries |
|---|---|
| star | name, radius, spectral class, type and type name, age, luminosity, temperature |
| planet | name, type and type name, position, and the moons and belts that orbit it |
| moon | name, position |
| asteroid belt | name, position |
| stargate | name, the system it leads to, position |
| station | name, type and type name, owner, race, services, maximum dockable volume, office rental, reprocessing efficiency, and the station's cut |

The shape stops where ESI's does, and that boundary is what the board draws. The source states no radius for a planet or a
moon, no parent body for a station beyond the name it is given, and nothing at all below a moon or an asteroid belt. A
region is therefore two levels deep: a system holds bodies, a body holds its moons and belts, and a berth is a point
beside them rather than a place of its own.

`capture/new-eden.json` is the market read: the source, the endpoint, the revision and the adapter version, then the
scenes the run is made of. It was read from ESI on 2026-11-15 at server 3698585, and these are the reads it stands on:

| Endpoint | What it gave |
|---|---|
| `/latest/status/` | `server_version` 3698585, 34417 players, `start_time` 2026-11-15T11:03:18Z |
| `/latest/universe/systems/30000142/` | Jita, security 0.946, 7 stargates, 18 stations |
| `/latest/universe/systems/30000144/` | Perimeter, security 0.949, 5 stargates, 5 stations |
| `/latest/universe/stations/60003760/` | Jita IV - Moon 4 - Caldari Navy Assembly Plant, with a market |
| `/latest/universe/stargates/50001249/` | the gate from Jita to Perimeter |
| `/latest/route/30000142/30000144/` | one jump, Jita then Perimeter |
| `/latest/markets/10000002/orders/?type_id=34&order_type=sell` | 47 sell orders at Jita IV-4, 4.19 the best ask |
| `/latest/markets/10000002/history/?type_id=34` | 2026-10-06 volume 23321824662 against a 90-day mean of 5859886043, high 4.74, and 3.54 by 2026-10-08 |

`capture/fleet.json` is the other pinned read: the fleet the Akkio project carries. It was found through zKillboard's
index and read from ESI on 2026-11-17 at server 3707965, and these are the reads it stands on:

| Endpoint | What it gave |
|---|---|
| `/latest/killmails/139984294/e118ee6d11fd578ff200dd8c1661b7d66d1218b4/` | Akkio, 12 attackers of New Eden Light Point College, and a Gila of GABELLA CORP destroyed |
| `/latest/killmails/139984282/527d51d60f860e3fc0d8bcc7bb57948027abb358/` | Akkio, 9 attackers of the same fleet, and a Tengu of GABELLA CORP destroyed |
| `/latest/universe/names/` | the eleven pilots, their corporation and alliance, the two victims, and the hulls |

The eleven pilots are Akkio's people and the three hulls they flew are its ships, so the roster is a read and not a crew
written for the demonstration. Who was in charge is the demonstration's reading of the kills, and it is the pilot whose
damage across both of them was the most. Every number is ESI's. To refresh a capture, read the endpoints again and rerun
`npm run generate`; the pin and the run move together or the run fails to parse.

## What the run asks

The Jita project audits one day rather than touring the corridor. Tritanium in The Forge trades 5,859,886,043 a day on
average over the 90 days to 2026-11-14. The desk's rule says a day over three times that mean, 17,579,658,129, has to be
explained, and 2026-10-06 traded 23,321,824,662, so it does.

The finding is in the numbers. That day's order count rose 42% over the mean while volume rose 298%, so the average
trade went from 2,812,520 to 7,878,994. Larger orders moved the day, not more participants. The intraday range went from
2.35% to 22.8%, more than twice the next widest day in the quarter.

What the run cannot say is who. ESI's public history gives the day and the book, not the accounts behind them, so the
finding stops where the data does. That boundary is the point: a record that claimed more would be the failure this
demonstration exists to argue against.

## Writing the projects

```bash
npm run generate
```

One project a system. Each folder is `project.json` and `run.txt`: the place holds the system at the middle of its own
box, every planet, moon, belt, gate and station the capture holds, the fleet if the system is Akkio's, and the market
station and its pilot if the system is Jita's. A unit's id is the spelling of its name, because the board draws the id and
`40009077` is a row nobody can read. The positions are the source's: the radius is compressed so a moon and a gate stand
on the same place, and the bearing is kept.

## The region's cells

The ninety systems divide the shell between them. Each place declares the polygon it holds as `place.cell`, in degrees,
and `place.sector` is the middle of that polygon. The polygons are the Voronoi cells of the ninety seeds on the sphere,
relaxed until the cells are the same size, so the cells cover the shell once: no gap, no overlap, and no two places
claiming one direction. Euler's formula forces twelve pentagons into any such tiling, so the ninety cells are twelve
pentagons and seventy-eight hexagons. `tools/cells.ts` computes them and `npm run generate` writes them; a test holds the
cells to the area of the sphere and to their shared edges.

The cell is nominal and not the system's galactic position. ESI's coordinates describe a flat map of a galaxy, and the
shell this board draws is a sphere of directions; a coordinate laid on it would put most of The Forge into one cap. What
the cell is for is that a place is a ground of its own at the region's scale, and that the frame's minimap and its shell
draw the same ground.

Inside its cell a place keeps its own layout: the star at the middle and the bodies where the source puts them, scaled
to the room the cell has. `place.mark` names the star as the one unit that stands for the system from the region, which
is what the minimap draws where a project is not open.

Every run is built by `src/mapping.ts` and read back with the kernel's parser before the folder is kept: a verb the reader
does not model, or a count that does not derive, fails the generation. `tests/eve.test.ts` holds the committed folders to
the capture, so a capture edited without a rerun fails there.

Jita's run is the market capture's rather than the system's three numbers, and its place holds the systems the run reads
in a ring around the star, the station the order stands at, and the pilot who takes the work.

## Scope of the seat

The perspective shift is this app's own. `src/space.tsx` moves the world around the picked unit, and `src/view.ts` is the
camera that shift is read through: the frame's view belongs to the shell, and this reading is drawn beside it, so the two
pictures keep two pilots. Nothing in `@ssccsorg/skene-frame` knows that a pick moves a seat, and the frame's own minimap
answers a different question: which project the pilot is in, rather than where the view is inside this space.

The system is drawn as a body: a star with a limb, a corona, and three planets derived from the system's own id, standing
behind the place so the place's marks are read in front of it. One system is always the same system.

## Attribution

The committed capture is a real ESI read, so it carries CCP data and the notice applies. The demonstration card carries
it, and a deployment that draws this space without that card must carry it somewhere it can be read:

```text
EVE Online data provided by CCP hf. Not affiliated with or endorsed by CCP.
"EVE", "EVE Online", "CCP", and all related logos and images are trademarks or registered
trademarks of CCP hf.
```

The capture is not covered by the repository's Apache-2.0 license. The code is; the data is CCP's, and the notice above
travels with it. See [NOTICE](NOTICE) and [capture/README.md](capture/README.md).

The capture is read over the public endpoints only. Two bounds follow and are not negotiable by this repository. A
demonstration that carries real EVE data stays non-commercial, and it uses no ESI endpoint that needs a token, which is
why nothing here is authenticated. Selling or publicly distributing a product over that data needs a commercial licence
from CCP, which is a decision outside this repository. zKillboard's software is AGPLv3 and is not used here: its index
named the two killmails, and both were read from ESI, so the committed data is CCP's under the same terms.
