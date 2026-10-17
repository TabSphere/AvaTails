// ─────────────────────────────────────────────────────────────────────────────
// AvaTails 3D Factory Floor
// Adapted from Gaurav2693/ai-office (MIT License) — https://github.com/Gaurav2693/ai-office
// © Gaurav Mishra. Reworked for AvaTails: 6 real agents driven by the live job queue.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from "three";

export const OFFICE_AGENTS = [
  { id: "chief",     name: "CHIEF",  full: "Chief of Staff", color: 0xffb020, hex: "#FFB020", screen: "chief",     hair: 0x3e2723, shirt: 0x37474f, pants: 0x1a1a2e },
  { id: "writer",    name: "WRITER", full: "Scriptwriter",   color: 0x7c4dff, hex: "#7C4DFF", screen: "writer",    hair: 0x1a1a2e, shirt: 0x4527a0, pants: 0x263238 },
  { id: "voice",     name: "VOICE",  full: "Voice Artist",   color: 0x00e676, hex: "#00E676", screen: "voice",     hair: 0x222222, shirt: 0x1b5e20, pants: 0x1a1a2e },
  { id: "artist",    name: "ARTIST", full: "Illustrator",    color: 0xe040fb, hex: "#E040FB", screen: "artist",    hair: 0x4a148c, shirt: 0x6a1b9a, pants: 0x1a1a2e },
  { id: "editor",    name: "EDITOR", full: "Video Editor",   color: 0x448aff, hex: "#448AFF", screen: "editor",    hair: 0x3e2723, shirt: 0x1565c0, pants: 0x263238 },
  { id: "publisher", name: "PUB",    full: "Publisher",      color: 0xff9100, hex: "#FF9100", screen: "publisher", hair: 0x1a1a1a, shirt: 0xbf360c, pants: 0x3e2723 },
];

const CHAT_PHRASES = [
  "episode shipped 📦", "render done ✅", "queue's empty 😴", "new script today?",
  "voiceover sounds great 🎙️", "26 letters to go!", "kids will love this one 🐊",
  "music bed mixed 🎵", "thumbnails looking cute", "crossfades are smooth 🎬",
  "A is for Alligator!", "who queued 10 jobs? 😅",
];

class RNG {
  constructor(s = 42) { this.s = s; }
  n() { this.s = (this.s * 16807) % 2147483647; return (this.s - 1) / 2147483646; }
  r(a, b) { return a + this.n() * (b - a); }
  i(a, b) { return Math.floor(this.r(a, b + 1)); }
}

