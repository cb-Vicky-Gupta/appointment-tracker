// Canvas-based crop for the "crop before scanning" step
// (components/patients/PrescriptionScanner.tsx). Everything here runs
// in-memory in the browser via <canvas> — same as the rest of the OCR
// pipeline (lib/ocr.ts), nothing is ever sent anywhere.

export interface CropPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't load image for cropping"));
    image.src = src;
  });
}

/** Draws just the cropped pixel region onto a same-size canvas and returns
 *  it as a JPEG Blob — the crop react-easy-crop reports back is already in
 *  source-image pixel coordinates, so no extra scaling math is needed here. */
export async function cropImageToBlob(imageSrc: string, crop: CropPixels): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't export cropped image"))),
      "image/jpeg",
      0.92
    );
  });
}
