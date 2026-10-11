"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { classifyPhoto, checkImageFile } from "@/lib/classify-client";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/validation/reports";
import type { ClassifyResponse } from "@/types/reports";
import { CATEGORY_LABELS } from "@/components/reports/labels";

const OUTCOME_TITLES: Record<ClassifyResponse["outcome"], string> = {
  garbage: "Garbage detected",
  unclear_category: "Garbage, but the type is unclear",
  not_garbage: "No garbage found",
  uncertain: "Not sure. Try a clearer photo",
};

function percent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function ClassifyPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    controllerRef.current?.abort();
    setBusy(false);
    setResult(null);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);

    const selected = event.target.files?.[0] ?? null;
    const problem = selected ? checkImageFile(selected) : null;
    const url = selected && !problem ? URL.createObjectURL(selected) : null;
    previewRef.current = url;
    setPreviewUrl(url);
    setFile(problem ? null : selected);
    setError(problem);
  }

  async function onClassify() {
    if (!file || busy) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const outcome = await classifyPhoto(file, controller.signal);
      if (outcome.ok) setResult(outcome.result);
      else setError(outcome.message);
    } catch {
      if (!controller.signal.aborted) setError("Something went wrong. Try again.");
    } finally {
      if (controllerRef.current === controller) setBusy(false);
    }
  }

  return (
    <section aria-labelledby="classify-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="classify-heading" className="text-lg font-medium">
          Classify a photo
        </h2>
        <p className="text-sm text-muted-foreground">
          Test the AI check. The photo is sent to the server for analysis only and is not saved.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row">
        <div className="flex flex-col gap-3 sm:w-72">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Photo (JPEG, PNG, or WebP, up to 4 MB)
            <input
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              onChange={onFileChange}
              className="text-sm font-normal file:mr-3 file:rounded-md file:border file:bg-background file:px-2.5 file:py-1 file:text-sm"
            />
          </label>
          {previewUrl && (
            <div className="relative aspect-4/3 overflow-hidden rounded-md border bg-muted">
              <Image src={previewUrl} alt="Selected photo" fill unoptimized className="object-contain" />
            </div>
          )}
          <Button onClick={onClassify} disabled={!file || busy} className="self-start">
            {busy ? "Classifying…" : "Classify"}
          </Button>
        </div>

        <div aria-live="polite" className="flex flex-1 flex-col gap-2 text-sm">
          {busy && <p className="text-muted-foreground">Asking the AI. This usually takes a few seconds…</p>}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {result && <ClassifyResultView result={result} />}
          {!busy && !error && !result && (
            <p className="text-muted-foreground">Choose a photo, then press Classify.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ClassifyResultView({ result }: { result: ClassifyResponse }) {
  if (result.outcome === "garbage") {
    const c = result.classification;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-base font-medium">{OUTCOME_TITLES.garbage}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Category</dt>
          <dd>{CATEGORY_LABELS[c.category]}</dd>
          <dt className="text-muted-foreground">Severity</dt>
          <dd className="capitalize">{c.severity}</dd>
          <dt className="text-muted-foreground">Confidence</dt>
          <dd>{percent(c.confidence)}</dd>
        </dl>
        <p>{c.description}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-medium">{OUTCOME_TITLES[result.outcome]}</p>
      <p className="text-muted-foreground">Confidence {percent(result.confidence)}</p>
      <p>{result.description}</p>
    </div>
  );
}
