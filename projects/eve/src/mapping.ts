// The capture this project reads, and the run it writes.
//
// The capture is the adapter's boundary: a pinned excerpt of a source, with the events the run is made of. The mapping
// is authored beside the pin, so a change to how a source field becomes a step is a new capture version rather than a run
// nobody can reconstruct.

export interface Pin {
  /** What the rows came from. */
  source: string;
  /** Where they were read. */
  endpoint: string;
  /** What the source was when they were read. */
  revision: string;
  /** Which mapping turned them into steps. */
  adapter: string;
}

export interface Step {
  verb: 'position' | 'path' | 'measured' | 'fact' | 'hint' | 'intent' | 'claim' | 'conclude' | 'write' | 'try-write';
  args: string[];
}

export interface Scene {
  /** The run's clock when the scene starts. */
  at: number;
  /** What the scene is, as the line the run carries above it. */
  note: string;
  steps: Step[];
}

export interface Capture {
  pin: Pin;
  title: string;
  introduction: string[];
  seed: number;
  scenes: Scene[];
}

/** How many facts a step writes, which is what the run's own `count` steps assert. */
function factsOf(step: Step): number {
  switch (step.verb) {
    case 'position':
    case 'measured':
    case 'fact':
    case 'conclude':
      return 1;
    case 'write':
    case 'try-write':
      return Number(step.args[0] ?? 0) || 0;
    case 'path':
      return Math.max(2, Math.trunc(Number(step.args[3] ?? 2)) || 2);
    default:
      return 0;
  }
}

/** The run a capture is, in the scenario language the frame reads. */
export function runOf(capture: Capture): string {
  const lines: string[] = [`# ${capture.title}`, '#'];
  for (const line of capture.introduction) lines.push(`# ${line}`);
  // The run carries where it came from, so a reader of the file does not have to find the capture to know.
  lines.push(
    '',
    `# pin: source=${capture.pin.source} endpoint=${capture.pin.endpoint} revision=${capture.pin.revision} adapter=${capture.pin.adapter}`,
  );
  lines.push('', `seed ${capture.seed}`);
  let facts = 0;
  for (const scene of capture.scenes) {
    lines.push('', `# ${scene.note}`, `time ${scene.at}`);
    let wrote = false;
    for (const step of scene.steps) {
      lines.push(`${step.verb} ${step.args.join(' ')}`);
      const count = factsOf(step);
      facts += count;
      wrote = wrote || count > 0;
    }
    if (wrote) lines.push(`count ${facts}`);
  }
  return `${lines.join('\n')}\n`;
}
