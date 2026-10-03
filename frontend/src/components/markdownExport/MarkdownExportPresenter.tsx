import { ChevronRight, Copy, Loader2, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/Button";

export interface ExportText {
  title: string;
  close: string;
  cancel: string;
  continue: string;
  copy: string;
  preparing: string;
  warningTitle: string;
  warningLead: string;
  nothing: string;
}

export interface ExportVideoView {
  heading: string;
  markdown: string;
  open: boolean;
}

export type ExportView =
  | { phase: "preparing" }
  | { phase: "building"; label: string }
  | { phase: "warning"; lines: readonly string[] }
  | { phase: "document"; head: string; videos: readonly ExportVideoView[] };

interface MarkdownExportPresenterProps {
  text: ExportText;
  view: ExportView;
  onClose: () => void;
  onContinue: () => void;
  onCopy: () => void;
  onToggleVideo: (index: number) => void;
}

const TEXT_BLOCK =
  "whitespace-pre-wrap break-anywhere font-mono text-xs leading-relaxed text-text-primary";

export function MarkdownExportPresenter({
  text,
  view,
  onClose,
  onContinue,
  onCopy,
  onToggleVideo,
}: MarkdownExportPresenterProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={text.title}
        className="relative mx-4 flex max-h-[90dvh] w-full max-w-wide flex-col rounded-2xl bg-bg-card shadow-lg animate-fade-in-scale"
      >
        <div className="flex items-center justify-between gap-3 border-b border-bg-border px-5 py-4">
          <h2 className="text-lg font-semibold text-text-primary">{text.title}</h2>
          <div className="flex items-center gap-2">
            {view.phase === "document" && (
              <Button variant="primary" onClick={onCopy}>
                <Copy size={14} />
                {text.copy}
              </Button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl p-1 text-text-muted hover:text-text-primary"
              aria-label={text.close}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {(view.phase === "preparing" || view.phase === "building") && (
            <p
              role="status"
              className="flex items-center gap-2 py-8 text-sm text-text-muted"
            >
              <Loader2 size={16} className="animate-spin" />
              {view.phase === "preparing" ? text.preparing : view.label}
            </p>
          )}

          {view.phase === "warning" && (
            <div role="alert">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <TriangleAlert size={16} className="text-text-muted" />
                {text.warningTitle}
              </h3>
              <p className="mb-3 text-sm text-text-muted">{text.warningLead}</p>
              <ul className="space-y-2 text-sm text-text-primary">
                {view.lines.map((line, i) => (
                  <li key={i} className="break-anywhere">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view.phase === "document" && (
            <div>
              <pre className={TEXT_BLOCK}>{view.head}</pre>
              {view.videos.length === 0 && (
                <p className="py-4 text-sm text-text-muted">{text.nothing}</p>
              )}
              <div className="mt-4 space-y-2">
                {view.videos.map((video, index) => (
                  <div key={index} className="rounded-xl bg-bg-elevated">
                    <button
                      type="button"
                      onClick={() => onToggleVideo(index)}
                      aria-expanded={video.open}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-text-primary hover:bg-bg-border/40"
                    >
                      <ChevronRight
                        size={14}
                        className={`shrink-0 transition-transform ${video.open ? "rotate-90" : ""}`}
                      />
                      <span className="break-anywhere">{video.heading}</span>
                    </button>
                    {video.open && (
                      <pre className={`${TEXT_BLOCK} px-3 pb-3`}>{video.markdown}</pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {view.phase === "warning" && (
          <div className="flex justify-end gap-3 border-t border-bg-border px-5 py-4">
            <Button variant="secondary" onClick={onClose}>
              {text.cancel}
            </Button>
            <Button variant="primary" onClick={onContinue} autoFocus>
              {text.continue}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
