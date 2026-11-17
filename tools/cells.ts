// The shell divided into one cell a place.
//
// The sphere has no tiling by hexagons alone: Euler's formula forces twelve pentagons into every tiling of this kind,
// so ninety places are seventy-eight hexagons and twelve pentagons. The cells are read from their seeds rather than
// drawn from a grid, because a grid that closes on itself is a Goldberg polyhedron and the one with ninety faces does
// not exist: ten times a triangular number plus two is never ninety.
//
// A seed is a direction, and its cell is every direction nearer that seed than any other, which is the Voronoi cell of
// the seeds on the sphere. The seeds start on a Fibonacci spiral and are moved to their own cells' middles until the
// cells stop moving, which is what makes the cells the same size: a spiral alone is even in count and not in area.
//
// The boundary is declared in degrees because a place declares its own bearing in degrees, and it is rounded to four
// decimals so a project file is a quiet text file rather than a wall of digits.

type Vec = [number, number, number];

export interface Tiling {
  /** Where the place stands, as the middle of its own cell. */
  seed: [number, number];
  /** The cell's edge, in degrees, in the order it is joined. */
  cell: [number, number][];
}

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function unit(v: Vec): Vec {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

/** A run of `count` directions round a seed at `angle`, which is the polygon the first clip starts from. */
function ring(seed: Vec, angle: number, count: number): Vec[] {
  const axis: Vec = Math.abs(seed[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const east = unit(cross(seed, axis));
  const north = cross(east, seed);
  const out: Vec[] = [];
  for (let index = 0; index < count; index += 1) {
    const turn = (index / count) * Math.PI * 2;
    const point = [0, 1, 2].map(
      (axis) =>
        seed[axis] * Math.cos(angle) +
        (east[axis] * Math.cos(turn) + north[axis] * Math.sin(turn)) * Math.sin(angle),
    );
    out.push(unit(point as Vec));
  }
  return out;
}

/** The part of a convex polygon on the seed's side of one bisector: the half of the sphere nearer this seed. */
function clip(cell: Vec[], normal: Vec): Vec[] {
  const out: Vec[] = [];
  for (let index = 0; index < cell.length; index += 1) {
    const a = cell[index];
    const b = cell[(index + 1) % cell.length];
    const one = dot(a, normal);
    const other = dot(b, normal);
    if (one <= 0) out.push(a);
    if ((one < 0 && other > 0) || (one > 0 && other < 0)) {
      const t = one / (one - other);
      out.push(unit([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]));
    }
  }
  return out;
}

/** A cell without the corners that land on the one before them, which a bisector through a corner can make. */
function tidy(cell: Vec[]): Vec[] {
  const out: Vec[] = [];
  for (const point of cell) {
    const last = out[out.length - 1];
    if (last && dot(last, point) > 1 - 1e-12) continue;
    out.push(point);
  }
  while (out.length > 1 && dot(out[0], out[out.length - 1]) > 1 - 1e-12) out.pop();
  return out;
}

/** The Voronoi cell of one seed among the rest: every bisector's half of the sphere, one after another. */
function cellOf(seeds: Vec[], index: number): Vec[] {
  let cell = ring(seeds[index], 1.35, 12);
  for (let other = 0; other < seeds.length && cell.length >= 3; other += 1) {
    if (other === index) continue;
    const normal = unit([
      seeds[other][0] - seeds[index][0],
      seeds[other][1] - seeds[index][1],
      seeds[other][2] - seeds[index][2],
    ]);
    cell = tidy(clip(cell, normal));
  }
  if (cell.length < 3) throw new Error(`seed ${index} has no cell`);
  return cell;
}

/** The middle of a cell, read in the plane tangent at the cell's own rough middle. */
function centroid(cell: Vec[]): Vec {
  let sum: Vec = [0, 0, 0];
  for (const point of cell) sum = [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]];
  const mid = unit(sum);
  const axis: Vec = Math.abs(mid[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const east = unit(cross(mid, axis));
  const north = cross(east, mid);
  const local = cell.map((point) => {
    const depth = Math.max(dot(point, mid), 1e-6);
    return [dot(point, east) / depth, dot(point, north) / depth] as [number, number];
  });
  let area = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < local.length; index += 1) {
    const [ax, ay] = local[index];
    const [bx, by] = local[(index + 1) % local.length];
    const wedge = ax * by - bx * ay;
    area += wedge;
    x += (ax + bx) * wedge;
    y += (ay + by) * wedge;
  }
  if (Math.abs(area) < 1e-14) return mid;
  x /= 3 * area;
  y /= 3 * area;
  return unit([mid[0] + east[0] * x + north[0] * y, mid[1] + east[1] * x + north[1] * y, mid[2] + east[2] * x + north[2] * y]);
}

/** A direction on the Fibonacci spiral: even in count, which is what the relaxation then makes even in area. */
function spiral(count: number): Vec[] {
  const turn = Math.PI * (3 - Math.sqrt(5));
  const out: Vec[] = [];
  for (let index = 0; index < count; index += 1) {
    const up = 1 - (2 * (index + 0.5)) / count;
    const flat = Math.sqrt(Math.max(0, 1 - up * up));
    const angle = turn * index;
    out.push([Math.cos(angle) * flat, up, Math.sin(angle) * flat]);
  }
  return out;
}

/** A direction as the two degrees a place declares. */
function bearing(point: Vec): [number, number] {
  const round = (value: number) => Number(value.toFixed(4));
  return [
    round((Math.atan2(point[0], -point[2]) * 180) / Math.PI),
    round((Math.asin(Math.max(-1, Math.min(1, point[1]))) * 180) / Math.PI),
  ];
}

function radiansOf(corner: [number, number]): Vec {
  const [azimuth, elevation] = [(corner[0] * Math.PI) / 180, (corner[1] * Math.PI) / 180];
  return [Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), -Math.cos(elevation) * Math.cos(azimuth)];
}

/**
 * One cell a place, in the order the names are given.
 *
 * The count is the names' own, so a board of ninety systems is ninety cells and a board with one system is one cell:
 * the tiling answers how many places it was handed, not how many a deployment happens to have today.
 */
export function tile(names: string[]): Map<string, Tiling> {
  const count = names.length;
  if (count === 0) return new Map();
  let seeds = spiral(count);
  // Lloyd's relaxation: a seed steps to its cell's middle until the cells stop moving. Sixty turns is enough for the
  // cells to settle to four decimals; a board this size converges long before that.
  for (let turn = 0; turn < 240; turn += 1) {
    seeds = seeds.map((_, index) => centroid(cellOf(seeds, index)));
  }
  const out = new Map<string, Tiling>();
  names.forEach((name, index) => {
    const corners = cellOf(seeds, index).map((point) => bearing(point));
    // The place stands at the middle of the cell as it is written, so a reader moving from the cell to the point the
    // place stands at does not move at all.
    const middle = corners.map(radiansOf).reduce<Vec>(
      (sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]],
      [0, 0, 0],
    );
    out.set(name, { seed: bearing(unit(middle)), cell: corners });
  });
  return out;
}
