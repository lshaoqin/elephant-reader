export interface SavedWordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface SavedAudioEntry {
  audioBase64: string;
  audioMimeType?: string;
  timestamps?: SavedWordTimestamp[];
  sampleRate?: number;
}

export interface SavedTextBlock {
  text: string;
  vertices: { x: number; y: number }[];
}

export interface SavedExtractionResult {
  full_text: string;
  blocks: SavedTextBlock[];
  image_base64: string;
}

export interface SavedDocumentPayload {
  results: SavedExtractionResult[];
  formattedCache: Record<string, string>;
  formattedState: Record<string, boolean>;
  audioCache: Record<string, SavedAudioEntry>;
  currentPageIndex: number;
  selectedBlockIndex: number | null;
  savedAt: string;
}

export interface SavedDocumentSummary {
  id: string;
  title: string;
  pageCount: number;
  phoneNumber?: string;
  previewImageUrl?: string;
  updatedAtMs: number;
  createdAtMs: number;
}

export async function saveUserDocument(params: {
  existingDocumentId?: string | null;
  payload: SavedDocumentPayload;
  title?: string;
}): Promise<string> {
  const response = await fetch("/api/user-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      existing_document_id: params.existingDocumentId,
      title: params.title,
      payload: params.payload,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Failed to save document");
  }

  return data.documentId as string;
}

export async function listUserDocuments(): Promise<SavedDocumentSummary[]> {
  const response = await fetch("/api/user-files", { method: "GET" });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Failed to load saved files");
  }

  const documents = (data.documents || []) as Array<
    SavedDocumentSummary & { hasPreview?: boolean; previewImageUrl?: string | null }
  >;
  return documents.map((item) => ({
    id: item.id,
    title: item.title,
    pageCount: item.pageCount,
    phoneNumber: item.phoneNumber,
    updatedAtMs: item.updatedAtMs,
    createdAtMs: (item as SavedDocumentSummary & { createdAtMs?: number }).createdAtMs ?? item.updatedAtMs,
    previewImageUrl:
      item.previewImageUrl
        ? `${item.previewImageUrl}?v=${item.updatedAtMs}`
        : item.hasPreview
          ? `/api/user-files/${item.id}/preview?v=${item.updatedAtMs}`
          : undefined,
  }));
}

export async function deleteUserDocument(params: {
  documentId: string;
}): Promise<void> {
  const response = await fetch(`/api/user-files/${params.documentId}`, {
    method: "DELETE",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Failed to delete document");
  }
}

export async function loadUserDocument(params: {
  documentId: string;
}): Promise<SavedDocumentPayload> {
  const response = await fetch(`/api/user-files/${params.documentId}`, {
    method: "GET",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Failed to load saved file");
  }

  return data as SavedDocumentPayload;
}
