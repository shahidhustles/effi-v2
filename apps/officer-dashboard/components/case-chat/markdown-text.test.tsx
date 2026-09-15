import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CitationAnchor } from "./markdown-text";

describe("CitationAnchor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the case chat open while revealing the cited evidence", () => {
    const dispatchEvent = vi.fn();
    const scrollIntoView = vi.fn();
    const getElementById = vi.fn(() => ({ scrollIntoView }));

    vi.stubGlobal("window", { dispatchEvent });
    vi.stubGlobal("document", { getElementById });

    const anchor = CitationAnchor({
      href: "#evidence-photo-1",
      children: "View evidence",
    }) as ReactElement<{ onClick: (event: { preventDefault: () => void }) => void }>;
    const preventDefault = vi.fn();

    anchor.props.onClick({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(getElementById).toHaveBeenCalledWith("evidence-photo-1");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });
});
