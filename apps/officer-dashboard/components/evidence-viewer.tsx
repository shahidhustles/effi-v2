import Image from "next/image";
import type { CaseEvidence } from "./case-detail-types";

export function EvidenceViewer({ evidence }: { evidence: readonly CaseEvidence[] }) {
  return (
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
              <div className="case-evidence-image">
                <Image src={item.url} alt="Accepted photo of the reported civic issue" fill sizes="(max-width: 900px) 100vw, 760px" />
              </div>
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
  );
}
