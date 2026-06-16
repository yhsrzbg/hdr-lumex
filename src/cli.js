#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { spawn } = require('node:child_process');
const { analyze } = require('./analyze');
const { generateReport } = require('./report');

const VALID_EXT = ['.mkv', '.mp4', '.mov', '.ts'];

function printBanner() {
  console.log('');
  console.log('==============================');
  console.log('     HDR Video Analyzer');
  console.log('==============================');
  console.log('');
}

function printMenu() {
  console.log('  1) 分析视频文件');
  console.log('  2) 关于 / 帮助');
  console.log('  0) 退出');
  console.log('');
}

function printHelp() {
  console.log('');
  console.log('HDR Video Analyzer 分析 HDR (PQ/ST2084) 视频的:');
  console.log('  - 亮度随时间变化 (Peak / Avg nits, MaxCLL/AveCLL/MaxFALL/AveFALL)');
  console.log('  - 色域占比随时间 (Rec.709 / P3 / Rec.2020)');
  console.log('  - APL 直方图');
  console.log('');
  console.log('分析以 1 fps 采样，结果输出为自包含 HTML 报告，可在浏览器中查看并导出 PNG。');
  console.log('支持格式: MKV, MP4, MOV, TS');
  console.log('');
}

/**
 * Strip surrounding quotes and whitespace from a drag-and-dropped path.
 */
function cleanPath(input) {
  let p = input.trim();
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1);
  }
  return p.trim();
}

function formatTime(seconds) {
  return seconds.toFixed(1) + 's';
}

/**
 * Open a file with the OS default handler.
 */
function openInBrowser(filePath) {
  let cmd, args;
  if (process.platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', filePath];
  } else if (process.platform === 'darwin') {
    cmd = 'open';
    args = [filePath];
  } else {
    cmd = 'xdg-open';
    args = [filePath];
  }
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // best-effort; ignore failures
  }
}

/**
 * Validate, analyze, and report on a single video. Returns the report path or
 * null on failure. When rl is provided, offers to open the report in a browser.
 */
async function analyzeOnce(rawPath, rl) {
  const videoPath = cleanPath(rawPath);
  if (!videoPath) {
    console.log('已取消。\n');
    return null;
  }

  if (!fs.existsSync(videoPath) || !fs.statSync(videoPath).isFile()) {
    console.log(`找不到文件: ${videoPath}\n`);
    return null;
  }
  const ext = path.extname(videoPath).toLowerCase();
  if (!VALID_EXT.includes(ext)) {
    console.log(`不支持的格式 "${ext}"。支持: ${VALID_EXT.join(', ')}\n`);
    return null;
  }

  console.log(`\n开始分析: ${path.basename(videoPath)}`);
  console.log('(按 Ctrl+C 可中断)\n');

  try {
    const analysisData = await analyze(videoPath, { useSubsample: true }, (percent, time, peak) => {
      stdout.write(
        `\r进度: ${percent.toFixed(1)}%  |  时间: ${formatTime(time)}  |  Peak: ${Math.round(peak)} nits   `
      );
    });
    stdout.write('\n\n');

    const reportPath = generateReport(analysisData, videoPath);
    console.log(`分析完成，共处理 ${analysisData.results.length} 帧。`);
    console.log(`报告已生成: ${reportPath}\n`);

    if (rl) {
      const ans = (await rl.question('是否用浏览器打开报告? (Y/n): ')).trim().toLowerCase();
      if (ans === '' || ans === 'y' || ans === 'yes') {
        openInBrowser(reportPath);
        console.log('已尝试打开。\n');
      } else {
        console.log('');
      }
    } else {
      openInBrowser(reportPath);
    }
    return reportPath;
  } catch (err) {
    stdout.write('\n');
    console.log(`分析失败: ${err.message}\n`);
    return null;
  }
}

async function runAnalysis(rl) {
  console.log('');
  const raw = await rl.question('请输入或拖入视频文件路径 (直接回车取消): ');
  await analyzeOnce(raw, rl);
}

async function main() {
  // Non-interactive mode: a video path as the first argument analyzes it
  // directly and exits (useful for scripting and CI).
  const argPath = process.argv[2];
  if (argPath) {
    await analyzeOnce(argPath);
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  printBanner();

  try {
    while (true) {
      printMenu();
      const choice = (await rl.question('请输入选项: ')).trim();

      if (choice === '1') {
        await runAnalysis(rl);
      } else if (choice === '2') {
        printHelp();
      } else if (choice === '0' || choice.toLowerCase() === 'q') {
        break;
      } else {
        console.log('无效选项，请重新输入。\n');
      }
    }

    // Keep the window open on double-click launch (Windows console closes otherwise).
    await rl.question('\n按回车键退出...');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('发生未预期的错误:', err);
  process.exit(1);
});
