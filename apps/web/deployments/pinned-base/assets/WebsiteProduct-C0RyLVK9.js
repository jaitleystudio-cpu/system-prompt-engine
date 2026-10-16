import{W as ue,e as pe,t as me,S as fe,f as he,F as Ee,P as ge,A as be,g as we,h as ye,T as _e,i as xe,k as Se,l as Te,m as Re,n as Ce,M as Ae,r as y,j as p}from"./r3f-xIa7EeOl.js";import{c as ve}from"./index-CALYsIRn.js";const Le={routeMountStatus:"MOUNTED"};class h extends Error{constructor(e){super(e),this.name="WebsiteCompileError"}}const Ie=/^[a-z0-9][a-z0-9-]*\.html$/,Ne=/^(?:[a-z0-9][a-z0-9-]*\.html)?(?:#[a-z0-9][a-z0-9-]*)?$/;function T(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;")}function V(t,e="path"){if(!t||!Ie.test(t))throw new h(`${e} must match ^[a-z0-9][a-z0-9-]*\\.html$ (got ${JSON.stringify(t)})`);if(t.includes("..")||t.includes("/")||t.includes("\\")||t.includes(":"))throw new h(`${e} refuses path-escape or separator: ${t}`);return t}function Oe(t,e="cta_href",s){if(!t||t==="#"||!Ne.test(t))throw new h(`${e} must be a same-site page or fragment. Network, script, and path-escape links are refused (got ${JSON.stringify(t)})`);if(t.includes("://")||t.startsWith("//")||t.includes("..")||t.includes("\\"))throw new h(`${e} is refused as a network or escape path`);const o=t.split("#",1)[0];if(s&&o&&!s.has(o))throw new h(`${e} points at unknown page ${o}`);return t}function W(t,e,s){if(!t)return"";if(!e)throw new h("cta_label present without cta_href");const o=Oe(e,"cta_href",s);return`<a href="${T(o)}" class="site-cta-btn">${T(t)}</a>`}function G(t,e="index.html"){if(!t.pages?.length)throw new h("pages must contain at least one page");const s=new Set;for(const i of t.pages){const l=V(i.path,"page.path");if(s.has(l))throw new h(`duplicate page path refused: ${l}`);s.add(l)}if(V(e,"activePagePath"),!s.has(e))throw new h(`activePagePath is not a page in this spec: ${JSON.stringify(e)}`);const o=t.pages.find(i=>i.path===e);if(!o)throw new h(`activePagePath is not a page in this spec: ${JSON.stringify(e)}`);const r=t.theme!=="light",n=`
/* Compiled from website-spec/1 (local TS emitter; not G13 Python package) */
:root {
  --site-bg: ${r?"#090d16":"#ffffff"};
  --site-surface: ${r?"#111827":"#f9fafb"};
  --site-text: ${r?"#f9fafb":"#111827"};
  --site-muted: ${r?"#9ca3af":"#4b5563"};
  --site-accent: #4338ca;
  --site-focus: ${r?"#bbceff":"#1e3a8a"};
  --site-border: ${r?"#374151":"#e5e7eb"};
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--site-bg);
  color: var(--site-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6;
}

.site-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 20px;
}

.site-section {
  margin-bottom: 48px;
}

.site-hero {
  padding: 48px 0;
  border-bottom: 1px solid var(--site-border);
}

.site-hero h1 {
  font-size: 2.25rem;
  margin: 0 0 16px 0;
  letter-spacing: -0.02em;
}

.site-cta-btn {
  display: inline-block;
  padding: 12px 24px;
  background-color: var(--site-accent);
  color: #ffffff;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 600;
  margin-top: 16px;
}

.site-list {
  padding-left: 20px;
}

.site-list li {
  margin-bottom: 8px;
}

.site-cta-btn:focus-visible,
.skip-link:focus-visible {
  outline: 3px solid var(--site-focus);
  outline-offset: 2px;
}

.skip-link {
  position: absolute;
  left: -999px;
  top: 0;
}

.skip-link:focus {
  left: 8px;
  top: 8px;
  background: var(--site-accent);
  color: #ffffff;
  padding: 8px 12px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}

@media (max-width: 360px) {
  .site-hero h1 { font-size: 1.75rem; }
  .site-container { padding: 16px 12px; }
}
`.trim(),a=o.sections.map(i=>{if(i.kind!=="hero"&&i.kind!=="prose"&&i.kind!=="list"&&i.kind!=="cta")throw new h(`unknown section kind ${JSON.stringify(i.kind)}`);if(typeof i.heading!="string"||i.heading.trim()==="")throw new h("section heading must be a non-empty string");if(i.body!=null&&typeof i.body!="string")throw new h("section body must be a string");if(i.items!=null&&(!Array.isArray(i.items)||i.items.some(m=>typeof m!="string")))throw new h("section items must be an array of strings");const l=T(i.heading),d=i.body?`<p>${T(i.body)}</p>`:"";switch(i.kind){case"hero":return`
    <header class="site-section site-hero">
      <h1>${l}</h1>
      ${d}
      ${W(i.cta_label,i.cta_href,s)}
    </header>`;case"prose":return`
    <article class="site-section site-prose">
      <h2>${l}</h2>
      ${d}
    </article>`;case"list":return`
    <section class="site-section site-list-sec">
      <h2>${l}</h2>
      ${d}
      <ul class="site-list">
        ${(i.items||[]).map(m=>`<li>${T(m)}</li>`).join(`
        `)}
      </ul>
    </section>`;case"cta":return`
    <section class="site-section site-cta">
      <h2>${l}</h2>
      ${d}
      ${W(i.cta_label,i.cta_href,s)}
    </section>`;default:throw new h(`unknown section kind ${JSON.stringify(i.kind)}`)}}).join(`
`);return{html:`<!DOCTYPE html>
<html lang="${T(t.language||"en")}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" />
  <title>${T(o.title)} - ${T(t.title)}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <a class="skip-link" href="#content">Skip to content</a>
  <main id="content" class="site-container">
${a}
  </main>
