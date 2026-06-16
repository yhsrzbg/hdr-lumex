# HDR Video Analyzer

An interactive command-line tool for analyzing HDR video files. It decodes video frames using FFmpeg, performs PQ EOTF conversion, calculates brightness and color gamut classification, and generates a self-contained HTML report with a 3-panel chart.

Double-click to launch — a terminal opens with a numbered menu. No installation step, no Node.js required (the released builds are single executables with FFmpeg bundled in).

## Features

- **Brightness Analysis**: Peak and average brightness over time (displayed in PQ/nits scale)
- **Color Gamut Classification**: Frame-by-frame breakdown of Rec.709, DCI-P3, and Rec.2020 content
- **APL Histogram**: Average Picture Level distribution across all analyzed frames
- **Statistics**: MaxCLL, AveCLL, MaxFALL, AveFALL, Average APL, Median APL
- **HTML report**: Opens in your browser; export the chart as a PNG with one click

## Download & Run (end users)

Grab the zip for your platform from the [Releases](../../releases) page:

- **Windows**: unzip and double-click `HDR-Video-Analyzer.exe`. A console window opens with the menu.
- **macOS**: unzip and double-click `run-mac.command` (opens in Terminal). First launch may be blocked by Gatekeeper — right-click → Open, or run `xattr -d com.apple.quarantine HDR-Video-Analyzer`.
- **Linux**: unzip and run `./run-linux.sh` from a terminal (or mark it executable and "Run in Terminal" from your file manager).

Then choose **1** to analyze a video, paste or drag in the file path, and the tool writes an HTML report next to it.

## Usage (menu)

```
==============================
     HDR Video Analyzer
==============================

  1) 分析视频文件
  2) 关于 / 帮助
  0) 退出
```

You can also run it non-interactively by passing a video path as an argument:

```bash
HDR-Video-Analyzer /path/to/video.mkv
```

Supported formats: MKV, MP4, MOV, TS.

## Development

```bash
# Node.js 18+ (CI builds with 22)
npm install
npm start          # run the CLI from source
npm run build      # build the single-file executable into dist/
```

`npm run build` uses esbuild to bundle the CLI, then Node's Single Executable Application (SEA) API plus postject to produce one binary with FFmpeg, FFprobe, and the chart renderer embedded as assets. SEA cannot cross-compile, so each platform's binary is built on its own CI runner (see `.github/workflows/release.yml`).

## How It Works

1. **FFprobe** extracts the video duration
2. **FFmpeg** decodes the video at 1 fps to raw 10-bit planar format (gbrp10le), padded to 3840x2160
3. Per-pixel analysis: PQ EOTF (ST 2084) → linear light → Rec.2020 luminance → CIE xy chromaticity for gamut classification
4. Results are written into an HTML report; the chart is drawn in the browser via the Canvas 2D API (no native canvas dependency)

## Size note

The released executable is ~170–190 MB. Most of that is the bundled FFmpeg/FFprobe (~130 MB) plus the Node runtime. To shrink it dramatically (~40 MB), switch `src/ffmpeg-paths.js` to download FFmpeg on first run instead of embedding it — the analysis code does not change.

## License

MIT
