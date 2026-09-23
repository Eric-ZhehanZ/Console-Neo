// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows a DOM snapshot of a real Console Neo window (public/ui/*.html),
 * rendered at the window's own size and scaled to fit.
 */
export function UiFrame({ src, width, height, label }: {
  src: string;
  width: number;
  height: number;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const element = box.current;
    if(!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  // The frame may finish loading before hydration attaches onLoad
  useEffect(() => {
    if(frame.current?.contentDocument?.readyState === "complete") setLoaded(true);
  }, [src]);

  return (
    <div
      ref={box}
      className={`ui-frame${loaded && scale > 0 ? " is-ready" : ""}`}
      style={{ aspectRatio: `${width} / ${height}` }}
      role="img"
      aria-label={label}
    >
      <iframe
        ref={frame}
        src={src}
        title={label}
        width={width}
        height={height}
        loading="lazy"
        tabIndex={-1}
        aria-hidden="true"
        onLoad={() => setLoaded(true)}
        style={{ transform: `scale(${scale})` }}
      />
    </div>
  );
}
