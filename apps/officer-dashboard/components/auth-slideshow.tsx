"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const slides = [
  {
    src: "/auth/road-inspection.jpg",
    title: "From report to repair.",
    description: "Safer streets today. Stronger communities tomorrow.",
  },
  {
    src: "/auth/water-maintenance.jpg",
    title: "Field work, made visible.",
    description: "See confirmed reports, current ownership, and the cases that need attention.",
  },
  {
    src: "/auth/street-lighting.jpg",
    title: "A quieter way to stay accountable.",
    description: "One shared inbox for the work residents are waiting on.",
  },
] as const;

const SLIDE_DURATION_MS = 7_000;

export function AuthSlideshow() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = globalThis.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => globalThis.clearInterval(timer);
  }, [isPaused]);

  const currentSlide = slides[activeSlide] ?? slides[0];

  return (
    <section
      className="auth-story"
      aria-label="How Effi supports civic work"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="auth-story-images" aria-hidden="true">
        {slides.map((slide, index) => (
          <Image
            key={slide.src}
            className={`auth-story-image${activeSlide === index ? " is-active" : ""}`}
            src={slide.src}
            alt=""
            fill
            priority={index === 0}
            sizes="(max-width: 767px) 100vw, 58vw"
          />
        ))}
      </div>
      <div className="auth-story-scrim" aria-hidden="true" />
      <div className="auth-story-brand">
        <strong>Effi</strong>
        <span>People · Progress · Safer Communities</span>
      </div>
      <div className="auth-story-copy" aria-live="polite">
        <p>{currentSlide.title}</p>
        <span>{currentSlide.description}</span>
      </div>
      <div className="auth-story-controls" aria-label="Choose slideshow image">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            className={activeSlide === index ? "is-active" : ""}
            aria-label={`Show image ${index + 1}`}
            aria-pressed={activeSlide === index}
            onClick={() => setActiveSlide(index)}
          >
            {String(index + 1).padStart(2, "0")}
          </button>
        ))}
      </div>
      <div className="auth-tricolor" aria-hidden="true"><span /><span /><span /></div>
    </section>
  );
}
