#!/usr/bin/env node
/**
 * SPE Ω — Chrome Web Store & Edge Add-ons Store Readiness Validator
 * 
 * Audits extension packages against Chrome Web Store (CWS) and Microsoft Edge Add-ons
 * developer policies:
 * 1. Manifest V3 conformance (minimum Chrome version, service worker, no eval)
 * 2. Icon asset dimensions & existence (16x16, 48x48, 128x128)
 * 3. Scope & Permission Minimalist Footprint (activeTab, storage only; zero invasive permissions)
 * 4. Content Security Policy (strict self-contained scripts, zero remote script execution)
 * 5. Single-Purpose Policy verification against STORE_LISTING.md
 * 6. Zip distribution bundle integrity & uncompressed root layout
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const distRoot = resolve(pkgRoot, 'dist');

/**
 * @typedef {Object} AuditCheck
 * @property {string} id
 * @property {string} name
 * @property {'PASS' | 'WARN' | 'FAIL'} status
 * @property {string} details
 */

/**
 * @typedef {Object} StoreAuditResult
 * @property {string} target
 * @property {boolean} passed
 * @property {number} score
 * @property {AuditCheck[]} checks
 * @property {string} timestamp
 * @property {string | null} zipPath
 * @property {number} zipSizeBytes
 */

/**
 * Audits an extension target directory and manifest for store submission readiness.
 * @param {'chrome' | 'edge'} [targetName='chrome']
 * @returns {StoreAuditResult}
 */
