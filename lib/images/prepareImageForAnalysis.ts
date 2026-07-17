const maximumAnalysisImageDimension = 1280;
const jpegQuality = 0.85;

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

/**
 * Converts a local photo to a reasonably sized JPEG before it is sent to the
 * vision API. A 1280px long edge retains enough detail for a close-up face
 * while avoiding the cost of uploading full-resolution camera originals.
 */
export async function prepareImageForAnalysis(file: File): Promise<string> {
  if (file.type === 'image/svg+xml') {
    throw new Error('Please choose a photo in JPG, PNG, WebP, HEIC, or HEIF format.');
  }

  const image = await decodeImage(file);
  try {
    const { width, height } = image;
    if (!width || !height) {
      throw new Error('This photo could not be read. Please choose another image.');
    }

    const scale = Math.min(1, maximumAnalysisImageDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Your browser could not prepare this photo. Please try another image.');
    }

    // JPEG does not support alpha, so transparent image areas are rendered
    // against white rather than becoming black in the uploaded result.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image.source, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToJpegBlob(canvas);
    return readBlobAsDataUrl(blob);
  } finally {
    image.dispose();
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      // This applies the EXIF orientation from phone cameras before drawing.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close()
      };
    } catch {
      // Some browsers do not decode every camera format with createImageBitmap.
      // Fall back to the browser's image decoder before showing an upload error.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = 'async';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The selected file is not a supported image.'));
      element.src = objectUrl;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl)
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('This photo could not be prepared. Please choose another image.'));
    }, 'image/jpeg', jpegQuality);
  });
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This photo could not be prepared. Please choose another image.'));
    reader.readAsDataURL(blob);
  });
}
