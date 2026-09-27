import { useEffect, useState } from "react";
import { dailyHeadlines, dailyHeroIndex, nextLocalMidnight } from "./dailyHero";

export function useDailyHero() {
  const [index, setIndex] = useState(() => dailyHeroIndex());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = new Date();
      setIndex(dailyHeroIndex(now));
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
    title: dailyHeadlines[index][0],
    accent: dailyHeadlines[index][1],
  };
}
