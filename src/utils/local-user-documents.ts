import fs from "fs/promises";
import path from "path";

export interface LocalUserDocument {
  id: string;
  title: string;
  pageCount: number;
  phoneNumber?: string;
  previewText?: string;
  previewImageBase64?: string;
  createdAtMs: number;
  updatedAtMs: number;
  payload: Record<string, unknown>;
}

const DATA_DIR = path.join(process.cwd(), ".saved-documents");

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_") || "guest";
}

async function ensureStoreDirectory() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function getStoreFilePath(username: string) {
  return path.join(DATA_DIR, `${slugify(username)}.json`);
}

export async function listLocalUserDocuments(username: string): Promise<LocalUserDocument[]> {
  try {
    await ensureStoreDirectory();
    const filePath = getStoreFilePath(username);
    const data = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(data) as { documents?: LocalUserDocument[] };
    return Array.isArray(parsed.documents) ? parsed.documents : [];
  } catch {
    return [];
  }
}

export async function saveLocalUserDocument(username: string, document: LocalUserDocument) {
  await ensureStoreDirectory();
  const filePath = getStoreFilePath(username);
  const current = await listLocalUserDocuments(username);
  const next = (() => {
    const existingIndex = current.findIndex((item) => item.id === document.id);
    if (existingIndex === -1) {
      return [document, ...current];
    }

    const copy = [...current];
    copy[existingIndex] = document;
    return copy;
  })();

  await fs.writeFile(filePath, JSON.stringify({ documents: next }, null, 2), "utf-8");
  return document;
}

export async function getLocalUserDocument(username: string, documentId: string) {
  const documents = await listLocalUserDocuments(username);
  return documents.find((item) => item.id === documentId) || null;
}

export async function deleteLocalUserDocument(username: string, documentId: string) {
  const documents = await listLocalUserDocuments(username);
  const next = documents.filter((item) => item.id !== documentId);
  await ensureStoreDirectory();
  await fs.writeFile(path.join(DATA_DIR, `${slugify(username)}.json`), JSON.stringify({ documents: next }, null, 2), "utf-8");
}
