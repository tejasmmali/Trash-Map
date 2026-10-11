import { DENSITY_SWATCHES, LAND_CELL_COLOR } from "./map-constants";

export function MapLegend() {
  return (
    <div className="pointer-events-none rounded-xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_92%,transparent)] px-3 py-2 text-xs text-[var(--map-fg)] shadow-sm backdrop-blur-md">
      <p className="mb-1.5 font-medium">Trash heat</p>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-[3px]"
            style={{ backgroundColor: LAND_CELL_COLOR }}
          />
          <span>Land</span>
        </li>
        {DENSITY_SWATCHES.map((swatch) => (
          <li key={swatch.key} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3 rounded-[3px] border border-black/25"
              style={{ backgroundColor: swatch.color }}
            />
            <span>{swatch.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
