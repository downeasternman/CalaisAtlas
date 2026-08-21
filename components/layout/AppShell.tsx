import { Suspense } from "react";
import { AtlasExplorer } from "@/components/explorer/AtlasExplorer";

export function AppShell() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading…</div>}>
      <AtlasExplorer />
    </Suspense>
  );
}
