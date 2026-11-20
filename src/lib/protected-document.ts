export const protectedDocumentTitle = "Dokumen Terlindungi Depup";
export const protectedDocumentMessage = "Dokumen ini hanya dapat dibuka di aplikasi Depup Office.";

const checks = new WeakMap<Blob, Promise<boolean>>();

async function inspectDocument(blob: Blob) {
  if (!(await blob.slice(0, 1024).text()).includes("%PDF-")) return false;

  const { PDFDocument, PDFName } = await import("pdf-lib");
  try {
    const document = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
    return document.catalog.has(PDFName.of("DepupSecureData"));
  } catch {
    return false;
  }
}

export function isDepupProtectedDocument(blob: Blob) {
  let result = checks.get(blob);
  if (!result) {
    result = inspectDocument(blob);
    checks.set(blob, result);
  }
  return result;
}

export async function findProtectedDocument(files: File[]) {
  for (const file of files) {
    if (await isDepupProtectedDocument(file)) return file;
  }
}
