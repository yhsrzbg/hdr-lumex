'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isSea } = require('./ffmpeg-paths');

/**
 * Load a text asset. In SEA mode reads from the embedded blob; in dev mode
 * reads from disk relative to the source tree.
 */
function loadAsset(name, devPath) {
  if (isSea()) {
    return require('node:sea').getAsset(name, 'utf8');
  }
  return fs.readFileSync(devPath, 'utf8');
}

/**
 * Generate a self-contained HTML report next to the analyzed video (or in cwd
 * if that is not writable). The chart is rendered in the user's browser using
 * the bundled chart-renderer source.
 *
 * @param {Object} analysisData - { results, totalDuration, filename }
 * @param {string} videoPath - original video path, used to place the report
 * @returns {string} path to the written HTML report
 */
function generateReport(analysisData, videoPath) {
  const template = loadAsset(
    'report-template.html',
    path.join(__dirname, 'report-template.html')
  );
  const chartRenderer = loadAsset(
    'chart-renderer.js',
    path.join(__dirname, '..', 'assets', 'chart-renderer.js')
  );

  const html = template
    .replace('__CHART_RENDERER__', () => chartRenderer)
    .replace('__ANALYSIS_DATA__', () => JSON.stringify(analysisData))
    .replace('__FILENAME__', () => analysisData.filename || '');

  const base = (analysisData.filename || 'hdr-analysis').replace(/\.[^.]+$/, '');
  const outName = `${base}-hdr-report.html`;

  // Prefer writing next to the source video; fall back to cwd.
  let outPath = path.join(path.dirname(videoPath), outName);
  try {
    fs.writeFileSync(outPath, html);
  } catch {
    outPath = path.join(process.cwd(), outName);
    fs.writeFileSync(outPath, html);
  }

  return outPath;
}

module.exports = { generateReport };
