// Dev launcher. The project folder name contains "#", which Vite's dev server treats as a URL
// fragment (its own /@vite/client 404s and nothing renders). When that's the case, run Vite
// through a "#"-free symlink with Node's preserve-symlinks flags so every path it serves is clean.
// Elsewhere this just runs `vite`. Production builds are unaffected.
import { spawn } from 'node:child_process';
import { existsSync, lstatSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const real = dirname(dirname(fileURLToPath(import.meta.url)));
let root = real;

if (real.includes('#')) {
  const link = join(tmpdir(), 'vite-' + real.replace(/[^A-Za-z0-9]+/g, '_'));
  const stat = lstatSync(link, { throwIfNoEntry: false });
  if (stat && (!stat.isSymbolicLink() || readlinkSync(link) !== real)) unlinkSync(link);
  if (!existsSync(link)) symlinkSync(real, link, 'dir');
  root = link;
}

const child = spawn(
  process.execPath,
  ['--preserve-symlinks', '--preserve-symlinks-main', join(root, 'node_modules/vite/bin/vite.js'), ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_DEV_ROOT: root } },
);
child.on('exit', (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