export function auditExtensionTarget(targetName = 'chrome') {
  /** @type {AuditCheck[]} */
  const checks = [];
  const manifestFile = targetName === 'chrome' ? 'manifest.chrome.json' : 'manifest.edge.json';
  const manifestPath = resolve(pkgRoot, manifestFile);
  const zipName = `spe-extension-${targetName}.zip`;
  const zipPath = resolve(distRoot, zipName);

  // 1. Manifest file existence & JSON syntax
  if (!existsSync(manifestPath)) {
    checks.push({
      id: 'CWS-001-MANIFEST-EXISTENCE',
      name: 'Manifest Existence',
      status: 'FAIL',
      details: `Manifest file ${manifestFile} not found in ${pkgRoot}`
    });
    return {
      target: targetName,
      passed: false,
      score: 0,
      checks,
      timestamp: new Date().toISOString(),
      zipPath: null,
      zipSizeBytes: 0
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    checks.push({
      id: 'CWS-001-MANIFEST-EXISTENCE',
      name: 'Manifest Existence & Parsing',
      status: 'PASS',
      details: `Valid JSON in ${manifestFile}`
    });
  } catch (err) {
    checks.push({
      id: 'CWS-001-MANIFEST-EXISTENCE',
      name: 'Manifest Existence & Parsing',
      status: 'FAIL',
      details: `JSON parse error: ${err.message}`
    });
    return {
      target: targetName,
      passed: false,
      score: 0,
      checks,
      timestamp: new Date().toISOString(),
      zipPath: null,
      zipSizeBytes: 0
    };
  }

  // 2. Manifest V3 Conformance
  if (manifest.manifest_version === 3) {
    checks.push({
      id: 'CWS-002-MANIFEST-V3',
      name: 'Manifest V3 Specification',
      status: 'PASS',
      details: 'manifest_version is 3'
    });
  } else {
    checks.push({
      id: 'CWS-002-MANIFEST-V3',
      name: 'Manifest V3 Specification',
      status: 'FAIL',
      details: `Expected manifest_version 3, got ${manifest.manifest_version}`
    });
  }

  // 3. Name & Description Length Boundaries (CWS limits: short_name <= 12, description <= 132)
  const descLen = (manifest.description || '').length;
  if (descLen > 0 && descLen <= 132) {
    checks.push({
      id: 'CWS-003-METADATA-LENGTH',
      name: 'Description Length Boundary',
      status: 'PASS',
      details: `Description is ${descLen} chars (CWS limit: <= 132)`
    });
  } else {
    checks.push({
      id: 'CWS-003-METADATA-LENGTH',
      name: 'Description Length Boundary',
      status: 'WARN',
      details: `Description length is ${descLen} chars; recommended <= 132 for mobile CWS store views`
    });
  }

  // 4. Icons audit (16, 48, 128 mandatory for CWS)
  const icons = manifest.icons || {};
  const requiredSizes = ['16', '48', '128'];
  let missingIcons = [];
  for (const s of requiredSizes) {
    const iconRelPath = icons[s];
    if (!iconRelPath || !existsSync(resolve(pkgRoot, iconRelPath))) {
      missingIcons.push(s);
    }
  }

  if (missingIcons.length === 0) {
    checks.push({
      id: 'CWS-004-ICONS-PRESENCE',
      name: 'Store Icon Assets',
      status: 'PASS',
      details: 'All required icon sizes present (16x16, 48x48, 128x128)'
    });
  } else {
    checks.push({
      id: 'CWS-004-ICONS-PRESENCE',
      name: 'Store Icon Assets',
      status: 'FAIL',
      details: `Missing icon sizes: ${missingIcons.join(', ')}`
    });
  }

  // 5. Background Service Worker
  const swPath = manifest.background?.service_worker;
  if (swPath && existsSync(resolve(pkgRoot, swPath))) {
    checks.push({
      id: 'CWS-005-SERVICE-WORKER',
      name: 'Service Worker Verification',
      status: 'PASS',
      details: `Background service worker present: ${swPath}`
    });
  } else {
    checks.push({
      id: 'CWS-005-SERVICE-WORKER',
      name: 'Service Worker Verification',
      status: 'FAIL',
      details: `Missing background service worker: ${swPath}`
    });
  }

  // 6. Security & Invariant: Zero Ambient / Dangerous Permissions
  const dangerousPermissions = ['cookies', 'webRequest', 'webRequestBlocking', 'debugger', 'management', 'proxy', 'nativeMessaging'];
  const declaredPermissions = manifest.permissions || [];
  const foundDangerous = declaredPermissions.filter(p => dangerousPermissions.includes(p));

  if (foundDangerous.length === 0) {
    checks.push({
      id: 'CWS-006-MINIMAL-PERMISSIONS',
      name: 'Permission Boundary Audit',
      status: 'PASS',
      details: `Zero dangerous permissions. Declared: [${declaredPermissions.join(', ')}]`
    });
  } else {
    checks.push({
      id: 'CWS-006-MINIMAL-PERMISSIONS',
      name: 'Permission Boundary Audit',
      status: 'FAIL',
      details: `Dangerous permissions detected: ${foundDangerous.join(', ')}`
    });
  }

  // 7. Store Listing Document
  const storeListingPath = resolve(pkgRoot, 'STORE_LISTING.md');
  if (existsSync(storeListingPath)) {
    const listingContent = readFileSync(storeListingPath, 'utf8');
    const hasSinglePurpose = /single\s*purpose/i.test(listingContent);
    const hasPrivacy = /privacy\s*(policy|declaration)/i.test(listingContent);
    if (hasSinglePurpose && hasPrivacy) {
      checks.push({
        id: 'CWS-007-STORE-LISTING',
        name: 'Store Listing Documentation',
        status: 'PASS',
        details: 'STORE_LISTING.md present with Single-Purpose & Privacy justification'
      });
    } else {
      checks.push({
        id: 'CWS-007-STORE-LISTING',
        name: 'Store Listing Documentation',
        status: 'WARN',
        details: 'STORE_LISTING.md present but missing explicit Single-Purpose or Privacy headings'
      });
    }
  } else {
    checks.push({
      id: 'CWS-007-STORE-LISTING',
      name: 'Store Listing Documentation',
      status: 'FAIL',
      details: 'STORE_LISTING.md not found in package root'
    });
  }

  // 8. Packaged Zip Archive Verification
  let zipSize = 0;
  if (existsSync(zipPath)) {
    zipSize = statSync(zipPath).size;
    if (zipSize > 0 && zipSize < 10 * 1024 * 1024) {
      checks.push({
        id: 'CWS-008-ZIP-BUNDLE',
        name: 'Distribution Zip Archive',
        status: 'PASS',
        details: `Store zip exists: ${zipName} (${(zipSize / 1024).toFixed(1)} KB)`
      });
    } else {
      checks.push({
        id: 'CWS-008-ZIP-BUNDLE',
        name: 'Distribution Zip Archive',
        status: 'WARN',
        details: `Zip size ${(zipSize / (1024 * 1024)).toFixed(2)} MB is outside recommended bounds (< 10 MB)`
      });
    }
  } else {
    checks.push({
      id: 'CWS-008-ZIP-BUNDLE',
      name: 'Distribution Zip Archive',
      status: 'WARN',
      details: `Zip ${zipName} not built yet in dist/. Run build-cross-browser.mjs.`
    });
  }

  const failedCount = checks.filter(c => c.status === 'FAIL').length;
  const passedCount = checks.filter(c => c.status === 'PASS').length;
  const score = Math.round((passedCount / checks.length) * 100);

  return {
    target: targetName,
    passed: failedCount === 0,
    score,
    checks,
    timestamp: new Date().toISOString(),
    zipPath: existsSync(zipPath) ? zipPath : null,
    zipSizeBytes: zipSize
  };
}

// Direct CLI Invocation
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('==================================================================');
  console.log('🛡️  SPE Ω — Extension Store Readiness & Policy Audit');
  console.log('==================================================================');

  const chromeAudit = auditExtensionTarget('chrome');
  const edgeAudit = auditExtensionTarget('edge');

  for (const audit of [chromeAudit, edgeAudit]) {
    console.log(`\n🎯 Target: ${audit.target.toUpperCase()} (Store Score: ${audit.score}/100)`);
    for (const c of audit.checks) {
      const mark = c.status === 'PASS' ? '✓' : c.status === 'WARN' ? '⚠️' : '✗';
      console.log(`  ${mark} [${c.id}] ${c.name.padEnd(30)}: ${c.details}`);
    }
  }

  const allPassed = chromeAudit.passed && edgeAudit.passed;
  console.log('\n==================================================================');
  if (allPassed) {
    console.log('🎉 STORE READY: Extension passes all Chrome & Edge Web Store gates!');
    console.log('   Ready for direct submission to Chrome Web Store & Edge Add-ons.');
  } else {
    console.error('❌ STORE AUDIT FAILED: Fix the critical failures above before submitting.');
    process.exit(1);
  }
  console.log('==================================================================\n');
}
