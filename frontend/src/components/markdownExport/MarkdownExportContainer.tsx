"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import { AddonSlot } from "@/components/AddonSlot";
import { useAddonSlots } from "@/components/AddonSlotsProvider";
import { useDialogPortalTarget } from "@/components/DialogPortal";
import { useToast } from "@/components/ToastProvider";
import { useShortcuts } from "@/hooks/useShortcuts";
import { copyText } from "@/lib/copyText";
import { useExportSections, type ExportSectionProvider } from "@/lib/exportSections";
import { OVERLAY_PRIORITY } from "@/lib/shortcuts";
import type { FileItem } from "@/types";

import { buildExportDocument, exportDocumentMarkdown, exportGaps } from "./document";
import { gapLines } from "./gapLines";
import {
  MarkdownExportPresenter,
  type ExportText,
  type ExportView,
} from "./MarkdownExportPresenter";
import { runExport } from "./runExport";
import type { ExportResult } from "./types";

export const EXPORT_SECTIONS_SLOT = "markdown-export-sections";
const WAIT_FOR_PROVIDERS_MS = 5000;

interface MarkdownExportContainerProps {
  files: readonly FileItem[];
  drive: string;
  onClose: () => void;
}

interface Plan {
  providers: readonly ExportSectionProvider[];
  unavailable: readonly string[];
}

export function MarkdownExportContainer({
  files,
  drive,
  onClose,
}: MarkdownExportContainerProps) {
  const t = useTranslations("markdownExport");
  const tc = useTranslations("common");
  const toast = useToast();
  const target = useDialogPortalTarget();
  const { getSlotEntries, loading: slotsLoading } = useAddonSlots();
  const offered = useExportSections();

  // The selection may change under an open dialog; the document is of what was
  // selected when it opened.
  const [selected] = useState(files);

  const [timedOut, setTimedOut] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [opened, setOpened] = useState<ReadonlySet<number>>(new Set());

  useShortcuts(
    "markdown-export-dialog",
    "Dialog",
    [{ key: "escape", label: "Cancel", editingOnly: false, handler: onClose, hidden: true }],
    true,
    OVERLAY_PRIORITY,
  );

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), WAIT_FOR_PROVIDERS_MS);
    return () => clearTimeout(timer);
  }, []);

  // Providers are offered by slot entries that load lazily, so the set is
  // taken once every entry the slot lists has offered one, or when waiting
  // any longer would leave the viewer looking at a spinner.
  const offeredIds = new Set(offered.map((p) => p.id));
  const notOffered = getSlotEntries(EXPORT_SECTIONS_SLOT).filter((e) => !offeredIds.has(e.id));
  const ready = timedOut || (!slotsLoading && notOffered.length === 0);

  useEffect(() => {
    if (!ready || plan) return;
    setPlan({ providers: offered, unavailable: notOffered.map((e) => e.label) });
  }, [ready, plan, offered, notOffered]);

  useEffect(() => {
    if (!plan) return;
    const controller = new AbortController();
    void runExport({
      files: selected,
      drive,
      providers: plan.providers,
      unregistered: plan.unavailable,
      signal: controller.signal,
      onProgress: (done, total) => setProgress({ done, total }),
    }).then((finished) => {
      if (finished) setResult(finished);
    });
    return () => controller.abort();
  }, [plan, selected, drive]);

  const lines = useMemo(
    () => (result ? gapLines(exportGaps(result), result, t) : []),
    [result, t],
  );
  const document = useMemo(
    () =>
      result
        ? buildExportDocument(result, {
            title: (count) => t("documentTitle", { count }),
            added: t("added"),
          })
        : null,
    [result, t],
  );

  const copy = useCallback(async () => {
    if (!document) return;
    if (await copyText(exportDocumentMarkdown(document))) {
      toast.success(t("copied"));
    } else {
      toast.error(t("copyFailed"));
    }
  }, [document, toast, t]);

  const toggleVideo = useCallback((index: number) => {
    setOpened((prev) => {
      const next = new Set(prev);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }, []);

  const text: ExportText = {
    title: t("title"),
    close: tc("close"),
    cancel: tc("cancel"),
    continue: t("continue"),
    copy: t("copy"),
    preparing: t("preparing"),
    warningTitle: t("warningTitle"),
    warningLead: t("warningLead"),
    nothing: t("nothing"),
  };

  let view: ExportView;
  if (!result || !document) {
    view = progress
      ? { phase: "building", label: t("building", { done: progress.done, total: progress.total }) }
      : { phase: "preparing" };
  } else if (lines.length > 0 && !accepted) {
    view = { phase: "warning", lines };
  } else {
    view = {
      phase: "document",
      head: document.head,
      videos: document.videos.map((video, index) => ({ ...video, open: opened.has(index) })),
    };
  }

  if (!target) return null;
  return createPortal(
    <>
      <AddonSlot id={EXPORT_SECTIONS_SLOT} props={{ drive }} />
      <MarkdownExportPresenter
        text={text}
        view={view}
        onClose={onClose}
        onContinue={() => setAccepted(true)}
        onCopy={() => void copy()}
        onToggleVideo={toggleVideo}
      />
    </>,
    target,
  );
}
