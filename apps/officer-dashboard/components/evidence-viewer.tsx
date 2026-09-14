"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CaseEvidence } from "./case-detail-types";

export function EvidenceViewer({ evidence }: { evidence: readonly CaseEvidence[] }) {
  const [selectedEvidence, setSelectedEvidence] = useState<CaseEvidence | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!selectedEvidence) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedEvidence(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedEvidence]);

  return (
    <>
      <section className="overflow-hidden rounded-[10px] border border-line bg-surface" aria-labelledby="evidence-title">
        <div className="flex min-h-[82px] items-end justify-between gap-6 border-b border-line p-[18px] sm:min-h-[92px] sm:px-[26px] sm:py-[22px]">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-graphite">Accepted evidence</p>
            <h2 className="text-xl font-semibold tracking-[-0.015em] text-ink" id="evidence-title">What the citizen submitted</h2>
          </div>
          <span className="font-display text-xs text-graphite">{evidence.length} {evidence.length === 1 ? "item" : "items"}</span>
        </div>
        <div className="grid gap-px bg-line">
          {evidence.map((item) => (
            <figure id={`evidence-${item.attachmentId}`} className="m-0 bg-surface" key={item.attachmentId}>
              {item.url && item.mediaType.startsWith("image/") ? (
                <button
                  type="button"
                  className="group relative block w-full bg-transparent text-left focus-visible:outline-3 focus-visible:outline-offset-[-3px]"
                  onClick={() => setSelectedEvidence(item)}
                  aria-label="Open accepted photo"
                >
                  <span className="relative block aspect-[4/3] bg-fog">
                    <Image className="object-cover" src={item.url} alt="Accepted photo of the reported civic issue" fill sizes="(max-width: 680px) 100vw, 760px" />
                  </span>
                  <span className="absolute bottom-4 right-4 translate-y-1 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-panel transition-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:transition-none">View full image</span>
                </button>
              ) : (
                <div className="grid min-h-[260px] content-center justify-items-center bg-fog p-10 text-center sm:min-h-[340px]">
                  <p className="font-semibold">Image unavailable</p>
                  <span className="mt-2 max-w-[38ch] text-[13px] text-muted">{item.storageId ? "The Convex Storage object could not be resolved." : "This older report only has a local storage key."}</span>
                </div>
              )}
              <figcaption className="flex justify-between gap-5 px-[18px] py-3 text-[11px] text-muted">
                <span>Accepted photo</span>
                <span>{item.mediaType}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {selectedEvidence?.url ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Accepted evidence preview"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedEvidence(null);
            }
          }}
        >
          <div className="grid h-full max-h-[92dvh] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-3">
            <button ref={closeButtonRef} type="button" className="justify-self-end rounded-md bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-fog active:scale-[0.98]" onClick={() => setSelectedEvidence(null)}>
              Close preview
            </button>
            <div className="relative min-h-0 overflow-hidden rounded-lg bg-black/20">
              <Image className="object-contain" src={selectedEvidence.url} alt="Accepted photo of the reported civic issue" fill sizes="100vw" priority />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
