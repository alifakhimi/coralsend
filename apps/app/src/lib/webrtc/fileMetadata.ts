const THUMBNAIL_MAX_SIZE = 200;

export interface FileIdentity {
  name: string;
  size: number;
  type: string;
  uploaderId: string;
}

export function sameFileIdentity(a: FileIdentity, b: FileIdentity): boolean {
  return a.uploaderId === b.uploaderId
    && a.name === b.name
    && a.size === b.size
    && (a.type || 'application/octet-stream') === (b.type || 'application/octet-stream');
}

export async function generateThumbnail(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return undefined;
  try {
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const image = new window.Image();
        image.onload = () => {
          const ratio = Math.min(1, THUMBNAIL_MAX_SIZE / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width * ratio);
          canvas.height = Math.round(image.height * ratio);
          canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        image.onerror = () => resolve(undefined);
        image.src = event.target?.result as string;
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });
  } catch {
    return undefined;
  }
}
