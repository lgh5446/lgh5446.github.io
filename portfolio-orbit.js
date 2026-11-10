(() => {
  "use strict";
  const canvas = document.getElementById("stage");
  const host = canvas.parentElement;
  const status = document.getElementById("orbit-status");
  const labels = document.getElementById("orbit-labels");
  const motionButton = document.getElementById("orbit-motion");
  const controls = [...document.querySelectorAll("#orbit .orbit-control")];
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const worlds = [
    { key: "__core", label: "프로필", map: "earth", radius: 104, size: 23, inc: .08, node: .4, phase: 4.6, speed: .075, tilt: .41, color: "#81b9e6", kind: "terrestrial" },
    { key: "finance", label: "개발금융", map: "saturn", radius: 163, size: 29, inc: -.08, node: 1.4, phase: .5, speed: .061, tilt: .47, color: "#e6c391", kind: "wide-rings" },
    { key: "renewal", label: "정비사업", map: "mars", radius: 218, size: 22, inc: .16, node: 2.2, phase: 3.0, speed: .049, tilt: .32, color: "#d98062", kind: "rocky" },
    { key: "urban", label: "도시개발", map: "neptune", radius: 268, size: 26, inc: -.06, node: .2, phase: 1.2, speed: .041, tilt: .49, color: "#6994e1", kind: "blue-giant" },
    { key: "npl", label: "채권관리", map: "mercury", radius: 314, size: 24, inc: .16, node: 3.1, phase: 4.9, speed: .034, tilt: .2, color: "#b7a799", kind: "irregular" },
    { key: "ai", label: "AI 도구", map: "uranus", radius: 361, size: 26, inc: -.12, node: 1.2, phase: 3.9, speed: .028, tilt: 1.7, color: "#9fdcde", kind: "tilted-rings" },
    { key: "career", label: "업무 경력", map: "jupiter", radius: 409, size: 32, inc: .08, node: 2.2, phase: .15, speed: .024, tilt: .06, color: "#dca578", kind: "moons" },
    { key: "credentials", label: "학력·자격", map: "moon", radius: 454, size: 22, inc: -.1, node: .8, phase: 2.1, speed: .020, tilt: .14, color: "#c7c8e2", kind: "cratered" }
  ];
  const textureFiles = { earth: "2k_earth_daymap.jpg", clouds: "2k_earth_clouds.jpg", saturn: "2k_saturn.jpg", ring: "2k_saturn_ring_alpha.png", mars: "2k_mars.jpg", neptune: "2k_neptune.jpg", mercury: "2k_mercury.jpg", uranus: "2k_uranus.jpg", jupiter: "2k_jupiter.jpg", moon: "2k_moon.jpg" };
  let THREE, renderer, scene, camera, galaxy, bodies = [], textureState = {}, fitSamples = [];
  let state = "idle", lost = false, inViewport = false, userPaused = motionQuery.matches;
  let frame = null, previousTime = 0, elapsed = 0, renderedFrames = 0;
  let activeKey = null, hoverKey = null, width = 0, height = 0, fitDistance = 1500;
  const view = { yaw: .44, elevation: .62, zoom: 1 };
  const projection = { boundsAtFit: null };
  const canAnimate = () => state === "ready" && !lost && inViewport && !userPaused && !document.hidden && !document.querySelector("dialog[open]");
  const canRender = () => state === "ready" && !lost && !document.hidden;

  function setNotice(message) {
    status.textContent = message;
    status.hidden = !message;
  }
  function stopFrame() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }
  function syncButton() {
    motionButton.setAttribute("aria-pressed", String(userPaused));
    motionButton.innerHTML = userPaused ? '<span aria-hidden="true">▶</span> 움직임 재생' : '<span aria-hidden="true">Ⅱ</span> 움직임 일시정지';
  }
  function fallback(message, reason) {
    stopFrame(); state = "unavailable";
    canvas.hidden = true; labels.hidden = true;
    host.classList.remove("is-ready");
    host.classList.add("is-unavailable");
    controls.forEach(button => { button.disabled = true; });
    setNotice(message);
    canvas.dataset.renderer = "unavailable";
    canvas.dataset.animationState = "paused";
    console.warn("Portfolio 3D view:", reason);
  }
  function orbitPoint(p, angle) {
    const x = Math.cos(angle) * p.radius, z = Math.sin(angle) * p.radius;
    const y = -z * Math.sin(p.inc), z2 = z * Math.cos(p.inc);
    return new THREE.Vector3(x * Math.cos(p.node) - z2 * Math.sin(p.node), y, x * Math.sin(p.node) + z2 * Math.cos(p.node));
  }
  function seeded(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function setCamera(distance) {
    camera.position.set(Math.sin(view.yaw) * Math.cos(view.elevation) * distance, Math.sin(view.elevation) * distance, Math.cos(view.yaw) * Math.cos(view.elevation) * distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }
  function sampleBounds(distance) {
    setCamera(distance);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let x = 0, y = 0;
    for (const sample of fitSamples) {
      const local = sample.position.clone().applyMatrix4(camera.matrixWorldInverse);
      const depth = Math.max(1, -local.z - sample.extent);
      const projected = sample.position.clone().project(camera);
      x = Math.max(x, Math.abs(projected.x) + sample.extent / (depth * tan * camera.aspect));
      y = Math.max(y, Math.abs(projected.y) + sample.extent / (depth * tan));
    }
    return { x, y };
  }
  function fitCamera() {
    let low = 600, high = 6000;
    for (let i = 0; i < 14; i++) {
      const candidate = (low + high) / 2;
      const bounds = sampleBounds(candidate);
      if (bounds.x > .94 || bounds.y > .86) low = candidate;
      else high = candidate;
    }
    fitDistance = high;
    projection.boundsAtFit = sampleBounds(high);
    setCamera(fitDistance / view.zoom);
  }
  function resize() {
    if (!renderer || !camera || lost) return;
    width = host.clientWidth; height = host.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 768 ? 1.25 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fitCamera();
    invalidate();
  }
  function makeOrbit(p) {
    const points = Array.from({ length: 192 }, (_, i) => orbitPoint(p, i / 192 * TAU));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: "#53657c", transparent: true, opacity: .27, depthWrite: false });
    const line = new THREE.LineLoop(geometry, material);
    scene.add(line);
    return line;
  }
  function atmosphere(radius, color, strength) {
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 24), new THREE.ShaderMaterial({
      uniforms: { tint: { value: new THREE.Color(color) }, strength: { value: strength } },
      vertexShader: "varying vec3 vNormal; varying vec3 vView; void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
      fragmentShader: "uniform vec3 tint;uniform float strength;varying vec3 vNormal;varying vec3 vView;void main(){float rim=pow(1.0-max(0.0,dot(normalize(vNormal),normalize(vView))),3.5);gl_FragColor=vec4(tint,rim*strength);}",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
  }
  function makeRing(p, texture) {
    const inner = p.size * (p.kind === "wide-rings" ? 1.28 : 1.45);
    const outer = p.size * (p.kind === "wide-rings" ? 2.1 : 1.8);
    const geometry = new THREE.RingGeometry(inner, outer, 128, 8);
    const position = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
      const radius = Math.hypot(position.getX(i), position.getY(i));
      uv.setXY(i, (radius - inner) / (outer - inner), .5);
    }
    const material = new THREE.MeshStandardMaterial({ map: texture, color: p.kind === "wide-rings" ? "#d8c4a4" : "#82acae", side: THREE.DoubleSide, transparent: true, opacity: p.kind === "wide-rings" ? .94 : .56, alphaTest: .06, roughness: 1, metalness: 0, depthWrite: false });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.castShadow = true; ring.receiveShadow = true;
    return ring;
  }
  function makeBody(p, textures) {
    const root = new THREE.Group(), axis = new THREE.Group();
    root.name = p.key; axis.rotation.z = p.tilt; root.add(axis); scene.add(root);
    const geometry = new THREE.SphereGeometry(p.size, 64, 40);
    if (p.kind === "irregular") {
      const attribute = geometry.attributes.position;
      for (let i = 0; i < attribute.count; i++) {
        const n = new THREE.Vector3().fromBufferAttribute(attribute, i).normalize();
        const rough = 1 + .09 * Math.sin(n.x * 6 + n.y * 3) * Math.cos(n.z * 5) + .035 * Math.sin(n.y * 11);
        attribute.setXYZ(i, n.x * p.size * rough * 1.16, n.y * p.size * rough * .86, n.z * p.size * rough);
      }
      geometry.computeVertexNormals();
    }
    const material = new THREE.MeshStandardMaterial({ map: textures[p.map], roughness: p.kind === "terrestrial" ? .72 : .96, metalness: 0, color: p.kind === "cratered" ? "#bec2dc" : "#ffffff" });
    if (["rocky", "cratered", "irregular"].includes(p.kind)) {
      material.bumpMap = textures[p.map]; material.bumpScale = p.kind === "irregular" ? 1.2 : .5;
    }
    const surface = new THREE.Mesh(geometry, material);
    surface.name = p.key + "-surface"; surface.userData.domainKey = p.key;
    surface.castShadow = true; surface.receiveShadow = true;
    axis.add(surface);
    let cloud = null, ring = null;
    const moons = [];
    if (p.kind === "terrestrial") {
      cloud = new THREE.Mesh(new THREE.SphereGeometry(p.size * 1.013, 48, 32), new THREE.MeshStandardMaterial({ color: "#ffffff", alphaMap: textures.clouds, transparent: true, opacity: .62, depthWrite: false, roughness: 1 }));
      axis.add(cloud); axis.add(atmosphere(p.size * 1.035, "#649dd5", .5));
    }
    if (["wide-rings", "tilted-rings"].includes(p.kind)) {
      ring = makeRing(p, textures.ring); ring.userData.domainKey = p.key; axis.add(ring);
    }
    if (["blue-giant", "tilted-rings"].includes(p.kind)) axis.add(atmosphere(p.size * 1.02, p.color, .22));
    if (p.kind === "moons") {
      for (let i = 0; i < 3; i++) {
        const moon = new THREE.Mesh(new THREE.SphereGeometry(3.4 + i * .7, 24, 16), new THREE.MeshStandardMaterial({ map: textures.moon, roughness: 1 }));
        moon.userData.domainKey = p.key; moon.castShadow = true; root.add(moon); moons.push(moon);
      }
    }
    const label = document.createElement("span");
    label.className = "orbit-body-label"; label.textContent = p.label; label.dataset.key = p.key; labels.append(label);
    const extent = p.size * (p.kind === "wide-rings" ? 2.15 : p.kind === "tilted-rings" ? 1.85 : p.kind === "moons" ? 2.45 : p.kind === "irregular" ? 1.27 : 1.05);
    for (let i = 0; i < 72; i++) fitSamples.push({ position: orbitPoint(p, i / 72 * TAU), extent });
    return { p, root, axis, surface, cloud, ring, moons, label, orbit: makeOrbit(p), extent };
  }
  function makeSpace() {
    const random = seeded(9841), starPositions = [], starColors = [];
    for (let i = 0; i < 3300; i++) {
      const theta = random() * TAU, phi = Math.acos(2 * random() - 1), radius = 1800 + random() * 2800;
      starPositions.push(Math.sin(phi) * Math.cos(theta) * radius, Math.cos(phi) * radius, Math.sin(phi) * Math.sin(theta) * radius);
      const color = new THREE.Color(i % 9 === 0 ? "#eccba1" : "#9eb4d0").multiplyScalar(.4 + random() * .8);
      starColors.push(color.r, color.g, color.b);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.Float32BufferAttribute(starColors, 3));
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: .85, depthWrite: false })));
    const positions = [], colors = [], sizes = [];
    for (let i = 0; i < 6200; i++) {
      const t = Math.pow(random(), .66), arm = i % 3, angle = t * 5.7 + arm * TAU / 3 + (random() - .5) * .48;
      const radius = 10 + t * 205 + (random() - .5) * 18;
      positions.push(Math.cos(angle) * radius, (random() - .5) * 16 * (1 - t * .65), Math.sin(angle) * radius);
      const color = new THREE.Color().lerpColors(new THREE.Color("#f7d3a0"), new THREE.Color("#738ead"), t).multiplyScalar(.7 + random() * .6);
      colors.push(color.r, color.g, color.b); sizes.push(1.5 + (1 - t) * 3.5 + random() * 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("pointSize", new THREE.Float32BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      vertexColors: true,
      vertexShader: "attribute float pointSize;varying vec3 vColor;void main(){vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(pointSize*600.0/-mv.z,1.0,8.0);gl_Position=projectionMatrix*mv;}",
      fragmentShader: "varying vec3 vColor;void main(){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;float a=pow(1.0-d*2.0,2.0)*.7;gl_FragColor=vec4(vColor,a);}",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    galaxy = new THREE.Points(geometry, material); scene.add(galaxy);
    const core = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 24), new THREE.MeshBasicMaterial({ color: "#ffe3b6" }));
    scene.add(core); scene.add(atmosphere(8, "#f2bd77", .8));
    const coreLight = new THREE.PointLight("#ffc989", 9000, 0, 2); scene.add(coreLight);
  }
  function highlight() {
    for (const body of bodies) {
      const on = body.p.key === activeKey || body.p.key === hoverKey;
      body.surface.material.emissive.set(on ? body.p.color : "#000000");
      body.surface.material.emissiveIntensity = on ? .14 : 0;
      body.orbit.material.color.set(on ? body.p.color : "#53657c");
      body.orbit.material.opacity = on ? .65 : .27;
      body.label.classList.toggle("is-active", on);
    }
  }
  function updateBodies() {
    for (const body of bodies) {
      body.root.position.copy(orbitPoint(body.p, body.p.phase + elapsed * body.p.speed));
      body.surface.rotation.y = elapsed * (body.p.kind === "irregular" ? .09 : .12);
      if (body.cloud) body.cloud.rotation.y = elapsed * .137;
      body.moons.forEach((moon, i) => {
        const angle = elapsed * (.23 - i * .035) + i * 2.1, radius = body.p.size * (1.65 + i * .3);
        moon.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * .14, Math.sin(angle) * radius);
        moon.rotation.y = elapsed * .08;
      });
    }
    galaxy.rotation.y = elapsed * .014;
  }
  function updateLabels() {
    const entries = bodies.map(body => {
      const point = body.root.position.clone().project(camera);
      const distance = body.root.position.distanceTo(camera.position);
      const r = body.extent / distance * height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      return { body, x: (point.x * .5 + .5) * width, y: (-point.y * .5 + .5) * height, r, z: point.z };
    });
    const occupied = entries.map(item => ({ x: item.x - item.r, y: item.y - item.r, w: item.r * 2, h: item.r * 2 }));
    for (const item of entries) {
      const { body, x, y, r, z } = item, label = body.label;
      const selected = body.p.key === activeKey || body.p.key === hoverKey;
      label.hidden = z > 1 || z < -1 || (width < 640 && !selected);
      if (label.hidden) continue;
      const w = label.offsetWidth || 65, h = 24;
      const candidates = [[x + r + 10, y - 12], [x - r - w - 10, y - 12], [x - w / 2, y + r + 9], [x - w / 2, y - r - 31], [x + r + 10, y + 18], [x - r - w - 10, y - 42]];
      const chosen = candidates.find(([left, top]) => left > 8 && left + w < width - 8 && top > 8 && top + h < height - 8 && !occupied.some(box => left < box.x + box.w && left + w > box.x && top < box.y + box.h && top + h > box.y));
      if (!chosen && !selected) { label.hidden = true; continue; }
      const left = Math.max(8, Math.min(width - w - 8, chosen ? chosen[0] : x + r + 8));
      const top = Math.max(8, Math.min(height - h - 8, chosen ? chosen[1] : y - 12));
      label.style.transform = "translate(" + left.toFixed(1) + "px," + top.toFixed(1) + "px)";
      occupied.push({ x: left, y: top, w, h });
    }
  }
  function render(now) {
    frame = null;
    if (!canRender()) return;
    if (canAnimate()) elapsed += Math.max(0, Math.min((now - previousTime) / 1000, .05));
    previousTime = now;
    updateBodies();
    renderer.render(scene, camera);
    updateLabels();
    renderedFrames++;
    canvas.dataset.animationState = canAnimate() ? "running" : "paused";
    if (canAnimate()) frame = requestAnimationFrame(render);
  }
  function invalidate() {
    stopFrame(); previousTime = performance.now();
    canvas.dataset.animationState = canAnimate() ? "running" : "paused";
    if (canRender()) frame = requestAnimationFrame(render);
  }
  function pick(event) {
    if (state !== "ready" || lost) return null;
    const rect = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(pointer, camera);
    scene.updateMatrixWorld();
    const targets = bodies.flatMap(body => [body.surface, ...(body.ring ? [body.ring] : []), ...body.moons]);
    return ray.intersectObjects(targets, false)[0]?.object.userData.domainKey || null;
  }
  function openKey(key) {
    if (key) window.PortfolioUI.openDetail(key, document.querySelector('.domain-link[data-detail-key="' + key + '"]'));
  }
  let gesture = null;
  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0 || state !== "ready") return;
    gesture = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: 0, touch: event.pointerType === "touch" };
    if (!gesture.touch) { canvas.setPointerCapture(event.pointerId); canvas.classList.add("dragging"); }
  });
  canvas.addEventListener("pointermove", event => {
    if (gesture) {
      const dx = event.clientX - gesture.lastX, dy = event.clientY - gesture.lastY;
      gesture.moved += Math.abs(dx) + Math.abs(dy);
      gesture.lastX = event.clientX; gesture.lastY = event.clientY;
      if (!gesture.touch) {
        view.yaw -= dx * .005; view.elevation = Math.max(.13, Math.min(1.35, view.elevation + dy * .004));
        fitCamera(); invalidate();
      }
    } else if (event.pointerType !== "touch") {
      const key = pick(event);
      canvas.style.cursor = key ? "pointer" : "grab";
      if (key !== hoverKey) { hoverKey = key; highlight(); invalidate(); }
    }
  });
  canvas.addEventListener("pointerup", event => {
    if (!gesture) return;
    if (gesture.moved < 8) openKey(pick(event));
    gesture = null; canvas.classList.remove("dragging");
  });
  canvas.addEventListener("pointercancel", () => { gesture = null; canvas.classList.remove("dragging"); });
  canvas.addEventListener("pointerleave", () => { if (!gesture) { hoverKey = null; highlight(); invalidate(); } });
  motionButton.addEventListener("click", () => { userPaused = !userPaused; syncButton(); invalidate(); });
  document.getElementById("orbit-zoom-in").addEventListener("click", () => { view.zoom = Math.min(1.7, view.zoom * 1.16); setCamera(fitDistance / view.zoom); invalidate(); });
  document.getElementById("orbit-zoom-out").addEventListener("click", () => { view.zoom = Math.max(.72, view.zoom / 1.16); setCamera(fitDistance / view.zoom); invalidate(); });
  document.getElementById("orbit-reset").addEventListener("click", () => { view.yaw = .44; view.elevation = .62; view.zoom = 1; fitCamera(); invalidate(); });
  document.addEventListener("portfolio:domain-highlight", event => { activeKey = event.detail.key; highlight(); invalidate(); });
  document.addEventListener("portfolio:domain-preview", event => { hoverKey = event.detail.key; highlight(); invalidate(); });
  document.addEventListener("portfolio:modal-change", invalidate);
  document.addEventListener("visibilitychange", invalidate);
  motionQuery.addEventListener("change", () => { userPaused = motionQuery.matches; syncButton(); invalidate(); });
  new IntersectionObserver(entries => { inViewport = entries[0].isIntersecting; invalidate(); }, { threshold: .05 }).observe(host);
  new ResizeObserver(resize).observe(host);
  syncButton(); controls.forEach(button => { button.disabled = true; });

  async function initialize() {
    if (state !== "idle") return;
    state = "loading";
    setNotice("3D 공간을 준비하고 있습니다.");
    try {
      THREE = await import("./assets/vendor/three/three.module.min.js");
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.setClearColor("#080b14"); renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
      scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(43, 1, 1, 10000);
      scene.add(new THREE.AmbientLight("#a3bbdf", .48));
      const keyLight = new THREE.DirectionalLight("#fff2de", 3.5);
      keyLight.position.set(-330, 550, 450); keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      Object.assign(keyLight.shadow.camera, { left: -600, right: 600, top: 600, bottom: -600, near: 1, far: 1800 });
      keyLight.shadow.bias = -.0005; keyLight.shadow.normalBias = .4; scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight("#6e9ccf", .8); rimLight.position.set(350, 120, -550); scene.add(rimLight);
      const loader = new THREE.TextureLoader().setPath("assets/space/");
      const textures = {};
      await Promise.all(Object.entries(textureFiles).map(async ([name, file]) => {
        textureState[name] = "loading";
        const texture = await loader.loadAsync(file);
        if (name !== "clouds") texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        textures[name] = texture; textureState[name] = "ready";
      }));
      bodies = worlds.map(p => makeBody(p, textures)); makeSpace();
      state = "ready"; canvas.hidden = false; labels.hidden = false;
      host.classList.add("is-ready"); host.classList.remove("is-unavailable");
      canvas.dataset.renderer = "webgl2"; controls.forEach(button => { button.disabled = false; });
      setNotice(""); resize();
      canvas.addEventListener("webglcontextlost", event => {
        event.preventDefault(); lost = true; stopFrame();
        canvas.dataset.animationState = "paused"; labels.hidden = true; canvas.style.visibility = "hidden";
        setNotice("3D 화면 연결이 잠시 끊겼습니다. 아래 목록으로 계속 살펴보실 수 있습니다.");
      });
      canvas.addEventListener("webglcontextrestored", () => {
        lost = false; labels.hidden = false; canvas.style.visibility = "";
        setNotice(""); resize();
      });
    } catch (error) {
      renderer?.dispose();
      fallback("이 환경에서는 3D 화면을 표시하지 못했습니다. 아래 8개 목록에서 같은 내용을 살펴보실 수 있습니다.", error?.message || String(error));
    }
  }
  const preparation = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { preparation.disconnect(); initialize(); }
  }, { rootMargin: "500px" });
  preparation.observe(host);
  window.PortfolioOrbit = Object.freeze({
    inspect: () => ({
      implementation: "Three.js WebGL2", revision: THREE?.REVISION || null, state, contextLost: lost,
      camera: camera?.type || null, perspective: camera?.isPerspectiveCamera === true,
      animationState: canvas.dataset.animationState, inViewport, userPaused, reducedMotion: motionQuery.matches,
      elapsedSeconds: elapsed, renderedFrames, width, height, zoom: view.zoom,
      cameraPosition: camera?.position.toArray() || null, fitBounds: projection.boundsAtFit,
      triangles: renderer?.info.render.triangles || 0, calls: renderer?.info.render.calls || 0,
      geometries: renderer?.info.memory.geometries || 0, textureCount: renderer?.info.memory.textures || 0,
      textures: { ...textureState },
      bodies: bodies.map(body => {
        const point = body.root.position.clone().project(camera);
        return { key: body.p.key, form: body.p.kind, geometry: body.surface.geometry.type, vertices: body.surface.geometry.attributes.position.count, rings: Number(!!body.ring), moons: body.moons.length, position: body.root.position.toArray(), rotationY: body.surface.rotation.y, screen: { x: (point.x * .5 + .5) * width, y: (-point.y * .5 + .5) * height }, labelVisible: !body.label.hidden };
      })
    })
  });
})();
