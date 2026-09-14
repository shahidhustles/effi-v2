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
      className="relative order-2 min-h-[66dvh] overflow-hidden text-[#fbfbfa] isolate md:order-none md:min-h-[100dvh]"
      aria-label="How Effi supports civic work"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="absolute inset-0 -z-20" aria-hidden="true">
        {slides.map((slide, index) => (
          <Image
            key={slide.src}
            className={`object-cover saturate-[0.78] contrast-[0.96] transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${activeSlide === index ? "scale-[1.045] opacity-100" : "scale-[1.015] opacity-0 motion-reduce:scale-100"}`}
            src={slide.src}
            alt=""
            fill
            priority={index === 0}
            sizes="(max-width: 767px) 100vw, 58vw"
          />
        ))}
      </div>
      <div className="absolute inset-0 -z-10 bg-[#0b2541]/25" aria-hidden="true" />
      <div className="absolute left-8 top-8 hidden gap-2 text-white [text-shadow:0_1px_14px_rgb(9_31_55/0.24)] md:grid lg:left-[34px] lg:top-7">
        <strong className="font-display text-[34px] font-semibold leading-none tracking-[-0.055em]">Effi</strong>
        <span className="font-display text-[11px]">People / Progress / Safer Communities</span>
      </div>
      <div className="absolute bottom-[88px] left-[22px] w-[calc(100%-44px)] sm:left-8 sm:w-[calc(100%-64px)] md:bottom-auto md:top-[17%]" aria-live="polite">
        <p className="max-w-[9ch] text-balance font-display text-[clamp(3rem,5.4vw,4.875rem)] font-medium leading-[0.96] tracking-[-0.045em]">{currentSlide.title}</p>
        <span className="mt-[18px] block max-w-[30ch] text-lg leading-relaxed text-white/85">{currentSlide.description}</span>
      </div>
      <div className="absolute bottom-7 right-[22px] flex gap-[18px] sm:right-[30px]" aria-label="Choose slideshow image">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            className={`min-w-7 border-b bg-transparent py-[7px] text-[11px] transition-colors focus-visible:outline-2 motion-reduce:transition-none ${activeSlide === index ? "border-white text-white" : "border-white/40 text-white/65 hover:border-white hover:text-white"}`}
            aria-label={`Show image ${index + 1}`}
            aria-pressed={activeSlide === index}
            onClick={() => setActiveSlide(index)}
          >
            {String(index + 1).padStart(2, "0")}
          </button>
        ))}
      </div>
      <div className="absolute bottom-[38px] left-8 hidden gap-3 sm:flex lg:left-12" aria-hidden="true"><span className="h-1 w-[38px] rounded bg-[#f59a35]" /><span className="h-1 w-[38px] rounded bg-white/70" /><span className="h-1 w-[38px] rounded bg-[#2f966d]" /></div>
    </section>
  );
}
