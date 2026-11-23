import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchPage } from "@/components/customer/search-page";
import { PackageCardSkeleton } from "@/components/customer/package-card";

export const metadata: Metadata = { title: "검색 결과" };

function Fallback() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 py-6">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-line" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <PackageCardSkeleton key={i} layout="list" />
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <SearchPage />
    </Suspense>
  );
}
