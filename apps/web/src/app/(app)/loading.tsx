import { BrandLoading } from "@/components/brand";

/**
 * Group-level loading boundary for the authenticated app. Routes that ship
 * their own skeleton `loading.tsx` override this; everything else gets the
 * Avion loading loop centered on the workspace canvas.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-950">
      <BrandLoading className="opacity-90" />
    </div>
  );
}
