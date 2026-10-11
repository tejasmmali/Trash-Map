"use client";

import { Camera, MapPin, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  createReportFieldsSchema,
  imageFileSchema,
} from "@/lib/validation/reports";

type ReportWasteSheetProps = {
  open: boolean;
  onClose: () => void;
  defaultLocation?: { lat: number; lng: number } | null;
};

type FormState = "idle" | "submitting" | "error" | "unavailable";

export function ReportWasteSheet({ open, onClose, defaultLocation }: ReportWasteSheetProps) {
  const formId = useId();
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    defaultLocation ?? null,
  );
  const [locating, setLocating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [state, setState] = useState<FormState>("idle");

  if (!open) return null;

  function assignImage(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      setFormError("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setFormError(null);
        setLocating(false);
      },
      () => {
        setFormError("Could not read your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!image) {
      setFormError("Add a photo of the waste.");
      return;
    }

    if (!location) {
      setFormError("Set your location to submit a report.");
      return;
    }

    const imageCheck = imageFileSchema.safeParse(image);
    if (!imageCheck.success) {
      setFormError(imageCheck.error.issues[0]?.message ?? "Invalid image.");
      return;
    }

    const fields = createReportFieldsSchema.safeParse({
      latitude: location.lat,
      longitude: location.lng,
      description: description.trim() || undefined,
    });
    if (!fields.success) {
      setFormError(fields.error.issues[0]?.message ?? "Location is invalid.");
      return;
    }

    setState("submitting");
    const body = new FormData();
    body.set("image", image);
    body.set("latitude", String(fields.data.latitude));
    body.set("longitude", String(fields.data.longitude));
    if (fields.data.description) body.set("description", fields.data.description);

    try {
      const res = await fetch("/api/reports", { method: "POST", body });
      if (res.status === 405) {
        setState("unavailable");
        setFormError("Report upload is not available yet. The API endpoint is still being built.");
        return;
      }
      if (!res.ok) {
        setState("error");
        setFormError("Could not submit the report. Try again later.");
        return;
      }
      setState("idle");
      onClose();
    } catch {
      setState("error");
      setFormError("Could not reach the server.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Dismiss report form"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="relative z-10 max-h-[min(92vh,40rem)] w-full overflow-auto rounded-t-2xl border border-white/10 bg-[var(--map-panel)] p-4 shadow-2xl sm:max-w-md sm:rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={`${formId}-title`} className="text-lg font-semibold text-[var(--map-fg)]">
              Report waste
            </h2>
            <p className="text-sm text-[var(--map-muted)]">
              Photo, location, and an optional note.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-[var(--map-fg)] hover:bg-white/10"
            aria-label="Close"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div>
            <p className="mb-2 text-sm text-[var(--map-muted)]">Photo</p>
            {preview ? (
              <div className="relative overflow-hidden rounded-xl border border-white/10">
                <img src={preview} alt="Selected waste photo preview" className="h-40 w-full object-cover" />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute right-2 top-2"
                  onClick={() => assignImage(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-[var(--map-muted)] hover:bg-white/5">
                <Camera aria-hidden className="size-6" />
                <span className="text-sm">Add photo</span>
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (!file) return;
                    if (file.size > MAX_IMAGE_BYTES) {
                      setFormError("Image must be 4 MB or smaller.");
                      return;
                    }
                    assignImage(file);
                    setFormError(null);
                  }}
                />
              </label>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--map-muted)]">Location</p>
            <Button
              type="button"
              variant="outline"
              className="h-11 border-white/15 bg-transparent text-[var(--map-fg)] hover:bg-white/10"
              onClick={useDeviceLocation}
              disabled={locating}
            >
              <MapPin />
              {locating ? "Getting location…" : location ? "Update location" : "Use my location"}
            </Button>
            <p className="text-xs text-[var(--map-muted)]" aria-live="polite">
              {location ? "Location ready for submission." : "Location is required to submit."}
            </p>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--map-muted)]">Description (optional)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={3}
              className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-[var(--map-fg)] outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            />
          </label>

          {formError && (
            <p role="alert" className="text-sm text-red-300">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            className="h-11 bg-[var(--map-accent)] text-[var(--map-accent-fg)] hover:bg-[var(--map-accent)]/90"
            disabled={state === "submitting"}
          >
            {state === "submitting" ? "Submitting…" : "Submit report"}
          </Button>
        </form>
      </div>
    </div>
  );
}
