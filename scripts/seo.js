// Generates the static SEO landing pages, sitemap.xml, robots.txt and llms.txt into a build folder.
// Called from build.js. Each page targets one cluster of real search queries and links back to the tool.
const fs = require("fs");
const path = require("path");

const SITE = "https://trimlabel.vercel.app";
const NAME = "TrimLabel";
const TODAY = new Date().toISOString().slice(0, 10);

const COMMON_FAQ = [
  ["Is TrimLabel free?", "Yes. TrimLabel is completely free, with no login, no sign-up, no email and no trial limit."],
  ["Are my label PDFs uploaded anywhere?", "No. Trimming and layout happen inside your browser, so your PDFs and customer details never leave your device."],
];

const PAGES = [
  {
    slug: "flipkart-label-cropper",
    title: "Flipkart Label Cropper: Trim Flipkart Shipping Labels Free",
    desc: "Crop Flipkart shipping label PDFs online for free. Remove the invoice, keep the barcode sharp, and print 2, 4 or 6 labels per A4 sheet or on a 4x6 thermal printer. No login.",
    h1: "Flipkart label cropper: trim Flipkart shipping labels in seconds",
    answer: "TrimLabel is a free Flipkart label cropper. Drop your Flipkart shipping label PDFs into it and it cuts each page down to just the label, removes the invoice, and arranges the labels on A4 sheets or thermal pages ready to print. Nothing is uploaded; it all runs in your browser.",
    keywords: ["flipkart label cropper", "crop flipkart shipping label", "flipkart label trimmer", "flipkart label pdf cutter"],
    sections: [
      ["Why Flipkart labels need cropping", "Flipkart label PDFs usually put the shipping label and the invoice on the same page. Printing them as they are wastes paper and leaves you with a label that is hard to stick on a parcel. Cropping keeps only the label, so one sheet can carry several of them."],
      ["What TrimLabel does with a Flipkart PDF", "It recognises the Flipkart format automatically, trims the page to the label area, and edits the PDF directly instead of taking a screenshot, so the barcode stays sharp and scannable. You can add one file or hundreds in one go."],
    ],
    steps: ["Open TrimLabel and add your Flipkart label PDFs.", "Pick a layout: 2, 4 or 6 labels per A4 sheet, thermal 3x5 or 4x6, or PNG images.", "Click Create print file, download it and print."],
    faq: [
      ["How do I crop a Flipkart shipping label?", "Open TrimLabel, add the Flipkart label PDF, choose a layout and create the print file. The label is trimmed automatically and the invoice is removed."],
      ["Can I print Flipkart labels 4 per A4 page?", "Yes. Choose the 4 per sheet A4 layout (2 and 6 per sheet are also available), and turn on cut marks if you want guides for cutting."],
      ["Can I use a thermal printer for Flipkart labels?", "Yes. Pick Thermal 4x6 or Thermal 3x5 to get one label per page, sized for a thermal label printer."],
    ],
    related: ["meesho-label-cropper", "a4-multiple-labels-per-page", "thermal-4x6-label-printing"],
  },
  {
    slug: "meesho-label-cropper",
    title: "Meesho Label Cropper: Crop Meesho Shipping Labels Free",
    desc: "Free Meesho label cropper. Trim Meesho shipping label PDFs, remove the extra page content, and print many labels per A4 sheet or on 4x6 thermal paper. No sign-up.",
    h1: "Meesho label cropper: crop Meesho shipping labels for printing",
    answer: "TrimLabel is a free Meesho label cropper. Add your Meesho shipping label PDFs and it trims each one to the label, then lays them out on A4 sheets (2, 4 or 6 per page) or thermal pages. It works in your browser, so your orders are never uploaded.",
    keywords: ["meesho label cropper", "crop meesho label", "meesho label trimmer", "meesho shipping label pdf crop"],
    sections: [
      ["The problem with Meesho label PDFs", "A Meesho label PDF often has more on the page than the label you need to stick on the parcel. Printing the whole page for every order uses a lot of paper and slows down packing."],
      ["How TrimLabel handles Meesho labels", "TrimLabel has a Meesho template and detects Meesho files automatically when you upload them. It crops the page directly in the PDF, so barcodes stay crisp, and you can process a whole day's labels in one batch."],
    ],
    steps: ["Open TrimLabel and add your Meesho label PDFs.", "Check the detected marketplace and choose a layout.", "Create the print file, download it and print."],
    faq: [
      ["How do I crop Meesho labels?", "Add the Meesho label PDFs to TrimLabel, choose a layout and click Create print file. Each label is trimmed to size automatically."],
      ["Can I put multiple Meesho labels on one A4 page?", "Yes. TrimLabel can place 2, 4 or 6 labels on an A4 sheet, with optional cut marks."],
      ["Does it work for hundreds of Meesho labels at once?", "Yes. You can add one file or hundreds in a single batch."],
    ],
    related: ["flipkart-label-cropper", "label-cutter-online", "a4-multiple-labels-per-page"],
  },
  {
    slug: "amazon-label-cropper",
    title: "Amazon Shipping Label Cropper: Trim Amazon Labels Free",
    desc: "Crop Amazon shipping label PDFs online for free. Trim to the label, print several per A4 sheet or one per 4x6 thermal page. Runs in your browser, no login.",
    h1: "Amazon shipping label cropper: trim Amazon label PDFs",
    answer: "TrimLabel is a free Amazon shipping label cropper. Add your Amazon label PDFs and it trims each page to the label and arranges them for A4 sheets or thermal printers. Files are processed in your browser and never uploaded.",
    keywords: ["amazon label cropper", "crop amazon shipping label", "amazon label trimmer", "amazon label pdf cutter"],
    sections: [
      ["Cropping Amazon labels for printing", "Amazon label PDFs come as full pages. To print them compactly or on a thermal printer, you need the label area cut out of the page. TrimLabel does that without turning the label into a blurry image."],
      ["Layouts for Amazon sellers", "Choose 2, 4 or 6 labels per A4 sheet, Thermal 3x5 or 4x6 for one label per page, or export images as a ZIP. Cut marks are optional."],
    ],
    steps: ["Open TrimLabel and add your Amazon label PDFs.", "Pick the layout that matches your printer or paper.", "Create the print file, download it and print."],
    faq: [
      ["How do I crop an Amazon shipping label PDF?", "Add the PDF to TrimLabel, pick a layout and create the print file. The label is trimmed automatically."],
      ["Can I print Amazon labels on a thermal printer?", "Yes. Use Thermal 4x6 or Thermal 3x5 for one label per page."],
    ],
    related: ["thermal-4x6-label-printing", "a4-multiple-labels-per-page", "flipkart-label-cropper"],
  },
  {
    slug: "shiprocket-label-cropper",
    title: "Shiprocket Label Cropper: Trim Shiprocket Labels Free",
    desc: "Free Shiprocket label cropper. Trim Shiprocket shipping label PDFs, then print multiple labels per A4 sheet or one per 4x6 thermal page. No login, runs in your browser.",
    h1: "Shiprocket label cropper: trim and print Shiprocket labels",
    answer: "TrimLabel is a free Shiprocket label cropper. Add your Shiprocket label PDFs and it trims them to the label and lays them out on A4 sheets or thermal pages for printing. Processing happens in your browser, so nothing is uploaded.",
    keywords: ["shiprocket label cropper", "crop shiprocket label", "shiprocket label trimmer", "shiprocket label 4x6 print"],
    sections: [
      ["Shiprocket labels, ready to print", "Shiprocket labels can be printed as they are, but many sellers want several labels on one A4 sheet to save paper, or a clean one-per-page file for a thermal printer. TrimLabel does both."],
      ["Works alongside other marketplaces", "If you sell on several platforms, you can use the same tool for Flipkart, Meesho, Amazon and Shiprocket labels, with automatic detection of which one you uploaded."],
    ],
    steps: ["Open TrimLabel and add your Shiprocket label PDFs.", "Choose A4 (2, 4 or 6 per sheet) or thermal.", "Create the print file, download it and print."],
    faq: [
      ["How do I crop a Shiprocket label?", "Add the label PDF to TrimLabel, choose a layout and click Create print file."],
      ["Can I print Shiprocket labels on 4x6 paper?", "Yes. Choose Thermal 4x6 for one label per page."],
    ],
    related: ["thermal-4x6-label-printing", "label-cutter-online", "amazon-label-cropper"],
  },
  {
    slug: "a4-multiple-labels-per-page",
    title: "Print Multiple Labels on One A4 Page: Free A4 Label Sheet Generator",
    desc: "Free A4 label sheet generator. Put 2, 4 or 6 shipping labels on one A4 page from your PDFs, with optional cut marks. No login, files stay on your device.",
    h1: "Print multiple shipping labels on one A4 page",
    answer: "To print multiple shipping labels on one A4 page, add your label PDFs to TrimLabel, choose 2, 4 or 6 labels per sheet, and download the print file. TrimLabel trims each label, arranges them in a grid, and can add cut marks. It is free and runs in your browser.",
    keywords: ["a4 multiple labels generator", "print 4 labels on a4", "print 6 labels on one page", "a4 label sheet generator", "multiple labels per page"],
    sections: [
      ["Why put several labels on one sheet", "Printing one label per A4 page wastes paper. Putting 2, 4 or 6 labels on a sheet cuts the paper you use and makes packing faster, since you cut a stack of labels at once."],
      ["Grid options in TrimLabel", "TrimLabel offers a 2-up, 4-up (2 by 2) and 6-up (2 by 3) A4 grid. Turn on cut marks to get guides along each label edge, then cut with scissors or a paper trimmer."],
    ],
    steps: ["Add your shipping label PDFs.", "Choose 2, 4 or 6 labels per sheet.", "Keep cutting guides on if you want them, then create the print file and print."],
    faq: [
      ["How do I print 4 shipping labels on one A4 page?", "Add your label PDFs to TrimLabel and choose the 4 per sheet A4 layout. Download the file and print it on A4 paper."],
      ["Can I print 6 labels on one page?", "Yes. The 6 per sheet layout places labels in a 2 by 3 grid on A4."],
      ["Does it work with labels from any marketplace?", "TrimLabel has templates for Flipkart, Meesho, Amazon and Shiprocket labels, and detects which one you uploaded."],
    ],
    related: ["label-cutter-online", "flipkart-label-cropper", "meesho-label-cropper"],
  },
  {
    slug: "label-cutter-online",
    title: "Online Label Cutter and Label Trimming Tool for PDFs (Free)",
    desc: "Free online label cutter. Trim shipping label PDFs to just the label, remove the invoice, and get print-ready sheets in seconds. No login, nothing uploaded.",
    h1: "Online label cutter: trim shipping label PDFs to size",
    answer: "TrimLabel is a free online label cutter and label trimming tool. It crops marketplace shipping label PDFs down to the label itself, removes the invoice portion, and outputs print-ready A4 sheets, thermal pages or images. It runs entirely in your browser.",
    keywords: ["label cutter", "label trimming tool", "label cropper online", "pdf label cutter", "label trim"],
    sections: [
      ["What a label cutter does", "A label cutter or label trimmer takes a PDF page that holds a label plus other content, and keeps only the label. TrimLabel does this on the PDF itself, so the barcode is not turned into a low-quality picture."],
      ["Built for batches", "You can add one PDF or hundreds. Each file is detected and trimmed with the right template, then everything is combined into one print file."],
    ],
    steps: ["Add your label PDFs.", "Choose how you want the output: A4 grid, thermal page or images.", "Create the print file and download it."],
    faq: [
      ["What is the best free label cutter for shipping labels?", "TrimLabel is a free label cutter built for Flipkart, Meesho, Amazon and Shiprocket shipping labels. It needs no sign-up and keeps files on your device."],
      ["Does trimming reduce barcode quality?", "No. TrimLabel edits the PDF directly rather than converting it to an image, so barcodes stay sharp and scannable."],
    ],
    related: ["remove-invoice-from-shipping-label", "a4-multiple-labels-per-page", "flipkart-label-cropper"],
  },
  {
    slug: "thermal-4x6-label-printing",
    title: "Thermal 4x6 and 3x5 Label Printing from Shipping Label PDFs",
    desc: "Convert marketplace shipping label PDFs into 4x6 or 3x5 thermal label pages, one label per page. Free, no login, runs in your browser.",
    h1: "Print shipping labels on a 4x6 or 3x5 thermal printer",
    answer: "To print shipping labels on a thermal printer, add your label PDFs to TrimLabel and choose Thermal 4x6 or Thermal 3x5. Each label is trimmed and placed on its own page at that size, ready to send to your thermal label printer. It is free and works in your browser.",
    keywords: ["4x6 thermal label pdf", "3x5 thermal label", "thermal printer shipping label", "resize label to 4x6"],
    sections: [
      ["One label per page", "Thermal label printers feed rolls or fan-fold stacks of one label at a time. TrimLabel outputs a PDF with one trimmed label per page at 4x6 or 3x5 so it prints without scaling surprises."],
      ["Mixed marketplaces in one file", "Because TrimLabel detects the marketplace for each file, you can add Flipkart, Meesho, Amazon and Shiprocket labels together and get one thermal print file."],
    ],
    steps: ["Add your label PDFs.", "Choose Thermal 4x6 or Thermal 3x5.", "Create the print file and print it from your thermal printer's driver."],
    faq: [
      ["How do I convert a shipping label to 4x6?", "Add the PDF to TrimLabel, choose Thermal 4x6 and create the print file. Each label gets its own 4x6 page."],
      ["What is the difference between 4x6 and 3x5?", "They are two common thermal label sizes in inches. Pick the one that matches the label stock loaded in your printer."],
    ],
    related: ["shiprocket-label-cropper", "amazon-label-cropper", "label-cutter-online"],
  },
  {
    slug: "remove-invoice-from-shipping-label",
    title: "Remove the Invoice from a Shipping Label PDF (Free Tool)",
    desc: "Remove the invoice from Flipkart, Meesho, Amazon or Shiprocket shipping label PDFs and keep just the label. Free, no login, files stay on your device.",
    h1: "Remove the invoice from a shipping label PDF",
    answer: "To remove the invoice from a shipping label PDF, add the file to TrimLabel. It trims each page down to the label area, so the invoice is left out, and gives you a print-ready file. It is free and everything happens in your browser.",
    keywords: ["remove invoice from shipping label", "separate label and invoice pdf", "crop label from invoice pdf"],
    sections: [
      ["Label and invoice on one page", "Many marketplace PDFs put the shipping label and a tax invoice on the same page. If you only need the label for the parcel, cropping away the invoice saves paper and keeps customer billing details off the parcel."],
      ["How TrimLabel separates them", "TrimLabel uses a template for each marketplace to crop the page to the label area. The crop is applied to the PDF itself, so the label remains vector-sharp."],
    ],
    steps: ["Add the combined label and invoice PDF.", "Choose your output layout.", "Create the print file. The invoice area is trimmed away."],
    faq: [
      ["How do I remove the invoice from a label PDF?", "Upload the PDF in TrimLabel and create the print file; the page is cropped to the label so the invoice is removed."],
      ["Is my invoice data sent to a server?", "No. TrimLabel processes the PDF locally in your browser."],
    ],
    related: ["label-cutter-online", "flipkart-label-cropper", "meesho-label-cropper"],
  },
];

