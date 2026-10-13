# TrimLabel

Free, private shipping-label trimming for e-commerce sellers. Drop in your marketplace PDFs and get print-ready labels in seconds.

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Web-orange.svg)]()
[![Private](https://img.shields.io/badge/privacy-100%25%20on--device-brightgreen.svg)]()

TrimLabel works with **Flipkart**, **Meesho**, **Amazon** and **Shiprocket** labels. It is **100% free** with **no login, no sign-up and no email**. Everything runs in your browser, and your files are never uploaded.

## Features

| | |
| :--- | :--- |
| **Lossless trimming** | Edits the PDF directly, so barcodes stay sharp and scannable. |
| **Auto-detect** | Recognises the marketplace and picks the right trim for you. |
| **Flexible layouts** | Thermal 3x5 / 4x6, A4 with 2, 4 or 6 labels per sheet, or PNG images in a ZIP. |
| **Cut guides** | Optional corner marks for clean cutting. |
| **Batch ready** | Add one file or hundreds in a single go. |
| **Activity log** | Recent print jobs, stored only in your browser. |

## How it works

1. **Add your PDFs.** Drop one file or hundreds.
2. **Choose a layout.** The marketplace is detected automatically.
3. **Create your print file.** Download it and print.

## Quick start

```bash
python web/server.py
```

Then open `http://localhost:8000`.

To build the deployable site (Vercel runs this for you):

```bash
node scripts/build.js web      # outputs dist/web
```

## Project structure

```
web/        Website: index.html, styles.css, js/app.js, server.py (local dev server)
shared/     PDF engine, templates, security helpers, self-hosted libraries, legal pages
scripts/    build.js (combines web/ and shared/ into dist/web)
archive/    Parked code kept for later (not built)
```

## License

MIT. See [LICENSE](LICENSE).
