"use client";

import type { ComponentProps } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

const labelSwap =
  "col-start-1 row-start-1 flex w-max items-center gap-1.5 leading-none transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";
const labelSwapIn = "opacity-100 blur-none";
const labelSwapOut = "pointer-events-none select-none opacity-0 blur-[2px]";

function SwapLabel({
  active,
  children,
  className,
}: {
  active: 0 | 1;
  children: [React.ReactNode, React.ReactNode];
  className?: string;
}) {
  const first = useRef<HTMLSpanElement>(null);
  const second = useRef<HTMLSpanElement>(null);
  const layers = useMemo(() => [first, second], [first, second]);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const target = layers[active]?.current;
    if (!target) return undefined;
    const measure = () => setWidth(Math.ceil(target.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [active, layers]);

  return (
    <span
      style={width === null ? undefined : { width }}
      className={`grid overflow-x-clip transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${className ?? ""}`}
    >
      {children.map((layer, index) => (
        <span
          key={index}
          ref={layers[index]}
          aria-hidden={active !== index}
          className={`${labelSwap} ${active === index ? labelSwapIn : labelSwapOut}`}
        >
          {layer}
        </span>
      ))}
    </span>
  );
}

export function ThinkingIndicator({
  label,
  elapsed,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children" | "label" | "elapsed"> & {
  label: string;
  elapsed?: string;
}) {
  return (
    <div
      data-slot="thinking-indicator"
      className={`flex items-center gap-2.5 text-sm text-chat-graphite ${className ?? ""}`}
      {...props}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 animate-pulse rounded-full bg-chat-action motion-reduce:animate-none"
      />
      <SwapLabel active={0} className="relative inline-block leading-none">
        <span key={label} className="shimmer inline-block">{label}</span>
        <span aria-hidden />
      </SwapLabel>
      {elapsed !== undefined && (
        <span className="font-mono text-[11px] tracking-tight text-chat-muted tabular-nums">{elapsed}</span>
      )}
    </div>
  );
}
