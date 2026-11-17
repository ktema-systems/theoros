import * as THREE from 'three';

// The shapes a mark is drawn with, built from primitives and shared by every mark of that kind.
//
// MESH.md states the contract these keep: no imported model, no loader, at most 3,000 triangles, largest dimension
// 0.08 units, nose at -Z, and identity from props rather than from a constant. The scene carries no lights, so the
// shading is baked into vertex colours and the material's colour multiplies it: a pick changes the colour and leaves
// the geometry alone.

/** The kinds of mark this builds a shape for. A system is drawn as a point of light elsewhere. */
export type MarkKind = 'hauler' | 'station' | 'gate';

/** One primitive of an assembly: its shape, where it sits, how it turns, and how bright its plates read. */
type Part = {
  shape: THREE.BufferGeometry;
  at?: [number, number, number];
  turn?: [number, number, number];
  tone?: number;
};

const ORIGIN: [number, number, number] = [0, 0, 0];
const STRAIGHT: [number, number, number] = [0, 0, 0];

/** The one light a hull's shading is baked from: high, ahead of the port side, and a little behind the nose. */
const LIGHT = new THREE.Vector3(-0.45, 0.78, 0.44).normalize();

/** How much of a face's brightness comes from the ambient term rather than from the light on it. */
const AMBIENT = 0.4;

/**
 * Fold an assembly into one geometry with the shading written into its vertex colours.
 *
 * Faces stay flat, so the parts are expanded rather than indexed: a box whose corners shared a normal would read
 * as a pillow, and every edge in these hulls is there to be seen.
 */
