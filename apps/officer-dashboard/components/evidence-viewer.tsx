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
      <section className="case-detail-section" aria-labelledby="evidence-title">
        <div className="case-detail-section-heading">
          <div>
            <p className="case-detail-kicker">Accepted evidence</p>
            <h2 id="evidence-title">What the citizen submitted</h2>
          </div>
          <span>{evidence.length} {evidence.length === 1 ? "item" : "items"}</span>
        </div>
        <div className="case-evidence-grid">
          {evidence.map((item) => (
            <figure id={`evidence-${item.attachmentId}`} className="case-evidence-item" key={item.attachmentId}>
              {item.url && item.mediaType.startsWith("image/") ? (
                <button
                  type="button"
                  className="case-evidence-button"
                  onClick={() => setSelectedEvidence(item)}
                  aria-label="Open accepted photo"
                >
                  <span className="case-evidence-image">
                    <Image src={item.url} alt="Accepted photo of the reported civic issue" fill sizes="(max-width: 680px) 100vw, 240px" />
                  </span>
                  <span className="case-evidence-view-label">View full image</span>
                </button>
              ) : (
                <div className="case-evidence-unavailable">
                  <p>Image unavailable</p>
                  <span>{item.storageId ? "The Convex Storage object could not be resolved." : "This older report only has a local storage key."}</span>
                </div>
              )}
              <figcaption>
                <span>Accepted photo</span>
                <span>{item.mediaType}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {selectedEvidence?.url ? (
        <div
          className="case-evidence-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Accepted evidence preview"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedEvidence(null);
            }
          }}
        >
          <div className="case-evidence-lightbox-content">
            <button ref={closeButtonRef} type="button" className="case-evidence-lightbox-close" onClick={() => setSelectedEvidence(null)}>
              Close preview
            </button>
            <div className="case-evidence-lightbox-image">
              <Image src={selectedEvidence.url} alt="Accepted photo of the reported civic issue" fill sizes="100vw" priority />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
