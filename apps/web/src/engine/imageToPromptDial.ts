/**
 * SPE Ω — Image to Prompt: 3D Lighting Vector Dial & Visual DNA Engine
 * 
 * 1. 3D Lighting Vector Dial (Volumetric, Rim, Golden Hour, Cyberpunk Neon, Studio 3-Point, Chiaroscuro, etc.)
 * 2. Visual DNA Chromosomes Extraction (Optics, Focal Length, Bokeh, Medium, Composition)
 * 3. Real-Time Multi-Model Dialect Modulation across:
 *    - Midjourney v6.1 (--ar 16:9, --style raw, --v 6.1, --s 250)
 *    - FLUX.1 [dev] (guidance scale, ray-traced lighting tokens, tactile textures)
 *    - SDXL (Positive & Negative prompt pairing)
 *    - DALL-E 3 (descriptive naturalistic narrative framing)
 */

export type LightingVectorKey =
  | 'volumetric'
  | 'rim_backlit'
  | 'golden_hour'
  | 'cyberpunk_neon'
  | 'studio_3point'
  | 'chiaroscuro'
  | 'overcast_soft'
  | 'rembrandt';

export interface LightingVectorSetting {
  key: LightingVectorKey;
  label: string;
  temperatureK: number;
  angleDegrees: number;
  intensity: number; // 0.0 - 1.0
  descriptor: string;
  shadowFalloff: string;
}

export interface VisualDnaChromosomes {
  optics: string;       // e.g. "Hasselblad H6D-100c Medium Format"
  focalLength: string;  // e.g. "85mm f/1.2 Prime Lens"
  bokeh: string;        // e.g. "Creamy shallow depth-of-field, 9-blade circular aperture"
  medium: string;       // e.g. "35mm Kodak Portra 400 analog grain"
  composition: string;  // e.g. "Rule of thirds, low-angle dynamic perspective"
  subject: string;      // e.g. "Sovereign obsidian mainframe monolith with electric cyan telemetry glow"
}

export interface ModulatedModelPrompts {
  lighting: LightingVectorSetting;
  chromosomes: VisualDnaChromosomes;
  midjourneyV61: string;
  flux1Dev: string;
  sdxl: {
    positive: string;
    negative: string;
  };
  dalle3: string;
}

export const LIGHTING_PRESETS: Record<LightingVectorKey, LightingVectorSetting> = {
  volumetric: {
    key: 'volumetric',
    label: 'Volumetric God Rays',
    temperatureK: 5500,
    angleDegrees: 45,
    intensity: 0.9,
    descriptor: 'crepuscular volumetric shafts of light cutting through subtle atmospheric haze and dust motes',
    shadowFalloff: 'dramatic deep ray-marched shadows',
  },
  rim_backlit: {
    key: 'rim_backlit',
    label: 'Rim Light & Silhouette',
    temperatureK: 6500,
    angleDegrees: 180,
    intensity: 0.95,
    descriptor: 'sculpted edge specular rim lighting carving silhouette edges against deep obsidian darkness',
    shadowFalloff: 'sharp edge separation with pitch black core shadow',
  },
  golden_hour: {
    key: 'golden_hour',
    label: 'Golden Hour (3200K)',
    temperatureK: 3200,
    angleDegrees: 15,
    intensity: 0.85,
    descriptor: 'warm low-angle raking sunlight, warm amber and gold tones with long soft ambient shadows',
    shadowFalloff: 'elongated warm diffused shadows',
  },
  cyberpunk_neon: {
    key: 'cyberpunk_neon',
    label: 'Cyberpunk Neon Split',
    temperatureK: 8000,
    angleDegrees: 90,
    intensity: 1.0,
    descriptor: 'high-contrast dual split lighting: cyan key light on left face, vibrant magenta rim light on right',
    shadowFalloff: 'colorful neon specular reflections in puddle mirrors',
  },
  studio_3point: {
    key: 'studio_3point',
    label: 'Studio 3-Point Setup',
    temperatureK: 5600,
    angleDegrees: 30,
    intensity: 0.8,
    descriptor: 'balanced commercial studio 3-point lighting with softbox key light, subtle fill, and crisp kicker hair light',
    shadowFalloff: 'gradual studio gradient soft shadows',
  },
  chiaroscuro: {
    key: 'chiaroscuro',
    label: 'Moody Chiaroscuro',
    temperatureK: 4000,
    angleDegrees: 60,
    intensity: 0.95,
    descriptor: 'Caravaggio chiaroscuro high-contrast lighting with deep tenebrism and dramatic directional falloff',
    shadowFalloff: 'abrupt falloff into pure black negative space',
  },
  overcast_soft: {
    key: 'overcast_soft',
    label: 'Overcast Soft Ambient',
    temperatureK: 6500,
    angleDegrees: 90,
    intensity: 0.6,
    descriptor: 'even shadowless giant skybox softbox illumination with smooth ambient occlusion in all crevices',
    shadowFalloff: 'ultra-soft contact shadows only',
  },
  rembrandt: {
    key: 'rembrandt',
    label: 'Cinematic Rembrandt',
    temperatureK: 4800,
    angleDegrees: 45,
    intensity: 0.85,
    descriptor: 'classic Rembrandt lighting with characteristic illuminated triangle on opposite cheek',
    shadowFalloff: 'cinematic velvet falloff with rich midtone transitions',
  },
};

