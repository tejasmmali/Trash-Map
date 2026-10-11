export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Trash Map</h1>
      <p className="text-lg text-muted-foreground">
        Snap a photo of garbage, pin it on the map, and help Mumbai see which
        hotspots have been waiting the longest.
      </p>
      <p className="text-sm text-muted-foreground">
        Reporting, the map, and AI classification are under construction.
      </p>
    </main>
  );
}
