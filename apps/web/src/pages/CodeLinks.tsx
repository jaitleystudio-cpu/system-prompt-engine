import { pathForView } from "../routing";

export function CodeLinks() {
  return (
    <ul className="spe-seo-links spe-code-links">
      <li>
        <a href={pathForView("home")}>System prompt engine foundation</a>
      </li>
      <li>
        <a href={pathForView("create")}>General task and multimodal prompt builder</a>
      </li>
      <li>
        <a href={pathForView("lab")}>Browse Daily Lab prompt specimens</a>
      </li>
      <li>
        <a href={pathForView("capabilities")}>Local execution contracts for code tools</a>
      </li>
      <li>
        <a href={pathForView("privacy")}>Private on-device screenshot processing</a>
      </li>
      <li>
        <a href={pathForView("my-work")}>Manage saved code prompt drafts</a>
      </li>
    </ul>
  );
}
