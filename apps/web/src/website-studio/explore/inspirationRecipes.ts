export interface InspirationItem {
  id: string;
  title: string;
  category: string;
  description: string;
  tags?: string[];
  features?: string[];
}

export const CURATED_INSPIRATION_RECIPES: InspirationItem[] = [
  {
    id: "luxury-product-orbit",
    title: "Luxury Product Showcase",
    category: "E-Commerce",
    description:
      "Multi-shot orbital camera with cinematic lighting and responsive zoom on interaction.",
    tags: ["orbit", "camera-director", "pbr-materials"],
    features: ["CameraDirector", "BehaviorGraph", "SceneDoctor"],
  },
  {
    id: "architectural-spatial",
    title: "Architectural Space Tour",
    category: "Real Estate & Architecture",
    description:
      "Interior flythrough with bounded mesh collision guards and waypoint annotations.",
    tags: ["flythrough", "waypoints", "lighting-ambient"],
    features: ["NarrativeBlocks", "CollisionGuards", "DataBinding"],
  },
  {
    id: "kinetic-typography-stage",
    title: "Kinetic Interactive Stage",
    category: "Creative & Agency",
    description:
      "Responsive 3D background linked to scroll progress with accessible static fallback.",
    tags: ["scroll-driven", "reduced-motion", "typography"],
    features: ["ReducedMotionEquivalence", "DOMSync", "BehaviorGraph"],
  },
  {
    id: "data-telemetry-dashboard",
    title: "Telemetry Data Stage",
    category: "Technology",
    description:
      "Live data-bound parameters controlling 3D geometry with strict origin disclosure.",
    tags: ["data-binding", "privacy-boundary", "real-time"],
    features: ["DataBindingInspector", "LocalSandbox", "DoctorDiagnostics"],
  },
];
