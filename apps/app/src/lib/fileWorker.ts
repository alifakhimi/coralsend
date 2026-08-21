export function createFileWorker(): Worker {
  return new Worker(new URL('./fileTransfer.worker.ts', import.meta.url), { type: 'module' });
}
