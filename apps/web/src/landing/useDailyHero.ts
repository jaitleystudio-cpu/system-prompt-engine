import { useEffect, useState } from "react";
import { dailyHeadlines, dailyHeroIndex, nextLocalMidnight } from "./dailyHero";
import {
  getStoredQualifiedHero,
  type HeroCopyPackage,
} from "../engine/heroIntelligence/heroExperimentEngine";

export interface HeroContent {
  index: number;
  title: string;
  accent: string;
  support?: string;
  cta?: string;
}

export function useDailyHero(): HeroContent {
  const [index, setIndex] = useState(() => dailyHeroIndex());
  const [qualifiedHero, setQualifiedHero] = useState<HeroCopyPackage | null>(() =>
    getStoredQualifiedHero(),
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = new Date();
      setIndex(dailyHeroIndex(now));
      setQualifiedHero(getStoredQualifiedHero());
      clearTimeout(timer);
      // A local midnight (not a fixed 24-hour timer) also handles DST days.
      timer = setTimeout(
        update,
        Math.max(1, nextLocalMidnight(now) - now.getTime()),
      );
    };
    const resume = () => {
      if (!document.hidden) update();
    };
    update();
    window.addEventListener("pageshow", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pageshow", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  return {
    index,
    title: qualifiedHero ? qualifiedHero.title : dailyHeadlines[index][0],
    accent: qualifiedHero ? qualifiedHero.accent : dailyHeadlines[index][1],
    support: qualifiedHero?.support,
    cta: qualifiedHero?.cta,
  };
}
