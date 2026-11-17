import { create } from 'zustand';
import { FOV_MAX, FOV_MIN, LEVEL, type View } from '@ssccsorg/skene-board';
import { perPixel } from '@ssccsorg/skene-frame/stores/view';

// The pilot's own view of New Eden.
//
// The frame's view belongs to the shell: the sphere draws it, the frame's minimap paints the region it holds, and the shell
// measures its own box into it. This reading is a second camera standing beside that one, so it keeps its own angles, its
// own field and its own size. Two pictures of one space are two pilots, and a drag in one must not turn the other.

/** How far the pilot may look up or down, in radians. */
const PITCH_LIMIT = (72 * Math.PI) / 180;
/** How much of a zoom a notch of the wheel is worth. */
const PER_NOTCH = 0.0016;

interface EveView extends View {
  /** This reading's own size in pixels, which its names are projected through. */
  frame: [number, number];
  /** Whether the pilot has taken the view over, in which case a resize does not refit it. */
  held: boolean;
  setFrame: (frame: [number, number]) => void;
  /** Turn by a drag, with the rate the surface the hand is on is worth. */
  turn: (dx: number, dy: number, per?: number) => void;
  zoom: (delta: number) => void;
  fit: (view: View) => void;
  release: () => void;
}

const clampFov = (fov: number) => Math.min(Math.max(fov, FOV_MIN), FOV_MAX);

function wrap(yaw: number): number {
  const turn = Math.PI * 2;
  return ((yaw + Math.PI) % turn + turn) % turn - Math.PI;
}

export const useView = create<EveView>((set) => ({
  ...LEVEL,
  frame: [0, 0],
  held: false,
  setFrame: (frame) =>
    set((state) => (state.frame[0] === frame[0] && state.frame[1] === frame[1] ? {} : { frame })),
  turn: (dx, dy, per) =>
    set((state) => {
      const rate = per ?? perPixel(state.fov, state.frame[1]);
      return {
        held: true,
        yaw: wrap(state.yaw - dx * rate),
        pitch: Math.min(Math.max(state.pitch + dy * rate, -PITCH_LIMIT), PITCH_LIMIT),
      };
    }),
  zoom: (delta) => set((state) => ({ held: true, fov: clampFov(state.fov * (1 + delta * PER_NOTCH)) })),
  // The fitted view is the space's while the pilot has not taken it: a pane that is resized is a space they can still see
  // all of. Asking for the view already standing is not a new instruction.
  fit: (view) =>
    set((state) =>
      state.held || (state.yaw === view.yaw && state.pitch === view.pitch && state.fov === view.fov) ? {} : view,
    ),
  release: () => set({ held: false }),
}));
