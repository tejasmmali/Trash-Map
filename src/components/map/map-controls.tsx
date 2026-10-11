"use client";

import { Layers, LocateFixed, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LAYER_LABELS, type MapLayerMode } from "./map-constants";

type MapControlsProps = {
  layer: MapLayerMode;
  layersOpen: boolean;
  onToggleLayers: () => void;
  onLayerChange: (layer: MapLayerMode) => void;
  onLocate: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

const LAYERS = Object.keys(LAYER_LABELS) as MapLayerMode[];

const BUTTON_CLASS =
  "rounded-xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_94%,transparent)] text-[var(--map-fg)] shadow-sm backdrop-blur-md hover:bg-white/10";

export function MapControls({
  layer,
  layersOpen,
  onToggleLayers,
  onLayerChange,
  onLocate,
  onZoomIn,
  onZoomOut,
}: MapControlsProps) {
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_94%,transparent)] shadow-sm backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="rounded-none text-[var(--map-fg)] hover:bg-white/10"
          aria-label="Zoom in"
          onClick={onZoomIn}
        >
          <Plus />
        </Button>
        <div className="h-px bg-white/10" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="rounded-none text-[var(--map-fg)] hover:bg-white/10"
          aria-label="Zoom out"
          onClick={onZoomOut}
        >
          <Minus />
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className={BUTTON_CLASS}
        aria-label="Highlight my location on the world map"
        onClick={onLocate}
      >
        <LocateFixed />
      </Button>

      <div className="relative">
        {layersOpen && (
          <div
            role="menu"
            aria-label="Map layers"
            className="absolute bottom-0 right-[calc(100%+0.5rem)] w-48 rounded-xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_94%,transparent)] p-1.5 shadow-lg backdrop-blur-md"
          >
            {LAYERS.map((item) => (
              <button
                key={item}
                type="button"
                role="menuitemradio"
                aria-checked={layer === item}
                className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  layer === item
                    ? "bg-white/15 text-[var(--map-fg)]"
                    : "text-[var(--map-muted)] hover:bg-white/10 hover:text-[var(--map-fg)]"
                }`}
                onClick={() => onLayerChange(item)}
              >
                {LAYER_LABELS[item]}
              </button>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className={BUTTON_CLASS}
          aria-label="Map layers"
          aria-expanded={layersOpen}
          onClick={onToggleLayers}
        >
          <Layers />
        </Button>
      </div>
    </div>
  );
}