</body>
</html>`.trim(),css:n}}function J(t,e){if(/<\s*\/\s*style/i.test(e)||/<\s*script/i.test(e))throw new h("css refuses style-tag breakout or script");if((t.match(/<!DOCTYPE html>/gi)||[]).length!==1)throw new h("expected exactly one doctype in compiled html");if(!t.includes('<link rel="stylesheet" href="styles.css"'))throw new h("compiled html missing styles.css link for standalone conversion");const s=t.replace(/<link\s+rel="stylesheet"\s+href="styles\.css"\s*\/>/,`<style>
${e}
</style>`),o=(s.match(/<!DOCTYPE html>/gi)||[]).length,r=(s.match(/<html\b/gi)||[]).length;if(o!==1||r!==1)throw new h(`standalone must be a single document (doctype=${o}, htmlOpen=${r})`);return s}const j="0.170.0",z="./vendor/three.min.js",X="08fd7545d13d2c7fb65ab691530a802dafefd638596501854f267d0fb13c39e7",ke="sha512-FQK+LEpYc0fBD+J8g6oSEyyNzjp+Q7Ks1C568WWaoMRLW+TkNNWmenWeGgJjV105Gd+p/2ql1ZcjYvNiPZBhuQ==",De={box:{triangles:12,ctor:"new THREE.BoxGeometry(1, 1, 1)"},sphere:{triangles:960,ctor:"new THREE.SphereGeometry(1, 32, 32)"},cylinder:{triangles:640,ctor:"new THREE.CylinderGeometry(1, 1, 2, 32)"},plane:{triangles:2,ctor:"new THREE.PlaneGeometry(10, 10)"},torus:{triangles:1200,ctor:"new THREE.TorusGeometry(1, 0.4, 16, 100)"}},$e=new Set(["position.x","position.y","position.z","rotation.x","rotation.y","scale"]),Pe=/^[A-Za-z0-9_-]{1,64}$/,je=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;function D(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function _(t){throw new Error(`SceneIR validation failed: ${t}`)}function g(t,e){return(typeof t!="number"||!Number.isFinite(t))&&_(`${e} must be a finite number`),t}function C(t,e){return(!Array.isArray(t)||t.length!==3)&&_(`${e} must be a 3-vector`),[g(t[0],`${e}[0]`),g(t[1],`${e}[1]`),g(t[2],`${e}[2]`)]}function $(t,e){return(typeof t!="string"||!je.test(t))&&_(`${e} must be a hex color`),t}function Y(t,e){return(typeof t!="string"||!Pe.test(t))&&_(`${e} must be a safe id`),t}function He(t){const e=[/<title>([\s\S]*?)<\/title>/g,/<h1>([\s\S]*?)<\/h1>/g,/<p>([\s\S]*?)<\/p>/g,/aria-label="([^"]*)"/g];for(const s of e)for(const o of t.matchAll(s)){const r=o[1]??"";(/<\s*script/i.test(r)||/javascript\s*:/i.test(r))&&_("markup breakout refused")}}function Me(t){return t.includes("function rebuildSceneFromIR(")&&t.includes("disposeRecoveredScene(")}class Q{validateSceneIR(e){const s=[];(!e||e.sceneVersion!=="scene-ir/1")&&s.push("Invalid or missing sceneVersion (must be 'scene-ir/1')"),(!e.camera||!e.camera.position||e.camera.position.length!==3)&&s.push("Invalid camera configuration"),(!e.objects||e.objects.length===0)&&s.push("Scene must contain at least one 3D object");for(const o of e.objects??[])(!o.id||!o.geometry||!o.material)&&s.push(`Object ${o.id||"unknown"} is missing geometry or material`);return{valid:s.length===0,errors:s}}compile(e){const s=this.validateSceneIR(e);if(!s.valid)throw new Error(`SceneIR validation failed: ${s.errors.join("; ")}`);const o=`scene-${ve(e.title+e.objects.length).substring(0,12)}`;let r=0;const n=[];for(const u of e.objects){const S=String(u.geometry?.type??""),w=De[S];w||_(`unsupported geometry '${S}' refused`);const b=Y(u.id,"object id"),k=$(u.material?.color,`material color for ${b}`),P=g(u.material?.roughness,`roughness for ${b}`),ie=g(u.material?.metalness,`metalness for ${b}`),ae=C(u.position,`position for ${b}`),ce=C(u.rotation,`rotation for ${b}`),le=C(u.scale,`scale for ${b}`),de=u.material?.wireframe===!0;r+=w.triangles,n.push(`
      {
        const geom = ${w.ctor};
        const mat = new THREE.MeshStandardMaterial({
          color: "${k}",
          roughness: ${P},
          metalness: ${ie},
          wireframe: ${de}
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(${ae.join(", ")});
        mesh.rotation.set(${ce.join(", ")});
        mesh.scale.set(${le.join(", ")});
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        meshMap.set(${JSON.stringify(b)}, mesh);
      }`)}e.performanceBudget||_("performance budget is required");const a=Math.min(2,g(e.performanceBudget.maxDpr||1.5,"maxDpr")),c=$(e.environment?.backgroundColor||"#08090d","backgroundColor"),i=e.environment?.fogColor?$(e.environment.fogColor,"fogColor"):"",l=e.environment?.fogColor?g(e.environment.fogDensity??.05,"fogDensity"):0;(!e.camera.target||e.camera.target.length!==3)&&_("camera target is required");const d=g(e.camera.fov,"camera fov"),m=g(e.camera.near,"camera near"),E=g(e.camera.far,"camera far"),A=C(e.camera.position,"camera position"),N=C(e.camera.target,"camera target"),R=[];for(const u of e.lighting??[]){const S=$(u.color,"light color"),w=g(u.intensity,"light intensity");if(u.type==="ambient"){R.push(`{ const light = new THREE.AmbientLight("${S}", ${w}); scene.add(light); }`);continue}if(u.type==="directional"){const b=C(u.position||[5,10,5],"directional light position");R.push(`{ const light = new THREE.DirectionalLight("${S}", ${w}); light.position.set(${b.join(", ")}); light.castShadow = ${u.castShadow===!0}; scene.add(light); }`);continue}if(u.type==="point"){const b=C(u.position||[0,5,0],"point light position");R.push(`{ const light = new THREE.PointLight("${S}", ${w}); light.position.set(${b.join(", ")}); scene.add(light); }`);continue}_(`unsupported light '${String(u.type)}' refused`)}const v=[];for(const u of e.scrollTracks??[]){const S=Y(u.objectId,"scroll objectId");$e.has(u.property)||_(`unsupported scroll property '${String(u.property)}' refused`);const w=g(u.startScrollRatio,"scroll start"),b=g(u.endScrollRatio,"scroll end"),k=g(u.fromValue,"scroll from"),P=g(u.toValue,"scroll to");v.push(`
        {
          const m = meshMap.get(${JSON.stringify(S)});
          if (m) {
            const t = Math.max(0, Math.min(1, (scrollRatio - ${w}) / (${b-w} || 1)));
            const val = ${k} + (${P} - ${k}) * t;
            m.${u.property} = val;
          }
        }`)}const L=D(String(e.title??"")),F=D(e.accessibilityFallback?.ariaRegionLabel||"3D Interactive Scene"),f=D(e.accessibilityFallback?.textDescription||"Interactive 3D procedural experience generated by SPE."),I=D(e.accessibilityFallback?.hero2dSvg||""),x=`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${L} - SPE 3D Scene</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${c}; color: #f8fafc; font-family: system-ui, sans-serif; overflow-x: hidden; }
    #canvas-container { position: fixed; inset: 0; z-index: 1; pointer-events: auto; }
    #content-layer { position: relative; z-index: 2; pointer-events: none; }
    .scroll-section { height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 2rem 4rem; pointer-events: auto; }
    h1 { font-size: 3rem; margin-bottom: 1rem; }
    p { font-size: 1.25rem; color: #cbd5e1; max-width: 36rem; }
    .static-fallback { display: none; }
    @media (prefers-reduced-motion: reduce) {
      #canvas-container { opacity: 0.2; }
      .static-fallback { display: block; max-width: 32rem; margin: 2rem auto; }
    }
  </style>
  <!-- Packaged ${z} three ${j} sha256 ${X} integrity ${ke} -->
</head>
<body>
  <div id="canvas-container" role="region" aria-label="${F}"></div>
  
  <main id="content-layer">
    <section class="scroll-section">
      <h1>${L}</h1>
      <p>${f}</p>
      <div class="static-fallback">
        ${I}
      </div>
    </section>
    <section class="scroll-section">
      <h1>Explore Dimensions</h1>
      <p>Scroll to trigger physics and timeline transformations.</p>
    </section>
  </main>

  <script type="module">
    const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
    const root = document.documentElement;
    function showStaticFallback() {
      window.__SPE_OFFLINE_FALLBACK = true;
      var fallback = document.querySelector(".static-fallback");
      if (fallback) fallback.style.display = "block";
      var host = document.getElementById("canvas-container");
      if (host) host.setAttribute("data-webgl", "NOT_RUN");
      root.setAttribute("data-fallback-shown", "1");
    }
    function settle(execution, extra) {
      window.__SPE_EXPORT_EXECUTION = execution;
      window.__SPE_WEBGL_EXECUTION = execution;
      root.setAttribute("data-webgl-execution", execution);
      root.setAttribute("data-reduced-motion", REDUCE ? "1" : "0");
      root.setAttribute("data-three-version", "${j}");
      root.setAttribute("data-three-sha256", "${X}");
      if (extra) {
        var keys = Object.keys(extra);
        for (var i = 0; i < keys.length; i++) root.setAttribute(keys[i], String(extra[keys[i]]));
      }
      root.setAttribute("data-scene-settled", "1");
    }
    if (REDUCE) {
      showStaticFallback();
      window.__SPE_WEBGL_EXECUTION = "NOT_RUN";
      settle("NOT_RUN", { "data-context-created": "0", "data-scene-created": "0", "data-non-clear-pixels": "0" });
    } else {
      let THREE = null;
      try {
        THREE = await import("${z}");
      } catch (error) {
        showStaticFallback();
        window.__SPE_WEBGL_EXECUTION = "NOT_RUN";
        window.__SPE_THREE_IMPORT_ERROR = String(error);
        settle("NOT_RUN", { "data-context-created": "0", "data-scene-created": "0", "data-three-missing": "1", "data-non-clear-pixels": "0" });
      }
      if (THREE) {
      const container = document.getElementById("canvas-container");
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("${c}");
      ${i?`scene.fog = new THREE.FogExp2("${i}", ${l});`:""}

      const camera = new THREE.PerspectiveCamera(${d}, window.innerWidth / window.innerHeight, ${m}, ${E});
      const initialCamPos = [${A.join(", ")}];
      const initialTarget = [${N.join(", ")}];
      camera.position.set(initialCamPos[0], initialCamPos[1], initialCamPos[2]);
      camera.lookAt(initialTarget[0], initialTarget[1], initialTarget[2]);

      let renderer = null;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: false });
      } catch (error) {
        showStaticFallback();
        window.__SPE_WEBGL_EXECUTION = "UNAVAILABLE";
        window.__SPE_WEBGL_ERROR = String(error);
        settle("UNAVAILABLE", { "data-context-created": "0", "data-scene-created": "0", "data-unavailable-honest": "1", "data-non-clear-pixels": "0" });
      }
      if (renderer && !renderer.getContext()) {
        showStaticFallback();
        window.__SPE_WEBGL_EXECUTION = "UNAVAILABLE";
        settle("UNAVAILABLE", { "data-context-created": "0", "data-scene-created": "0", "data-unavailable-honest": "1", "data-non-clear-pixels": "0" });
        try { renderer.dispose(); } catch (error) { /* already unavailable */ }
        renderer = null;
      }
      if (renderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ${a}));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      container.appendChild(renderer.domElement);

      let isContextLost = false;
      let isTabVisible = !document.hidden;

      renderer.domElement.addEventListener("webglcontextlost", function(e) {
        e.preventDefault();
        isContextLost = true;
        console.warn("SPE WebGL Context Lost. Pausing render loop. Scene is not rebuilt.");
      }, false);

      document.addEventListener("visibilitychange", function() {
        isTabVisible = !document.hidden;
      });

      ${R.join(`
      `)}

      const meshMap = new Map();
      ${n.join(`
`)}

      let scrollRatio = 0;
      window.addEventListener("scroll", function() {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        scrollRatio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      });

      let mouseX = 0, mouseY = 0;
      window.addEventListener("pointermove", function(e) {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      });

      window.addEventListener("resize", function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      let clock = new THREE.Clock();
      function animate() {
        requestAnimationFrame(animate);
        if (isContextLost || !isTabVisible) return;

        const elapsed = clock.getElapsedTime();

        camera.position.x += (initialCamPos[0] + mouseX * 0.4 - camera.position.x) * 0.05;
        camera.position.y += (initialCamPos[1] + mouseY * 0.3 - camera.position.y) * 0.05;
        camera.lookAt(initialTarget[0], initialTarget[1], initialTarget[2]);

        ${v.join(`
`)}

        renderer.render(scene, camera);
        if (!window.__SPE_FRAME_SETTLED) {
          window.__SPE_FRAME_SETTLED = true;
          var gl = renderer.getContext();
          gl.finish();
          var width = gl.drawingBufferWidth;
          var height = gl.drawingBufferHeight;
          var pixels = new Uint8Array(width * height * 4);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          var clearHex = "${c}".replace("#", "");
          var clearR = parseInt(clearHex.slice(0, 2), 16);
          var clearG = parseInt(clearHex.slice(2, 4), 16);
          var clearB = parseInt(clearHex.slice(4, 6), 16);
          var nonClear = 0;
          for (var pi = 0; pi < pixels.length; pi += 4) {
            var delta = Math.abs(pixels[pi] - clearR) + Math.abs(pixels[pi + 1] - clearG) + Math.abs(pixels[pi + 2] - clearB);
            if (delta > 18) nonClear += 1;
          }
          var execution = (width > 1 && height > 1 && nonClear >= 50) ? "EXECUTED_WITHIN_TESTED_SCOPE" : "NOT_RUN";
          if (execution === "NOT_RUN") window.__SPE_WEBGL_EXECUTION = "NOT_RUN";
          root.setAttribute("data-non-clear-pixels", String(nonClear));
          root.setAttribute("data-sampled-pixels", String(width * height));
          root.setAttribute("data-context-created", "1");
          root.setAttribute("data-scene-created", meshMap.size > 0 ? "1" : "0");
          root.setAttribute("data-three-revision", String(THREE.REVISION));
          root.setAttribute("data-fallback-shown", "0");
          root.setAttribute("data-unavailable-honest", "0");
          settle(execution, {});
        }
      }
      animate();

      window.addEventListener("beforeunload", function() {
        meshMap.forEach(function(m) {
          if (m.geometry) m.geometry.dispose();
          if (m.material) {
            if (Array.isArray(m.material)) {
              m.material.forEach(function(mat) { mat.dispose(); });
            } else {
              m.material.dispose();
            }
          }
        });
        renderer.dispose();
      });
      }
      }
    }
  <\/script>
