/**
 * Inspiration Gallery and Experience Recipes.
 * Coupled with an Originality Firewall for clean brand remixing.
 */

export interface InspirationRecipe {
  id: string;
  title: string;
  originalBrand: string;
  category: string;
}

export function validateOriginalityFirewall(
  remixedSite: { metadata?: { title?: string } },
  sourceRecipe: { originalBrand: string },
): void {
  const forbiddenBrand = sourceRecipe.originalBrand.toLowerCase();
  const remixedTitle = (remixedSite?.metadata?.title || "").toLowerCase();

  if (remixedTitle.includes(forbiddenBrand)) {
    throw new Error(
      `ORIGINALITY_FIREWALL_VIOLATION: Remixed site retains source brand name: "${sourceRecipe.originalBrand}"`,
    );
  }
}
