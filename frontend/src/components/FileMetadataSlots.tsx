"use client";

import type { ReactNode } from "react";
import { AddonSlot } from "./AddonSlot";
import { useAddonSlots } from "./AddonSlotsProvider";

type Part = "metadata" | "indicators";

interface SlotTarget {
  fileId: string;
  drive: string;
  filename: string;
  fileType?: string;
}

const isLoft = (filename: string) => filename.toLowerCase().endsWith(".loft");

const offersPart = (part: Part, { filename, fileType }: SlotTarget) =>
  part === "metadata" ? isLoft(filename) : fileType === "video" || isLoft(filename);

export function useHasFileMetadataSlots(target: SlotTarget): boolean {
  const { getSlotEntries } = useAddonSlots();
  return (["metadata", "indicators"] as const).some(
    (part) => offersPart(part, target) && getSlotEntries(`file-card-${part}`).length > 0,
  );
}

export function FileMetadataSlots({
  fileId,
  drive,
  filename,
  fileType,
  part,
}: SlotTarget & { part: Part }) {
  if (!offersPart(part, { fileId, drive, filename, fileType })) return null;
  return (
    <span className={part === "indicators" ? "ml-auto inline-flex shrink-0 items-center gap-1.5 empty:hidden" : "inline-flex min-w-0 items-center empty:hidden"}>
      <AddonSlot id={`file-card-${part}`} props={{ fileId, drive, filename, fileType }} />
    </span>
  );
}

/**
 * The line of small facts under a title. Without an addon filling the card
 * slots it is exactly `className` around `children`; with one, the facts and
 * the addon's entries share a row that keeps its indicators at the end.
 */
export function FileMetaLine({
  target,
  className,
  marked = false,
  children,
}: {
  target: SlotTarget;
  className: string;
  marked?: boolean;
  children: ReactNode;
}) {
  const hasSlots = useHasFileMetadataSlots(target);
  if (!hasSlots) {
    return (
      <div {...(marked ? { "data-file-meta": "" } : {})} className={className}>
        {children}
      </div>
    );
  }
  const nowrap = target.fileType === "video" || isLoft(target.filename);
  return (
    <div data-file-meta className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
      <div className={`flex min-w-0 flex-1 items-center gap-x-1.5 gap-y-0.5 ${nowrap ? "overflow-hidden whitespace-nowrap" : "flex-wrap"}`}>
        <FileMetadataSlots {...target} part="metadata" />
        {children}
      </div>
      <FileMetadataSlots {...target} part="indicators" />
    </div>
  );
}
