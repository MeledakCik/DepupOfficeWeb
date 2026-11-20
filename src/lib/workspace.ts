import { createStore, del, delMany, get, getMany, keys, set, setMany, update } from "idb-keyval";
import { getKind, type Kind } from "./catalog";
import { isDepupProtectedDocument } from "./protected-document";
import { appearanceDefaults, type Appearance } from "./appearance";

export type DocumentRecord = {
  id: string; name: string; kind: Kind; size: number; mime: string;
  saved: number; opened: number; source: "import" | "output";
  starred?: boolean; pinned?: boolean;
  depupProtected?: boolean;
};
export type StoredDocument = DocumentRecord & { data: Blob };
export type Output = { name: string; blob: Blob };
export type Preferences = Appearance & {
  paper: "A4" | "Letter"; margin: "normal" | "narrow"; textSize: number; lineHeight: number;
  gridlines: boolean; currency: string; autosum: boolean; zoom: number;
  reader: "natural" | "warm" | "night"; pdfLayout: "continuous" | "single";
};

export const defaults: Preferences = {
  ...appearanceDefaults,
  paper: "A4", margin: "normal", textSize: 12, lineHeight: 1.5,
  gridlines: true, currency: "IDR", autosum: false, zoom: 1, reader: "natural", pdfLayout: "continuous",
};

const records = createStore("depup-office-workspace", "documents");
const metadataKey = (id: string) => "meta:" + id;
const dataKey = (id: string) => "data:" + id;
const indexKey = (id: string) => "index:" + id;
const vaultStore = createStore("depup-office-vault", "items");
const signatureStore = createStore("depup-office-signatures", "items");

export function metadata(document: StoredDocument): DocumentRecord {
  const { data, ...record } = document;
  return { ...record, size: data.size };
}

export async function listDocuments() {
  const entries = (await keys<string>(records)).filter((key) => key.startsWith("meta:"));
  return (await getMany<DocumentRecord>(entries, records))
    .filter((item): item is DocumentRecord => Boolean(item)).sort((first, second) => second.opened - first.opened);
}

export async function readDocument(id: string) {
  const [storedMetadata, storedBlob] = await getMany<DocumentRecord | Blob | ArrayBuffer>([metadataKey(id), dataKey(id)], records);
  const record = storedMetadata as DocumentRecord | undefined;
  if (!record || !(storedBlob instanceof Blob || storedBlob instanceof ArrayBuffer)) throw new Error("Berkas ini tidak ditemukan.");
  const data = storedBlob instanceof Blob ? storedBlob : new Blob([storedBlob], { type: record.mime });
  if (record.depupProtected === undefined) {
    const depupProtected = await isDepupProtectedDocument(data);
    const classification: Pick<DocumentRecord, "kind" | "mime" | "depupProtected"> = depupProtected
      ? { depupProtected, kind: "pdf", mime: "application/pdf" }
      : { depupProtected, kind: record.kind, mime: record.mime };
    await updateDocument(id, classification).catch(() => {});
    return { ...record, ...classification, data };
  }
  return { ...record, data };
}

export async function writeDocument(document: StoredDocument) {
  const record = metadata(document);
  // Binary values avoid Blob and File clone errors in IndexedDB on WebKit.
  const data = await document.data.arrayBuffer();
  await setMany([[metadataKey(document.id), record], [dataKey(document.id), data]], records);
}

export async function updateDocument(id: string, change: Partial<DocumentRecord>) {
  await update<DocumentRecord>(metadataKey(id), (current) => {
    if (!current) throw new Error("Berkas ini tidak ditemukan.");
    return { ...current, ...change };
  }, records);
}

export async function openStoredDocument(id: string) {
  await updateDocument(id, { opened: Date.now() });
  return readDocument(id);
}

export async function deleteDocument(id: string) {
  await delMany([metadataKey(id), dataKey(id), indexKey(id)], records);
}

export const readSearchIndex = (id: string) => get<string>(indexKey(id), records);
export const writeSearchIndex = (id: string, text: string) => records("readwrite", (store) => new Promise<void>((resolve, reject) => {
  const check = store.getKey(metadataKey(id));
  check.onsuccess = () => { if (check.result !== undefined) store.put(text, indexKey(id)); };
  store.transaction.oncomplete = () => resolve();
  store.transaction.onabort = store.transaction.onerror = () => reject(store.transaction.error);
}));

export async function makeDocument(name: string, data: Blob, source: DocumentRecord["source"]): Promise<StoredDocument> {
  const depupProtected = await isDepupProtectedDocument(data);
  const mime = depupProtected ? "application/pdf" : data.type;
  const now = Date.now();
  return { id: crypto.randomUUID(), name, data, kind: getKind(name, mime), mime, size: data.size, saved: now, opened: now, source, depupProtected };
}

export function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  const units = size < 1024 ** 2 ? [1024, "KB"] as const : [1024 ** 2, "MB"] as const;
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(size / units[0])} ${units[1]}`;
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function shareFile(blob: Blob, name: string) {
  const files = [new File([blob], name, { type: blob.type })];
  if (typeof navigator.share !== "function" || !navigator.canShare?.({ files })) {
    download(blob, name);
    return false;
  }
  await navigator.share({ files });
  return true;
}

export type VaultItem = {
  id: string; salt: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer>;
  encrypted: ArrayBuffer; size: number; date: number;
};

async function vaultKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  const secret = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", iterations: 600_000, salt }, secret, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function lockFile(file: File, password: string) {
  if (password.length < 8) throw new Error("Gunakan kata sandi minimal 8 karakter.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await vaultKey(password, salt);
  const header = JSON.stringify({ name: file.name, type: file.type });
  const content = await new Blob([header, "\n", file]).arrayBuffer();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, content);
  const item = { id: crypto.randomUUID(), salt, iv, encrypted, size: file.size, date: Date.now() };
  await set(item.id, item, vaultStore);
  return item;
}

export async function unlockFile(item: VaultItem, password: string): Promise<Output> {
  let plaintext: Uint8Array<ArrayBuffer>;
  try {
    const key = await vaultKey(password, item.salt);
    plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: item.iv }, key, item.encrypted));
  } catch {
    throw new Error("Kata sandi salah atau berkas rusak.");
  }
  const end = plaintext.indexOf(10);
  const info = JSON.parse(new TextDecoder().decode(plaintext.subarray(0, end))) as { name: string; type: string };
  return { name: info.name, blob: new Blob([plaintext.subarray(end + 1)], { type: info.type }) };
}

export const listVault = async () => {
  const ids = await keys<string>(vaultStore);
  const entries = await Promise.all(ids.map((id) => get<VaultItem>(id, vaultStore)));
  return entries.filter((item): item is VaultItem => Boolean(item)).sort((a, b) => b.date - a.date);
};
export const removeVaultItem = (id: string) => del(id, vaultStore);

export type SignatureItem = { id: string; name: string; blob: Blob };
type StoredSignature = Omit<SignatureItem, "blob"> & { blob: Blob | ArrayBuffer; mime?: string };
export async function listSignatures() {
  const ids = await keys<string>(signatureStore);
  const values = await getMany<StoredSignature>(ids, signatureStore);
  return values.filter((entry): entry is StoredSignature => Boolean(entry)).map(({ id, name, blob, mime }) => ({
    id, name, blob: blob instanceof Blob ? blob : new Blob([blob], { type: mime }),
  }));
}
export async function putSignature({ id, name, blob }: SignatureItem) {
  await set(id, { id, name, blob: await blob.arrayBuffer(), mime: blob.type }, signatureStore);
}
export const deleteSignature = (id: string) => del(id, signatureStore);
