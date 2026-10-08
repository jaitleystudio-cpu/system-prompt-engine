import { pathForView } from "../routing";

export function CreateLinks() {
  return (
    <ul className="spe-seo-links spe-create-links">
      <li>
        <a href={pathForView("home")}>System prompt generator overview</a>
      </li>
      <li>
        <a href={pathForView("code")}>Screenshot-to-code prompt workflow</a>
      </li>
      <li>
        <a href={pathForView("lab")}>Explore Daily Lab prompt ideas</a>
      </li>
      <li>
        <a href={pathForView("capabilities")}>Execution contracts and local specs</a>
      </li>
      <li>
        <a href={pathForView("privacy")}>On-device privacy proofs and limits</a>
      </li>
      <li>
        <a href={pathForView("my-work")}>Saved local prompts and drafts</a>
      </li>
    </ul>
  );
}
