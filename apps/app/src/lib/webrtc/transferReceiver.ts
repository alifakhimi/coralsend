export interface FileMetadataPayload {
  id: string;
  name: string;
  size: number;
  type: string;
  uploaderId: string;
  uploaderName: string;
  uploadedAt: number;
  thumbnailUrl?: string;
}

interface FinalizeReceivedFileOptions {
  fileId: string;
  metadata: FileMetadataPayload;
  chunks: Array<ArrayBuffer | Blob>;
  mode: 'download' | 'copy';
  receivedTextFiles: Map<string, Blob>;
}

function downloadBlob(metadata: FileMetadataPayload, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = metadata.name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function copyTextBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(await blob.text());
    return true;
  } catch {
    return false;
  }
}

export async function finalizeReceivedFile(options: FinalizeReceivedFileOptions): Promise<void> {
  const { fileId, metadata, chunks, mode, receivedTextFiles } = options;
  const blob = new Blob(chunks, { type: metadata.type });
  const isText = metadata.type.startsWith('text/');
  if (isText) receivedTextFiles.set(fileId, blob);

  if (mode === 'copy' && isText) {
    if (await copyTextBlobToClipboard(blob)) return;
    // Clipboard permissions are optional; download remains the safe fallback.
  }
  downloadBlob(metadata, blob);
}