export function createOfficeScene(container) {
  const rng = new RNG(7);
  const W = () => container.clientWidth || 800;
  const H = () => container.clientHeight || 480;

  // ── Scene / camera / renderer ────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060b18);
  scene.fog = new THREE.FogExp2(0x060b18, 0.004);

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

  // ── Lights ───────────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff8f0, 1.1);
  sun.position.set(12, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xdde8f0, 0xb0bec5, 0.35);
  scene.add(hemi);

  // ── Materials / office shell ─────────────────────────────────────────────
  const office = new THREE.Group();
  scene.add(office);
  const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const MB = (c) => new THREE.MeshBasicMaterial({ color: c });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.15, 18), M(0xe8e8e8));
  floor.position.y = -0.075; floor.receiveShadow = true; office.add(floor);
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(14, 0.02, 10), M(0xd0d8e0));
  carpet.position.set(0, 0.01, 0); carpet.receiveShadow = true; office.add(carpet);

  // ── Room shell: back + side walls, beams, skirting, brand stripe ──────────
  const wall = new THREE.Mesh(new THREE.BoxGeometry(26, 4.5, 0.2), M(0x1a2140));
  wall.position.set(0, 2.25, -8.9); office.add(wall);
  [-13, 13].forEach((wx) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.5, 18), M(0x212a52));
    side.position.set(wx, 2.25, 0); office.add(side);
  });
  // ceiling beams (suggest a ceiling without blocking top-down orbit views)
  [-4, 0, 4].forEach((bz) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(26, 0.16, 0.4), M(0x141a33));
    beam.position.set(0, 4.5, bz); office.add(beam);
  });
  // skirting boards
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(26, 0.18, 0.06), M(0xe8ecf0));
  skirt.position.set(0, 0.09, -8.77); office.add(skirt);
  [-12.87, 12.87].forEach((wx) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 18), M(0xe8ecf0));
    s.position.set(wx, 0.09, 0); office.add(s);
  });
  // brand stripe along the back wall
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(26, 0.14, 0.04), MB(0xffb020));
  stripe.position.set(0, 0.55, -8.78); office.add(stripe);

  // Daylight windows flanking the sign
  [-8.5, 8.5].forEach((wx) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.9, 0.08), M(0x0f1428));
    frame.position.set(wx, 2.7, -8.76); office.add(frame);
    const paneCv = document.createElement("canvas"); paneCv.width = 128; paneCv.height = 80;
    const pc = paneCv.getContext("2d");
    const grad = pc.createLinearGradient(0, 0, 0, 80);
    grad.addColorStop(0, "#7fb2ff"); grad.addColorStop(1, "#dcecff");
    pc.fillStyle = grad; pc.fillRect(0, 0, 128, 80);
    pc.strokeStyle = "#0f1428"; pc.lineWidth = 5;
    pc.beginPath(); pc.moveTo(64, 0); pc.lineTo(64, 80); pc.moveTo(0, 40); pc.lineTo(128, 40); pc.stroke();
    const paneTex = new THREE.CanvasTexture(paneCv); paneTex.colorSpace = THREE.SRGBColorSpace;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.7), new THREE.MeshBasicMaterial({ map: paneTex }));
    pane.position.set(wx, 2.7, -8.71); office.add(pane);
  });

  // Back wall with AVATAILS sign
  const signCv = document.createElement("canvas"); signCv.width = 512; signCv.height = 96;
  const signCx = signCv.getContext("2d");
  signCx.fillStyle = "#1a2140"; signCx.fillRect(0, 0, 512, 96);
  signCx.font = "bold 52px 'Segoe UI', sans-serif"; signCx.textAlign = "center";
  signCx.fillStyle = "#F3F5FF"; signCx.fillText("AVA", 180, 66);
  signCx.fillStyle = "#FFB020"; signCx.fillText("TAILS", 300, 66);
  signCx.font = "20px 'Segoe UI', sans-serif"; signCx.fillStyle = "#9AA3C7";
  signCx.fillText("🐊  F A C T O R Y", 396, 62);
  const signTex = new THREE.CanvasTexture(signCv); signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, 3.1, -8.78); office.add(sign);

  // Mission-control board: current job + live progress bar (under the sign)
  const boardCv = document.createElement("canvas"); boardCv.width = 512; boardCv.height = 128;
  const boardTex = new THREE.CanvasTexture(boardCv); boardTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: boardTex }));
  board.position.set(0, 1.72, -8.78); office.add(board);
  function drawBoard(title, pct, stage) {
    const c = boardCv.getContext("2d");
    c.fillStyle = "#0D1117"; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = "#2c3355"; c.lineWidth = 4; c.strokeRect(2, 2, 508, 124);
    c.textAlign = "center";
    if (title) {
      c.fillStyle = "#FFB020"; c.font = "bold 32px 'Segoe UI', sans-serif";
      c.fillText(title.toUpperCase().slice(0, 26), 256, 46);
      c.fillStyle = "#9AA3C7"; c.font = "19px 'Segoe UI', sans-serif";
      c.fillText((stage || "working").toUpperCase().slice(0, 34), 256, 74);
      c.fillStyle = "#20263F"; c.fillRect(56, 92, 380, 18);
      c.fillStyle = "#3DDC97";
      c.fillRect(56, 92, 380 * Math.max(0, Math.min(1, (pct || 0) / 100)), 18);
      c.fillStyle = "#F3F5FF"; c.font = "bold 15px 'Segoe UI', sans-serif";
      c.fillText(Math.round(pct || 0) + "%", 466, 107);
    } else {
      c.fillStyle = "#3a4270"; c.font = "bold 25px 'Segoe UI', sans-serif";
      c.fillText("QUEUE EMPTY — AGENTS STANDING BY", 256, 60);
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
    c.fillStyle = "#f4f7ff"; c.beginPath(); c.arc(48, 48, 44, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#1a2140"; c.lineWidth = 4; c.stroke();
    const hr = ((min / 60) % 12) * (Math.PI / 6) - Math.PI / 2;
    const mn = (min % 60) * (Math.PI / 30) - Math.PI / 2;
    c.lineWidth = 5; c.beginPath(); c.moveTo(48, 48); c.lineTo(48 + Math.cos(hr) * 22, 48 + Math.sin(hr) * 22); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(48, 48); c.lineTo(48 + Math.cos(mn) * 32, 48 + Math.sin(mn) * 32); c.stroke();
    c.fillStyle = "#ffb020"; c.beginPath(); c.arc(48, 48, 4, 0, Math.PI * 2); c.fill();
    clockTex.needsUpdate = true;
  }

  // Ceiling tube lights (visual only)
  for (let x = -8; x <= 8; x += 8) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 0.6), MB(0xf0f4ff));
    tube.position.set(x, 4.4, 0); office.add(tube);
    const pl = new THREE.PointLight(0xffffff, 0.35, 12, 1.8);
    pl.position.set(x, 4.1, 0); office.add(pl);
    tube.userData.isTube = true; tube.userData.light = pl;
  }
  const tubes = office.children.filter((c) => c.userData.isTube);

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
      // Kanban board with moving dots
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
      // Video timeline with playhead
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
      // publisher: upload bar + box
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
      c.fillStyle = "rgba(7,18,38,0.78)";
      c.beginPath(); c.roundRect(28, 8, 200, 48, 12); c.fill();
      c.fillStyle = working ? agent.hex : "rgba(255,255,255,0.85)";
      c.font = "bold 24px 'Segoe UI', sans-serif"; c.textAlign = "center";
      c.fillText(agent.name, 128, 32);
      c.font = "15px 'Segoe UI', sans-serif";
      c.fillStyle = working ? "#3DDC97" : "rgba(255,255,255,0.4)";
      const sub = working ? "● " + (stageText || "working").toUpperCase().slice(0, 20) : "○ idle";
      c.fillText(sub, 128, 50);
      tex.needsUpdate = true;
    };
    draw(false);
    return { sprite: sp, draw };
  }

  // ── Desks ────────────────────────────────────────────────────────────────
  const screenData = [];
  const agentData = [];

  function buildDesk(x, z, agent, faceSign) {
    // faceSign: +1 → char sits at z+0.7 facing -z; -1 → char at z-0.7 facing +z
    const g = new THREE.Group();
    // legs
    [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), M(0xbbccdd));
      leg.position.set(x + lx, 0.35, z + lz); office.add(leg);
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.75), M(0xe8ecf0));
    top.position.set(x, 0.72, z); top.castShadow = true; top.receiveShadow = true; office.add(top);
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 0.03), M(0xdde4ec));
    front.position.set(x, 0.5, z + faceSign * -0.36); office.add(front);

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
    const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.4), M(0x37474f));
    cSeat.position.set(x, 0.32, z + faceSign * 0.7); office.add(cSeat);
    const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.04), M(0x37474f));
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

  // 2 rows × 3 desks
  const deskX = [-6.5, 0, 6.5];
  OFFICE_AGENTS.forEach((agent, i) => {
    if (i < 3) buildDesk(deskX[i], -3.2, agent, 1);   // back row, chars face -z (toward camera)
    else buildDesk(deskX[i - 3], 3.2, agent, -1);     // front row, chars face +z
  });

  // ── Props: water cooler, lounge, plants, papers ──────────────────────────
  const wcBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 0.28), M(0xe0e0e0));
  wcBase.position.set(-10.5, 0.275, 2); office.add(wcBase);
  const wcTank = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.22), M(0x90caf9));
  wcTank.position.set(-10.5, 0.675, 2); office.add(wcTank);

  const sofa = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.7), M(0x274060));
  sofa.position.set(10, 0.2, 4); sofa.castShadow = true; office.add(sofa);
  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.15), M(0x274060));
  sofaBack.position.set(10, 0.6, 4.3); office.add(sofaBack);
  const table = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.5), M(0xdde4ec));
  table.position.set(10, 0.175, 2.9); office.add(table);

  function addPlant(px, pz) {
    const pot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), M(0xeceff1));
    pot.position.set(px, 0.11, pz); pot.castShadow = true; office.add(pot);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), M(0x3ddc97));
      leaf.position.set(px + rng.r(-0.08, 0.08), 0.4, pz + rng.r(-0.08, 0.08));
      leaf.rotation.z = rng.r(-0.25, 0.25); office.add(leaf);
    }
  }
  addPlant(-11.5, -7.5); addPlant(11.5, -7.5); addPlant(-11.5, 6.5);

  // Lounge rug
  const rug = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.02, 2.8), M(0x3a2447));
  rug.position.set(10, 0.02, 3.4); rug.receiveShadow = true; office.add(rug);

  // Whiteboard: A–Z production tracker (left wall)
  const wbCv = document.createElement("canvas"); wbCv.width = 256; wbCv.height = 160;
  const wbc = wbCv.getContext("2d");
  wbc.fillStyle = "#f4f7ff"; wbc.fillRect(0, 0, 256, 160);
  wbc.fillStyle = "#1a2140"; wbc.font = "bold 15px 'Segoe UI', sans-serif"; wbc.textAlign = "left";
  wbc.fillText("A-Z PRODUCTION", 12, 22);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  wbc.textAlign = "center";
  for (let i = 0; i < 26; i++) {
    const col = i % 7, row = Math.floor(i / 7);
    const lx = 16 + col * 33, ly = 44 + row * 28;
    wbc.fillStyle = "#c3cbe8"; wbc.fillRect(lx - 4, ly - 16, 26, 22);
    wbc.fillStyle = "#1a2140"; wbc.font = "bold 14px 'Segoe UI', sans-serif";
    wbc.fillText(letters[i], lx + 9, ly);
  }
  const wbTex = new THREE.CanvasTexture(wbCv); wbTex.colorSpace = THREE.SRGBColorSpace;
  const wb = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.1), new THREE.MeshBasicMaterial({ map: wbTex }));
  wb.position.set(-12.75, 2.3, -2); wb.rotation.y = Math.PI / 2; office.add(wb);

  // Bookshelf with colorful binders (right wall)
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 2.6), M(0x2c3355));
  shelf.position.set(12.7, 1.1, -3); office.add(shelf);
  const bookColors = [0xffb020, 0x7c4dff, 0x00e676, 0xe040fb, 0x448aff, 0xff9100, 0xff5d8f];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.22), M(bookColors[(row * 8 + i) % 7]));
      b.position.set(12.48, 0.55 + row * 0.62, -4 + i * 0.28);
      office.add(b);
    }
  }

  const papers = [];
  for (let i = 0; i < 10; i++) {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.18),
      new THREE.MeshBasicMaterial({ color: [0xffb020, 0x7c4dff, 0x00e676, 0xe040fb, 0x448aff][i % 5], side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    p.position.set(rng.r(-10, 10), rng.r(1, 3.5), rng.r(-7, 7));
    office.add(p);
    papers.push({ mesh: p, dx: rng.r(-0.15, 0.15), dz: rng.r(-0.15, 0.15), baseY: p.position.y, bobSp: rng.r(0.5, 1.5), ph: rng.r(0, 6), tum: rng.r(0.5, 2) });
  }

  // ── Chat bubbles ─────────────────────────────────────────────────────────
  const bubbles = [];
  function spawnBubble(target, text) {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 72;
    const c = cv.getContext("2d");
    c.fillStyle = "rgba(255,255,255,0.95)";
    c.beginPath(); c.roundRect(4, 4, 248, 52, 14); c.fill();
    c.beginPath(); c.moveTo(110, 56); c.lineTo(128, 70); c.lineTo(146, 56); c.fill();
    c.fillStyle = "#1a1a2e"; c.font = "17px 'Segoe UI', sans-serif"; c.textAlign = "center";
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
    { x: -10.5, z: 1 }, { x: 0, z: 0 }, { x: 10, z: 2.5 }, { x: -11, z: -6.5 }, { x: 9, z: -6 },
  ];

  function updateWalkers(delta, elapsed) {
    agentData.forEach((ad) => {
      if (ad.chatCooldown > 0) ad.chatCooldown -= delta;
      if (ad.working) {
        // stay seated, type away
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

  // ── Time of day / cyberpunk ──────────────────────────────────────────────
  let timeOfDay = 600;
  let cyberpunk = false;
  const nightBg = new THREE.Color(0x060b18);
  const dayBg = new THREE.Color(0x16244a);
  const bgTmp = new THREE.Color();

  function updateTime(min) {
    timeOfDay = min;
    drawClock(min);
    const rawDay = Math.max(0, Math.sin(((min - 360) / 720) * Math.PI)); // 6:00–18:00
    const day = 0.45 + rawDay * 0.55; // studio stays bright and readable around the clock
    sun.intensity = cyberpunk ? 0.05 : 0.25 + day * 1.1;
    sun.color.setHSL(0.1, 0.45, 0.55 + day * 0.4);
    ambient.intensity = cyberpunk ? 0.12 : 0.38 + day * 0.4;
    hemi.intensity = cyberpunk ? 0.05 : 0.2 + day * 0.3;
    bgTmp.lerpColors(nightBg, cyberpunk ? nightBg : dayBg, day);
    scene.background = bgTmp;
    scene.fog.color.copy(bgTmp);
    tubes.forEach((tb) => {
      tb.material = cyberpunk ? MB(0x223355) : MB(0xf0f4ff);
      tb.userData.light.intensity = cyberpunk ? 0.03 : 0.25 + day * 0.2;
    });
    const dark = cyberpunk; // only lights-off mode dims the desk glows
    agentData.forEach((ad) => {
      ad.glow.intensity = ad.working ? 0.8 : dark ? 0.22 : 0;
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
        // called back to desk mid-wander
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
    updateWalkers(delta, elapsed);
    checkConversations();
    updateBubbles(delta);
    papers.forEach((p) => {
      p.mesh.position.x += p.dx * delta; p.mesh.position.z += p.dz * delta;
      p.mesh.position.y = p.baseY + Math.sin(elapsed * p.bobSp + p.ph) * 0.25;
      p.mesh.rotation.x += p.tum * delta; p.mesh.rotation.y += p.tum * 0.7 * delta;
      if (p.mesh.position.x > 12) p.mesh.position.x = -12;
      if (p.mesh.position.x < -12) p.mesh.position.x = 12;
      if (p.mesh.position.z > 8) p.mesh.position.z = -8;
      if (p.mesh.position.z < -8) p.mesh.position.z = 8;
    });
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
