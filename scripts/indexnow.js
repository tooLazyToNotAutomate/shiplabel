// Tells IndexNow (Bing, Yandex and other participating engines) about every URL in the built sitemap.
// Run after each deploy:   node scripts/indexnow.js
//   --dry-run   print the payload without sending it
// The key file must already be live at KEY_LOCATION, or the engines reject the request.
const fs = require("fs");
const path = require("path");

const HOST = "trimlabel.vercel.app";
const KEY = process.env.INDEXNOW_KEY || "d2d2703e3ae749f5a0447125883398c7";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP = path.resolve(__dirname, "..", "dist", "web", "sitemap.xml");
const ENDPOINT = "https://api.indexnow.org/indexnow";

const xml = fs.readFileSync(SITEMAP, "utf8");
const urlList = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };

async function main() {
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  // 200 and 202 mean accepted. 403 means the key file is missing or wrong. 422 means a URL does not match HOST.
  console.log(`IndexNow responded ${res.status} ${res.statusText} for ${urlList.length} URLs`);
  if (!res.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("IndexNow submission failed:", err.message);
  process.exitCode = 1;
});