</body>
</html>`;He(x);const O=x.includes("@media (prefers-reduced-motion: reduce)")&&x.includes("static-fallback"),re=Me(x);return{sceneId:o,standaloneHtml:x,totalTriangles:r,status:"AVAILABLE",memoryFootprintKb:Math.round(r*.05+120),threeVersion:j,reducedMotionSupported:O,contextLossRecoverySupported:re,webglExecution:"NOT_RUN"}}}function Be(t){return/[\u0C00-\u0C7F]/.test(t)?"te":/[\u0B80-\u0BFF]/.test(t)?"ta":/[\u0900-\u097F]/.test(t)?"hi":/[\u0600-\u06FF]/.test(t)?"ar":/[\u0590-\u05FF]/.test(t)?"he":/[\u4E00-\u9FFF]/.test(t)?"zh":/[\u3040-\u30FF]/.test(t)?"ja":"en"}function Ue(t){const e=t.trim(),o=(e.split(/[\n.!?]/)[0]||"Interactive Presentation").replace(/[^\p{L}\p{M}\p{N}\s-]/gu,"").replace(/\s+/g," ").trim(),r=o.length<=60?o||"Interactive Presentation":o.slice(0,57).trim()+"...",n=e.toLowerCase(),a=Be(e),c=n.includes("dark")||n.includes("space")||n.includes("night")||n.includes("cyber")||n.includes("luxury"),i=c?"dark":"light";let l="sphere",d={radius:1.5},m=c?"#818cf8":"#6366f1";n.includes("box")||n.includes("cube")||n.includes("card")?(l="box",d={width:2,height:2,depth:2}):n.includes("torus")||n.includes("ring")||n.includes("donut")?(l="torus",d={radius:1.5,tube:.4}):n.includes("cylinder")||n.includes("column")||n.includes("pillar")?(l="cylinder",d={radiusTop:1,radiusBottom:1,height:2}):(n.includes("wave")||n.includes("mesh")||n.includes("terrain"))&&(l="wave-mesh",d={width:4,height:4}),n.includes("finance")||n.includes("gold")?m="#eab308":n.includes("nature")||n.includes("green")||n.includes("eco")?m="#22c55e":(n.includes("space")||n.includes("cosmic"))&&(m="#38bdf8");const E={spec_version:"website-spec/1",title:r,language:a,summary:"Local static website compiled from prompt.",theme:i,pages:[{path:"index.html",title:"Home",sections:[{kind:"hero",heading:r,body:e},{kind:"prose",heading:"Overview",body:"Structured static site representation generated offline from user prompt."},{kind:"cta",heading:"Explore",cta_label:"Overview",cta_href:"#overview"}]}]},A={sceneVersion:"scene-ir/1",title:r,theme:c?"dark":"light",camera:{type:"perspective",fov:60,position:[0,2,8],target:[0,0,0],near:.1,far:1e3},environment:{backgroundColor:c?"#05070a":"#f8fafc",fogColor:c?"#05070a":"#f8fafc",fogDensity:.04},lighting:[{id:"ambient",type:"ambient",color:"#ffffff",intensity:.6},{id:"key",type:"directional",color:m,intensity:1.2,position:[5,10,5],castShadow:!0}],objects:[{id:"hero-geometry",name:"Interactive Object",geometry:{type:l,parameters:d},material:{type:"standard",color:m,roughness:.2,metalness:.8},position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}],scrollTracks:[{objectId:"hero-geometry",property:"rotation.y",startScrollRatio:0,endScrollRatio:1,fromValue:0,toValue:6.28}],performanceBudget:{maxDpr:1.5,maxDrawCalls:50,maxTriangles:1e4,targetFps:60},accessibilityFallback:{hero2dSvg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${m}"/></svg>`,textDescription:`Interactive 3D representation for ${r}`,ariaRegionLabel:"Interactive 3D Scene"}};return{spec:E,sceneDefinition:A}}const Fe="NOT_AVAILABLE",Ve="NOT_AVAILABLE",We="HOLD",Ge="UNSUPPORTED",Je="apps/web/src/engine/multimodal/sceneCompiler.ts",ze="c08c6929ad57885a3d16eb10f1cd07b2a5ed4949",Xe="NOT_IMPLEMENTED",Ye="NOT_RUN",qe="LOCAL_TS_WEBSITE_SPEC_1",Ke="MOUNTED",Z=/<\s*script\b|javascript\s*:|vbscript\s*:|<\s*iframe\b|<\s*object\b|<\s*embed\b|\son[a-z]+\s*=/i,ee=/https?:\/\//i,te=/\bxmlns(?::[a-zA-Z0-9_-]+)?=['"]http:\/\/www\.w3\.org\/2000\/svg['"]/gi,Qe=new Set(["box","sphere","cylinder","plane","torus","wave-mesh"]),ne=new Q;function H(t){return{status:"REFUSED",sourceKind:t,networkPerformed:!1,fetchedUrl:!1,localSavedHtmlIsLiveUrl:!1,aiGeneration:Fe,scene3d:"OWNER_WIRED",liveUrlReconstruction:Ve,hostedPublish:We,sandbox:Ge,sceneIrWired:!0,sceneIrOwnerPath:Je,sceneIrSourceSha:ze,webglContextLossDisposal:Xe,shellMount:Ke,compiler:qe,reasons:[],previewHtml:null,exportHtml:null,sceneHtml:null,sceneId:null,sceneTriangles:null,reducedMotion:!1,contentSecurityPolicy:!1,scrollTracksSupported:!1,contextLossRecoverySupported:!1,contextRestoredSupported:!1,disposeSupported:!1,webglExecution:Ye}}function Ze(t){if(!t||typeof t!="object")return!1;const e=t;return e.spec_version==="website-spec/1"&&Array.isArray(e.pages)}function B(t,e){if(typeof t=="string"){e.push(t);return}if(Array.isArray(t)){for(const s of t)B(s,e);return}if(t&&typeof t=="object")for(const s of Object.values(t))B(s,e)}function et(t){if(t==null)return{ok:!1,reasons:["SCENE_DEFINITION_MISSING"]};if(typeof t=="string")try{t=JSON.parse(t)}catch{return{ok:!1,reasons:["SCENE_JSON_INVALID"]}}if(!t||typeof t!="object")return{ok:!1,reasons:["SCENE_SHAPE_REFUSED"]};const e=[];B(t,e);for(const r of e){const n=r.replace(te,"");if(Z.test(r)||ee.test(n))return{ok:!1,reasons:["MALICIOUS_SCENEIR_REFUSED"]}}const s=t,o=ne.validateSceneIR(s);if(!o.valid)return{ok:!1,reasons:!s.objects||Array.isArray(s.objects)&&s.objects.length===0?["SCENE_ZERO_OBJECTS",...o.errors]:["SCENEIR_VALIDATION_FAILED",...o.errors]};for(const r of s.objects)if(!Qe.has(r.geometry?.type))return{ok:!1,reasons:["SCENE_INVALID_GEOMETRY"]};return s.objects.length>256?{ok:!1,reasons:["SCENE_TOO_LARGE"]}:{ok:!0,ir:s}}function tt(t,e){return t.scene3d=e.status==="AVAILABLE"?"AVAILABLE":"NOT_AVAILABLE",t.sceneHtml=e.standaloneHtml,t.sceneId=e.sceneId,t.sceneTriangles=e.totalTriangles,t.scrollTracksSupported=e.standaloneHtml.includes("scrollRatio"),t.contextLossRecoverySupported=e.contextLossRecoverySupported,t.contextRestoredSupported=e.contextLossRecoverySupported,t.webglExecution=e.webglExecution,t.disposeSupported=e.standaloneHtml.includes("beforeunload")&&e.standaloneHtml.includes(".dispose()"),e.reducedMotionSupported?!1:(t.status="REJECTED",t.reasons=["SCENE_REDUCED_MOTION_MISSING"],t.sceneHtml=null,t.scene3d="REJECTED",!0)}function M(t){if(t.kind==="live_url"){const n=H("live_url");return n.status="REFUSED",n.scene3d="NOT_AVAILABLE",n.reasons=["LIVE_URL_NOT_FETCHED","NO_ACQUISITION_GRANT"],n}if(t.kind==="local_saved_html"){const n=H("local_saved_html");n.scene3d="NOT_AVAILABLE";const a=String(t.html??"");if(!t.filename.trim()||!a.trim())return n.status="REJECTED",n.reasons=["LOCAL_DOCUMENT_EMPTY"],n;const c=a.replace(te,"");return Z.test(a)||ee.test(c)?(n.status="REJECTED",n.reasons=["MALICIOUS_OR_REMOTE_MARKUP_REFUSED"],n):(n.status="REFUSED",n.reasons=["LOCAL_SAVED_HTML_IS_NOT_A_SPEC","RAW_DOCUMENT_NOT_REPLAYED"],n)}const e=H("website_spec");let s=t.spec;if(typeof s=="string"){const n=s.trim();if(!n)return e.status="REJECTED",e.scene3d="NOT_AVAILABLE",e.reasons=["SPEC_EMPTY"],e;if(n.startsWith("<"))return e.status="REJECTED",e.scene3d="NOT_AVAILABLE",e.reasons=["HTML_IS_NOT_A_WEBSITE_SPEC"],e;try{s=JSON.parse(n)}catch{if(n.startsWith("{"))return e.status="REJECTED",e.scene3d="NOT_AVAILABLE",e.reasons=["SPEC_JSON_INVALID"],e;{const a=Ue(n);s=a.spec,t.sceneDefinition===void 0&&(t.sceneDefinition=a.sceneDefinition)}}}if(!Ze(s))return e.status="REJECTED",e.scene3d="NOT_AVAILABLE",e.reasons=["SPEC_SHAPE_REFUSED"],e;const o=s.pages[0]?.path;if(!o)return e.status="REJECTED",e.scene3d="NOT_AVAILABLE",e.reasons=["SPEC_HAS_NO_PAGE"],e;let r=null;if(t.sceneDefinition!==void 0){const n=et(t.sceneDefinition);if(!n.ok)return e.status="REJECTED",e.scene3d="REJECTED",e.reasons=n.reasons,e;try{r=ne.compile(n.ir)}catch(a){return e.status="REJECTED",e.scene3d="REJECTED",e.reasons=[a instanceof Error?a.message:"SCENE_COMPILE_REFUSED"],e}}try{const n=G(s,o),a=G(s,o);if(n.html!==a.html||n.css!==a.css)return e.status="REJECTED",e.scene3d=r?"AVAILABLE":"NOT_AVAILABLE",e.reasons=["EXPORT_NOT_DETERMINISTIC"],e;const c=J(n.html,n.css),i=J(a.html,a.css);return c!==i?(e.status="REJECTED",e.scene3d=r?"AVAILABLE":"NOT_AVAILABLE",e.reasons=["EXPORT_NOT_DETERMINISTIC"],e):c.includes('http-equiv="Content-Security-Policy"')?n.css.includes("prefers-reduced-motion")?/<\s*script\b/i.test(c)?(e.status="REJECTED",e.scene3d=r?"AVAILABLE":"NOT_AVAILABLE",e.reasons=["SCRIPT_ELEMENT_REFUSED"],e):(e.status="LOCAL_EXPORT_READY",e.reasons=r?["STATIC_FILES_ONLY","SCENEIR_OPTIONAL_ATTACHED"]:["STATIC_FILES_ONLY"],e.previewHtml=c,e.exportHtml=c,e.reducedMotion=!0,e.contentSecurityPolicy=!0,e.scene3d="NOT_AVAILABLE",r&&tt(e,r),e):(e.status="REJECTED",e.scene3d=r?"AVAILABLE":"NOT_AVAILABLE",e.reasons=["REDUCED_MOTION_MISSING"],e):(e.status="REJECTED",e.scene3d=r?"AVAILABLE":"NOT_AVAILABLE",e.reasons=["CSP_MISSING"],e)}catch(n){return e.status="REJECTED",e.scene3d=r?"AVAILABLE":"NOT_AVAILABLE",e.reasons=[n instanceof h?n.message:"SPEC_COMPILE_REFUSED"],e}}const nt=me.version,ot="vite-import-three-package",st=new Q,U={sceneVersion:"scene-ir/1",title:"Quantum Accelerator Landing",theme:"dark",camera:{type:"perspective",fov:60,position:[0,2,8],target:[0,0,0],near:.1,far:1e3},environment:{backgroundColor:"#05070a",fogColor:"#05070a",fogDensity:.04},lighting:[{id:"ambient",type:"ambient",color:"#ffffff",intensity:.6},{id:"key",type:"directional",color:"#818cf8",intensity:1.2,position:[5,10,5],castShadow:!1}],objects:[{id:"hero-orb",name:"Central Core",geometry:{type:"sphere",parameters:{radius:1.5}},material:{type:"standard",color:"#6366f1",roughness:.2,metalness:.8},position:[0,0,0],rotation:[0,0,0],scale:[1.6,1.6,1.6]}],scrollTracks:[{objectId:"hero-orb",property:"rotation.y",startScrollRatio:0,endScrollRatio:1,fromValue:0,toValue:6.28}],performanceBudget:{maxDpr:1,maxDrawCalls:50,maxTriangles:1e4,targetFps:60},accessibilityFallback:{hero2dSvg:"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='18' fill='#6366f1'/></svg>",textDescription:"A central quantum orb that rotates as you scroll.",ariaRegionLabel:"Interactive 3D Quantum Scene"}},oe=480,se=360,rt={box:()=>new Re(1,1,1),sphere:()=>new Te(1,32,32),cylinder:()=>new Se(1,1,2,32),plane:()=>new xe(10,10),torus:()=>new _e(1,.4,16,100)};function it(){return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches===!0}function q(t){const e=new fe;e.background=new he(t.environment.backgroundColor),t.environment.fogColor&&(e.fog=new Ee(t.environment.fogColor,t.environment.fogDensity??.05));const s=new ge(t.camera.fov,oe/se,t.camera.near,t.camera.far);s.position.set(t.camera.position[0],t.camera.position[1],t.camera.position[2]),s.lookAt(t.camera.target[0],t.camera.target[1],t.camera.target[2]);const o=[],r=[];for(const n of t.lighting){if(n.type==="ambient"){const a=new be(n.color,n.intensity);e.add(a),r.push(a);continue}if(n.type==="directional"){const a=new we(n.color,n.intensity),c=n.position??[5,10,5];a.position.set(c[0],c[1],c[2]),e.add(a),r.push(a);continue}if(n.type==="point"){const a=new ye(n.color,n.intensity),c=n.position??[0,5,0];a.position.set(c[0],c[1],c[2]),e.add(a),r.push(a)}}for(const n of t.objects){const a=rt[n.geometry.type];if(!a)throw new Error(`unsupported geometry ${n.geometry.type}`);const c=new Ce({color:n.material.color,roughness:n.material.roughness,metalness:n.material.metalness,wireframe:n.material.wireframe===!0}),i=new Ae(a(),c);i.position.set(n.position[0],n.position[1],n.position[2]),i.rotation.set(n.rotation[0],n.rotation[1],n.rotation[2]),i.scale.set(n.scale[0],n.scale[1],n.scale[2]),e.add(i),o.push(i)}return{scene:e,camera:s,meshes:o,lights:r}}function K(t){if(t){for(const e of t.meshes){t.scene.remove(e);try{e.geometry.dispose()}catch{}const s=e.material,o=Array.isArray(s)?s:[s];for(const r of o)try{r.dispose()}catch{}}for(const e of t.lights)t.scene.remove(e)}}function at(t){const e=t.replace("#","");return[Number.parseInt(e.slice(0,2),16),Number.parseInt(e.slice(2,4),16),Number.parseInt(e.slice(4,6),16)]}function ct(t,e){const s=t.drawingBufferWidth,o=t.drawingBufferHeight;if(s<2||o<2)return{nonClear:0,sampled:0};const r=new Uint8Array(s*o*4);t.readPixels(0,0,s,o,t.RGBA,t.UNSIGNED_BYTE,r);const[n,a,c]=at(e);let i=0;for(let l=0;l<r.length;l+=4)Math.abs(r[l]-n)+Math.abs(r[l+1]-a)+Math.abs(r[l+2]-c)>18&&(i+=1);return{nonClear:i,sampled:s*o}}function lt(t){return{webglExecution:"NOT_RUN",threeVersion:nt,threeRevision:pe,bundling:ot,contextCreated:!1,sceneCreated:!1,frameRendered:!1,nonClearPixels:0,sampledPixels:0,clearColor:U.environment.backgroundColor,reducedMotion:!1,fallbackShown:!1,unavailableHonest:!1,disposeThrew:null,disposed:!1,contextLossRecovery:"NOT_RUN",contextLossNonClearPixels:null,note:"",...t}}function dt(t,e){const s=st.validateSceneIR(e),o=lt({clearColor:e.environment?.backgroundColor||"#05070a"});let r=null,n=null,a=!1;const c=f=>{o.webglExecution="UNAVAILABLE",o.unavailableHonest=!0,o.contextCreated=!1,o.sceneCreated=!1,o.frameRendered=!1,o.note=f};if(!s.valid)return o.note=s.errors.join("; "),{report:o,dispose(){o.disposed=!0},async loseAndRestore(){return o}};if(it())return o.reducedMotion=!0,o.fallbackShown=!0,o.webglExecution="NOT_RUN",o.note="prefers-reduced-motion: static fallback, WebGL not started",{report:o,dispose(){o.disposed=!0},async loseAndRestore(){return o.note="reduced-motion path has no WebGL context to lose",o}};const i=document.createElement("canvas"),l=i.getContext("webgl2",{failIfMajorPerformanceCaveat:!1})||i.getContext("webgl",{failIfMajorPerformanceCaveat:!1});if(!l)return c("getContext(webgl) returned null"),{report:o,dispose(){o.disposed=!0},async loseAndRestore(){return o}};l.getExtension("WEBGL_lose_context")?.loseContext();try{n=new ue({antialias:!1,alpha:!1,powerPreference:"high-performance",preserveDrawingBuffer:!0,failIfMajorPerformanceCaveat:!1})}catch(f){return c(f instanceof Error?f.message:"WebGLRenderer threw"),{report:o,dispose(){o.disposed=!0},async loseAndRestore(){return o}}}if(!n.getContext()){c("WebGLRenderer.getContext() returned null");try{n.dispose()}catch{}return n=null,{report:o,dispose(){o.disposed=!0},async loseAndRestore(){return o}}}o.contextCreated=!0,n.setPixelRatio(1),n.setSize(oe,se,!1),n.setClearColor(e.environment.backgroundColor,1),t.replaceChildren(n.domElement);try{r=q(e)}catch(f){o.note=f instanceof Error?f.message:"scene build failed",o.webglExecution="NOT_RUN";try{n.dispose()}catch{}return{report:o,dispose(){o.disposed=!0},async loseAndRestore(){return o}}}o.sceneCreated=r.meshes.length>0&&r.scene.children.length>0;const E=()=>!n||!r?{nonClear:0,sampled:0}:(n.render(r.scene,r.camera),ct(n.getContext(),e.environment.backgroundColor)),A=E(),N=E(),R=Math.max(A.nonClear,N.nonClear);o.nonClearPixels=R,o.sampledPixels=Math.max(A.sampled,N.sampled),o.frameRendered=R>=50,o.contextCreated&&o.sceneCreated&&o.frameRendered?(o.webglExecution="EXECUTED",o.note="readPixels found a non-clear frame"):(o.webglExecution="NOT_RUN",o.note="context or scene existed but the frame was clear-only or empty");const v=f=>{f.preventDefault(),K(r),r=null,o.sceneCreated=!1},L=()=>{if(!(!n||a))try{r=q(e);const f=E();o.sceneCreated=!0,o.contextLossNonClearPixels=f.nonClear,o.contextLossRecovery=f.nonClear>=50?"REBUILT":"FAILED"}catch{o.contextLossRecovery="FAILED"}};return n.domElement.addEventListener("webglcontextlost",v,!1),n.domElement.addEventListener("webglcontextrestored",L,!1),{report:o,dispose:()=>{if(!a){a=!0;try{n?.domElement.removeEventListener("webglcontextlost",v,!1),n?.domElement.removeEventListener("webglcontextrestored",L,!1),K(r),r=null,n?.dispose(),n?.domElement.remove(),n=null,o.disposed=!0,o.disposeThrew=null}catch(f){throw o.disposed=!0,o.disposeThrew=f instanceof Error?f.message:String(f),f}}},async loseAndRestore(){if(!n||a)return o.contextLossRecovery="FAILED",o;const I=n.getContext().getExtension("WEBGL_lose_context");if(!I)return o.contextLossRecovery="FAILED",o.note=`${o.note}; WEBGL_lose_context missing`,o;let x=!1;return await new Promise(O=>{n?.domElement.addEventListener("webglcontextrestored",()=>{x=!0,O()},{once:!0}),I.loseContext(),window.setTimeout(()=>I.restoreContext(),40),window.setTimeout(()=>O(),1e3)}),x||(o.contextLossRecovery="FAILED"),o}}}function ut(){const t=y.useRef(null),[e,s]=y.useState(null),[o,r]=y.useState(!0),[n,a]=y.useState("pending");y.useEffect(()=>{if(!o)return;const d=t.current;if(!d)return;const m=dt(d,U);return window.__SPE_SCENE_HANDLE=m,s({...m.report}),()=>{try{m.dispose()}catch{}}},[o]);function c(){const d=window.__SPE_SCENE_HANDLE;try{d?.dispose(),a(d?.report.disposeThrew?`threw:${d.report.disposeThrew}`:"ok"),d&&s({...d.report})}catch(m){const E=m instanceof Error?m.message:String(m);a(`threw:${E}`)}r(!1)}const i=e?.webglExecution??"NOT_RUN",l=e?.fallbackShown===!0;return p.jsxs("div",{className:"website-scene","data-scene-settled":e?"1":"0","data-webgl-execution":i,"data-three-version":e?.threeVersion??"","data-three-revision":e?.threeRevision??"","data-context-created":e?.contextCreated?"1":"0","data-scene-created":e?.sceneCreated?"1":"0","data-non-clear-pixels":String(e?.nonClearPixels??0),"data-sampled-pixels":String(e?.sampledPixels??0),"data-reduced-motion":e?.reducedMotion?"1":"0","data-fallback-shown":l?"1":"0","data-unavailable-honest":e?.unavailableHonest?"1":"0","data-dispose":n,"data-bundling":e?.bundling??"","data-frame-note":e?.note??"",children:[p.jsx("h2",{children:"Scene"}),o?p.jsx("div",{ref:t,className:"website-scene-canvas"}):null,l?p.jsx("div",{className:"website-scene-fallback",children:p.jsx("p",{children:U.accessibilityFallback.textDescription})}):null,p.jsxs("p",{className:"website-scene-status",children:["WebGL ",i,". Three ",e?.threeVersion||"not executed"," bundled as"," ",e?.bundling||"not executed",". Non-clear pixels ",e?.nonClearPixels??0,"."]}),p.jsx("button",{type:"button",onClick:c,children:"Unmount scene"})]})}const pt=`{
  "spec_version": "website-spec/1",
  "title": "Local notes",
  "language": "en",
  "summary": "A private static page.",
  "theme": "light",
  "pages": [
    {
      "path": "index.html",
      "title": "Home",
      "sections": [
        {
          "kind": "prose",
          "heading": "Notes",
          "body": "This page is a local file."
        }
      ]
    }
  ]
}`;function ht(){const[t,e]=y.useState("website_spec"),[s,o]=y.useState(pt),[r,n]=y.useState("page.html"),[a,c]=y.useState(!1),i=y.useMemo(()=>a?M(t==="website_spec"?{kind:t,spec:s}:t==="local_saved_html"?{kind:t,filename:r,html:s}:{kind:"live_url"}):null,[a,t,s,r]);function l(){if(!i?.exportHtml)return;const d=new Blob([i.exportHtml],{type:"text/html;charset=utf-8"}),m=URL.createObjectURL(d),E=document.createElement("a");E.href=m,E.download="index.html",document.body.appendChild(E),E.click(),E.remove(),URL.revokeObjectURL(m)}return p.jsxs("section",{className:"website-product","data-copy-depth":"PROOF","data-route-mount":Le.routeMountStatus,"data-scene-ir-wired":"true","aria-label":"Website product",children:[p.jsx("h1",{children:"Website"}),p.jsx(ut,{}),p.jsx("p",{className:"website-product-note",children:"A local spec can become a preview and a saved file. A saved file is not a web address. A web address is not opened."}),p.jsxs("div",{className:"website-product-modes",role:"group","aria-label":"Input kind",children:[p.jsx("button",{type:"button","aria-pressed":t==="website_spec",onClick:()=>{e("website_spec"),c(!1)},children:"Spec"}),p.jsx("button",{type:"button","aria-pressed":t==="local_saved_html",onClick:()=>{e("local_saved_html"),c(!1)},children:"Saved file"}),p.jsx("button",{type:"button","aria-pressed":t==="live_url",onClick:()=>{e("live_url"),c(!1)},children:"Web address"})]}),t==="local_saved_html"?p.jsxs("label",{children:["File name",p.jsx("input",{value:r,onChange:d=>n(d.target.value),"aria-label":"File name"})]}):null,p.jsxs("label",{children:["Input",p.jsx("textarea",{value:s,onChange:d=>{o(d.target.value),c(!1)},"aria-label":"Website input"})]}),p.jsxs("div",{className:"website-product-actions",children:[p.jsx("button",{type:"button",onClick:()=>c(!0),children:"Build preview"}),p.jsx("button",{type:"button",onClick:l,disabled:!i?.exportHtml,children:"Save HTML"})]}),i?p.jsxs("div",{role:"status","aria-label":"Website result",children:[p.jsx("p",{children:i.status}),p.jsx("p",{children:i.reasons.join(", ")}),p.jsx("p",{children:"Fetched: no. Live site: no. SceneIR owner: wired. Live URL: unavailable. Website UI is mounted in the app shell."})]}):null,i?.previewHtml?p.jsx("iframe",{className:"website-product-preview",title:"Local website preview",sandbox:"",srcDoc:i.previewHtml}):null]})}export{ht as WebsiteProduct};
