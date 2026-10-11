import { MapIcon } from "lucide-react";

export function MapPlaceholder() {
  return (
    <section aria-labelledby="map-heading" className="flex flex-col gap-2">
      <h2 id="map-heading" className="text-lg font-medium">
        Map
      </h2>
      <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 p-6 text-center">
        <MapIcon aria-hidden className="size-8 text-muted-foreground" />
        <p className="font-medium">Interactive map coming next</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          An OpenStreetMap view with report markers, a density heat layer, and delay-weighted heat
          for unresolved reports will replace this placeholder.
        </p>
      </div>
    </section>
  );
}
