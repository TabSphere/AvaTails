// ─────────────────────────────────────────────────────────────────────────────
// TabSphere — YouTube Automation Division · 3D Operations Floor (v8, multi-brand)
// Adapted from Gaurav2693/ai-office (MIT License) — https://github.com/Gaurav2693/ai-office
// © Gaurav Mishra. Reworked for TabSphere: 6 real agents driven by the live job
// queue, inside bright AI data-centre halls — one themed floor per channel brand.
// To add a future channel/office: add ONE entry to OFFICE_THEMES below and one
// to the BRANDS list in app/page.tsx — everything else is automatic.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from "three";

export const OFFICE_AGENTS = [
  { id: "chief",     name: "CHIEF",  full: "Chief of Staff", color: 0xffb020, hex: "#FFB020", screen: "chief",     hair: 0x3e2723, shirt: 0x37474f, pants: 0x1a1a2e },
  { id: "writer",    name: "WRITER", full: "Scriptwriter",   color: 0x7c4dff, hex: "#7C4DFF", screen: "writer",    hair: 0x1a1a2e, shirt: 0x4527a0, pants: 0x263238 },
  { id: "voice",     name: "VOICE",  full: "Voice Artist",   color: 0x00c853, hex: "#00C853", screen: "voice",     hair: 0x222222, shirt: 0x1b7a43, pants: 0x1a1a2e },
  { id: "artist",    name: "ARTIST", full: "Illustrator",    color: 0xe040fb, hex: "#E040FB", screen: "artist",    hair: 0x4a148c, shirt: 0x8e24aa, pants: 0x1a1a2e },
  { id: "editor",    name: "EDITOR", full: "Video Editor",   color: 0x448aff, hex: "#448AFF", screen: "editor",    hair: 0x3e2723, shirt: 0x1565c0, pants: 0x263238 },
  { id: "publisher", name: "PUB",    full: "Publisher",      color: 0xff6d00, hex: "#FF6D00", screen: "publisher", hair: 0x1a1a1a, shirt: 0xd84315, pants: 0x3e2723 },
];

// ── Brand themes: one per channel. Add future divisions here. ───────────────
export const OFFICE_THEMES = {
  avatails: {
    id: "avatails",
    dayBg: 0x93a9d4,
    wall: 0xccd6e8, wallSide: 0xd4ddee, floor: 0xdde4ee,
    gridBase: "#dde4ee", gridLine: "rgba(40,90,180,0.14)", gridBorder: "rgba(40,90,180,0.28)",
    accent: 0xffb020, accent2: 0x0fa8c8,
    signBg: "#ccd6e8",
    signA: "Tab", signAColor: "#16224a", signB: "Sphere", signBColor: "#f59f00",
    signSub: "Y O U T U B E   A U T O M A T I O N   D I V I S I O N", signSubColor: "#0e7a8f",
    boardIdle: "@AVATAILS — QUEUE EMPTY",
    packetA: 0xf59f00, packetB: 0x0fa8c8,
  },
  wildtails: {
    id: "wildtails",
    dayBg: 0x9fc4a8,
    wall: 0xd2e2cc, wallSide: 0xdae8d5, floor: 0xdfe8da,
    gridBase: "#dfe8da", gridLine: "rgba(28,105,58,0.14)", gridBorder: "rgba(28,105,58,0.28)",
    accent: 0x2e9e5b, accent2: 0xff6d00,
    signBg: "#d2e2cc",
    signA: "Wild", signAColor: "#1b5e20", signB: "Tails", signBColor: "#ff6d00",
    signSub: "B Y   T A B S P H E R E   ·   W I L D   N A T U R E   D I V I S I O N", signSubColor: "#2e7d46",
    boardIdle: "@WILDTAILS — QUEUE EMPTY",
    packetA: 0x2e9e5b, packetB: 0xff6d00,
  },
};

const CHAT_PHRASES = [
  "GPU cluster at 98% 🔥", "cooling nominal ❄️", "latency 12ms ⚡", "episode shipped 📦",
  "render done ✅", "queue's empty 😴", "new script today?", "voiceover sounds great 🎙️",
  "26 letters to go!", "kids will love this one 🐊", "crossfades are smooth 🎬",
  "who queued 10 jobs? 😅", "failover test passed 💚", "token budget check 📊",
];

class RNG {
  constructor(s = 42) { this.s = s; }
  n() { this.s = (this.s * 16807) % 2147483647; return (this.s - 1) / 2147483646; }
  r(a, b) { return a + this.n() * (b - a); }
  i(a, b) { return Math.floor(this.r(a, b + 1)); }
}

