'use strict';

/**
 * Build a Node Single Executable Application (SEA) for the current platform.
 *
 * Steps:
 *   1. esbuild bundles src/cli.js -> dist/app.cjs (ffmpeg-static/ffprobe-static
 *      stay external; their binaries are embedded as SEA assets instead).
 *   2. Write sea-config.json listing the bundled assets (chart-renderer,
 *      report template, and the platform ffmpeg/ffprobe binaries).
 *   3. Generate the SEA preparation blob.
 *   4. Copy the running node binary and inject the blob with postject.
 *
 * NOTE: SEA cannot cross-compile. Each OS produces its own executable and must
 * run on a matching CI runner.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const isWin = process.platform === 'win32';
const exeExt = isWin ? '.exe' : '';
const OUT_NAME = `HDR-Video-Analyzer${exeExt}`;

function log(msg) {
  console.log(`[build-sea] ${msg}`);
}

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // 1. Bundle the CLI into a single CJS file.
  log('bundling with esbuild...');
  const esbuild = require('esbuild');
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'src', 'cli.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    outfile: path.join(DIST, 'app.cjs'),
    // ffmpeg-static/ffprobe-static only export binary paths; we embed the
    // binaries as SEA assets and resolve them at runtime, so keep them external.
    external: ['ffmpeg-static', 'ffprobe-static'],
  });

  // 2. Resolve the platform ffmpeg/ffprobe binaries to embed.
  const ffmpegPath = require('ffmpeg-static');
  const ffprobePath = require('ffprobe-static').path;
  if (!fs.existsSync(ffmpegPath)) throw new Error(`ffmpeg not found: ${ffmpegPath}`);
  if (!fs.existsSync(ffprobePath)) throw new Error(`ffprobe not found: ${ffprobePath}`);
  log(`ffmpeg:  ${ffmpegPath}`);
  log(`ffprobe: ${ffprobePath}`);

  const seaConfig = {
    main: path.join(DIST, 'app.cjs'),
    output: path.join(DIST, 'sea-prep.blob'),
    disableExperimentalSEAWarning: true,
    // Code cache and snapshot are platform-specific; must be false for SEA.
    useSnapshot: false,
    useCodeCache: false,
    assets: {
      'chart-renderer.js': path.join(ROOT, 'assets', 'chart-renderer.js'),
      'report-template.html': path.join(ROOT, 'src', 'report-template.html'),
      'ffmpeg': ffmpegPath,
      'ffprobe': ffprobePath,
    },
  };
  const configPath = path.join(DIST, 'sea-config.json');
  fs.writeFileSync(configPath, JSON.stringify(seaConfig, null, 2));

  // 3. Generate the SEA preparation blob.
  log('generating SEA blob...');
  run(process.execPath, ['--experimental-sea-config', configPath]);

  // 4. Copy node binary and inject the blob.
  const outPath = path.join(DIST, OUT_NAME);
  fs.copyFileSync(process.execPath, outPath);
  log(`copied node -> ${outPath}`);

  // Remove signature on macOS before injection (re-signed ad-hoc after).
  if (process.platform === 'darwin') {
    try { run('codesign', ['--remove-signature', outPath]); } catch { /* ignore */ }
  }

  log('injecting blob with postject...');
  const postjectArgs = [
    outPath,
    'NODE_SEA_BLOB',
    seaConfig.output,
    '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ];
  if (process.platform === 'darwin') {
    postjectArgs.push('--macho-segment-name', 'NODE_SEA');
  }
  run(process.execPath, [require.resolve('postject/dist/cli.js'), ...postjectArgs]);

  if (process.platform === 'darwin') {
    try { run('codesign', ['--sign', '-', outPath]); } catch { /* ignore */ }
  }

  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  log(`done: ${outPath} (${sizeMB} MB)`);
}

main();
