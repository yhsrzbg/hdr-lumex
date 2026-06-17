'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * Detect whether we are running inside a Node Single Executable Application.
 */
function isSea() {
  try {
    return require('node:sea').isSea();
  } catch {
    return false;
  }
}

const CACHE_DIR = path.join(os.tmpdir(), 'hdr-video-analyzer');

/**
 * Extract a bundled SEA asset (a binary) to the cache dir once, return its path.
 */
function extractSeaAsset(assetKey, outName) {
  const { getRawAsset } = require('node:sea');
  const ext = process.platform === 'win32' ? '.exe' : '';
  const outPath = path.join(CACHE_DIR, `${outName}${ext}`);

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    return outPath;
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const raw = getRawAsset(assetKey);
  fs.writeFileSync(outPath, new Uint8Array(raw));
  if (process.platform !== 'win32') {
    fs.chmodSync(outPath, 0o755);
  }
  return outPath;
}

/**
 * Resolve the ffmpeg binary path for the current runtime mode.
 */
function resolveFfmpegPath() {
  if (isSea()) {
    return extractSeaAsset('ffmpeg', 'ffmpeg');
  }
  try {
    return require('ffmpeg-static');
  } catch {
    const resourcesPath = process.resourcesPath || path.join(__dirname, '..');
    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.join(resourcesPath, `ffmpeg${ext}`);
  }
}

/**
 * Resolve the ffprobe binary path for the current runtime mode.
 */
function resolveFfprobePath() {
  if (isSea()) {
    return extractSeaAsset('ffprobe', 'ffprobe');
  }
  try {
    return require('@derhuerst/ffprobe-static');
  } catch {
    return 'ffprobe';
  }
}

module.exports = { isSea, resolveFfmpegPath, resolveFfprobePath, CACHE_DIR };
