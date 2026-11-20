import { cp, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const files = [
  ["pdfjs-dist/build/pdf.worker.min.mjs", "pdf/pdf.worker.min.mjs"],
  ...["cmaps", "iccs", "standard_fonts", "wasm", "LICENSE"].map((name) => ["pdfjs-dist/" + name, "pdf/" + name]),
  ["tesseract.js/dist/worker.min.js", "ocr/worker.min.js"],
  ["tesseract.js/dist/worker.min.js.LICENSE.txt", "ocr/worker.min.js.LICENSE.txt"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "ocr/tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/LICENSE", "ocr/LICENSE"],
  ...["ind", "eng"].map((lang) => ["@tesseract.js-data/" + lang + "/4.0.0_best_int/" + lang + ".traineddata.gz", "ocr/" + lang + ".traineddata.gz"]),
  ["@neslinesli93/qpdf-wasm/dist/qpdf.js", "qpdf/qpdf.js"],
  ["@neslinesli93/qpdf-wasm/dist/qpdf.wasm", "qpdf/qpdf.wasm"],
  ["@neslinesli93/qpdf-wasm/LICENSE", "qpdf/LICENSE"],
];
await Promise.all(files.map(async ([source, destination]) => {
  const target = "public/runtime/" + destination;
  await mkdir(dirname(target), { recursive: true });
  await cp("node_modules/" + source, target, { recursive: true, preserveTimestamps: true });
}));
