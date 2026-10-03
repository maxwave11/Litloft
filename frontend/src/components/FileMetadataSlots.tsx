"use client";

import { AddonSlot } from "./AddonSlot";

export function FileMetadataSlots({ fileId, drive, filename, fileType, part }: {
  fileId: string;
  drive: string;
  filename: string;
  fileType?: string;
  part: "metadata" | "indicators";
}) {
  const loft = filename.toLowerCase().endsWith(".loft");
  if (part === "metadata" ? !loft : fileType !== "video" && !loft) return null;
  return (
    <span className={part === "indicators" ? "ml-auto inline-flex shrink-0 items-center gap-1.5 empty:hidden" : "inline-flex min-w-0 items-center empty:hidden"}>
      <AddonSlot id={`file-card-${part}`} props={{ fileId, drive, filename, fileType }} />
    </span>
  );
}
