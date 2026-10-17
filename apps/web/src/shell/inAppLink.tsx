import type { MouseEvent, ReactNode } from "react";
import { pathForView, type AppView } from "../routing";

type Props = {
  view: AppView;
  onNavigate: (view: AppView) => void;
  className?: string;
  children: ReactNode;
};

/** Same-document navigation so an unsaved idea stays in React state. */
export function InAppLink({ view, onNavigate, className, children }: Props) {
  return (
    <a
      className={className}
      href={pathForView(view)}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        onNavigate(view);
      }}
    >
      {children}
    </a>
  );
}
