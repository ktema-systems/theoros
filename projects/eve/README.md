# New Eden

The Jita corridor, as an EVE-shaped space for the New Eden board.

## Scope

This folder is the whole project. The capture, the mapping that turns it into a run, the importer that writes the run, and
the sphere the project opens on are all here. The board names the run the importer writes, `projects/eve/scenario.txt`, the
way it names every other run; nothing else outside this folder knows what the space is.

Ktema is the core engine and carries no adapter for this source. The adapter boundary is the capture in `capture/`.

## The capture

`capture/new-eden.json` is a pinned read: the source, the endpoint, the revision and the adapter version, then the
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

`capture/fleet.json` is the other pinned read: the fleet the run is read by. It was found through zKillboard's index and
read from ESI on 2026-11-17 at server 3707965, and these are the reads it stands on:

| Endpoint | What it gave |
|---|---|
| `/latest/killmails/139984294/e118ee6d11fd578ff200dd8c1661b7d66d1218b4/` | Akkio, 12 attackers of New Eden Light Point College, and a Gila of GABELLA CORP destroyed |
| `/latest/killmails/139984282/527d51d60f860e3fc0d8bcc7bb57948027abb358/` | Akkio, 9 attackers of the same fleet, and a Tengu of GABELLA CORP destroyed |
| `/latest/universe/names/` | the eleven pilots, their corporation and alliance, the two victims, and the hulls |

The eleven pilots are the place's people and the three hulls they flew are the place's ships, so the roster is a read and
not a crew written for the demonstration. Who was in charge is the demonstration's reading of the kills, and it is the
pilot whose damage across both of them was the most. What the capture adds to those reads is the demonstration's own: the
alliance rule, the taker, and the times. Every number is ESI's. To refresh it, read the endpoints again and rerun the
importer; the pin and the run move together or the importer refuses.

## What the run asks

The run audits one day rather than touring the corridor. Tritanium in The Forge trades 5,859,886,043 a day on average
over the 90 days to 2026-11-14. The desk's rule says a day over three times that mean, 17,579,658,129, has to be
explained, and 2026-10-06 traded 23,321,824,662, so it does.

The finding is in the numbers. That day's order count rose 42% over the mean while volume rose 298%, so the average
trade went from 2,812,520 to 7,878,994. Larger orders moved the day, not more participants. The intraday range went from
2.35% to 22.8%, more than twice the next widest day in the quarter.

What the run cannot say is who. ESI's public history gives the day and the book, not the accounts behind them, so the
finding stops where the data does. That boundary is the point: a record that claimed more would be the failure this
demonstration exists to argue against.

## Importing

```bash
cd apps/eve
npx tsx projects/eve/src/import.ts projects/eve/capture/new-eden.json
```

The run is written to `projects/eve/scenario.txt` and parsed before it is kept: a verb the reader does not model, or a count
that does not derive, fails the import. `tests/eve.test.ts` holds the committed run to the mapping, so a capture edited
without a rerun fails there.

## Scope of the seat

The perspective shift is this folder's own. `src/space.tsx` moves the world around the picked unit, and `src/view.ts` is
the camera that shift is read through: the frame's view belongs to the shell, and this reading is drawn beside it, so the
two pictures keep two pilots. Nothing in `@ssccsorg/skene-frame`, and nothing in `apps/eve/src`, knows that a pick moves
a seat. A second project that wants the same behaviour writes it in its own reading.

The region stands where Kwai Tsing's map stands: a pane the frame sizes beside the shell. The two pictures are therefore
drawn together, and the pilot can stack them, give the region the whole frame, or close it back to the sphere. The
region's minimap is drawn inside it, because the frame's minimap answers a different question: which project the pilot is
in, rather than where the view is inside this space.

The two marks the font did not carry, `gate` and `system`, were added to it because a project selects a drawing from the
font and cannot add one of its own. Both are ordinary words, and the font already carries the vocabulary of other
projects (`spider`, `auv`, `pump`, `rover`), so this is that convention rather than a second one.

## Attribution

The committed capture is a real ESI read, so it carries CCP data and the notice applies. The demonstration card carries
it, and a deployment that draws this space without that card must carry it somewhere it can be read:

```text
EVE Online data provided by CCP hf. via EVE Ref. Not affiliated with or endorsed by CCP.
```

The capture is read over the public endpoints only. Two bounds follow and are not negotiable by this repository. A
demonstration that carries real EVE data stays non-commercial, and it uses no ESI endpoint that needs a token, which is
why nothing here is authenticated. Selling or publicly distributing a product over that data needs a commercial licence
from CCP, which is a decision outside this folder. zKillboard's software is AGPLv3 and is not used here: its index named
the two killmails, and both were read from ESI, so the committed data is CCP's under the same terms.
