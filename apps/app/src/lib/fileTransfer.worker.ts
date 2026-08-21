/// <reference lib="webworker" />

interface StartTransferMessage {
  type: 'start-transfer';
  payload: { file: File; chunkSize: number };
}

interface PullChunkMessage {
  type: 'pull-chunk';
}

let activeFile: File | null = null;
let chunkSize = 0;
let offset = 0;

async function pullNext(): Promise<void> {
  if (!activeFile) return;
  if (offset >= activeFile.size) {
    self.postMessage({ type: 'transfer-done' });
    activeFile = null;
    return;
  }
  const end = Math.min(offset + chunkSize, activeFile.size);
  const chunk = await activeFile.slice(offset, end).arrayBuffer();
  offset = end;
  self.postMessage({
    type: 'chunk-data',
    chunk,
    progressOffset: offset,
    totalBytes: activeFile.size,
  }, { transfer: [chunk] });
}

self.onmessage = (event: MessageEvent<StartTransferMessage | PullChunkMessage>) => {
  if (event.data.type === 'start-transfer') {
    activeFile = event.data.payload.file;
    chunkSize = event.data.payload.chunkSize;
    offset = 0;
    void pullNext();
    return;
  }
  void pullNext();
};

export {};
