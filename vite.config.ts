import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boardIntoBuild } from '@ssccsorg/skene-frame/tools/vite-board.mjs';
import { SKENE_CHUNK_LIMIT, SKENE_DEDUPE, skeneChunks } from '@ssccsorg/skene-frame/tools/vite-chunks.mjs';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * The version the frame shows beside the name.
 *
 * A version nobody stamps is a placeholder, so the build stamps the commit it was made from: the date the commit landed,
 * as `yymmdd`, and the commit's own short hash. A build with no commit to read names its own with `EVE_VERSION` rather
 * than showing a stamp that belongs to no commit.
 */
function buildVersion(): string {
  const given = process.env.EVE_VERSION?.trim();
  if (given) return given;
  const stamped = execFileSync('git', ['log', '-1', '--format=%cd %h', '--date=format:%y%m%d'], {
    cwd: here('./'),
    encoding: 'utf8',
  }).trim();
  const [date, hash] = stamped.split(' ');
  if (!/^\d{6}$/.test(date ?? '') || !/^[0-9a-f]{4,}$/i.test(hash ?? '')) {
    throw new Error(`the build has no version: git answered "${stamped}", so set EVE_VERSION`);
  }
  return `${date}+${hash}`;
}

const version = buildVersion();

// The project a bare address opens on. The board names it rather than an entry, so no source file carries a project's own
// name. A config loaded without a generated board, which is a preview of an existing build, opens on nothing; the build's
// own copy is where a missing board fails.
const opens = (() => {
  try {
    return (JSON.parse(readFileSync(here('./projects/board.json'), 'utf8')) as { opens?: string }).opens ?? '';
  } catch {
    return '';
  }
})();

export default defineConfig({
  plugins: [react(), tailwindcss(), boardIntoBuild()],
  define: {
    'import.meta.env.VITE_OPENS': JSON.stringify(opens),
    'import.meta.env.VITE_VERSION': JSON.stringify(version),
  },
  // One React, one Three and one state store for the frame and this application: the frame declares React as a peer, so a
  // second copy is the failure this prevents. The rest of the frame's dependencies resolve from its own checkout.
  resolve: { dedupe: SKENE_DEDUPE },
  server: { port: 5274, strictPort: true },
  preview: { port: 5277, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The warning guards against a board that has grown. The rest is two engines and the frame drawn with them, each in
    // its own file so a deploy does not make a reader fetch a renderer that did not change.
    chunkSizeWarningLimit: SKENE_CHUNK_LIMIT,
    rollupOptions: { output: { manualChunks: skeneChunks } },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
