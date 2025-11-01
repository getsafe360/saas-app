// components/analyzer/FindingsGrid.tsx
import { ReactNode } from "react";

export function FindingsGrid({ columns }: { columns: ReactNode[] }) {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-8">
      <div className="grid gap-6 sm:grid-cols-2">
        {columns}
      </div>
    </section>
  );
}
