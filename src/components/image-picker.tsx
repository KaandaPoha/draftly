"use client";

/**
 * Image picker with a before-generate preview.
 *
 * This is the one client island on the image-to-content page. A file input
 * alone cannot show a preview, so this island keeps the selected file in
 * memory and shows it immediately. Everything else on the page — dropdowns,
 * validation errors from the server, the Generate button — is a plain
 * server-rendered form.
 *
 * The island never sends the file anywhere itself: the outer form posts it
 * to the API route, which re-validates the image on the server.
 */
import { useRef, useState, useEffect } from "react";
import { ImagePlus, X } from "lucide-react";

export function ImagePicker({
  name = "image",
  maxBytes,
}: {
  name?: string;
  maxBytes: number;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Revoke the object URL when it changes or unmounts, so the preview blob
  // never leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setError(null);

    if (!picked) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    // Client-side quick checks mirror the server's real validation. They are
    // a courtesy only — the server re-validates everything.
    if (picked.size > maxBytes) {
      setError(
        `That image is ${(picked.size / (1024 * 1024)).toFixed(1)} MB — the limit is ${Math.round(maxBytes / (1024 * 1024))} MB.`
      );
      setFile(null);
      setPreviewUrl(null);
      e.target.value = "";
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(picked.type)) {
      setError("Unsupported file type. Upload a JPEG, PNG, or WebP image.");
      setFile(null);
      setPreviewUrl(null);
      e.target.value = "";
      return;
    }

    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function onRemove() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      {!file && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface-2 px-6 py-8 text-center transition-colors hover:border-accent">
          <ImagePlus size={28} className="text-accent" aria-hidden />
          <span className="text-sm font-medium">
            Tap to choose an image
          </span>
          <span className="text-xs text-text-faint">
            JPEG, PNG, or WebP · up to {Math.round(maxBytes / (1024 * 1024))} MB
          </span>
          <input
            ref={inputRef}
            type="file"
            name={name}
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={onPick}
          />
        </label>
      )}

      {file && (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-text-faint">
                {(file.size / (1024 * 1024)).toFixed(2)} MB ·{" "}
                {file.type.replace("image/", "").toUpperCase()}
              </p>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs text-text-muted hover:border-danger hover:text-danger"
            >
              <X size={12} aria-hidden /> Remove
            </button>
          </div>
          {previewUrl && (
            /* eslint-disable-next-line @next/next/no-img-element -- the
               preview is a local blob URL, not a remote image; next/image
               cannot load one. */
            <img
              src={previewUrl}
              alt={`Preview of ${file.name}`}
              className="max-h-72 w-auto self-center rounded-lg border border-line object-contain"
            />
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
