/**
 * SPE Ω Vertical Before/After Diff Scroll Engine
 * High-performance, compositor-friendly bounded scroll reveal driver.
 * Uses requestAnimationFrame and IntersectionObserver to eliminate continuous React re-renders.
 */

import { useEffect, type RefObject, type MutableRefObject } from "react";

export function isPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function setCanvasSplitPct(canvas: HTMLElement | null, pct: number): void {
  if (!canvas) return;
  canvas.style.setProperty("--spe-split-pct", `${pct}%`);
}

export interface UseVerticalDiffScrollOptions {
  trackRef: RefObject<HTMLElement | null>;
  pinRef: RefObject<HTMLElement | null>;
  canvasRef: RefObject<HTMLElement | null>;
  isDraggingRef: MutableRefObject<boolean>;
  isManualOverrideRef: MutableRefObject<boolean>;
  lastScrollYRef: MutableRefObject<number>;
  lastPctRef: MutableRefObject<number>;
  onProgressChange: (pct: number) => void;
}

export function useVerticalDiffScroll({
  trackRef,
  pinRef,
  canvasRef,
  isDraggingRef,
  isManualOverrideRef,
  lastScrollYRef,
  lastPctRef,
  onProgressChange,
}: UseVerticalDiffScrollOptions): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isPrefersReducedMotion()) {
      onProgressChange(50);
      if (lastPctRef.current !== null) {
        lastPctRef.current = 50;
      }
      setCanvasSplitPct(canvasRef.current, 50);
      return;
    }

    let rafId: number | null = null;
    let isObserving = false;

    const handleScroll = () => {
      if (isDraggingRef.current) return;
      if (isManualOverrideRef.current) {
        if (Math.abs(window.scrollY - (lastScrollYRef.current ?? 0)) > 40) {
          isManualOverrideRef.current = false;
        } else {
          return;
        }
      }
      if (rafId !== null) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (!trackRef.current || !pinRef.current) return;

        const trackRect = trackRef.current.getBoundingClientRect();
        const pinRect = pinRef.current.getBoundingClientRect();
        const maxTravel = trackRect.height - pinRect.height;

        if (maxTravel > 15) {
          const stickyTop = parseFloat(window.getComputedStyle(pinRef.current).top) || 24;
          const scrolled = stickyTop - trackRect.top;
          const progress = Math.max(0, Math.min(1, scrolled / maxTravel));
          const newPct = Math.round(progress * 100);

          if (newPct !== lastPctRef.current) {
            lastPctRef.current = newPct;
            onProgressChange(newPct);
            setCanvasSplitPct(canvasRef.current, newPct);
          }
        }
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          if (!isObserving) {
            window.addEventListener("scroll", handleScroll, { passive: true });
            window.addEventListener("resize", handleScroll, { passive: true });
            isObserving = true;
            handleScroll();
          }
        } else {
          if (isObserving) {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleScroll);
            isObserving = false;
            if (rafId !== null) {
              window.cancelAnimationFrame(rafId);
              rafId = null;
            }
          }
        }
      },
      { rootMargin: "300px 0px" }
    );

    if (trackRef.current) {
      observer.observe(trackRef.current);
    }

    return () => {
      observer.disconnect();
      if (isObserving) {
        window.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
      }
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [trackRef, pinRef, canvasRef, isDraggingRef, isManualOverrideRef, lastScrollYRef, lastPctRef, onProgressChange]);
}

export function recordScrollPosition(
  lastScrollYRef: MutableRefObject<number>,
  isManualOverrideRef?: MutableRefObject<boolean>
): void {
  if (isManualOverrideRef) {
    isManualOverrideRef.current = true;
  }
  if (typeof window !== "undefined") {
    lastScrollYRef.current = window.scrollY;
  }
}

export function handleDiffSliderKeyDown(
  e: React.KeyboardEvent<HTMLElement>,
  canvas: HTMLElement | null,
  splitPct: number,
  setSplitPct: (updater: (prev: number) => number) => void,
  lastPctRef: MutableRefObject<number>,
  isManualOverrideRef: MutableRefObject<boolean>,
  lastScrollYRef: MutableRefObject<number>
): void {
  recordScrollPosition(lastScrollYRef, isManualOverrideRef);

  let next: number | null = null;
  if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
    next = Math.max(0, splitPct - 5);
  } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
    next = Math.min(100, splitPct + 5);
  } else if (e.key === "PageUp") {
    next = Math.max(0, splitPct - 15);
  } else if (e.key === "PageDown") {
    next = Math.min(100, splitPct + 15);
  } else if (e.key === "Home") {
    next = 0;
  } else if (e.key === "End") {
    next = 100;
  }

  if (next !== null) {
    e.preventDefault();
    const finalNext = next;
    lastPctRef.current = finalNext;
    setCanvasSplitPct(canvas, finalNext);
    setSplitPct(() => finalNext);
  }
}

