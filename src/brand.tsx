import type { Brand } from '@ssccsorg/skene-frame';

/** The storage's mark: a hexagon, the diamond inside it, and the six spokes that join them. */
export const MARK_VIEWBOX = 32;

export const MARK =
  'M22.5 4.74L29 16L22.5 27.26L9.5 27.26L3 16L9.5 4.74Z' +
  'M18.68 11.36L20.64 18.68L13.32 20.64L11.36 13.32Z' +
  'M22.5 4.74L18.68 11.36' +
  'M9.5 27.26L13.32 20.64' +
  'M9.5 4.74L11.36 13.32' +
  'M29 16L20.64 18.68' +
  'M3 16L11.36 13.32' +
  'M22.5 27.26L20.64 18.68';

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label="Ktema" className={className}>
      <path
        d={MARK}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * What the bar and the card say about this board.
 *
 * The screen is one reading of a record, so it says what it is rather than leaving a reader to take it for the engine, for
 * the storage, or for measured data. The last two lines are the notices the data asks for, and every number behind the
 * board is a real read.
 */
export const brand: Brand = {
  title: 'NEW EDEN',
  name: 'New Eden',
  // Stamped by the build from the commit it was made from, so a reader can tell one build from another.
  version: `v${import.meta.env.VITE_VERSION}`,
  layers: ['Ktema', 'Skene'],
  // What this stack calls the three kinds of record: the frame's names are the engine's, and a reader of this board is
  // given its own.
  words: { fact: 'observation', intent: 'action', hint: 'constraint' },
  status: 'read-only',
  // The frame's unit is a project; this board's unit is a star system, and it says so wherever a reader adds or names one.
  unit: { one: 'system', many: 'systems' },
  note: '',
  about: [
    'New Eden is a board of its own over Ktema: one record model, one place, and the run the engine executed.',
    'The board is The Forge: ninety systems with the coordinates, gates, stations and security ESI answers for them, and a project is one of them.',
    'The fleet is a real one: eleven pilots of New Eden Light Point College, in Fraternity., and the two hulls of GABELLA CORP they killed in Akkio, read from two ESI killmails.',
    'The market numbers are ESI too. The question, the finding and who took the work are this board reading them.',
    'Skene draws it. The space is New Eden in EVE Online. Ktema is not affiliated with or endorsed by CCP.',
    'Background: ESO/S. Brunier, CC BY 4.0.',
  ],
  Mark,
  mark: { path: MARK, viewBox: MARK_VIEWBOX },
};
