import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import * as THREE from 'three';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, Star } from 'lucide-react';
import sky from '../assets/sky.jpg?url';
import {
  LEVEL,
  bearingOf,
  dragTurn,
  fitView,
  forwardOf,
  onDisc,
  placed,
  project,
  viewRegion,
  visible,
} from '@ssccsorg/skene-board';
import { registerReading, type Board } from '@ssccsorg/skene-frame/lib/readings';
import { useScenario } from '@ssccsorg/skene-frame/stores/scenario';
import { cn } from '@ssccsorg/skene-ui';
import { markGeometry } from './hulls';
import { useView } from './view';

// New Eden, read from the pilot's seat: the stars behind, the systems the run stands in, and the route each
// unit has taken. It is the project's own sphere rather than the frame's, so the place's ground is not drawn.

/** How far a pointer travels before a press is a drag rather than a pick, on the canvas and on the map. */
const DRAG = 4;

/**
 * The sky the seat is under.
 *
 * An equirectangular panorama wrapped inside a sphere the camera stands in, so turning the view turns within one photograph
 * rather than within a scatter of generated points. ESO/S. Brunier, CC BY 4.0, credited in the demonstration card.
 */
function Sky() {
  const texture = useLoader(THREE.TextureLoader, sky);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  // BackSide draws the inside of the sphere; the x flip undoes the mirror that comes with it.
  return (
    <mesh scale={[-1, 1, 1]} renderOrder={-1}>
      <sphereGeometry args={[900, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/**
 * The star points in front of the sky.
 *
 * A graphic layer rather than a catalogue: the photograph carries the band and the nebula, and what it cannot carry at
 * this size is a field of points with a spread of brightness. Most are faint and a few are bright, because that spread
 * is what reads as stars rather than as noise.
 */
function Stars() {
  const geometry = useMemo(() => {
    const count = 2400;
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    // Seeded, so a re-render is the same sky and a screenshot is reproducible.
    let seed = 1291;
    const next = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let index = 0; index < count; index += 1) {
      const azimuth = next() * Math.PI * 2;
      const elevation = Math.acos(2 * next() - 1);
      const radius = 820 + next() * 40;
      const flat = Math.sin(elevation) * radius;
      positions[index * 3] = flat * Math.cos(azimuth);
      positions[index * 3 + 1] = Math.cos(elevation) * radius;
      positions[index * 3 + 2] = flat * Math.sin(azimuth);
      const light = 0.22 + next() ** 6 * 0.78;
      colours[index * 3] = light;
      colours[index * 3 + 1] = light;
      colours[index * 3 + 2] = Math.min(1, light * 1.06);
    }
    const made = new THREE.BufferGeometry();
    made.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    made.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return made;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Screen-sized rather than world-sized: a star does not grow as the view is turned toward it.
  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={1.8}
        sizeAttenuation={false}
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** The pilot's own camera, kept in step with this reading's view: the field and the names share it. */
function Pilot({ camera }: { camera: RefObject<THREE.PerspectiveCamera | null> }) {
  useFrame(() => {
    const view = useView.getState();
    const made = camera.current;
    if (!made) return;
    made.fov = view.fov;
    made.updateProjectionMatrix();
    made.lookAt(...forwardOf(view));
  });
  return null;
}

/**
 * A hauler: the freighter hull from `hulls.ts`, with the two exhausts drawn as light rather than as metal.
 *
 * The nose points at -Z, because that is the camera's forward, and the heading turns the hull onto its path.
 */
function Hauler({ colour, heading }: { colour: string; heading: number }) {
  return (
    <group rotation={[0, heading, 0]}>
      <mesh geometry={markGeometry('hauler')}>
        <meshBasicMaterial color={colour} vertexColors />
      </mesh>
      <mesh geometry={markGeometry('exhaust')}>
        <meshBasicMaterial
          color="#7fd8e8"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** A station, and a gate: one geometry each, shared by every mark of that kind. */
function Structure({ kind, colour }: { kind: 'station' | 'gate'; colour: string }) {
  return (
    <mesh geometry={markGeometry(kind)}>
      <meshBasicMaterial color={colour} vertexColors />
    </mesh>
  );
}

/** One unit as this board draws it: where it stands, what it is, and where it is pointed. */
interface Marked {
  id: string;
  label: string | null;
  icon: string | null;
  heading: number;
  at: [number, number, number];
}

/**
 * One entity's mark. What the unit is decides the silhouette, and the pick stays with the caller.
 *
 * A sphere for every kind is what made the space read as a scatter of dots: a system is a faceted body, a station is a
 * structure, a gate is the ring it opens, and a hauler is a hull.
 */
function Mark({ system, picked, onPick }: { system: Marked; picked: boolean; onPick: (id: string) => void }) {
  const colour = picked
    ? '#ffffff'
    : system.icon === 'gate'
      ? '#9fc0ff'
      : system.icon === 'station'
        ? '#e0b050'
        : system.icon === 'hauler'
          ? '#9fb6c9'
          : '#8fb2e8';
  return (
    <group
      position={system.at}
      // A press that travels is the camera's, so the pick waits for a release that did not: a drag beginning on a mark
      // would otherwise pick it, and the frame turns the shell to whatever is picked.
      onClick={(event) => {
        if (event.delta > DRAG) return;
        event.stopPropagation();
        onPick(system.id);
      }}
    >
      {system.icon === 'hauler' ? (
        <Hauler colour={colour} heading={system.heading} />
      ) : system.icon === 'station' ? (
        <Structure kind="station" colour={colour} />
      ) : system.icon === 'gate' ? (
        <Structure kind="gate" colour={colour} />
      ) : (
        <mesh>
          {/* A system is a point of light, so it is drawn as one: a small body with the glow of one rather than a facet. */}
          <sphereGeometry args={[0.006, 8, 6]} />
          <meshBasicMaterial color={colour} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** The disc's own grid, at every thirty degrees. It is what makes the disc read as a sphere. */
const WEB = [-60, -30, 0, 30, 60];
/** The samples on one line of the web, enough that the curve the projection gives is the curve drawn. */
const WEB_STEPS = 32;

/** A parallel at one elevation, from the left rim to the right. */
function parallelPath(elevation: number): string {
  const points: string[] = [];
  for (let step = 0; step <= WEB_STEPS; step += 1) {
    const [x, y] = onDisc(-Math.PI / 2 + (step / WEB_STEPS) * Math.PI, elevation);
    points.push(`${x.toFixed(4)} ${y.toFixed(4)}`);
  }
  return `M${points.join('L')}`;
}

/** A meridian at one azimuth, from the south pole to the north. */
function meridianPath(azimuth: number): string {
  const points: string[] = [];
  for (let step = 0; step <= WEB_STEPS; step += 1) {
    const [x, y] = onDisc(azimuth, -Math.PI / 2 + (step / WEB_STEPS) * Math.PI);
    points.push(`${x.toFixed(4)} ${y.toFixed(4)}`);
  }
  return `M${points.join('L')}`;
}

/**
 * The space as a disc, small, at the pane's own corner.
 *
 * The frame's minimap answers where the pilot is among the projects; this one answers where they are inside the space, and
 * it is read the same way: the shell seen from outside the seat, turned to the pilot's bearing, with the part the pane
 * holds painted on it. A hand that pushes the disc turns the view, because the surface moves under the marker and not the
 * marker under the surface, and a press on a mark looks at it. Two navigators because they are two questions, and each
 * belongs to the layer that can answer it.
 *
 * The marks are the same points the board draws, so the disc and the space cannot disagree about a bearing: both are read
 * off the one shifted point. Only the half of the shell the pilot faces is drawn, which is what makes the disc a sphere
 * rather than a chart.
 */
function RegionMap({
  systems,
  sector,
  pickedId,
  onPick,
}: {
  systems: Marked[];
  sector: [number, number];
  pickedId: string | null;
  onPick: (id: string) => void;
}) {
  const yaw = useView((state) => state.yaw);
  const pitch = useView((state) => state.pitch);
  const fov = useView((state) => state.fov);
  const frame = useView((state) => state.frame);
  const turn = useView((state) => state.turn);
  const fit = useView((state) => state.fit);
  const disc = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; at: [number, number] } | null>(null);
  const turned = useRef(false);
  // The pilot's own bearing, which the disc is centred on: the map shows the half of the shell they face.
  const bearing: [number, number] = [yaw, pitch];
  // The pane's own corners, recomputed from the view rather than tracked beside it.
  const view = useMemo(
    () => viewRegion({ yaw, pitch, fov }, frame[0] / Math.max(frame[1], 1)),
    [yaw, pitch, fov, frame],
  );

  const down = (event: ReactPointerEvent<SVGSVGElement>) => {
    // The pane turns the view on its own drag, so a hand that took the disc has taken the map and not the space behind it.
    event.stopPropagation();
    drag.current = { id: event.pointerId, at: [event.clientX, event.clientY] };
    turned.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    const from = drag.current;
    if (!from || from.id !== event.pointerId) return;
    const [dx, dy] = [event.clientX - from.at[0], event.clientY - from.at[1]];
    if (!turned.current && Math.hypot(dx, dy) < DRAG) return;
    turned.current = true;
    drag.current = { id: from.id, at: [event.clientX, event.clientY] };
    if (!dx && !dy) return;
    // The sphere is drawn from outside the seat, so a hand that pushes its surface turns the space the other way.
    const step = dragTurn(dx, dy, disc.current?.getBoundingClientRect() ?? null);
    turn(-step.dx, -step.dy, step.per);
  };
  const up = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (!systems.length) return null;

  return (
    <div
      className="pointer-events-auto absolute bottom-3 left-3 overflow-hidden rounded-full border border-border/70 bg-card/85 shadow-lg backdrop-blur-sm"
      style={{ width: 160, height: 160 }}
    >
      <svg
        ref={disc}
        viewBox="-1.01 -1.01 2.02 2.02"
        preserveAspectRatio="xMidYMid meet"
        className="size-full cursor-move touch-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <g className="fill-none stroke-border" strokeWidth={0.004}>
          {WEB.map((degrees) => (
            <path
              key={`meridian-${degrees}`}
              d={meridianPath((degrees * Math.PI) / 180)}
              className={degrees === 0 ? 'stroke-muted-foreground/60' : undefined}
            />
          ))}
          {WEB.map((degrees) => (
            <path key={`parallel-${degrees}`} d={parallelPath((degrees * Math.PI) / 180)} />
          ))}
        </g>

        {frame[0] > 0 && frame[1] > 0 ? (
          <polygon
            points={view.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(' ')}
            className="fill-foreground/5 stroke-foreground/25"
            strokeWidth={0.006}
            pointerEvents="none"
          />
        ) : null}

        {systems.map((system) => {
          const [azimuth, elevation] = bearingOf(system.at);
          if (!visible([azimuth, elevation], bearing)) return null;
          const [x, y] = onDisc(azimuth, elevation, bearing);
          const picked = system.id === pickedId;
          // A star is a point of the field and a station or a hull is a body on it, so the disc tells them apart the way the
          // board does: the field fine and the bodies larger.
          const size = system.icon === 'system' ? 0.022 : 0.04;
          return (
            <g key={system.id}>
              {picked ? (
                <circle cx={x} cy={y} r={0.07} className="fill-none stroke-foreground/40" strokeWidth={0.01} />
              ) : null}
              <circle
                cx={x}
                cy={y}
                r={picked ? 0.05 : size}
                className={cn(
                  'cursor-pointer',
                  picked
                    ? 'fill-foreground'
                    : system.icon === 'system'
                      ? 'fill-muted-foreground/60 hover:fill-foreground'
                      : 'fill-muted-foreground hover:fill-foreground',
                )}
                onClick={() => {
                  if (turned.current) return;
                  if (frame[0] && frame[1]) fit(fitView([system.at], frame[0], frame[1], 1.2, sector));
                  onPick(system.id);
                }}
              >
                <title>{system.label ?? system.id}</title>
              </circle>
            </g>
          );
        })}

        <circle r={0.03} className="fill-claim" />
      </svg>
    </div>
  );
}

function Route({ points }: { points: [number, number, number][] }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: '#3d5f8f', transparent: true, opacity: 0.55 }),
    );
  }, [points]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  return <primitive object={line} />;
}

/** A name is placed with the projection the camera is given, so it cannot stand beside another mark. */
/**
 * The marks as the reader touches them.
 *
 * A point is two pixels, which is not a target. Every unit gets a circle of its own in the layer above the canvas: a
 * ring on hover or when picked, the name where there is room for one, and a card beside it saying what the unit is.
 * The drawing stays in the canvas; only the touching is here.
 */
function Overlay({
  systems,
  pickedId,
  onPick,
}: {
  systems: Marked[];
  pickedId: string | null;
  onPick: (id: string) => void;
}) {
  const yaw = useView((state) => state.yaw);
  const pitch = useView((state) => state.pitch);
  const fov = useView((state) => state.fov);
  const frame = useView((state) => state.frame);
  const [hovered, setHovered] = useState<string | null>(null);
  // Where the press began, so a name dragged off is a turn of the camera rather than a pick.
  const pressed = useRef<[number, number] | null>(null);
  if (!frame[0] || !frame[1]) return null;

  const middle: [number, number] = [frame[0] / 2, frame[1] / 2];
  const points = systems
    .map((system) => {
      const [x, y, depth] = project(system.at, frame[0], frame[1], { yaw, pitch, fov });
      return { system, x, y, depth, away: Math.hypot(x - middle[0], y - middle[1]) };
    })
    .filter((point) => point.depth > 0);

  // A name is drawn only where it does not land on one already drawn.
  const named: typeof points = [];
  for (const point of [...points].sort((left, right) => left.away - right.away)) {
    if (named.length >= 12) break;
    if (point.away < Math.min(frame[0], frame[1]) * 0.55 && named.every((other) => Math.hypot(other.x - point.x, other.y - point.y) > 64)) {
      named.push(point);
    }
  }
  const labelled = new Set(named.map((point) => point.system.id));
  const card = points.find((point) => point.system.id === hovered);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {points.map(({ system, x, y }) => (
        <button
          key={system.id}
          type="button"
          onPointerEnter={() => setHovered(system.id)}
          onPointerLeave={() => setHovered((now) => (now === system.id ? null : now))}
          onPointerDown={(event) => {
            pressed.current = [event.clientX, event.clientY];
          }}
          onClick={(event) => {
            const from = pressed.current;
            if (from && Math.hypot(event.clientX - from[0], event.clientY - from[1]) > DRAG) return;
            onPick(system.id);
          }}
          className="pointer-events-auto absolute flex items-center justify-center"
          style={{ left: x, top: y, width: 24, height: 24, transform: 'translate(-50%, -50%)' }}
        >
          {hovered === system.id || pickedId === system.id ? (
            <span
              className={cn(
                'block rounded-full border',
                pickedId === system.id ? 'size-6 border-foreground/70' : 'size-5 border-foreground/40',
              )}
            />
          ) : null}
          {labelled.has(system.id) ? (
            <span
              className={cn(
                'pointer-events-none absolute top-full left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] tracking-wide',
                system.id === pickedId || hovered === system.id ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {system.label ?? system.id}
            </span>
          ) : null}
        </button>
      ))}
      {card ? (
        <div
          className="pointer-events-none absolute rounded border border-border/70 bg-card/95 px-2 py-1 text-[11px] shadow-lg"
          style={{ left: card.x + 16, top: card.y + 12 }}
        >
          <span className="block text-foreground">{card.system.label ?? card.system.id}</span>
          <span className="block text-muted-foreground">{card.system.icon ?? 'unit'}</span>
        </div>
      ) : null}
    </div>
  );
}

function EveSpace({ world, pickedId, onPick }: Board) {
  const box = useRef<HTMLDivElement>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const turn = useView((state) => state.turn);
  const zoom = useView((state) => state.zoom);
  const fit = useView((state) => state.fit);
  const release = useView((state) => state.release);
  const held = useView((state) => state.held);
  const frame = useView((state) => state.frame);
  const setFrame = useView((state) => state.setFrame);
  const projectId = useScenario((state) => state.projectId);

  const aspect = world?.aspect ?? 2;
  const sector = world?.sector ?? ([0, 0] as [number, number]);
  // A pick is a seat. The chosen unit becomes the origin and everything else is drawn relative to it, which is what
  // makes the shell the world that unit looks at rather than the one the pilot happens to be standing in.
  const [seatId, setSeatId] = useState<string | null>(null);
  // A pick from anywhere opens the seat, and the toolbar can move it to a neighbour or back to the third person without
  // asking the panel to clear a selection the frame has no verb for.
  useEffect(() => {
    setSeatId(pickedId ?? null);
  }, [pickedId]);
  const seat = useMemo(() => {
    if (!seatId || !world) return null;
    const found = world.present.find((unit) => unit.id === seatId);
    return found ? placed(found.at, aspect, sector) : null;
  }, [seatId, world, aspect, sector]);
  const shift = (point: [number, number, number]): [number, number, number] =>
    seat ? [point[0] - seat[0], point[1] - seat[1], point[2] - seat[2]] : point;
  // The frame is fitted to the systems the place declares, not to the people it also names: a person is not a body on
  // this board, and the fit follows the declared set rather than the records that have arrived.
  const ground = useMemo(
    () =>
      world
        ? world.standing
            .filter((unit) => unit.icon !== 'person')
            .map((unit) => shift(placed(unit.at, aspect, sector)))
        : [],
    [world, aspect, sector, seat],
  );
  const systems = useMemo<Marked[]>(
    () =>
      world
        ? world.present
            .filter((unit) => unit.icon !== 'person')
            .map((unit) => {
              // The last leg of the path is where the hull is pointed. A unit that has not moved faces the way the camera does.
              const path = unit.path;
              const [from, to] = [path[path.length - 2], path[path.length - 1]];
              const heading =
                from && to ? Math.atan2(-(to[0] - from[0]), -(to[2] - from[2])) : 0;
              return {
                id: unit.id,
                label: unit.label,
                icon: unit.icon,
                heading,
                at: shift(placed(unit.at, aspect, sector)),
              };
            })
        : [],
    [world, aspect, sector, seat],
  );
  const stars = useMemo<Marked[]>(() => systems.filter((system) => system.icon === 'system'), [systems]);
  const bodies = useMemo<Marked[]>(() => systems.filter((system) => system.icon !== 'system'), [systems]);
  // One Points object for every star: ninety meshes became ninety draw calls whose size followed the distance, so the
  // near ones were discs and the far ones specks. A star map draws points at one size and that is what this is.
  // A point with no map is a square, which reads as a pixel rather than a star. The glow is drawn into a canvas at
  // load, so the field needs no image and no loader.
  const starSprite = useMemo(() => {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (context) {
      const glow = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      glow.addColorStop(0, 'rgba(255,255,255,1)');
      glow.addColorStop(0.35, 'rgba(255,255,255,0.8)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, size, size);
    }
    const made = new THREE.CanvasTexture(canvas);
    made.colorSpace = THREE.SRGBColorSpace;
    return made;
  }, []);
  useEffect(() => () => starSprite.dispose(), [starSprite]);
  const starGeometry = useMemo(() => {
    if (!stars.length) return null;
    const made = new THREE.BufferGeometry();
    made.setAttribute('position', new THREE.BufferAttribute(new Float32Array(stars.flatMap((star) => star.at)), 3));
    return made;
  }, [stars]);
  useEffect(() => () => starGeometry?.dispose(), [starGeometry]);
  const routes = useMemo(
    () =>
      world
        ? world.present
            .filter((unit) => unit.path.length > 1)
            .map((unit) => unit.path.map((point) => shift(placed(point, aspect, sector))))
        : [],
    [world, aspect, sector, seat],
  );

  useEffect(() => {
    const element = box.current;
    if (!element) return undefined;
    const measure = () => setFrame([element.clientWidth, element.clientHeight]);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [setFrame]);

  // Another project is another space, so the pilot's own view of this one is not a view of that one.
  useEffect(() => {
    release();
  }, [release, projectId, seatId]);


  useEffect(() => {
    if (held || !ground.length || !frame[0] || !frame[1]) return;
    fit(fitView(ground, frame[0], frame[1], 1.45, sector));
  }, [held, ground, frame, sector, fit]);

  useEffect(() => {
    const element = box.current;
    if (!element) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(event.deltaY);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [zoom]);

  if (!world) return null;

  /** The unit next to the seat in the order the board lists them, which is the order the names are read in. */
  const step = (by: number) => {
    if (!systems.length) return;
    const at = systems.findIndex((system) => system.id === seatId);
    const next = systems[((at < 0 ? 0 : at) + by + systems.length) % systems.length];
    if (!next) return;
    setSeatId(next.id);
    onPick(next.id);
  };

  return (
    <div
      ref={box}
      className="absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
      onPointerDown={(event) => {
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        const from = drag.current;
        if (!from || from.id !== event.pointerId) return;
        const dx = event.clientX - from.x;
        const dy = event.clientY - from.y;
        if (Math.hypot(dx, dy) < DRAG) return;
        drag.current = { ...from, x: event.clientX, y: event.clientY };
        turn(dx, dy);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <Canvas
        dpr={[1, 2]}
        flat
        gl={{ powerPreference: 'high-performance' }}
        camera={{ fov: LEVEL.fov, position: [0, 0, 0], far: 4000 }}
        onCreated={({ camera: made }) => {
          camera.current = made as THREE.PerspectiveCamera;
        }}
      >
        <Pilot camera={camera} />
        <Sky />
        <Stars />
        {starGeometry ? (
          <points
            geometry={starGeometry}
            onClick={(event) => {
              if (event.delta > DRAG) return;
              const hit = event.index === undefined ? undefined : stars[event.index];
              if (!hit) return;
              event.stopPropagation();
              onPick(hit.id);
            }}
          >
            <pointsMaterial map={starSprite} size={9} sizeAttenuation={false} color="#cfe0ff" transparent depthWrite={false} />
          </points>
        ) : null}
        {bodies.map((system) => (
          <Mark key={system.id} system={system} picked={system.id === pickedId} onPick={onPick} />
        ))}
        {routes.map((points, index) => (
          <Route key={index} points={points} />
        ))}
      </Canvas>
      <Overlay systems={systems} pickedId={pickedId} onPick={onPick} />
      <div className="absolute right-3 bottom-3 flex flex-col gap-1">
        {[
          { title: 'previous unit', Icon: ChevronLeft, run: () => step(-1) },
          { title: 'next unit', Icon: ChevronRight, run: () => step(1) },
          {
            title: 'third person',
            Icon: RotateCcw,
            run: () => {
              setSeatId(null);
              release();
            },
          },
          { title: 'closer', Icon: Plus, run: () => zoom(-120) },
          { title: 'further', Icon: Minus, run: () => zoom(120) },
        ].map(({ title, Icon, run }) => (
          <button
            key={title}
            type="button"
            title={title}
            onClick={run}
            className="pointer-events-auto flex size-7 items-center justify-center rounded border border-border/70 bg-card/90 text-muted-foreground hover:text-foreground"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
      <RegionMap systems={systems} sector={sector} pickedId={pickedId} onPick={onPick} />
    </div>
  );
}

/**
 * New Eden as the project's own pane.
 *
 * The shell is still the seat and still the default sphere: this is a second picture of the same space, drawn by this
 * project for this space. It stands where the frame's map stands in Kwai Tsing, so the frame arranges it the same way
 * (side by side, stacked, or taking the frame) and the pilot can close it back to the sphere.
 */
export const EVE_SPACE = registerReading({
  key: 'eve-space',
  path: '/eden',
  View: EveSpace,
  button: { order: 11, title: 'new eden', Icon: Star },
  // A pane of the board rather than a place the cockpit goes to, which is what puts it beside the shell.
  pane: true,
  // It draws the units the run has placed, so it is offered wherever a space has any.
  can: (world) => Boolean(world?.standing.length),
  asked: true,
  pack: 'eve',
});
