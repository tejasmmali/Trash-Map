"use client";

import { LocateFixed, MapPin } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { checkImageFile } from "@/lib/classify-client";
import { createReport } from "@/lib/reports-client";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/validation/reports";
import type { Report } from "@/types/reports";
import { CATEGORY_LABELS } from "./labels";

export type PickedLocation = { latitude: number; longitude: number; label?: string };

type Props = {
  location: PickedLocation | null;
  onLocationChange: (location: PickedLocation | null) => void;
  onCreated: (report: Report) => void;
};

type Feedback = { tone: "success" | "warning" | "error"; text: string } | null;

const MAX_DESCRIPTION = 1000;

export function ReportForm({ location, onLocationChange, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const inFlight = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const previewRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  function setPreview(url: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreviewUrl(url);
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    const problem = selected ? checkImageFile(selected) : null;
    setPreview(selected && !problem ? URL.createObjectURL(selected) : null);
    setFile(problem ? null : selected);
    setFeedback(problem ? { tone: "error", text: problem } : null);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setFeedback({ tone: "error", text: "This browser can't share its location. Pick a spot on the map instead." });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onLocationChange({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: "Your location",
        });
      },
      () => {
        setLocating(false);
        setFeedback({ tone: "error", text: "Couldn't get your location. Pick a spot on the map instead." });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || !file || !location) return;
    inFlight.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await createReport(
        { image: file, latitude: location.latitude, longitude: location.longitude, description },
        controller.signal,
      );
      if (result.kind === "created") {
        const report = result.report;
        const unclear = report.ai_analysis === null;
        setFeedback({
          tone: "success",
          text: unclear
            ? "Report saved as Other: the AI saw garbage but couldn't tell what kind."
            : `Report saved as ${CATEGORY_LABELS[report.category]}. It's now on the map and in the list.`,
        });
        setFile(null);
        setPreview(null);
        setDescription("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        onLocationChange(null);
        onCreated(report);
      } else {
        setFeedback({ tone: result.kind === "rejected" ? "warning" : "error", text: result.message });
      }
    } catch {
      // Aborted on unmount.
    } finally {
      inFlight.current = false;
      if (controllerRef.current === controller) setBusy(false);
    }
  }

  const missing = !file ? "Choose a photo." : !location ? "Set the location on the map." : null;

  return (
    <section aria-labelledby="report-form-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="report-form-heading" className="text-lg font-medium">
          Report garbage
        </h2>
        <p className="text-sm text-muted-foreground">
          Add a photo and the location. The AI checks the photo before the report is saved.
        </p>
      </div>

      <form onSubmit={submit} aria-busy={busy} className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row">
        <div className="flex flex-col gap-3 sm:w-72">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Photo (JPEG, PNG, or WebP, up to 4 MB)
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              onChange={onFileChange}
              disabled={busy}
              className="text-sm font-normal file:mr-3 file:rounded-md file:border file:bg-background file:px-2.5 file:py-1 file:text-sm"
            />
          </label>
          {previewUrl && (
            <div className="relative aspect-4/3 overflow-hidden rounded-md border bg-muted">
              <Image src={previewUrl} alt="Selected photo" fill unoptimized className="object-contain" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <span className="font-medium">Location</span>
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin aria-hidden className="size-4 shrink-0" />
                {location ? (
                  <span className="text-foreground tabular-nums">
                    {location.label ? `${location.label} · ` : ""}
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  </span>
                ) : (
                  "Click the map below or search for a place."
                )}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={busy || locating}>
                <LocateFixed aria-hidden />
                {locating ? "Locating…" : "Use my location"}
              </Button>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-medium">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <textarea
              value={description}
              maxLength={MAX_DESCRIPTION}
              rows={2}
              disabled={busy}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. Pile next to the bus stop, there for a week"
              className="rounded-md border bg-background px-2.5 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy || missing !== null}>
              {busy ? "Checking photo…" : "Submit report"}
            </Button>
            {!busy && missing && <span className="text-muted-foreground">{missing}</span>}
            {busy && <span className="text-muted-foreground">The AI check usually takes a few seconds…</span>}
          </div>

          <p
            role={feedback?.tone === "error" ? "alert" : "status"}
            className={
              feedback?.tone === "success"
                ? "text-emerald-700"
                : feedback?.tone === "warning"
                  ? "text-amber-700"
                  : "text-destructive"
            }
          >
            {feedback?.text}
          </p>
        </div>
      </form>
    </section>
  );
}
