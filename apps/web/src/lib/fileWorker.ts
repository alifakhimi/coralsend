export function createFileWorker(): Worker {
  const code = `
    self.onmessage = async function(e) {
      if (e.data.type === 'start-transfer') {
        const { file, fileId, chunkSize, headerSize } = e.data.payload;
        let offset = 0;
        const totalBytes = file.size;
        
        // Encode the fileId header ONCE
        const encoder = new TextEncoder();
        const fileIdBytes = encoder.encode(fileId.padEnd(headerSize, ' '));

        const pullNext = async () => {
          if (offset >= totalBytes) {
            self.postMessage({ type: 'transfer-done' });
            return;
          }

          // Slice the next chunk from the File (disk I/O off-thread)
          const end = Math.min(offset + chunkSize, totalBytes);
          const chunkLen = end - offset;
          const chunkBlob = file.slice(offset, end);
          const buffer = await chunkBlob.arrayBuffer();
          
          // Assemble the final transmission buffer
          const outBuf = new Uint8Array(headerSize + chunkLen);
          outBuf.set(fileIdBytes, 0);
          outBuf.set(new Uint8Array(buffer), headerSize);
          
          offset = end;
          
          // Transfer the buffer ownership to avoid Main Thread memory duplication
          self.postMessage({ 
            type: 'chunk-data', 
            chunk: outBuf.buffer, 
            progressOffset: offset, 
            totalBytes: totalBytes 
          }, [outBuf.buffer]);
        };

        // Listen for backpressure-aware pull requests from Main Thread
        self.addEventListener('message', (msg) => {
          if (msg.data.type === 'pull-chunk') {
            pullNext();
          }
        });

        // Push the first chunk immediately
        pullNext();
      }
    };
  `;
  const blob = new Blob([code], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}