const PAGE_BY_SLUG = Object.fromEntries(PAGES.map((p) => [p.slug, p]));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

function renderPage(p) {
  const url = `${SITE}/${p.slug}`;
  const faq = [...p.faq, ...COMMON_FAQ];
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: p.title,
      description: p.desc,
      url,
      isPartOf: { "@type": "WebSite", name: NAME, url: SITE },
      about: { "@type": "WebApplication", name: NAME, url: SITE },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: NAME, item: SITE },
        { "@type": "ListItem", position: 2, name: p.h1, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: p.h1,
      step: p.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];
  const toc = [...p.sections.map(([h], i) => [`s${i + 1}`, h]), ["how", "How to do it"], ["faq", "FAQ"], ["related", "Related guides"]];
  const related = p.related
    .map((s) => `<li><a href="/${s}">${esc(PAGE_BY_SLUG[s].h1)}</a></li>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#1b1b39">
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.desc)}">
  <meta name="keywords" content="${esc(p.keywords.join(", "))}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${NAME}">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.desc)}">
  <meta property="og:url" content="${url}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="stylesheet" href="/shared/legal/legal.css">
  <link rel="stylesheet" href="/seo.css">
  <script type="application/ld+json">${json(ld)}</script>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/">
      <span class="brand-mark"><svg width="26" height="26" viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22V13a1 1 0 0 1 1-1h9M42 12h9a1 1 0 0 1 1 1v9M52 42v9a1 1 0 0 1-1 1h-9M22 52h-9a1 1 0 0 1-1-1v-9" stroke="#99B7FC" stroke-width="4.5"/><path d="M22 23h20M32 23v19" stroke="#fff" stroke-width="6"/></svg></span>
      ${NAME}
    </a>
    <a class="back" href="/#print">Open the free tool</a>
  </header>

  <div class="wrap">
    <nav class="toc" aria-label="On this page">
      <b>On this page</b>
${toc.map(([id, label]) => `      <a href="#${id}">${esc(label)}</a>`).join("\n")}
    </nav>

    <article>
      <span class="eyebrow">Guide</span>
      <h1>${esc(p.h1)}</h1>
      <p class="meta">Free tool &middot; No login &middot; Files stay on your device</p>

      <div class="summary">
        <b>The short answer</b>
        <p>${esc(p.answer)}</p>
      </div>
      <p><a class="btn" href="/#print">Trim my labels, it's free</a></p>

${p.sections.map(([h, t], i) => `      <h2 id="s${i + 1}">${esc(h)}</h2>
      <p>${esc(t)}</p>`).join("\n\n")}

      <h2 id="how">How to do it</h2>
      <ol>${p.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>

      <h2 id="faq">Frequently asked questions</h2>
${faq.map(([q, a]) => `      <h3>${esc(q)}</h3>
      <p>${esc(a)}</p>`).join("\n")}

      <h2 id="related">Related guides</h2>
      <ul>${related}</ul>
    </article>
  </div>

  <nav class="legal-nav" aria-label="Site links">
    <a href="/">${NAME}</a>
    <a href="/privacy">Privacy Policy</a>
    <a href="/terms">Terms of Use</a>
    <a href="/disclaimer">Disclaimer</a>
    <span>&copy; 2026 ${NAME}</span>
  </nav>
</body>
</html>
`;
}

function generate(outDir) {
  for (const p of PAGES) {
    const dir = path.join(outDir, p.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), renderPage(p));
  }

  const urls = ["", ...PAGES.map((p) => p.slug)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}/${u}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemap);

  const robots = `# Search and AI crawlers are welcome; the tool and guides are meant to be found.
User-agent: *
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
  fs.writeFileSync(path.join(outDir, "robots.txt"), robots);

  const llms = `# ${NAME}

> ${NAME} is a free, private, browser-based tool that trims marketplace shipping label PDFs (Flipkart, Meesho, Amazon, Shiprocket) and arranges them as 2, 4 or 6 labels per A4 sheet, thermal 3x5 or 4x6 pages, or PNG images. No login or sign-up. Files never leave the user's device.

## Tool
- [${NAME}](${SITE}/): the label trimming and print-layout tool

## Guides
${PAGES.map((p) => `- [${p.h1}](${SITE}/${p.slug}): ${p.desc}`).join("\n")}
`;
  fs.writeFileSync(path.join(outDir, "llms.txt"), llms);
}

module.exports = { generate, PAGES, SITE };