export const DEFAULT_VISUAL_DNA: VisualDnaChromosomes = {
  optics: 'Hasselblad H6D-100c Medium Format',
  focalLength: '85mm f/1.2 prime lens',
  bokeh: 'creamy shallow depth of field, circular 9-blade specular bokeh highlights',
  medium: '35mm Kodak Portra 400 analog film grain, uncompressed 8K RAW',
  composition: 'rule of thirds, low-angle dynamic hero framing, cinematic aspect ratio',
  subject: 'Enterprise titanium server node with glowing fiber optic cables and holographic status HUD',
};

/**
 * Modulates prompt output across all 4 major image models using 3D lighting vector & DNA.
 */
export function modulateImagePrompts(
  dna: VisualDnaChromosomes = DEFAULT_VISUAL_DNA,
  lightingKey: LightingVectorKey = 'cyberpunk_neon'
): ModulatedModelPrompts {
  const lighting = LIGHTING_PRESETS[lightingKey] || LIGHTING_PRESETS.cyberpunk_neon;

  // 1. Midjourney v6.1 Target
  const midjourneyV61 = `${dna.subject}, ${lighting.descriptor}, captured on ${dna.optics}, ${dna.focalLength}, ${dna.bokeh}, ${dna.medium}, ${dna.composition}, ${lighting.shadowFalloff} --ar 16:9 --style raw --v 6.1 --s 250 --c 5`;

  // 2. FLUX.1 [dev] Target
  const flux1Dev = `A photorealistic shot of ${dna.subject}. Lighting: ${lighting.descriptor} (${lighting.temperatureK}K color temperature). Camera optics: ${dna.optics} with ${dna.focalLength}. Beautiful ${dna.bokeh}. Subtly textured ${dna.medium}. Composition: ${dna.composition}. Ray-traced subsurface scattering, hyper-detailed materials, guidance_scale: 3.5.`;

  // 3. SDXL Positive and Negative Targets
  const sdxlPositive = `(masterpiece, best quality, ultra-detailed, 8k resolution:1.2), ${dna.subject}, ${lighting.descriptor}, ${dna.optics}, ${dna.focalLength}, ${dna.bokeh}, ${dna.medium}, ${dna.composition}, octane render, unreal engine 5, photorealistic`;

  const sdxlNegative = `(worst quality, low quality:1.4), (deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated hands and fingers, disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation, watermark, text, signature`;

  // 4. DALL-E 3 Target
  const dalle3 = `A cinematic, ultra-high-resolution photograph capturing ${dna.subject}. The scene is illuminated by ${lighting.descriptor}, producing ${lighting.shadowFalloff}. The image possesses the optical characteristics of being shot on a ${dna.optics} with an ${dna.focalLength}, showcasing ${dna.bokeh}. The framing adheres to ${dna.composition}, preserving the rich organic textures of ${dna.medium}.`;

  return {
    lighting,
    chromosomes: dna,
    midjourneyV61,
    flux1Dev,
    sdxl: {
      positive: sdxlPositive,
      negative: sdxlNegative,
    },
    dalle3,
  };
}
