"use client";

import { Captions, FileText, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";

export type MediaStatus = "ready" | "missing" | "working" | "error" | "unknown";

export function MediaIndicator({ kind, status }: {
  kind: "transcript" | "summary" | "comments";
  status: MediaStatus;
}) {
  const t = useTranslations("mediaIndicators");
  const Icon = { transcript: Captions, summary: FileText, comments: MessagesSquare }[kind];
  const label = `${t(kind)}: ${t(status)}`;
  return (
    <span role="img" aria-label={label} title={label} className={`media-indicator media-indicator-${status}`}>
      <Icon size={16} aria-hidden />
    </span>
  );
}