export function createOfficeScene(container, theme = OFFICE_THEMES.avatails) {
  const rng = new RNG(7);
  const W = () => container.clientWidth || 800;
  const H = () => container.clientHeight || 480;

  // ── Scene / camera / renderer ────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.dayBg);
  scene.fog = new THREE.FogExp2(theme.dayBg, 0.004);

  const camera = new THREE.PerspectiveCamera(30, W() / H(), 0.1, 500);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W(), H());
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Custom orbit (drag rotate, wheel zoom, auto-rotate after idle)
  const sph = { theta: 0.6, phi: 1.0, radius: 21 };
  const camTarget = new THREE.Vector3(0, 1.2, 0);
  let autoRot = true, isDrag = false, px = 0, py = 0, autoTmr = null;
  function updCam() {
    sph.phi = Math.max(0.25, Math.min(Math.PI / 2.4, sph.phi));
    sph.radius = Math.max(10, Math.min(45, sph.radius));
    camera.position.set(
      sph.radius * Math.sin(sph.phi) * Math.sin(sph.theta) + camTarget.x,
      sph.radius * Math.cos(sph.phi) + camTarget.y,
      sph.radius * Math.sin(sph.phi) * Math.cos(sph.theta) + camTarget.z
    );
    camera.lookAt(camTarget);
  }
  updCam();
  const dom = renderer.domElement;
  const onDown = (e) => { isDrag = true; autoRot = false; px = e.clientX; py = e.clientY; if (autoTmr) clearTimeout(autoTmr); };
  const onMove = (e) => {
    if (!isDrag) return;
    sph.theta -= (e.clientX - px) * 0.005; sph.phi -= (e.clientY - py) * 0.005;
    px = e.clientX; py = e.clientY; updCam();
  };
  const onUp = () => { if (isDrag) { isDrag = false; autoTmr = setTimeout(() => (autoRot = true), 6000); } };
  const onWheel = (e) => { e.preventDefault(); sph.radius += e.deltaY * 0.02; updCam(); };
  dom.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  dom.addEventListener("wheel", onWheel, { passive: false });

  // ── Lights (bright facility lighting) ────────────────────────────────────
  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(12, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb8c4d8, 0.5);
  scene.add(hemi);

  // ── Materials / shell ────────────────────────────────────────────────────
  const office = new THREE.Group();
  scene.add(office);
  const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const MB = (c) => new THREE.MeshBasicMaterial({ color: c });

  // Raised floor: light base + soft grid (theme-tinted)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.15, 18), M(theme.floor));
  floor.position.y = -0.075; floor.receiveShadow = true; office.add(floor);
  const gridCv = document.createElement("canvas"); gridCv.width = 256; gridCv.height = 256;
  const gc = gridCv.getContext("2d");
  gc.fillStyle = theme.gridBase; gc.fillRect(0, 0, 256, 256);
  gc.strokeStyle = theme.gridLine; gc.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    gc.beginPath(); gc.moveTo(i, 0); gc.lineTo(i, 256); gc.stroke();
    gc.beginPath(); gc.moveTo(0, i); gc.lineTo(256, i); gc.stroke();
  }
  gc.strokeStyle = theme.gridBorder; gc.lineWidth = 3;
  gc.strokeRect(1, 1, 254, 254);
  const gridTex = new THREE.CanvasTexture(gridCv);
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.repeat.set(6.5, 4.5);
  const gridFloor = new THREE.Mesh(new THREE.PlaneGeometry(26, 18), new THREE.MeshBasicMaterial({ map: gridTex }));
  gridFloor.rotation.x = -Math.PI / 2; gridFloor.position.y = 0.005; office.add(gridFloor);

  // ── Room shell: light walls, beams, skirting, brand stripes ──────────────
  const wall = new THREE.Mesh(new THREE.BoxGeometry(26, 4.5, 0.2), M(theme.wall));
  wall.position.set(0, 2.25, -8.9); office.add(wall);
  [-13, 13].forEach((wx) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.5, 18), M(theme.wallSide));
    side.position.set(wx, 2.25, 0); office.add(side);
  });
  // ceiling beams (suggest a ceiling without blocking top-down orbit views)
  [-4, 0, 4].forEach((bz) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(26, 0.16, 0.4), M(0xb4c0d8));
    beam.position.set(0, 4.5, bz); office.add(beam);
  });
  // skirting boards
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(26, 0.18, 0.06), M(0xffffff));
  skirt.position.set(0, 0.09, -8.77); office.add(skirt);
  [-12.87, 12.87].forEach((wx) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 18), M(0xffffff));
    s.position.set(wx, 0.09, 0); office.add(s);
  });
  // brand accent stripe + accent lines
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(26, 0.14, 0.04), MB(theme.accent));
  stripe.position.set(0, 0.55, -8.78); office.add(stripe);
  [0.28, 4.1].forEach((wy) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(26, 0.05, 0.04), MB(theme.accent2));
    line.position.set(0, wy, -8.78); office.add(line);
  });
  [-12.87, 12.87].forEach((wx) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 18), MB(theme.accent2));
    line.position.set(wx, 4.1, 0); office.add(line);
  });

  // Uplink status displays flanking the sign
  [-8.5, 8.5].forEach((wx, idx) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.9, 0.08), M(0x16224a));
    frame.position.set(wx, 2.7, -8.76); office.add(frame);
    const dispCv = document.createElement("canvas"); dispCv.width = 128; dispCv.height = 80;
    const dc = dispCv.getContext("2d");
    dc.fillStyle = "#0a1130"; dc.fillRect(0, 0, 128, 80);
    dc.strokeStyle = "#18FFFF"; dc.lineWidth = 2; dc.beginPath();
    for (let i = 0; i <= 16; i++) {
      const x = 6 + i * 7.2;
      const y = 44 + Math.sin(i * 1.3 + idx * 2) * 16 + Math.cos(i * 0.7) * 8;
      if (i === 0) dc.moveTo(x, y); else dc.lineTo(x, y);
    }
    dc.stroke();
    dc.fillStyle = "rgba(61,220,151,0.85)";
    for (let i = 0; i < 8; i++) dc.fillRect(8 + i * 15, 64 - (i * 7 + idx * 11) % 22, 9, 22);
    dc.font = "bold 9px monospace"; dc.fillStyle = "#18FFFF";
    dc.fillText(idx === 0 ? "UPLINK A" : "UPLINK B", 8, 12);
    dc.fillStyle = "#3DDC97"; dc.fillText("● LIVE", 92, 12);
    const dispTex = new THREE.CanvasTexture(dispCv); dispTex.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.7), new THREE.MeshBasicMaterial({ map: dispTex }));
    disp.position.set(wx, 2.7, -8.71); office.add(disp);
  });

  // Back wall sign: brand title + division subtitle (theme-driven)
  const signCv = document.createElement("canvas"); signCv.width = 512; signCv.height = 96;
  const signCx = signCv.getContext("2d");
  signCx.fillStyle = theme.signBg; signCx.fillRect(0, 0, 512, 96);
  signCx.font = "bold 46px 'Segoe UI', sans-serif"; signCx.textAlign = "center";
  signCx.fillStyle = theme.signAColor; signCx.fillText(theme.signA, 196, 56);
  signCx.fillStyle = theme.signBColor; signCx.fillText(theme.signB, 322, 56);
  signCx.font = "bold 17px 'Segoe UI', sans-serif"; signCx.fillStyle = theme.signSubColor;
  signCx.fillText(theme.signSub, 256, 84);
  const signTex = new THREE.CanvasTexture(signCv); signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, 3.1, -8.78); office.add(sign);

  // Mission-control board: current job + live progress bar (under the sign)
  const boardCv = document.createElement("canvas"); boardCv.width = 512; boardCv.height = 128;
  const boardTex = new THREE.CanvasTexture(boardCv); boardTex.colorSpace = THREE.SRGBColorSpace;
  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.55, 0.06), M(0x16224a));
  boardFrame.position.set(0, 1.72, -8.8); office.add(boardFrame);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: boardTex }));
  board.position.set(0, 1.72, -8.76); office.add(board);
  function drawBoard(title, pct, stage) {
    const c = boardCv.getContext("2d");
    c.fillStyle = "#0a1130"; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = "#2c4a8a"; c.lineWidth = 4; c.strokeRect(2, 2, 508, 124);
    c.textAlign = "center";
    if (title) {
      c.fillStyle = "#FFB020"; c.font = "bold 32px 'Segoe UI', sans-serif";
      c.fillText(title.toUpperCase().slice(0, 26), 256, 46);
      c.fillStyle = "#18FFFF"; c.font = "19px 'Segoe UI', sans-serif";
      c.fillText((stage || "working").toUpperCase().slice(0, 34), 256, 74);
      c.fillStyle = "#22305c"; c.fillRect(56, 92, 380, 18);
      c.fillStyle = "#3DDC97";
      c.fillRect(56, 92, 380 * Math.max(0, Math.min(1, (pct || 0) / 100)), 18);
      c.fillStyle = "#F3F5FF"; c.font = "bold 15px 'Segoe UI', sans-serif";
      c.fillText(Math.round(pct || 0) + "%", 466, 107);
    } else {
      c.fillStyle = "#7fd4ff"; c.font = "bold 24px 'Segoe UI', sans-serif";
      c.fillText(theme.boardIdle, 256, 58);
      c.fillStyle = "#9AA3C7"; c.font = "17px 'Segoe UI', sans-serif";
      c.fillText("enqueue jobs to start production", 256, 92);
    }
    boardTex.needsUpdate = true;
  }
  drawBoard(null, 0, null);

  // Wall clock — shows real local time
  const clockCv = document.createElement("canvas"); clockCv.width = 96; clockCv.height = 96;
  const clockTex = new THREE.CanvasTexture(clockCv); clockTex.colorSpace = THREE.SRGBColorSpace;
  const wallClock = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ map: clockTex, transparent: true })
  );
  wallClock.position.set(5.6, 3.1, -8.78); office.add(wallClock);
  function drawClock(min) {
    const c = clockCv.getContext("2d");
    c.clearRect(0, 0, 96, 96);
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(48, 48, 44, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#16224a"; c.lineWidth = 4; c.stroke();
    c.fillStyle = "#8a94a8";
    for (let h = 0; h < 12; h++) {
      const a = h * (Math.PI / 6);
      c.fillRect(48 + Math.cos(a) * 36 - 1.5, 48 + Math.sin(a) * 36 - 1.5, 3, 3);
    }
    const hr = ((min / 60) % 12) * (Math.PI / 6) - Math.PI / 2;
    const mn = (min % 60) * (Math.PI / 30) - Math.PI / 2;
    c.strokeStyle = "#16224a";
    c.lineWidth = 5; c.beginPath(); c.moveTo(48, 48); c.lineTo(48 + Math.cos(hr) * 20, 48 + Math.sin(hr) * 20); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(48, 48); c.lineTo(48 + Math.cos(mn) * 31, 48 + Math.sin(mn) * 31); c.stroke();
    c.fillStyle = "#f59f00"; c.beginPath(); c.arc(48, 48, 4, 0, Math.PI * 2); c.fill();
    clockTex.needsUpdate = true;
  }

  // Ceiling tube lights
  for (let x = -8; x <= 8; x += 8) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 0.6), MB(0xffffff));
    tube.position.set(x, 4.4, 0); office.add(tube);
    const pl = new THREE.PointLight(0xffffff, 0.5, 12, 1.8);
    pl.position.set(x, 4.1, 0); office.add(pl);
    tube.userData.isTube = true; tube.userData.light = pl;
  }
  const tubes = office.children.filter((c) => c.userData.isTube);

  // ── Server racks with blinking LED fronts ────────────────────────────────
  const racks = [];
  function makeRackFront() {
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 160;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const ctx = cv.getContext("2d");
    const leds = [];
    for (let r = 0; r < 20; r++) {
      for (let i = 0; i < 3; i++) {
        leds.push({
          x: 8 + i * 8, y: 6 + r * 7.6,
          on: Math.random() > 0.4,
          c: ["#3DDC97", "#18FFFF", "#FFB020"][Math.floor(Math.random() * 3)],
          blink: Math.random() > 0.55,
        });
      }
    }
    const draw = () => {
      ctx.fillStyle = "#101a38"; ctx.fillRect(0, 0, 64, 160);
      ctx.fillStyle = "#1c2848";
      for (let r = 0; r < 20; r++) ctx.fillRect(2, 4 + r * 7.6, 60, 6);
      leds.forEach((L) => {
        if (L.blink && Math.random() > 0.5) L.on = !L.on;
        ctx.fillStyle = L.on ? L.c : "#2a3a5f";
        ctx.fillRect(L.x, L.y + 1, 3, 2.4);
      });
      ctx.fillStyle = "#33436e"; ctx.fillRect(36, 4, 24, 152);
      ctx.fillStyle = "#141f3d";
      for (let r = 0; r < 20; r++) ctx.fillRect(38, 5 + r * 7.6, 20, 4);
      tex.needsUpdate = true;
    };
    draw();
    return { tex, draw };
  }
  function buildRack(x, z, ry) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 0.9), M(0x2a3454));
    body.position.set(x, 1.3, z); body.rotation.y = ry; body.castShadow = true; office.add(body);
    const rf = makeRackFront();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.4), new THREE.MeshBasicMaterial({ map: rf.tex }));
    front.position.set(x + Math.sin(ry) * 0.46, 1.3, z + Math.cos(ry) * 0.46);
    front.rotation.y = ry; office.add(front);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.12), MB(0x18c8ff));
    st.position.set(x, 2.66, z); office.add(st);
    racks.push(rf);
  }
  // Server aisles along both side walls
  [-6.5, -4, -1.5, 1, 6.5].forEach((z) => buildRack(-12.1, z, Math.PI / 2));
  [-6.5, -4, -1.5, 1, 3.5, 6.5].forEach((z) => buildRack(12.1, z, -Math.PI / 2));

  // Overhead cable trays
  [-11, 11].forEach((tx) => {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 17), M(0x9aa8c4));
    tray.position.set(tx, 4.35, 0); office.add(tray);
  });
  [-4.2, 4.2].forEach((tz) => {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(22.6, 0.08, 0.6), M(0x9aa8c4));
    tray.position.set(0, 4.35, tz); office.add(tray);
  });

  // Live data packets flowing along the trays (brand colours)
  const packets = [];
  const LANES = [
    { axis: "z", fixed: -11, dir: 1 },
    { axis: "z", fixed: 11, dir: -1 },
    { axis: "x", fixed: -4.2, dir: 1 },
    { axis: "x", fixed: 4.2, dir: -1 },
  ];
  for (let i = 0; i < 16; i++) {
    const lane = LANES[i % 4];
    const pkt = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.09),
      MB(i % 3 === 0 ? theme.packetA : theme.packetB)
    );
    const t = rng.r(-8, 8);
    if (lane.axis === "z") pkt.position.set(lane.fixed, 4.25, t);
    else pkt.position.set(t, 4.25, lane.fixed);
    office.add(pkt);
    packets.push({ mesh: pkt, lane, t, speed: rng.r(1.5, 3.5) });
  }

  // ── Characters ───────────────────────────────────────────────────────────
  function buildChar(agent, standing) {
    const g = new THREE.Group();
    const skin = 0xdeb887;
    if (standing) {
      [[-0.08, 0], [0.08, Math.PI]].forEach(([lx, phase]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), M(agent.pants));
        leg.position.set(lx, 0.2, 0); leg.userData.isLeg = true; leg.userData.phase = phase; g.add(leg);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.16), M(0x222222));
        shoe.position.set(lx, 0.025, 0.02); g.add(shoe);
      });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.16), M(agent.shirt));
      torso.position.set(0, 0.55, 0); torso.castShadow = true; g.add(torso);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.1), M(0xffffff));
      collar.position.set(0, 0.71, 0.03); g.add(collar);
      [-1, 1].forEach((s) => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), M(agent.shirt));
        arm.position.set(s * 0.19, 0.55, 0); g.add(arm);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.07), M(skin));
        hand.position.set(s * 0.19, 0.37, 0); g.add(hand);
      });
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), M(skin));
      head.position.set(0, 0.82, 0); head.castShadow = true; g.add(head);
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.22), M(agent.hair));
      hair.position.set(0, 0.94, 0); g.add(hair);
      const hairB = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.04), M(agent.hair));
      hairB.position.set(0, 0.87, -0.09); g.add(hairB);
      [-1, 1].forEach((s) => {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), MB(0xffffff));
        eye.position.set(s * 0.05, 0.83, 0.101); g.add(eye);
        const pup = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), MB(0x1a1a2e));
        pup.position.set(s * 0.05, 0.83, 0.106); g.add(pup);
      });
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), MB(agent.color));
      badge.position.set(0.19, 0.32, 0.02); g.add(badge);
    } else {
      // Seated: thighs forward, shins down, arms reaching to keyboard
      [-1, 1].forEach((s) => {
        const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.22), M(agent.pants));
        thigh.position.set(s * 0.08, 0.32, 0.08); g.add(thigh);
        const shin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), M(agent.pants));
        shin.position.set(s * 0.08, 0.16, 0.17); g.add(shin);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.14), M(0x222222));
        shoe.position.set(s * 0.08, 0.025, 0.2); g.add(shoe);
      });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.16), M(agent.shirt));
      torso.position.set(0, 0.51, 0); torso.castShadow = true; g.add(torso);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.1), M(0xffffff));
      collar.position.set(0, 0.66, 0.03); g.add(collar);
      [-1, 1].forEach((s) => {
        const ua = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), M(agent.shirt));
        ua.position.set(s * 0.19, 0.52, 0); g.add(ua);
        const fa = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.22), M(skin));
        fa.position.set(s * 0.19, 0.44, 0.12);
        fa.userData.isArm = true; fa.userData.phase = s > 0 ? 0 : Math.PI; g.add(fa);
      });
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), M(skin));
      head.position.set(0, 0.76, 0); head.castShadow = true;
      head.userData.isHead = true; g.add(head);
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.22), M(agent.hair));
      hair.position.set(0, 0.88, 0); g.add(hair);
      const hairB = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.04), M(agent.hair));
      hairB.position.set(0, 0.81, -0.09); g.add(hairB);
      [-1, 1].forEach((s) => {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), MB(0xffffff));
        eye.position.set(s * 0.05, 0.77, 0.101); g.add(eye);
        const pup = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), MB(0x1a1a2e));
        pup.position.set(s * 0.05, 0.77, 0.106); g.add(pup);
      });
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), MB(agent.color));
      badge.position.set(0.19, 0.58, 0.06); g.add(badge);
    }
    return g;
  }

  // ── Monitor screens (canvas textures, role-specific) ─────────────────────
  function drawScreen(sd, frame) {
    const { ctx: c, canvas: cv, type, hex } = sd;
    const w = cv.width, h = cv.height;
    c.fillStyle = "#0D1117"; c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;
    const t = frame * 0.02;
    if (type === "chief") {
      ["#FF6B6B", "#FFB020", "#3DDC97"].forEach((cl, col) => {
        c.fillStyle = cl; c.globalAlpha = 0.25; c.fillRect(8 + col * 40, 8, 34, h - 16);
        c.globalAlpha = 0.9;
        for (let i = 0; i < 3; i++) {
          const y = 14 + ((i * 22 + frame * (0.4 + col * 0.2)) % (h - 30));
          c.fillRect(12 + col * 40, y, 26, 12);
        }
      });
    } else if (type === "writer") {
      c.fillStyle = hex; c.font = "7px monospace";
      for (let i = 0; i < 9; i++) {
        const len = 30 + Math.sin(i * 2.1 + t) * 25 + 30;
        c.globalAlpha = 0.25 + (i % 3) * 0.15;
        c.fillRect(10, 10 + i * 8, len, 3);
      }
      if (Math.sin(t * 5) > 0) { c.globalAlpha = 0.9; c.fillRect(10 + 60 + Math.sin(t) * 10, h - 12, 4, 7); }
    } else if (type === "voice") {
      c.fillStyle = hex;
      for (let i = 0; i < 24; i++) {
        const bh = 6 + Math.abs(Math.sin(t * 3 + i * 0.7)) * 26;
        c.globalAlpha = 0.4 + Math.abs(Math.sin(t * 2 + i)) * 0.5;
        c.fillRect(6 + i * 5, h / 2 - bh / 2, 3, bh);
      }
      c.globalAlpha = 0.8; c.font = "7px monospace"; c.fillText("REC", 8, 12);
      c.fillStyle = "#FF5252";
      if (Math.sin(t * 4) > 0) { c.beginPath(); c.arc(30, 10, 3, 0, Math.PI * 2); c.fill(); }
    } else if (type === "artist") {
      ["#E040FB", "#FF4081", "#7C4DFF", "#448AFF", "#18FFFF", "#69F0AE", "#FFB020", "#FF9100", "#FF5252"].forEach((cl, i) => {
        c.fillStyle = cl; c.globalAlpha = 0.7;
        c.fillRect(8 + (i % 3) * 24, 8 + Math.floor(i / 3) * 18, 18, 12);
      });
      c.globalAlpha = 0.4; c.strokeStyle = hex; c.lineWidth = 1.5;
      c.beginPath(); c.arc(100, 40, 12 + Math.sin(t) * 4, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.8; c.fillStyle = hex;
      c.beginPath(); c.arc(100 + Math.sin(t * 2) * 6, 40 + Math.cos(t * 2) * 6, 3, 0, Math.PI * 2); c.fill();
    } else if (type === "editor") {
      c.fillStyle = hex; c.globalAlpha = 0.2; c.fillRect(8, 12, w - 16, 14);
      c.globalAlpha = 0.5;
      for (let i = 0; i < 6; i++) c.fillRect(10 + i * 19, 14, 15, 10);
      const px = 8 + ((frame * 0.6) % (w - 16));
      c.globalAlpha = 1; c.fillStyle = "#FFFFFF"; c.fillRect(px, 8, 2, 22);
      c.fillStyle = hex; c.globalAlpha = 0.3; c.fillRect(8, 34, w - 16, 8);
      c.globalAlpha = 0.6; c.fillRect(8, 34, (w - 16) * ((Math.sin(t * 0.4) + 1) / 2), 8);
      c.globalAlpha = 0.9; c.font = "7px monospace"; c.fillText("00:" + String(10 + (Math.floor(frame / 60) % 50)), 8, h - 8);
      c.fillText("xfade ✓", w - 42, h - 8);
    } else {
      c.strokeStyle = hex; c.globalAlpha = 0.9; c.lineWidth = 1.5;
      c.strokeRect(w / 2 - 12, 10, 24, 16);
      c.beginPath(); c.moveTo(w / 2 - 12, 10); c.lineTo(w / 2, 4); c.lineTo(w / 2 + 12, 10); c.stroke();
      c.fillStyle = hex; c.globalAlpha = 0.15; c.fillRect(10, 40, w - 20, 12);
      const p = (Math.sin(t * 0.5) + 1) / 2;
      c.globalAlpha = 0.7; c.fillRect(10, 40, (w - 20) * p, 12);
      c.globalAlpha = 0.9; c.font = "7px monospace";
      c.fillText("UPLOAD " + Math.round(p * 100) + "%", 10, 62);
      c.fillText("ep #" + (100 + Math.floor(t * 0.5) % 20), w - 40, 62);
    }
    c.globalAlpha = 1;
  }

  // ── Name labels ──────────────────────────────────────────────────────────
  function makeLabel(agent) {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(1.6, 0.4, 1);
    const draw = (working, stageText) => {
      const c = cv.getContext("2d");
      c.clearRect(0, 0, 256, 64);
      c.fillStyle = "rgba(22,34,74,0.85)";
      c.beginPath(); c.roundRect(28, 8, 200, 48, 12); c.fill();
      c.fillStyle = working ? agent.hex : "#ffffff";
      c.font = "bold 24px 'Segoe UI', sans-serif"; c.textAlign = "center";
      c.fillText(agent.name, 128, 32);
      c.font = "15px 'Segoe UI', sans-serif";
      c.fillStyle = working ? "#3DDC97" : "rgba(255,255,255,0.55)";
      const sub = working ? "● " + (stageText || "working").toUpperCase().slice(0, 20) : "○ idle";
      c.fillText(sub, 128, 50);
      tex.needsUpdate = true;
    };
    draw(false);
    return { sprite: sp, draw };
  }

  // ── Operator consoles (desks) ────────────────────────────────────────────
  const screenData = [];
  const agentData = [];

  function buildDesk(x, z, agent, faceSign) {
    // faceSign: +1 → char sits at z+0.7 facing -z; -1 → char at z-0.7 facing +z
    const g = new THREE.Group();
    [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), M(0x9aa8c0));
      leg.position.set(x + lx, 0.35, z + lz); office.add(leg);
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.75), M(0xe8ecf0));
    top.position.set(x, 0.72, z); top.castShadow = true; top.receiveShadow = true; office.add(top);
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 0.03), M(0xdde4ec));
    front.position.set(x, 0.5, z + faceSign * -0.36); office.add(front);
    // under-desk LED strip (brand accent)
    const led = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.02), MB(theme.accent2));
    led.position.set(x, 0.695, z + faceSign * 0.37); office.add(led);

    // monitor (screen faces the char)
    const monBase = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.12), M(0xaabbcc));
    monBase.position.set(x, 0.75, z + faceSign * -0.1); office.add(monBase);
    const monStand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.03), M(0xaabbcc));
    monStand.position.set(x, 0.86, z + faceSign * -0.1); office.add(monStand);
    const monBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.52, 0.03), M(0x2a2a2a));
    monBody.position.set(x, 1.1, z + faceSign * -0.1); office.add(monBody);
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 80;
    const tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace;
    const sf = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.46), new THREE.MeshBasicMaterial({ map: tex }));
    sf.position.set(x, 1.1, z + faceSign * -0.08);
    if (faceSign > 0) sf.rotation.y = Math.PI;
    office.add(sf);
    screenData.push({ canvas: cv, ctx: cv.getContext("2d"), tex, type: agent.screen, hex: agent.hex });

    // keyboard + mug
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.13), M(0x333333));
    kb.position.set(x, 0.75, z + faceSign * 0.18); office.add(kb);
    const mug = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), M(agent.color));
    mug.position.set(x + 0.55, 0.78, z + faceSign * 0.15); office.add(mug);

    // chair
    const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.4), M(0x46557a));
    cSeat.position.set(x, 0.32, z + faceSign * 0.7); office.add(cSeat);
    const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.04), M(0x46557a));
    cBack.position.set(x, 0.6, z + faceSign * 0.9); office.add(cBack);
    const cLeg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), M(0x90a4ae));
    cLeg.position.set(x, 0.15, z + faceSign * 0.7); office.add(cLeg);

    // colored desk glow (on while working / in dark)
    const glow = new THREE.PointLight(agent.color, 0, 3, 2);
    glow.position.set(x, 1.6, z + faceSign * 0.3);
    office.add(glow);

    // characters + label
    const sitting = buildChar(agent, false);
    sitting.position.set(x, 0, z + faceSign * 0.7);
    if (faceSign > 0) sitting.rotation.y = Math.PI;
    office.add(sitting);
    const walker = buildChar(agent, true);
    walker.visible = false; office.add(walker);
    const label = makeLabel(agent);
    label.sprite.position.set(x, 1.85, z + faceSign * 0.7);
    office.add(label.sprite);

    agentData.push({
      agent, sitting, walker, label,
      home: { x, z: z + faceSign * 0.7 }, faceSign,
      glow,
      state: "sitting", // sitting | walking_out | walking_back | working
      working: false,
      timer: rng.r(2, 10),
      walkTarget: null, walkPause: 0,
      chatCooldown: 0,
    });
    void g;
  }

  // 2 rows × 3 consoles in the operations pit
  const deskX = [-6.5, 0, 6.5];
  OFFICE_AGENTS.forEach((agent, i) => {
    if (i < 3) buildDesk(deskX[i], -3.2, agent, 1);
    else buildDesk(deskX[i - 3], 3.2, agent, -1);
  });

  // ── Props: CRAC cooling unit, visitor lounge, plants ─────────────────────
  const crac = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.9, 0.6), M(0x94a2bc));
  crac.position.set(-10.8, 0.95, 2); crac.castShadow = true; office.add(crac);
  const cracCv = document.createElement("canvas"); cracCv.width = 64; cracCv.height = 128;
  const crc = cracCv.getContext("2d");
  crc.fillStyle = "#0a1130"; crc.fillRect(0, 0, 64, 128);
  crc.fillStyle = "#22305c";
  for (let i = 0; i < 10; i++) crc.fillRect(8, 14 + i * 9, 48, 5);
  crc.fillStyle = "#18FFFF"; crc.font = "bold 8px monospace";
  crc.fillText("CRAC", 20, 10);
  crc.fillStyle = "#3DDC97"; crc.fillRect(52, 4, 6, 4);
  const cracTex = new THREE.CanvasTexture(cracCv); cracTex.colorSpace = THREE.SRGBColorSpace;
  const cracFront = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.8), new THREE.MeshBasicMaterial({ map: cracTex }));
  cracFront.position.set(-10.8, 0.95, 2.31); office.add(cracFront);
  const coolGlow = new THREE.PointLight(0x18c8ff, 0.25, 4, 2);
  coolGlow.position.set(-10.8, 1.9, 2.5); office.add(coolGlow);

  // Visitor lounge corner
  const sofa = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.7), M(0x2c4a78));
  sofa.position.set(10, 0.2, 4); sofa.castShadow = true; office.add(sofa);
  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.15), M(0x2c4a78));
  sofaBack.position.set(10, 0.6, 4.3); office.add(sofaBack);
  const table = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.5), M(0xdde4ec));
  table.position.set(10, 0.175, 2.9); office.add(table);
  const rug = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.02, 2.8), M(0xc3b8e2));
  rug.position.set(10, 0.02, 3.4); rug.receiveShadow = true; office.add(rug);

  function addPlant(px, pz) {
    const pot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), M(0xffffff));
    pot.position.set(px, 0.11, pz); pot.castShadow = true; office.add(pot);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), M(0x2e9e5b));
      leaf.position.set(px + rng.r(-0.08, 0.08), 0.4, pz + rng.r(-0.08, 0.08));
      leaf.rotation.z = rng.r(-0.25, 0.25); office.add(leaf);
    }
  }
  addPlant(-11.5, -7.5); addPlant(11.5, -7.5); addPlant(-11.5, 6.5);

  // A–Z production tracker whiteboard (left wall, bright)
  const wbFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 3.6), M(0x9aa8c4));
  wbFrame.position.set(-12.8, 2.3, 3.5); office.add(wbFrame);
  const wbCv = document.createElement("canvas"); wbCv.width = 256; wbCv.height = 160;
  const wbc = wbCv.getContext("2d");
  wbc.fillStyle = "#ffffff"; wbc.fillRect(0, 0, 256, 160);
  wbc.fillStyle = "#16224a"; wbc.font = "bold 15px 'Segoe UI', sans-serif"; wbc.textAlign = "left";
  wbc.fillText("A-Z PRODUCTION", 12, 22);
  wbc.fillStyle = "#00c853"; wbc.font = "9px monospace"; wbc.textAlign = "right";
  wbc.fillText("● LIVE", 246, 20);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  wbc.textAlign = "center";
  for (let i = 0; i < 26; i++) {
    const col = i % 7, row = Math.floor(i / 7);
    const lx = 16 + col * 33, ly = 44 + row * 28;
    wbc.fillStyle = "#e3eaf6"; wbc.fillRect(lx - 4, ly - 16, 26, 22);
    wbc.strokeStyle = "rgba(22,34,74,0.18)"; wbc.lineWidth = 1;
    wbc.strokeRect(lx - 4, ly - 16, 26, 22);
    wbc.fillStyle = "#16224a"; wbc.font = "bold 14px 'Segoe UI', sans-serif";
    wbc.fillText(letters[i], lx + 9, ly);
  }
  const wbTex = new THREE.CanvasTexture(wbCv); wbTex.colorSpace = THREE.SRGBColorSpace;
  const wb = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.1), new THREE.MeshBasicMaterial({ map: wbTex }));
  wb.position.set(-12.75, 2.3, 3.5); wb.rotation.y = Math.PI / 2; office.add(wb);

  // ── Chat bubbles ─────────────────────────────────────────────────────────
  const bubbles = [];
  function spawnBubble(target, text) {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 72;
    const c = cv.getContext("2d");
    c.fillStyle = "rgba(255,255,255,0.95)";
    c.beginPath(); c.roundRect(4, 4, 248, 52, 14); c.fill();
    c.beginPath(); c.moveTo(110, 56); c.lineTo(128, 70); c.lineTo(146, 56); c.fill();
    c.fillStyle = "#16224a"; c.font = "17px 'Segoe UI', sans-serif"; c.textAlign = "center";
    c.fillText(text, 128, 37);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(1.7, 0.48, 1);
    sp.position.copy(target.position).add(new THREE.Vector3(0, 1.35, 0));
    office.add(sp);
    bubbles.push({ sp, target, life: 3.2 });
  }

  // ── Behavior: wander, chat, work ─────────────────────────────────────────
  const walkDestinations = [
    { x: -10.5, z: 0.5 }, { x: 0, z: 0 }, { x: 10, z: 2.5 }, { x: -11, z: -6.5 }, { x: 9, z: -6 },
  ];

  function updateWalkers(delta, elapsed) {
    agentData.forEach((ad) => {
      if (ad.chatCooldown > 0) ad.chatCooldown -= delta;
      if (ad.working) {
        if (!ad.sitting.visible) { ad.sitting.visible = true; ad.walker.visible = false; ad.state = "sitting"; }
        ad.sitting.children.forEach((ch) => {
          if (ch.userData.isArm) ch.position.z = 0.12 + Math.sin(elapsed * 18 + ch.userData.phase) * 0.02;
          if (ch.userData.isHead) ch.position.y = 0.76 + Math.sin(elapsed * 2.2) * 0.008;
        });
        return;
      }
      if (ad.state === "sitting") {
        ad.sitting.children.forEach((ch) => {
          if (ch.userData.isArm) ch.position.z = 0.12;
          if (ch.userData.isHead) ch.position.y = 0.76 + Math.sin(elapsed * 1.4) * 0.006;
        });
        ad.timer -= delta;
        if (ad.timer <= 0) {
          ad.state = "walking_out";
          ad.sitting.visible = false;
          ad.walker.visible = true;
          ad.walker.position.set(ad.home.x, 0, ad.home.z);
          const d = walkDestinations[rng.i(0, walkDestinations.length - 1)];
          ad.walkTarget = { x: d.x + rng.r(-0.5, 0.5), z: d.z + rng.r(-0.5, 0.5) };
          ad.walkPause = 0;
        }
      } else if (ad.state === "walking_out" || ad.state === "walking_back") {
        const tgt = ad.state === "walking_out" ? ad.walkTarget : ad.home;
        const dx = tgt.x - ad.walker.position.x, dz = tgt.z - ad.walker.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.15) {
          if (ad.state === "walking_out") {
            ad.walkPause += delta;
            if (ad.walkPause > 2 + rng.r(0, 3)) { ad.state = "walking_back"; }
          } else {
            ad.state = "sitting";
            ad.walker.visible = false;
            ad.sitting.visible = true;
            ad.timer = 6 + rng.r(0, 14);
            ad.label.sprite.position.set(ad.home.x, 1.85, ad.home.z);
          }
        } else {
          const sp = 1.6 * delta, nx = dx / dist, nz = dz / dist;
          ad.walker.position.x += nx * sp; ad.walker.position.z += nz * sp;
          ad.walker.rotation.y = Math.atan2(nx, nz);
          ad.walker.children.forEach((ch) => {
            if (ch.userData.isLeg) ch.position.z = Math.sin(elapsed * 10 + ch.userData.phase) * 0.08;
          });
          ad.label.sprite.position.set(ad.walker.position.x, 1.5, ad.walker.position.z);
        }
      }
    });
  }

  function checkConversations() {
    const walkers = agentData.filter((a) => a.state.startsWith("walking") && a.walker.visible);
    for (let i = 0; i < walkers.length; i++) {
      for (let j = i + 1; j < walkers.length; j++) {
        const a = walkers[i], b = walkers[j];
        if (a.chatCooldown > 0 || b.chatCooldown > 0) continue;
        const dx = a.walker.position.x - b.walker.position.x;
        const dz = a.walker.position.z - b.walker.position.z;
        if (dx * dx + dz * dz < 2.25) {
          spawnBubble(a.walker, CHAT_PHRASES[rng.i(0, CHAT_PHRASES.length - 1)]);
          a.chatCooldown = 9; b.chatCooldown = 9;
        }
      }
    }
  }

  function updateBubbles(delta) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.life -= delta;
      b.sp.position.y += delta * 0.12;
      b.sp.material.opacity = Math.min(1, b.life);
      if (b.life <= 0) {
        office.remove(b.sp);
        b.sp.material.map.dispose(); b.sp.material.dispose();
        bubbles.splice(i, 1);
      }
    }
  }

  // ── Time of day / lights-off mode ────────────────────────────────────────
  // Bright facility lighting all day; LIGHTS OFF flips to dark ops mode.
  let timeOfDay = 600;
  let cyberpunk = false;
  const nightBg = new THREE.Color(0x0a0f1e);
  const dayBg = new THREE.Color(theme.dayBg);
  const bgTmp = new THREE.Color();

  function updateTime(min) {
    timeOfDay = min;
    drawClock(min);
    const rawDay = Math.max(0, Math.sin(((min - 360) / 720) * Math.PI)); // 6:00–18:00
    const day = 0.85 + rawDay * 0.15; // facility stays bright around the clock
    sun.intensity = cyberpunk ? 0.05 : 0.5 + day * 0.9;
    sun.color.setHSL(0.58, 0.12, 0.75);
    ambient.intensity = cyberpunk ? 0.12 : 0.55 + day * 0.4;
    hemi.intensity = cyberpunk ? 0.06 : 0.3 + day * 0.3;
    bgTmp.lerpColors(nightBg, cyberpunk ? nightBg : dayBg, day);
    scene.background = bgTmp;
    scene.fog.color.copy(bgTmp);
    tubes.forEach((tb) => {
      tb.material = cyberpunk ? MB(0x2a3a5f) : MB(0xffffff);
      tb.userData.light.intensity = cyberpunk ? 0.04 : 0.4 + day * 0.2;
    });
    coolGlow.intensity = cyberpunk ? 0.45 : 0.25;
    const dark = cyberpunk;
    agentData.forEach((ad) => {
      ad.glow.intensity = ad.working ? 0.8 : dark ? 0.25 : 0;
    });
  }

  let currentStage = null;

  function setWorking(ids, stage) {
    if (stage !== undefined) currentStage = stage;
    const set = new Set(ids || []);
    agentData.forEach((ad) => {
      const w = set.has(ad.agent.id);
      const changed = w !== ad.working;
      ad.working = w;
      if (changed || w) ad.label.draw(w, currentStage);
      if (w && changed) {
        ad.walker.visible = false; ad.sitting.visible = true;
        ad.state = "sitting"; ad.timer = 6 + rng.r(0, 10);
        ad.label.sprite.position.set(ad.home.x, 1.85, ad.home.z);
      }
    });
    updateTime(timeOfDay);
  }

  // Mission-control board: setJob("A is for Alligator", 42, "recording voice") / setJob(null)
  function setJob(title, pct, stage) {
    drawBoard(title || null, pct || 0, stage || null);
  }

  // ── Main loop ────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let frame = 0, rafId = 0;
  function animate() {
    rafId = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();
    frame++;
    if (autoRot) { sph.theta += 0.001; updCam(); }
    if (frame % 3 === 0) {
      screenData.forEach((sd) => { drawScreen(sd, frame); sd.tex.needsUpdate = true; });
    }
    if (frame % 15 === 0) {
      racks.forEach((r) => r.draw());
    }
    packets.forEach((p) => {
      p.t += p.lane.dir * p.speed * delta;
      if (p.t > 8) p.t = -8;
      if (p.t < -8) p.t = 8;
      if (p.lane.axis === "z") p.mesh.position.z = p.t;
      else p.mesh.position.x = p.t;
      p.mesh.rotation.y += delta * 3;
    });
    updateWalkers(delta, elapsed);
    checkConversations();
    updateBubbles(delta);
    renderer.render(scene, camera);
  }
  animate();
  updateTime(timeOfDay);

  const onResize = () => {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
  };
  window.addEventListener("resize", onResize);

  // ── Public API ───────────────────────────────────────────────────────────
  return {
    setWorking,
    setJob,
    setTime: updateTime,
    toggleCyberpunk: () => { cyberpunk = !cyberpunk; updateTime(timeOfDay); return cyberpunk; },
    destroy: () => {
      cancelAnimationFrame(rafId);
      if (autoTmr) clearTimeout(autoTmr);
      dom.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dom.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    },
  };
}