function bake(parts: Part[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const along = new THREE.Vector3();
  const across = new THREE.Vector3();
  const face = new THREE.Vector3();
  const place = new THREE.Matrix4();
  const turn = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const sit = new THREE.Vector3();

  for (const part of parts) {
    const flat = part.shape.toNonIndexed();
    sit.set(...(part.at ?? ORIGIN));
    turn.setFromEuler(new THREE.Euler(...(part.turn ?? STRAIGHT)));
    flat.applyMatrix4(place.compose(sit, turn, one));
    const source = flat.getAttribute('position');
    for (let index = 0; index < source.count; index += 3) {
      for (let corner = 0; corner < 3; corner += 1) corners[corner].fromBufferAttribute(source, index + corner);
      along.subVectors(corners[1], corners[0]);
      across.subVectors(corners[2], corners[0]);
      face.crossVectors(along, across).normalize();
      const lit = AMBIENT + (1 - AMBIENT) * Math.max(0, face.dot(LIGHT));
      const value = Math.min(1, (part.tone ?? 1) * lit);
      for (const corner of corners) {
        positions.push(corner.x, corner.y, corner.z);
        colours.push(value, value, value);
      }
    }
    flat.dispose();
    part.shape.dispose();
  }

  const made = new THREE.BufferGeometry();
  made.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  made.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  made.computeBoundingSphere();
  return made;
}

const box = (width: number, height: number, depth: number) => new THREE.BoxGeometry(width, height, depth);

/**
 * A freighter: a spine carrying containers, a bridge over the nose, and two drives on outriggers.
 *
 * The nose is at -Z and the whole hull is 0.073 long, which is what a mark on a shell of radius 1.25 is allowed to
 * be. It reads as a hauler rather than as a pointed ship because the cargo deck is the widest thing on it.
 */
function haulerParts(): Part[] {
  const parts: Part[] = [
    { shape: box(0.03, 0.01, 0.038), at: [0, 0, 0.004], tone: 0.92 },
    { shape: box(0.02, 0.012, 0.02), at: [0, 0, -0.025] },
    { shape: new THREE.ConeGeometry(0.01, 0.016, 6), at: [0, 0, -0.03], turn: [-Math.PI / 2, 0, 0], tone: 1.1 },
    // Cheek plates widen the nose into a wedge, so the plan view is not a tube with a point on it.
    { shape: box(0.005, 0.008, 0.018), at: [-0.012, 0, -0.022], tone: 0.84 },
    { shape: box(0.005, 0.008, 0.018), at: [0.012, 0, -0.022], tone: 0.84 },
    // The containers sit recessed on the deck, so the deck reads as a deck.
    { shape: box(0.024, 0.008, 0.013), at: [0, 0.008, -0.002], tone: 0.7 },
    { shape: box(0.024, 0.008, 0.013), at: [0, 0.008, 0.013], tone: 0.7 },
    { shape: box(0.009, 0.006, 0.009), at: [0, 0.01, -0.02], tone: 1.16 },
    { shape: box(0.006, 0.004, 0.018), at: [0, 0.011, 0.004], tone: 0.58 },
    { shape: box(0.003, 0.009, 0.012), at: [0, -0.009, 0.02], tone: 0.8 },
    { shape: box(0.032, 0.013, 0.009), at: [0, 0, 0.03], tone: 0.88 },
  ];
  for (const side of [-1, 1]) {
    parts.push({ shape: box(0.011, 0.003, 0.007), at: [side * 0.012, 0.001, 0.014], tone: 0.66 });
    parts.push({
      shape: new THREE.CylinderGeometry(0.005, 0.005, 0.026, 6),
      at: [side * 0.018, 0.002, 0.014],
      turn: [Math.PI / 2, 0, 0],
      tone: 0.96,
    });
  }
  return parts;
}

/** The two exhausts, kept apart because they are a colour the hull's material cannot carry. */
function exhaustParts(): Part[] {
  return [-1, 1].map((side) => ({
    shape: new THREE.CircleGeometry(0.0045, 10),
    at: [side * 0.018, 0.002, 0.0348] as [number, number, number],
  }));
}

/**
 * A station: a core, the ring it turns inside, four spokes, and the mast a ship berths along.
 *
 * A station is recognised by its silhouette, so the ring and the mast are the shape and the core is what holds
 * them. It is 0.06 across, which keeps it the size of the other marks on the shell.
 */
function stationParts(): Part[] {
  const parts: Part[] = [
    { shape: box(0.016, 0.014, 0.016) },
    { shape: new THREE.TorusGeometry(0.026, 0.0035, 5, 16), turn: [Math.PI / 2, 0, 0], tone: 0.74 },
    { shape: box(0.004, 0.004, 0.016), at: [0, 0, -0.02], tone: 0.9 },
    { shape: box(0.01, 0.01, 0.004), at: [0, 0, -0.03], tone: 1.14 },
    // The panels are angled opposite ways, so one catches the light more than the other.
    { shape: box(0.002, 0.013, 0.01), at: [-0.013, 0, 0.002], turn: [0, 0, 0.18], tone: 0.62 },
    { shape: box(0.002, 0.013, 0.01), at: [0.013, 0, 0.002], turn: [0, 0, -0.18], tone: 0.62 },
  ];
  for (const quarter of [0, 1, 2, 3]) {
    const angle = (quarter * Math.PI) / 2;
    parts.push({
      shape: box(0.022, 0.003, 0.004),
      at: [Math.cos(angle) * 0.012, 0, Math.sin(angle) * 0.012],
      turn: [0, -angle, 0],
      tone: 0.8,
    });
  }
  return parts;
}

/**
 * A gate: the frame a hauler passes through, the aperture inside it, and the arm it stands on.
 *
 * The two rings are separate so the aperture reads as light rather than as more metal, which is what tells a gate
 * from a ring at this size.
 */
function gateParts(): Part[] {
  const parts: Part[] = [
    { shape: new THREE.TorusGeometry(0.02, 0.0032, 5, 18), turn: [Math.PI / 2, 0, 0], tone: 0.86 },
    { shape: new THREE.TorusGeometry(0.013, 0.0016, 4, 14), turn: [Math.PI / 2, 0, 0], tone: 1.2 },
    { shape: box(0.005, 0.01, 0.005), at: [0, -0.024, 0], tone: 0.72 },
    { shape: box(0.014, 0.005, 0.009), at: [0, -0.03, 0], tone: 0.64 },
  ];
  for (const side of [-1, 1]) {
    parts.push({ shape: box(0.006, 0.003, 0.004), at: [side * 0.011, 0.017, 0], turn: [0, 0, side * 0.6], tone: 0.78 });
  }
  return parts;
}

const PARTS: Record<MarkKind, () => Part[]> = { hauler: haulerParts, station: stationParts, gate: gateParts };

const shapes = new Map<string, THREE.BufferGeometry>();

/**
 * The geometry for one kind of mark, built on first use and shared afterwards.
 *
 * A hull is the same object on every mark of its kind, so a hundred haulers are one geometry and one draw call
 * each, and a pick only changes the material's colour.
 */
export function markGeometry(kind: MarkKind | 'exhaust'): THREE.BufferGeometry {
  const cached = shapes.get(kind);
  if (cached) return cached;
  const made = bake(kind === 'exhaust' ? exhaustParts() : PARTS[kind]());
  shapes.set(kind, made);
  return made;
}
