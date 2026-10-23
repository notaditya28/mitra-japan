import { lazy, Suspense } from 'react';

// The ingredient dictionary and sample scans are ~40 kB; keep them out of first paint.
const FoodScanPreview = lazy(() =>
  import('./FoodScanPreview').then((m) => ({ default: m.FoodScanPreview })),
);

export function LazyFoodScanPreview() {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className="min-h-64 rounded-2xl border border-blush bg-paper" />
      }
    >
      <FoodScanPreview />
    </Suspense>
  );
}
