# QuietPDF 🤫📄

QuietPDF is a minimal, fast, and privacy-first PDF utility web app.

## 🔒 100% Client-Side Privacy

- **Zero Server Uploads**: Every PDF operation runs completely inside the user's browser using WebAssembly and JavaScript (`pdf-lib`).
- **No Backend**: There is no backend server, no API, and no database.
- **No Tracking**: No analytics, tracking pixels, or third-party telemetry scripts.
- **Data Guarantee**: Your files never leave your device.

---

## 🛠️ Tech Stack & Dependencies

- **Vite**: Ultra-fast frontend tooling & bundler.
- **TypeScript**: Type-safe vanilla development (zero UI framework overhead).
- **pdf-lib**: Client-side PDF manipulation library.

---

## 📁 Project Structure

```text
quietpdf/
├── dist/               # Production build output
├── src/
│   ├── styles/         # CSS stylesheets
│   │   └── style.css
│   ├── tools/          # Future PDF utility modules
│   │   ├── merge.ts        (planned)
│   │   ├── compress.ts     (planned)
│   │   ├── imageToPdf.ts   (planned)
│   │   └── pdfToImage.ts   (planned)
│   └── main.ts         # App entry point
├── index.html          # Main HTML document
├── package.json        # Project metadata and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration (dist output)
└── README.md
```

---

## 🚀 Development & Scripts

### Install Dependencies
```bash
npm install
```

### Local Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```
This runs TypeScript type checking (`tsc`) and compiles the static site into the `/dist` directory.

### Preview Production Build
```bash
npm run preview
```

---

## 🌐 Cloudflare Pages Deployment

QuietPDF is designed to be hosted seamlessly on static hosting providers like **Cloudflare Pages**.

- **Framework preset**: `None` / `Vite`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
