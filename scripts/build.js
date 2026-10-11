// Assembles a deployable bundle by combining a platform folder with shared/.
//   node scripts/build.js web      -> dist/web      (Vercel / static hosting)
//   node scripts/build.js android  -> android/www   (Capacitor webDir)
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const targets = {
  web: { src: path.join(root, "web"), out: path.join(root, "dist", "web"), skip: ["server.py"] },
  android: { src: path.join(root, "android", "src"), out: path.join(root, "android", "www"), skip: [] },
};

const name = process.argv[2];
const t = targets[name];
if (!t) {
  console.error("Usage: node scripts/build.js <web|android>");
  process.exit(1);
}

function copy(from, to, skip = []) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copy(s, d, skip);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(t.out, { recursive: true, force: true });
copy(t.src, t.out, t.skip);
copy(path.join(root, "shared"), path.join(t.out, "shared"));
console.log(`Built ${name} -> ${path.relative(root, t.out)}`);
