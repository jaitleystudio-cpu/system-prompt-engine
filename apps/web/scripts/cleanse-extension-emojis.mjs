import fs from 'node:fs';

const file = 'packages/spe-extension/content.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove icon properties in OUTCOME_CAPABILITIES and VAULT
content = content.replace(/\s*icon:\s*"[^"]*",/g, '');

// 2. Remove emoji in badgeLabel
content = content.replace(/badgeLabel:\s*`⚡ SPE Lift:/g, 'badgeLabel: `SPE Lift:');

// 3. Clean prompt injection toast
content = content.replace('showToast("Prompt Injected & Ready! ⚡");', 'showToast("Prompt injected successfully");');

// 4. Clean toast styling
const oldToast = `    toast.style.cssText = \`
      position: fixed;
      bottom: 90px;
      right: 32px;
      background: linear-gradient(135deg, #00d2ff, #3a7bd5);
      color: #0f172a;
      font-weight: 700;
      font-size: 13px;
      padding: 10px 18px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,210,255,0.5);
      z-index: 10000000;
      transition: all 0.3s;
    \`;`;

const newToast = `    toast.style.cssText = \`
      position: fixed;
      bottom: 90px;
      right: 32px;
      background: #18181b;
      color: #f4f4f5;
      border: 1px solid rgba(255, 255, 255, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Geist", system-ui, sans-serif;
      font-weight: 500;
      font-size: 12.5px;
      letter-spacing: -0.01em;
      padding: 9px 16px;
      border-radius: 10px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      z-index: 10000000;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    \`;`;
content = content.replace(oldToast, newToast);

// 5. Trigger Pill
content = content.replace(
  `  pill.innerHTML = \`
    <span>⚡ SPE Prompts</span>
    <span class="spe-badge">1-Click</span>
  \`;`,
  `  pill.innerHTML = \`
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
    <span>SPE Prompts</span>
  \`;`
);

// 6. Drawer header
content = content.replace(
  `      <div class="spe-header">
        <div class="spe-header-title">
          <span>⚡ System Prompt Engine</span>
          <span class="spe-shield-badge">🛡️ Hallucination Shield</span>
        </div>
        <button class="spe-close-btn" id="spe-close-btn">✕</button>
      </div>`,
  `      <div class="spe-header">
        <div class="spe-header-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>System Prompt Engine</span>
          <span class="spe-shield-badge">Invariant Shield</span>
        </div>
        <button class="spe-close-btn" id="spe-close-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>`
);

// 7. Prompt card contents
content = content.replace(`                  <span>\${p.icon}</span>\n                  <span>\${p.title}</span>`, `                  <span>\${p.title}</span>`);
content = content.replace(`Inject ⚡`, `Inject`);
content = content.replace(`Compile & Inject to \${platform} 🚀`, `Compile & Inject to \${platform}`);
content = content.replace(`<span>👍 \${p.upvotes.toLocaleString()}</span>`, `<span>\${p.upvotes.toLocaleString()} verified</span>`);
content = content.replace(`<span style="font-size: 11px; color: #34d399;">✓ Invariant Sound</span>`, `<span style="font-size: 11px; color: #10b981;">Sound</span>`);

// 8. In-chat lift badge
content = content.replace(`const icon = OUTCOME_CAPABILITIES[result.capabilityId]?.icon || "⚡";\n\n    liftContainer.innerHTML = \`
      <div class="spe-lift-badge">
        <div class="spe-lift-info">
          <span class="spe-lift-icon">\${icon}</span>
          <span class="spe-lift-label">\${result.capabilityName}</span>
          <span class="spe-lift-desc">• Elevate into verified 2026 specification</span>
        </div>
        <button class="spe-lift-action-btn" id="spe-lift-apply-btn">
          Enhance 1-Click 🚀
        </button>
        <button class="spe-lift-dismiss-btn" id="spe-lift-dismiss-btn" title="Dismiss">
          ✕
        </button>
      </div>
    \`;`,
`    liftContainer.innerHTML = \`
      <div class="spe-lift-badge">
        <div class="spe-lift-info">
          <span class="spe-lift-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          </span>
          <span class="spe-lift-label">\${result.capabilityName}</span>
          <span class="spe-lift-desc">• Compile into verified specification</span>
        </div>
        <button class="spe-lift-action-btn" id="spe-lift-apply-btn">
          Enhance Specification
        </button>
        <button class="spe-lift-dismiss-btn" id="spe-lift-dismiss-btn" title="Dismiss">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    \`;`);

content = content.replace(`showToast(\`⚡ Elevated into \${result.capabilityName}!\`);`, `showToast(\`Specification elevated: \${result.capabilityName}\`);`);

// 9. Daily usage badge
content = content.replace(`badge.textContent = stats.isPro ? "Pro ⚡" : \`\${stats.remaining}/15 Free\`;`, `badge.textContent = stats.isPro ? "Pro" : \`\${stats.remaining}/15 Free\`;`);

// 10. Selection action triggers
content = content.replaceAll(`showDiffHologram(activeSelection, "humanize", "✍️ Humanized & De-AI'd");`, `showDiffHologram(activeSelection, "humanize", "Editorial Polish");`);

// 11. Usage pledge
content = content.replace(`? "⚡ SPE Pro Active • Unlimited Specifications"
        : \`⚡ Free Action (\${usage.count + 1}/\${usage.limit} Today)\`;`,
`? "SPE Pro Active • Unlimited Specifications"
        : \`Free Action (\${usage.count + 1}/\${usage.limit} Today)\`;`);

// 12. Copy and apply toasts
content = content.replaceAll(`showToast("Polished & Copied to Clipboard! 📋");`, `showToast("Copied to clipboard");`);
content = content.replace(`showToast("Auto-Action Applied ✓ (10x Return Delivered)");`, `showToast("Specification applied");`);

// 13. Action labels mapping
content = content.replace(`      const labels = {
        humanize: "✍️ Humanized & De-AI'd",
        fluent: "🔄 Fluent Rephrase",
        grammar: "🛡️ Flow & Grammar Polish",
        executive: "🎯 Executive Polish",
        promptify: "⚡ SPE Promptify"
      };

      showDiffHologram(activeSelection, action, labels[action] || "⚡ Auto-Action");`,
`      const labels = {
        humanize: "Editorial Polish",
        fluent: "Fluent Rephrase",
        grammar: "Flow Polish",
        executive: "Executive Tone",
        promptify: "Specification Lift"
      };

      showDiffHologram(activeSelection, action, labels[action] || "Auto-Action");`);

// 14. Log line
content = content.replace(`console.log("⚡ SPE Companion loaded into " + getHostPlatform() + " with Specification Lift & 10/10 Live Diff Hologram");`, `console.log("SPE Companion active on " + getHostPlatform());`);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully cleansed content.js of all emojis and sales slogans!');
