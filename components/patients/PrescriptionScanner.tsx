"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Camera, Crop, RotateCcw, ScanLine, ZoomIn } from "lucide-react";
import { scanPrescription, type ScanResult } from "@/lib/ocr";
import { cropImageToBlob } from "@/lib/image-crop";
import { Spinner } from "@/components/ui/Spinner";

type Status = "idle" | "cropping" | "scanning" | "error";

const LOW_CONFIDENCE_THRESHOLD = 60;

// PRD Phase 7 (+ crop step added afterward): capture -> crop -> OCR, all
// client-side. The photo lives in component state only as an in-memory
// File/Blob/object-URL; it's never attached to any fetch call and gets
// discarded (URLs revoked, references dropped) on retake/unmount or the
// moment `onScanned` fires.
//
// The crop step exists because Tesseract's accuracy tracks how much of the
// frame is actually the label/text — a phone photo usually includes a lot of
// surrounding clutter (hands, clothing, background) at a shallow angle, and
// that alone can push a printed OPD slip's raw text into unreadable garbage
// (see PRD.md's Phase 7 OCR-quality note). Cropping tight to just the label
// before OCR runs is the single biggest lever a user has over scan quality —
// bigger than anything a regex tweak can fix after the fact.
export function PrescriptionScanner({
  onScanned,
}: Readonly<{ onScanned: (result: ScanResult) => void }>) {
  const [rawPreviewUrl, setRawPreviewUrl] = useState<string | null>(null);
  const [resultPreviewUrl, setResultPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lowConfidence, setLowConfidence] = useState(false);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const croppedAreaRef = useRef<Area | null>(null);
  const rawFileRef = useRef<File | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Revoke both object URLs on unmount/replacement — nothing lingers.
    return () => {
      if (rawPreviewUrl) URL.revokeObjectURL(rawPreviewUrl);
      if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
    };
  }, [rawPreviewUrl, resultPreviewUrl]);

  function selectFile(file: File) {
    if (rawPreviewUrl) URL.revokeObjectURL(rawPreviewUrl);
    rawFileRef.current = file;
    setRawPreviewUrl(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    croppedAreaRef.current = null;
    setErrorMessage(null);
    setLowConfidence(false);
    setStatus("cropping");
  }

  async function runScan(source: File | Blob) {
    if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
    setResultPreviewUrl(URL.createObjectURL(source));
    setStatus("scanning");
    setErrorMessage(null);
    try {
      const result = await scanPrescription(source);
      setLowConfidence(result.confidence < LOW_CONFIDENCE_THRESHOLD);
      setStatus("idle");
      onScanned(result);
    } catch {
      setStatus("error");
      setErrorMessage("Couldn't read that image. You can still fill the form in manually.");
    }
  }

  async function handleScanCrop() {
    if (!rawPreviewUrl || !croppedAreaRef.current) return;
    const blob = await cropImageToBlob(rawPreviewUrl, croppedAreaRef.current);
    await runScan(blob);
  }

  async function handleUseFullPhoto() {
    if (!rawFileRef.current) return;
    await runScan(rawFileRef.current);
  }

  function reset() {
    if (rawPreviewUrl) URL.revokeObjectURL(rawPreviewUrl);
    if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
    setRawPreviewUrl(null);
    setResultPreviewUrl(null);
    rawFileRef.current = null;
    croppedAreaRef.current = null;
    setStatus("idle");
    setErrorMessage(null);
    setLowConfidence(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <ScanLine className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium">Scan a prescription</h2>
      </div>
      <p className="mt-1 text-xs text-muted">
        Optional. Photograph the OPD slip to pre-fill the fields below — the photo stays on
        this device and is never uploaded; only the text you confirm gets saved.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) selectFile(file);
        }}
      />

      {status === "idle" && !rawPreviewUrl && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-primary"
        >
          <Camera className="h-4 w-4" />
          Take or choose a photo
        </button>
      )}

      {status === "cropping" && rawPreviewUrl && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Crop className="h-3.5 w-3.5" />
            Drag/pinch so the crop box covers just the label and handwriting — tighter is
            better for the scan.
          </p>
          <div className="relative h-64 w-full overflow-hidden rounded-md bg-black/80 sm:h-80">
            <Cropper
              image={rawPreviewUrl}
              crop={crop}
              zoom={zoom}
              aspect={undefined}
              objectFit="contain"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, areaPixels) => {
                croppedAreaRef.current = areaPixels;
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <ZoomIn className="h-3.5 w-3.5 shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleScanCrop}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-contrast"
            >
              <ScanLine className="h-4 w-4" />
              Scan this crop
            </button>
            <button
              type="button"
              onClick={handleUseFullPhoto}
              className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm hover:border-primary"
            >
              Use full photo instead
            </button>
            <button
              type="button"
              onClick={reset}
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-text"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retake
            </button>
          </div>
        </div>
      )}

      {(status === "scanning" || status === "error" || (status === "idle" && resultPreviewUrl)) && (
        <div className="mt-3 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultPreviewUrl ?? undefined}
            alt="Scanned prescription preview"
            className="h-24 w-24 rounded-md border border-border object-cover"
          />
          <div className="flex flex-1 flex-col gap-2">
            {status === "scanning" && <Spinner label="Reading prescription…" className="items-start text-left" />}
            {status === "error" && <p className="text-sm text-danger">{errorMessage}</p>}
            {status === "idle" && !errorMessage && (
              <p className="text-sm text-muted">
                {lowConfidence
                  ? "Scan quality was low — double-check every field below before saving."
                  : "Scanned — please verify details below before saving."}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              className="flex w-fit cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-text"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retake
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
