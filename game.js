(() => {
  "use strict";

  const DB_NAME = "BuddyBuildDB";
  const DB_VERSION = 1;
  const STORE = "images";
  const SAVE_KEY = "buddybuild.save.v1";

  const $ = (id) => document.getElementById(id);

  const canvas = $("game");
  const ctx = canvas.getContext("2d");

  const ui = {
    coins: $("coins"),
    combo: $("combo"),
    mood: $("mood"),
    weaponList: $("weaponList"),
    dialog: $("weaponDialog"),
    form: $("weaponForm"),
    btnNewWeapon: $("btnNewWeapon"),
    btnExport: $("btnExport"),
    btnReset: $("btnReset"),
    importInput: $("projectImport"),
    name: $("weaponName"),
    type: $("weaponType"),
    damage: $("weaponDamage"),
    damageText: $("weaponDamageText"),
    force: $("weaponForce"),
    forceText: $("weaponForceText"),
    size: $("weaponSize"),
    sizeText: $("weaponSizeText"),
    cooldown: $("weaponCooldown"),
    png: $("weaponPng"),
    path: $("weaponPath"),
    preview: $("weaponPreview"),
    saveWeapon: $("btnSaveWeapon"),
    btnResetLooks: $("btnResetLooks"),
    bgUpload: $("bgUpload"),
    bgPath: $("bgPath"),
    btnApplyBg: $("btnApplyBg"),
    buddyUpload: $("buddyUpload"),
    buddyPath: $("buddyPath"),
    btnApplyBuddy: $("btnApplyBuddy"),
  };

  const defaultWeapons = [
    {
      id: "bat",
      name: "Baseball Bat",
      type: "melee",
      damage: 12,
      force: 32,
      size: 64,
      cooldown: 260,
      imageMode: "path",
      imagePath: "weapon_bat.png",
    },
    {
      id: "ball",
      name: "Super Ball",
      type: "projectile",
      damage: 9,
      force: 26,
      size: 46,
      cooldown: 170,
      imageMode: "path",
      imagePath: "weapon_ball.png",
    },
    {
      id: "bomb",
      name: "Cartoon Bomb",
      type: "explosive",
      damage: 22,
      force: 52,
      size: 74,
      cooldown: 700,
      imageMode: "path",
      imagePath: "weapon_bomb.png",
    },
    {
      id: "glove",
      name: "Boxing Glove",
      type: "melee",
      damage: 15,
      force: 42,
      size: 68,
      cooldown: 360,
      imageMode: "path",
      imagePath: "weapon_glove.png",
    },
    {
      id: "anvil",
      name: "Anvil Drop",
      type: "drop",
      damage: 24,
      force: 58,
      size: 72,
      cooldown: 650,
      imageMode: "path",
      imagePath: "weapon_anvil.png",
    },
  ];

  const defaultLooks = {
    background: {
      mode: "path",
      path: "bg_room.png",
      key: "",
      originalPath: "",
    },
    buddy: {
      mode: "path",
      path: "buddy.png",
      key: "",
      originalPath: "",
    },
  };

  const state = {
    weapons: [],
    imageUrls: new Map(),
    images: new Map(),
    looks: JSON.parse(JSON.stringify(defaultLooks)),
    selectedId: "bat",
    coins: 0,
    combo: 1,
    comboTimer: 0,
    lastUse: new Map(),
    projectName: "Buddy Build Project",
    projectVersion: 1,
    drag: null,
    buddy: {
      x: 480,
      y: 300,
      vx: 0,
      vy: 0,
      angle: 0,
      av: 0,
      radius: 58,
      dazed: 0,
      stress: 0,
      squash: 0,
    },
    projectiles: [],
    particles: [],
    floatingTexts: [],
    flashes: [],
    shake: 0,
    time: 0,
  };

  const bg = new Image();
  bg.src = "bg_room.png";
  const buddyImg = new Image();
  buddyImg.src = "buddy.png";
  const buddyDazedImg = new Image();
  buddyDazedImg.src = "buddy_dazed.png";
  const starImg = new Image();
  starImg.src = "fx_star.png";

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(key, blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbClear() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  function uid(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function dist(a, b, c, d) {
    return Math.hypot(a - c, b - d);
  }

  function imageForWeapon(w) {
    return w.imageMode === "upload" ? state.imageUrls.get(w.imageKey) : w.imagePath;
  }

  function lookSource(kind) {
    const look = state.looks[kind] || defaultLooks[kind];
    return look.mode === "upload" ? state.imageUrls.get(look.key) : look.path;
  }

  function sanitizeLook(raw, fallback) {
    const base = fallback || { mode: "path", path: "", key: "", originalPath: "" };
    const out = {
      mode: raw && raw.mode === "upload" ? "upload" : "path",
      path: String((raw && raw.path) || base.path || ""),
      key: String((raw && raw.key) || ""),
      originalPath: String((raw && raw.originalPath) || ""),
    };
    if (out.mode !== "upload" && !out.path) out.path = base.path || "";
    return out;
  }

  function refreshLookImages() {
    const bgSrc = lookSource("background") || "bg_room.png";
    const buddySrc = lookSource("buddy") || "buddy.png";

    bg.src = bgSrc;
    buddyImg.src = buddySrc;

    // If a custom buddy is used, use it for the dazed state too. The stars still show dizziness.
    buddyDazedImg.src = buddySrc || "buddy_dazed.png";

    if (ui.bgPath) ui.bgPath.value = state.looks.background.mode === "path" ? state.looks.background.path : "";
    if (ui.buddyPath) ui.buddyPath.value = state.looks.buddy.mode === "path" ? state.looks.buddy.path : "";
  }

  function preloadImage(src) {
    if (!src) return null;
    if (state.images.has(src)) return state.images.get(src);
    const img = new Image();
    img.src = src;
    state.images.set(src, img);
    return img;
  }

  async function rebuildImageUrls() {
    for (const url of state.imageUrls.values()) URL.revokeObjectURL(url);
    state.imageUrls.clear();

    for (const w of state.weapons) {
      if (w.imageMode === "upload" && w.imageKey) {
        const blob = await idbGet(w.imageKey);
        if (blob) state.imageUrls.set(w.imageKey, URL.createObjectURL(blob));
      }
    }

    for (const kind of ["background", "buddy"]) {
      const look = state.looks[kind];
      if (look && look.mode === "upload" && look.key) {
        const blob = await idbGet(look.key);
        if (blob) state.imageUrls.set(look.key, URL.createObjectURL(blob));
      }
    }

    for (const w of state.weapons) {
      const src = imageForWeapon(w);
      if (src) preloadImage(src);
    }

    refreshLookImages();
  }

  function sanitizeWeapon(w) {
    return {
      id: String(w.id || uid("weapon")),
      name: String(w.name || "Custom Weapon").slice(0, 24),
      type: ["melee", "projectile", "explosive", "drop"].includes(w.type) ? w.type : "melee",
      damage: clamp(Number(w.damage) || 10, 1, 50),
      force: clamp(Number(w.force) || 20, 1, 80),
      size: clamp(Number(w.size) || 58, 24, 110),
      cooldown: clamp(Number(w.cooldown) || 300, 80, 5000),
      imageMode: w.imageMode === "upload" ? "upload" : "path",
      imagePath: String(w.imagePath || "assets/weapon_bat.png"),
      imageKey: w.imageKey ? String(w.imageKey) : "",
    };
  }

  function saveMeta() {
    const serial = {
      projectName: state.projectName,
      projectVersion: state.projectVersion,
      selectedId: state.selectedId,
      coins: state.coins,
      looks: {
        background: sanitizeLook(state.looks.background, defaultLooks.background),
        buddy: sanitizeLook(state.looks.buddy, defaultLooks.buddy),
      },
      weapons: state.weapons.map(sanitizeWeapon),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(serial));
  }

  async function loadMeta() {
    let loaded = null;
    try {
      loaded = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    } catch {
      loaded = null;
    }

    state.weapons = defaultWeapons.map(sanitizeWeapon);

    if (loaded && Array.isArray(loaded.weapons)) {
      const custom = loaded.weapons
        .map(sanitizeWeapon)
        .filter(w => !defaultWeapons.some(d => d.id === w.id));
      state.weapons = [...defaultWeapons.map(sanitizeWeapon), ...custom];
      state.selectedId = loaded.selectedId || "bat";
      state.coins = Number(loaded.coins) || 0;
      state.projectName = loaded.projectName || "Buddy Build Project";
      if (loaded.looks) {
        state.looks.background = sanitizeLook(loaded.looks.background, defaultLooks.background);
        state.looks.buddy = sanitizeLook(loaded.looks.buddy, defaultLooks.buddy);
      }
    }

    await rebuildImageUrls();

    if (!state.weapons.some(w => w.id === state.selectedId)) state.selectedId = state.weapons[0]?.id || "bat";
    renderWeapons();
    updateStats();
  }

  function selectedWeapon() {
    return state.weapons.find(w => w.id === state.selectedId) || state.weapons[0];
  }

  function renderWeapons() {
    ui.weaponList.innerHTML = "";
    for (const w of state.weapons) {
      const row = document.createElement("button");
      row.className = "weapon" + (w.id === state.selectedId ? " selected" : "");
      row.type = "button";
      const img = document.createElement("img");
      img.src = imageForWeapon(w);
      img.alt = w.name;
      img.onerror = () => {
        img.src = "weapon_bat.png";
      };

      const text = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = w.name;
      const small = document.createElement("small");
      small.textContent = `${w.type} • dmg ${w.damage} • kb ${w.force}`;
      text.append(title, small);

      const del = document.createElement("button");
      del.className = "delete";
      del.type = "button";
      del.textContent = "X";
      del.title = "Delete custom weapon";
      del.style.visibility = defaultWeapons.some(d => d.id === w.id) ? "hidden" : "visible";
      del.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        await deleteWeapon(w.id);
      });

      row.addEventListener("click", () => {
        state.selectedId = w.id;
        saveMeta();
        renderWeapons();
      });

      row.append(img, text, del);
      ui.weaponList.appendChild(row);
    }
  }

  async function deleteWeapon(id) {
    const w = state.weapons.find(x => x.id === id);
    if (!w || defaultWeapons.some(d => d.id === id)) return;
    if (w.imageMode === "upload" && w.imageKey) {
      const url = state.imageUrls.get(w.imageKey);
      if (url) URL.revokeObjectURL(url);
      state.imageUrls.delete(w.imageKey);
      await idbDelete(w.imageKey);
    }
    state.weapons = state.weapons.filter(x => x.id !== id);
    if (state.selectedId === id) state.selectedId = "bat";
    saveMeta();
    await rebuildImageUrls();
    renderWeapons();
  }

  function updateStats() {
    ui.coins.textContent = Math.floor(state.coins).toString();
    ui.combo.textContent = "x" + Math.floor(state.combo);
    const s = state.buddy.stress;
    ui.mood.textContent = s < 25 ? "Fine" : s < 55 ? "Rattled" : s < 85 ? "Dizzy" : "Bonked";
  }

  function canvasPoint(ev) {
    const rect = canvas.getBoundingClientRect();
    const client = ev.touches ? ev.touches[0] : ev;
    return {
      x: (client.clientX - rect.left) * (canvas.width / rect.width),
      y: (client.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function addParticle(x, y, opts = {}) {
    const a = opts.angle ?? Math.random() * Math.PI * 2;
    const sp = opts.speed ?? (2 + Math.random() * 7);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1,
      life: opts.life ?? (25 + Math.random() * 30),
      maxLife: opts.life ?? 45,
      size: opts.size ?? (5 + Math.random() * 12),
      kind: opts.kind || "spark",
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    });
  }

  function addFloatingText(text, x, y) {
    state.floatingTexts.push({ text, x, y, vy: -1.4, life: 60, maxLife: 60 });
  }

  function award(damage) {
    const now = performance.now();
    state.comboTimer = 120;
    state.combo = clamp(state.combo + 0.12, 1, 9);
    const gain = Math.max(1, Math.round(damage * state.combo));
    state.coins += gain;
    addFloatingText("+" + gain, state.buddy.x, state.buddy.y - 90);
    saveMeta();
    updateStats();
  }

  function hitBuddy(x, y, weapon, mult = 1) {
    const b = state.buddy;
    const dx = b.x - x;
    const dy = b.y - y;
    const len = Math.hypot(dx, dy) || 1;
    const force = weapon.force * mult;
    b.vx += (dx / len) * force * 0.45;
    b.vy += (dy / len) * force * 0.45 - weapon.damage * 0.08;
    b.av += ((dx > 0 ? 1 : -1) * force * 0.005) + (Math.random() - 0.5) * 0.12;
    b.dazed = Math.max(b.dazed, 35 + weapon.damage * 1.5);
    b.stress = clamp(b.stress + weapon.damage * 0.85, 0, 100);
    b.squash = Math.min(1, b.squash + 0.35);
    state.shake = Math.max(state.shake, clamp(weapon.damage * 0.25, 3, 14));
    award(weapon.damage * mult);

    for (let i = 0; i < 12 + weapon.damage * 0.4; i++) {
      addParticle(b.x + (Math.random() - .5) * 60, b.y + (Math.random() - .5) * 80, {
        kind: Math.random() < .35 ? "star" : "spark",
        speed: 2 + Math.random() * 8,
        life: 28 + Math.random() * 36,
        size: 6 + Math.random() * 14,
      });
    }
  }

  function canUse(w) {
    const now = performance.now();
    const last = state.lastUse.get(w.id) || 0;
    if (now - last < w.cooldown) return false;
    state.lastUse.set(w.id, now);
    return true;
  }

  function useWeaponAt(w, x, y, aim = null) {
    if (!w || !canUse(w)) return;

    const b = state.buddy;
    const d = dist(x, y, b.x, b.y);

    if (w.type === "melee") {
      state.flashes.push({ x, y, r: w.size * 0.9, life: 14, maxLife: 14 });
      for (let i = 0; i < 9; i++) addParticle(x, y, { speed: 2 + Math.random() * 6, life: 22, kind: "spark" });
      if (d < b.radius + w.size) hitBuddy(x, y, w, 1);
      else {
        const nx = b.x + (x < b.x ? -b.radius : b.radius);
        const ny = b.y;
        hitBuddy(nx, ny, w, 0.35);
      }
    }

    if (w.type === "projectile") {
      let sx = x, sy = y, tx = b.x, ty = b.y;
      if (aim) {
        sx = aim.start.x;
        sy = aim.start.y;
        tx = aim.end.x;
        ty = aim.end.y;
      }
      const dx = tx - sx;
      const dy = ty - sy;
      const len = Math.hypot(dx, dy) || 1;
      state.projectiles.push({
        x: sx,
        y: sy,
        vx: (dx / len) * 17,
        vy: (dy / len) * 17,
        rot: 0,
        vr: 0.22,
        life: 150,
        weapon: { ...w },
      });
    }

    if (w.type === "explosive") {
      state.flashes.push({ x, y, r: w.size * 1.8, life: 22, maxLife: 22, blast: true });
      for (let i = 0; i < 34; i++) {
        addParticle(x, y, {
          angle: Math.random() * Math.PI * 2,
          speed: 4 + Math.random() * 12,
          life: 28 + Math.random() * 38,
          size: 7 + Math.random() * 16,
          kind: Math.random() < .45 ? "star" : "spark",
        });
      }
      const radius = w.size * 2.3;
      if (d < radius + b.radius) {
        hitBuddy(x, y, w, clamp(1.4 - d / radius, 0.35, 1.4));
      }
    }

    if (w.type === "drop") {
      state.projectiles.push({
        x,
        y: -60,
        vx: (b.x - x) * 0.012,
        vy: 4,
        rot: 0,
        vr: 0.04,
        gravity: 0.55,
        life: 200,
        weapon: { ...w },
      });
    }
  }

  function stepProjectiles() {
    const b = state.buddy;
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.vy += p.gravity || 0.12;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life--;

      if (dist(p.x, p.y, b.x, b.y) < b.radius + p.weapon.size * 0.43) {
        hitBuddy(p.x, p.y, p.weapon, 1.1);
        state.flashes.push({ x: p.x, y: p.y, r: p.weapon.size, life: 14, maxLife: 14 });
        state.projectiles.splice(i, 1);
        continue;
      }

      if (p.y > canvas.height - 65 && p.weapon.type === "drop") {
        state.flashes.push({ x: p.x, y: canvas.height - 67, r: p.weapon.size, life: 14, maxLife: 14 });
        state.projectiles.splice(i, 1);
        continue;
      }

      if (p.life <= 0 || p.x < -180 || p.x > canvas.width + 180 || p.y > canvas.height + 180) {
        state.projectiles.splice(i, 1);
      }
    }
  }

  function stepBuddy() {
    const b = state.buddy;
    const floor = canvas.height * 0.80 - 18;
    b.vy += 0.62;
    b.vx *= 0.987;
    b.vy *= 0.996;
    b.av *= 0.985;

    b.x += b.vx;
    b.y += b.vy;
    b.angle += b.av;

    if (b.x < 85) {
      b.x = 85;
      b.vx = Math.abs(b.vx) * 0.72;
      b.av *= -0.55;
    }
    if (b.x > canvas.width - 85) {
      b.x = canvas.width - 85;
      b.vx = -Math.abs(b.vx) * 0.72;
      b.av *= -0.55;
    }
    if (b.y > floor) {
      b.y = floor;
      if (Math.abs(b.vy) > 5) {
        for (let i = 0; i < 7; i++) addParticle(b.x, b.y + 45, { speed: 2 + Math.random() * 4, life: 20, kind: "dust" });
      }
      b.vy = -Math.abs(b.vy) * 0.45;
      b.vx *= 0.89;
      b.av *= 0.75;
      if (Math.abs(b.vy) < 2.2) b.vy = 0;
    }
    if (b.y < 75) {
      b.y = 75;
      b.vy = Math.abs(b.vy) * 0.5;
    }

    b.dazed = Math.max(0, b.dazed - 1);
    b.stress = Math.max(0, b.stress - 0.018);
    b.squash = Math.max(0, b.squash - 0.06);

    if (state.comboTimer > 0) {
      state.comboTimer--;
    } else {
      state.combo = Math.max(1, state.combo - 0.025);
    }
  }

  function stepParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.vy += p.kind === "dust" ? 0.02 : 0.18;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.rot += p.vr;
      p.life--;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const f = state.floatingTexts[i];
      f.y += f.vy;
      f.life--;
      if (f.life <= 0) state.floatingTexts.splice(i, 1);
    }

    for (let i = state.flashes.length - 1; i >= 0; i--) {
      state.flashes[i].life--;
      if (state.flashes[i].life <= 0) state.flashes.splice(i, 1);
    }

    state.shake = Math.max(0, state.shake - 0.7);
  }

  function drawImageCentered(img, x, y, w, h, angle = 0, alpha = 1, sx = 1, sy = 1) {
    if (!img || !img.complete) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(sx, sy);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawBackground() {
    if (bg.complete) ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    else {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawBuddy() {
    const b = state.buddy;
    const img = b.dazed > 0 ? buddyDazedImg : buddyImg;
    const squish = 1 - b.squash * 0.16;
    const stretch = 1 + b.squash * 0.12;
    drawImageCentered(img, b.x, b.y - 20, 150, 157, b.angle, 1, stretch, squish);

    if (b.dazed > 5) {
      for (let i = 0; i < 3; i++) {
        const a = state.time * 0.045 + i * Math.PI * 2 / 3;
        drawImageCentered(starImg, b.x + Math.cos(a) * 58, b.y - 112 + Math.sin(a) * 12, 30, 30, -a);
      }
    }
  }

  function drawProjectiles() {
    for (const p of state.projectiles) {
      const src = imageForWeapon(p.weapon);
      const img = preloadImage(src);
      drawImageCentered(img, p.x, p.y, p.weapon.size, p.weapon.size, p.rot);
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === "star") {
        drawImageCentered(starImg, 0, 0, p.size * 1.4, p.size * 1.4, 0, a);
      } else if (p.kind === "dust") {
        ctx.fillStyle = "rgba(210,220,235,.55)";
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.25, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(255,221,92,.95)";
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }

  function drawFlashes() {
    for (const f of state.flashes) {
      const t = f.life / f.maxLife;
      ctx.save();
      ctx.globalAlpha = t * 0.75;
      ctx.lineWidth = f.blast ? 12 : 7;
      ctx.strokeStyle = f.blast ? "rgba(255,180,80,.9)" : "rgba(125,211,252,.9)";
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1.15 - t * 0.35), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = t * 0.25;
      ctx.fillStyle = f.blast ? "rgba(255,90,70,.65)" : "rgba(255,255,255,.5)";
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1.05 - t * 0.25), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFloatingTexts() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "800 30px system-ui";
    for (const f of state.floatingTexts) {
      ctx.globalAlpha = f.life / f.maxLife;
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,.55)";
      ctx.fillStyle = "#fef3c7";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function drawDragAim() {
    if (!state.drag) return;
    const w = selectedWeapon();
    if (!w || w.type !== "projectile") return;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(state.drag.start.x, state.drag.start.y);
    ctx.lineTo(state.drag.current.x, state.drag.current.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(56,189,248,.22)";
    ctx.beginPath();
    ctx.arc(state.drag.start.x, state.drag.start.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHud() {
    const w = selectedWeapon();
    if (!w) return;
    const src = imageForWeapon(w);
    const img = preloadImage(src);
    ctx.save();
    ctx.globalAlpha = .95;
    ctx.fillStyle = "rgba(2,6,23,.55)";
    ctx.roundRect(16, 16, 300, 76, 18);
    ctx.fill();
    drawImageCentered(img, 56, 54, 54, 54, 0);
    ctx.fillStyle = "#fff";
    ctx.font = "800 21px system-ui";
    ctx.fillText(w.name, 94, 48);
    ctx.fillStyle = "rgba(226,232,240,.86)";
    ctx.font = "700 14px system-ui";
    ctx.fillText(`${w.type} • damage ${w.damage} • knockback ${w.force}`, 94, 72);
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);
    }

    drawBackground();
    drawFlashes();
    drawProjectiles();
    drawBuddy();
    drawParticles();
    drawFloatingTexts();
    drawDragAim();
    drawHud();

    ctx.restore();
  }

  function tick() {
    state.time++;
    stepBuddy();
    stepProjectiles();
    stepParticles();
    draw();
    if (state.time % 20 === 0) updateStats();
    requestAnimationFrame(tick);
  }

  function pointerDown(ev) {
    ev.preventDefault();
    const p = canvasPoint(ev);
    state.drag = { start: p, current: p, moved: false };
  }

  function pointerMove(ev) {
    if (!state.drag) return;
    ev.preventDefault();
    const p = canvasPoint(ev);
    if (dist(p.x, p.y, state.drag.start.x, state.drag.start.y) > 8) state.drag.moved = true;
    state.drag.current = p;
  }

  function pointerUp(ev) {
    if (!state.drag) return;
    ev.preventDefault();
    const end = canvasPoint(ev.changedTouches ? ev.changedTouches[0] : ev);
    const start = state.drag.start;
    const w = selectedWeapon();
    if (w?.type === "projectile" && state.drag.moved) {
      const aim = { start, end };
      useWeaponAt(w, start.x, start.y, aim);
    } else {
      useWeaponAt(w, end.x, end.y);
    }
    state.drag = null;
  }

  canvas.addEventListener("mousedown", pointerDown);
  canvas.addEventListener("mousemove", pointerMove);
  window.addEventListener("mouseup", pointerUp);
  canvas.addEventListener("touchstart", pointerDown, { passive: false });
  canvas.addEventListener("touchmove", pointerMove, { passive: false });
  canvas.addEventListener("touchend", pointerUp, { passive: false });

  function syncRangeLabels() {
    ui.damageText.textContent = ui.damage.value;
    ui.forceText.textContent = ui.force.value;
    ui.sizeText.textContent = ui.size.value;
  }

  ui.damage.addEventListener("input", syncRangeLabels);
  ui.force.addEventListener("input", syncRangeLabels);
  ui.size.addEventListener("input", syncRangeLabels);

  ui.btnNewWeapon.addEventListener("click", () => {
    ui.form.reset();
    ui.damage.value = 12;
    ui.force.value = 25;
    ui.size.value = 58;
    ui.cooldown.value = 350;
    ui.preview.removeAttribute("src");
    syncRangeLabels();
    ui.dialog.showModal();
  });

  ui.png.addEventListener("change", () => {
    const file = ui.png.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    ui.preview.src = url;
    ui.path.value = "";
  });

  ui.path.addEventListener("input", () => {
    if (ui.path.value.trim()) ui.preview.src = ui.path.value.trim();
  });

  ui.form.addEventListener("submit", async (ev) => {
    ev.preventDefault();

    const name = ui.name.value.trim() || "Custom Weapon";
    const file = ui.png.files?.[0] || null;
    const path = ui.path.value.trim();

    let imageMode = "path";
    let imagePath = path || "weapon_bat.png";
    let imageKey = "";

    if (file) {
      imageMode = "upload";
      imageKey = uid("img");
      await idbPut(imageKey, file);
      imagePath = "";
    }

    const w = sanitizeWeapon({
      id: uid("weapon"),
      name,
      type: ui.type.value,
      damage: ui.damage.value,
      force: ui.force.value,
      size: ui.size.value,
      cooldown: ui.cooldown.value,
      imageMode,
      imagePath,
      imageKey,
    });

    state.weapons.push(w);
    state.selectedId = w.id;
    await rebuildImageUrls();
    saveMeta();
    renderWeapons();
    ui.dialog.close();
  });

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  async function pathToDataUrl(path) {
    if (!path) return "";
    if (path.startsWith("data:")) return path;

    // Best case: normal browser fetch works for the PNG beside index.html.
    try {
      const response = await fetch(path);
      if (response.ok) {
        const blob = await response.blob();
        return await blobToDataUrl(blob);
      }
    } catch {
      // Some file:// browser setups block fetch. Fall through to canvas fallback.
    }

    // Fallback: use the already loaded image and serialize it through a canvas.
    // This keeps default assets exportable as base64 without embedding them in index.html.
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth || img.width;
          c.height = img.naturalHeight || img.height;
          const cctx = c.getContext("2d");
          cctx.drawImage(img, 0, 0);
          resolve(c.toDataURL("image/png"));
        } catch {
          resolve("");
        }
      };
      img.onerror = () => resolve("");
      img.src = path;
    });
  }

  function dataUrlToBlob(dataUrl) {
    const [head, data] = dataUrl.split(",");
    const mime = /data:(.*?);base64/.exec(head)?.[1] || "application/octet-stream";
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  ui.btnExport.addEventListener("click", async () => {
    const out = {
      app: "Buddy Build",
      version: 1,
      exportedAt: new Date().toISOString(),
      projectName: state.projectName,
      selectedId: state.selectedId,
      coins: state.coins,
      looks: {
        background: sanitizeLook(state.looks.background, defaultLooks.background),
        buddy: sanitizeLook(state.looks.buddy, defaultLooks.buddy),
      },
      weapons: [],
    };

    for (const kind of ["background", "buddy"]) {
      const look = sanitizeLook(state.looks[kind], defaultLooks[kind]);
      const copy = { ...look };

      if (copy.mode === "upload" && copy.key) {
        const blob = await idbGet(copy.key);
        const dataUrl = blob ? await blobToDataUrl(blob) : "";
        copy.imageData = dataUrl;
        copy.path = dataUrl;
      } else if (copy.mode === "path" && copy.path) {
        const dataUrl = await pathToDataUrl(copy.path);
        if (dataUrl) {
          copy.originalPath = copy.path;
          copy.imageData = dataUrl;
          copy.path = dataUrl;
        }
      }

      out.looks[kind] = copy;
    }

    for (const w of state.weapons.map(sanitizeWeapon)) {
      const copy = { ...w };

      if (copy.imageMode === "upload" && copy.imageKey) {
        const blob = await idbGet(copy.imageKey);
        const dataUrl = blob ? await blobToDataUrl(blob) : "";
        copy.imageData = dataUrl;
        copy.imagePath = dataUrl; // base64 URL inside export
      } else if (copy.imageMode === "path" && copy.imagePath) {
        const dataUrl = await pathToDataUrl(copy.imagePath);
        if (dataUrl) {
          copy.originalImagePath = copy.imagePath;
          copy.imageData = dataUrl;
          copy.imagePath = dataUrl; // base64 URL inside export
        }
      }

      out.weapons.push(copy);
    }

    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my_buddy_build_project.buddybuild";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  ui.importInput.addEventListener("change", async () => {
    const file = ui.importInput.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const data = JSON.parse(txt);
      if (!Array.isArray(data.weapons)) throw new Error("No weapons array found.");

      await idbClear();

      const imported = [];
      for (const raw of data.weapons) {
        const w = sanitizeWeapon(raw);

        // Accept both old exports with imageData and new exports where imagePath itself is a base64 data URL.
        const exportedImageData =
          raw.imageData ||
          (typeof raw.imagePath === "string" && raw.imagePath.startsWith("data:") ? raw.imagePath : "");

        if (exportedImageData) {
          const newKey = uid("img");
          await idbPut(newKey, dataUrlToBlob(exportedImageData));
          w.imageKey = newKey;
          w.imageMode = "upload";
          w.imagePath = "";
        }

        imported.push(w);
      }

      const custom = imported.filter(w => !defaultWeapons.some(d => d.id === w.id));
      state.weapons = [...defaultWeapons.map(sanitizeWeapon), ...custom];

      state.looks = JSON.parse(JSON.stringify(defaultLooks));
      if (data.looks) {
        for (const kind of ["background", "buddy"]) {
          const rawLook = data.looks[kind];
          if (!rawLook) continue;

          const exportedLookData =
            rawLook.imageData ||
            (typeof rawLook.path === "string" && rawLook.path.startsWith("data:") ? rawLook.path : "");

          if (exportedLookData) {
            const newKey = uid("img");
            await idbPut(newKey, dataUrlToBlob(exportedLookData));
            state.looks[kind] = {
              mode: "upload",
              path: "",
              key: newKey,
              originalPath: rawLook.originalPath || "",
            };
          } else {
            state.looks[kind] = sanitizeLook(rawLook, defaultLooks[kind]);
          }
        }
      }

      state.selectedId = data.selectedId || state.weapons[0].id;
      state.coins = Number(data.coins) || 0;
      state.projectName = data.projectName || "Buddy Build Project";
      await rebuildImageUrls();
      saveMeta();
      renderWeapons();
      updateStats();
      alert("Project imported.");
    } catch (err) {
      alert("Import failed: " + err.message);
    } finally {
      ui.importInput.value = "";
    }
  });

  async function setLookFromUpload(kind, file) {
    if (!file) return false;

    const old = state.looks[kind];
    if (old && old.mode === "upload" && old.key) {
      const oldUrl = state.imageUrls.get(old.key);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      state.imageUrls.delete(old.key);
      await idbDelete(old.key);
    }

    const key = uid("img");
    await idbPut(key, file);
    state.looks[kind] = {
      mode: "upload",
      path: "",
      key,
      originalPath: "",
    };
    await rebuildImageUrls();
    saveMeta();
    return true;
  }

  async function setLookFromPath(kind, path) {
    path = String(path || "").trim();
    if (!path) return false;

    const old = state.looks[kind];
    if (old && old.mode === "upload" && old.key) {
      const oldUrl = state.imageUrls.get(old.key);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      state.imageUrls.delete(old.key);
      await idbDelete(old.key);
    }

    state.looks[kind] = {
      mode: "path",
      path,
      key: "",
      originalPath: path,
    };
    await rebuildImageUrls();
    saveMeta();
    return true;
  }

  if (ui.bgUpload) {
    ui.bgUpload.addEventListener("change", async () => {
      const ok = await setLookFromUpload("background", ui.bgUpload.files?.[0]);
      if (ok) ui.bgUpload.value = "";
    });
  }

  if (ui.buddyUpload) {
    ui.buddyUpload.addEventListener("change", async () => {
      const ok = await setLookFromUpload("buddy", ui.buddyUpload.files?.[0]);
      if (ok) ui.buddyUpload.value = "";
    });
  }

  if (ui.btnApplyBg) {
    ui.btnApplyBg.addEventListener("click", async () => {
      await setLookFromPath("background", ui.bgPath.value);
    });
  }

  if (ui.btnApplyBuddy) {
    ui.btnApplyBuddy.addEventListener("click", async () => {
      await setLookFromPath("buddy", ui.buddyPath.value);
    });
  }

  if (ui.btnResetLooks) {
    ui.btnResetLooks.addEventListener("click", async () => {
      for (const kind of ["background", "buddy"]) {
        const old = state.looks[kind];
        if (old && old.mode === "upload" && old.key) await idbDelete(old.key);
      }
      state.looks = JSON.parse(JSON.stringify(defaultLooks));
      await rebuildImageUrls();
      saveMeta();
    });
  }

  ui.btnReset.addEventListener("click", async () => {
    if (!confirm("Reset custom weapons and browser save?")) return;
    localStorage.removeItem(SAVE_KEY);
    await idbClear();
    state.weapons = defaultWeapons.map(sanitizeWeapon);
    state.looks = JSON.parse(JSON.stringify(defaultLooks));
    state.selectedId = "bat";
    state.coins = 0;
    state.combo = 1;
    state.buddy.x = 480;
    state.buddy.y = 300;
    state.buddy.vx = 0;
    state.buddy.vy = 0;
    state.buddy.angle = 0;
    state.buddy.av = 0;
    await rebuildImageUrls();
    renderWeapons();
    updateStats();
  });

  // Safari older canvas fallback
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      this.beginPath();
      this.moveTo(x + rr, y);
      this.arcTo(x + w, y, x + w, y + h, rr);
      this.arcTo(x + w, y + h, x, y + h, rr);
      this.arcTo(x, y + h, x, y, rr);
      this.arcTo(x, y, x + w, y, rr);
      this.closePath();
      return this;
    };
  }

  syncRangeLabels();
  loadMeta().then(() => {
    updateStats();
    tick();
  });
})();
