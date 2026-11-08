/* Clockwork Courier — one dusk rooftop, drawn on a canvas. */
(function () {
  "use strict";

  var VIEW_W = 960;
  var VIEW_H = 540;
  var WORLD_W = 6400;
  var PW = 34;
  var PH = 50;
  var GRAVITY = 1700;
  var JUMP_V = -575;
  var HOLD_ACC = -650;
  var HOLD_TIME = 0.1;
  var MAX_FALL = 760;
  var RUN_SPEED = 248;
  var RUN_ACCEL = 2600;
  var AIR_ACCEL = 1800;
  var GROUND_FRICTION = 2200;
  var AIR_FRICTION = 280;
  var COYOTE = 0.13;
  var JUMP_BUFFER = 0.13;
  var LIVES_MAX = 3;

  var canvas = document.getElementById("view");
  var ctx = canvas.getContext("2d");
  var startCard = document.getElementById("start-card");
  var winCard = document.getElementById("win-card");
  var winCopy = document.getElementById("win-copy");
  var startBtn = document.getElementById("start-btn");
  var replayBtn = document.getElementById("replay-btn");
  var muteBtn = document.getElementById("mute");

  var platforms = [
    { id: "r1", kind: "roof", x: -40, y: 400, w: 480, h: 280 },
    { id: "r2", kind: "roof", x: 540, y: 400, w: 400, h: 280 },
    { id: "c1", kind: "chimney", x: 1050, y: 348, w: 84, h: 380 },
    { id: "c2", kind: "chimney", x: 1214, y: 292, w: 80, h: 430 },
    { id: "c3", kind: "chimney", x: 1374, y: 332, w: 82, h: 400 },
    { id: "c4", kind: "chimney", x: 1536, y: 270, w: 78, h: 460 },
    { id: "c5", kind: "chimney", x: 1696, y: 322, w: 82, h: 410 },
    { id: "mid", kind: "roof", x: 1888, y: 388, w: 370, h: 300 },
    { id: "gl", kind: "roof", x: 2370, y: 400, w: 230, h: 280 },
    { id: "gr", kind: "roof", x: 2970, y: 376, w: 260, h: 300 },
    { id: "steam", kind: "roof", x: 3350, y: 400, w: 820, h: 280 },
    { id: "sl", kind: "roof", x: 4290, y: 392, w: 210, h: 290 },
    { id: "sr", kind: "roof", x: 5160, y: 400, w: 230, h: 280 },
    { id: "s1", kind: "step", x: 5500, y: 344, w: 120, h: 28 },
    { id: "s2", kind: "step", x: 5700, y: 286, w: 116, h: 26 },
    { id: "s3", kind: "step", x: 5488, y: 226, w: 150, h: 26 }
  ];

  var liftDef = { id: "lift", x: 2710, w: 156, h: 22, yLow: 400, yHigh: 300, period: 4.2 };
  var sliderDef = { id: "slider", x0: 4610, x1: 4940, y: 396, w: 168, h: 20, period: 4.4 };
  var vents = [
    { x: 3600, phase: 0 },
    { x: 3970, phase: 1.55 }
  ];
  var STEAM_PERIOD = 3.15;
  var checkpointX = 2020;
  var START_SPAWN = { x: 78, y: 350 };
  var CHECK_SPAWN = { x: 1948, y: 338 };
  var goal = { x: 5510, y: 176, w: 108, h: 54 };

  var springDefs = [
    { x: 210, y: 378 },
    { x: 390, y: 378 },
    { x: 690, y: 378 },
    { x: 880, y: 378 },
    { x: 1092, y: 326 },
    { x: 1254, y: 270 },
    { x: 1575, y: 248 },
    { x: 2060, y: 366 },
    { x: 2490, y: 378 },
    { x: 3480, y: 378 },
    { x: 3785, y: 378 },
    { x: 5758, y: 264 }
  ];

  var farCity = [];
  var nearCity = [];
  (function buildSkyline() {
    var rng = function (seed) {
      var a = seed;
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    var r = rng(11);
    var x = -180;
    var i = 0;
    while (x < WORLD_W + 400) {
      var w = 36 + Math.floor(r() * 54);
      var h = 150 + Math.floor(r() * 210);
      farCity.push({
        x: x,
        w: w,
        h: h,
        tip: i % 4,
        windows: Math.floor(r() * 4)
      });
      x += w + 22 + Math.floor(r() * 70);
      i += 1;
    }
    r = rng(29);
    x = -80;
    i = 0;
    while (x < WORLD_W + 200) {
      nearCity.push({
        x: x,
        w: 48 + Math.floor(r() * 36),
        h: 90 + Math.floor(r() * 120),
        gear: r() > 0.55,
        gr: 18 + r() * 22
      });
      x += 90 + Math.floor(r() * 80);
      i += 1;
    }
  })();

  var state = "start";
  var time = 0;
  var cameraX = 0;
  var lives = LIVES_MAX;
  var iframes = 0;
  var shake = 0;
  var coyote = 0;
  var jumpBuffer = 0;
  var jumpHold = 0;
  var prevGrounded = false;
  var grounded = false;
  var groundId = null;
  var riding = null;
  var squash = 0;
  var runPhase = 0;
  var keyAngle = 0;
  var facing = 1;
  var checkpointOn = false;
  var spawn = { x: START_SPAWN.x, y: START_SPAWN.y };
  var unwind = 0;
  var winGlow = 0;
  var springs = [];
  var particles = [];
  var player = { x: START_SPAWN.x, y: START_SPAWN.y, vx: 0, vy: 0 };
  var liftPrev = { x: liftDef.x, y: liftDef.yLow };
  var sliderPrev = { x: sliderDef.x0, y: sliderDef.y };
  var keys = { left: false, right: false, jump: false };

  var audioCtx = null;
  var muted = false;
  var audioReady = false;
  var dpr = 1;

  function resetRun() {
    springs = springDefs.map(function (s) {
      return { x: s.x, y: s.y, got: false };
    });
    lives = LIVES_MAX;
    iframes = 0;
    shake = 0;
    coyote = 0;
    jumpBuffer = 0;
    jumpHold = 0;
    prevGrounded = true;
    grounded = true;
    groundId = "r1";
    riding = null;
    squash = 0;
    runPhase = 0;
    keyAngle = 0;
    facing = 1;
    checkpointOn = false;
    spawn.x = START_SPAWN.x;
    spawn.y = START_SPAWN.y;
    unwind = 0;
    winGlow = 0;
    particles.length = 0;
    player.x = START_SPAWN.x;
    player.y = START_SPAWN.y;
    player.vx = 0;
    player.vy = 0;
    cameraX = 0;
    time = 0;
    keys.left = false;
    keys.right = false;
    keys.jump = false;
    var lift = liftRect(0);
    var slide = sliderRect(0);
    liftPrev.x = lift.x;
    liftPrev.y = lift.y;
    sliderPrev.x = slide.x;
    sliderPrev.y = slide.y;
  }

  function springsGot() {
    var n = 0;
    for (var i = 0; i < springs.length; i++) if (springs[i].got) n += 1;
    return n;
  }

  function showStart() {
    state = "start";
    resetRun();
    startCard.hidden = false;
    winCard.hidden = true;
    muteBtn.hidden = true;
    startBtn.focus();
  }

  function beginRun() {
    resetRun();
    state = "play";
    startCard.hidden = true;
    winCard.hidden = true;
    muteBtn.hidden = false;
    unlockAudio();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function showWin() {
    state = "win";
    winGlow = 1.3;
    var n = springsGot();
    var total = springs.length;
    winCopy.textContent = "You collected " + n + " of " + total + " brass springs.";
    winCard.hidden = false;
    muteBtn.hidden = false;
    burst(goal.x + goal.w * 0.5, goal.y + 10, 42, "#f3d48a", 220, 40);
    burst(goal.x + 20, goal.y + 16, 18, "#9ee0d6", 160, 20);
    sfxDeliver();
    replayBtn.focus();
  }

  function unlockAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    var resume = audioCtx.resume();
    if (resume && resume.catch) resume.catch(function () {});
    audioReady = true;
  }

  function tone(freq, dur, type, gain, delay, slide) {
    if (!audioReady || muted || !audioCtx) return;
    var t0 = audioCtx.currentTime + (delay || 0);
    var osc = audioCtx.createOscillator();
    var amp = audioCtx.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + dur);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(amp);
    amp.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function sfxJump() { tone(440, 0.12, "square", 0.045, 0, 720); }
  function sfxCollect() {
    tone(680, 0.08, "triangle", 0.05, 0);
    tone(920, 0.12, "triangle", 0.045, 0.07);
  }
  function sfxDeliver() {
    tone(523, 0.16, "triangle", 0.05, 0);
    tone(659, 0.16, "triangle", 0.05, 0.09);
    tone(784, 0.18, "triangle", 0.05, 0.18);
    tone(1046, 0.28, "triangle", 0.04, 0.28);
  }

  function burst(x, y, n, color, speed, upBias) {
    for (var i = 0; i < n; i++) {
      if (particles.length > 240) particles.shift();
      var a = Math.random() * Math.PI * 2;
      var s = speed * (0.35 + Math.random() * 0.7);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (upBias || 0) * Math.random(),
        life: 0.32 + Math.random() * 0.38,
        age: 0,
        color: color,
        size: 1.6 + Math.random() * 2.2,
        puff: false
      });
    }
  }

  function puff(x, y) {
    if (particles.length > 240) return;
    particles.push({
      x: x + (Math.random() - 0.5) * 18,
      y: y,
      vx: (Math.random() - 0.5) * 18,
      vy: -40 - Math.random() * 50,
      life: 0.45 + Math.random() * 0.25,
      age: 0,
      color: "rgba(210, 255, 246, 0.8)",
      size: 6 + Math.random() * 8,
      puff: true
    });
  }

  function ping(t, period) {
    var u = (t % period) / period;
    return 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
  }

  function liftRect(t) {
    var p = ping(t, liftDef.period);
    return {
      id: "lift",
      kind: "lift",
      x: liftDef.x,
      y: liftDef.yLow + (liftDef.yHigh - liftDef.yLow) * p,
      w: liftDef.w,
      h: liftDef.h,
      vx: 0,
      vy: 0
    };
  }

  function sliderRect(t) {
    var p = ping(t, sliderDef.period);
    return {
      id: "slider",
      kind: "slider",
      x: sliderDef.x0 + (sliderDef.x1 - sliderDef.x0) * p,
      y: sliderDef.y,
      w: sliderDef.w,
      h: sliderDef.h,
      vx: 0,
      vy: 0
    };
  }

  function solidsAt(t) {
    var list = platforms.map(function (p) {
      return { id: p.id, kind: p.kind, x: p.x, y: p.y, w: p.w, h: p.h };
    });
    list.push(liftRect(t));
    list.push(sliderRect(t));
    return list;
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function playerBox() {
    return { x: player.x, y: player.y, w: PW, h: PH };
  }

  function hurtBox() {
    return { x: player.x + 5, y: player.y + 8, w: PW - 10, h: PH - 10 };
  }

  function circleHits(box, cx, cy, r) {
    var nx = Math.max(box.x, Math.min(cx, box.x + box.w));
    var ny = Math.max(box.y, Math.min(cy, box.y + box.h));
    var dx = cx - nx;
    var dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function steamMode(phase) {
    var u = ((time + phase) % STEAM_PERIOD + STEAM_PERIOD) % STEAM_PERIOD;
    if (u > 1.35 && u <= 2.0) return "puff";
    if (u > 2.0 && u <= 2.72) return "hot";
    return "safe";
  }

  function gearHazard() {
    return { x: liftDef.x + liftDef.w * 0.5, y: 508, r: 82 };
  }

  function isLeft(code) { return code === "ArrowLeft" || code === "KeyA"; }
  function isRight(code) { return code === "ArrowRight" || code === "KeyD"; }
  function isJump(code) { return code === "Space" || code === "ArrowUp" || code === "KeyW"; }

  window.addEventListener("keydown", function (e) {
    if (isLeft(e.code) || isRight(e.code) || isJump(e.code)) {
      if (state === "play" || state === "unwind" || isLeft(e.code) || isRight(e.code)) e.preventDefault();
      if (state === "play" && isJump(e.code)) e.preventDefault();
    }
    if (e.repeat) return;
    if (isLeft(e.code)) keys.left = true;
    else if (isRight(e.code)) keys.right = true;
    else if (isJump(e.code)) {
      keys.jump = true;
      if (state === "play") jumpBuffer = JUMP_BUFFER;
    }
  });

  window.addEventListener("keyup", function (e) {
    if (isLeft(e.code)) keys.left = false;
    else if (isRight(e.code)) keys.right = false;
    else if (isJump(e.code)) keys.jump = false;
  });

  window.addEventListener("blur", function () {
    keys.left = false;
    keys.right = false;
    keys.jump = false;
  });

  function hurt() {
    if (iframes > 0 || state !== "play") return;
    lives -= 1;
    shake = 8;
    burst(player.x + PW * 0.5, player.y + 16, 16, "#e7c98a", 160, 30);
    if (lives <= 0) {
      state = "unwind";
      unwind = 0.85;
      iframes = 2;
      player.vx = 0;
      player.vy = 0;
      riding = null;
      return;
    }
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    riding = null;
    iframes = 1.2;
    jumpHold = 0;
    grounded = true;
    prevGrounded = true;
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 16);
    if (iframes > 0 && state === "play") iframes = Math.max(0, iframes - dt);
    if (squash > 0) squash = Math.max(0, squash - dt);

    var lift = liftRect(time);
    var slide = sliderRect(time);

    if (state === "unwind") {
      unwind -= dt;
      updateParticles(dt);
      if (unwind <= 0) showStart();
      return;
    }

    if (state === "win") {
      winGlow = Math.max(0, winGlow - dt);
      if (winGlow > 0 && Math.random() < 0.4) {
        burst(goal.x + goal.w * 0.5, goal.y + 8, 2, "#f3d48a", 90, 20);
      }
      updateParticles(dt);
      updateCamera(dt);
      return;
    }

    if (state !== "play") {
      updateParticles(dt);
      if (Math.abs(player.vx) < 8 && grounded) {
        /* idle clock for the key stays still; bob uses time */
      }
      return;
    }

    if (prevGrounded) coyote = COYOTE;
    else coyote = Math.max(0, coyote - dt);
    if (jumpBuffer > 0) jumpBuffer = Math.max(0, jumpBuffer - dt);

    if (riding === "lift") {
      player.x += lift.x - liftPrev.x;
      player.y += lift.y - liftPrev.y;
    } else if (riding === "slider") {
      player.x += slide.x - sliderPrev.x;
      player.y += slide.y - sliderPrev.y;
    }

    var dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var accel = grounded ? RUN_ACCEL : AIR_ACCEL;
    if (dir !== 0) {
      player.vx += dir * accel * dt;
      if (player.vx > RUN_SPEED) player.vx = RUN_SPEED;
      if (player.vx < -RUN_SPEED) player.vx = -RUN_SPEED;
    } else {
      var fr = (grounded ? GROUND_FRICTION : AIR_FRICTION) * dt;
      if (Math.abs(player.vx) <= fr) player.vx = 0;
      else player.vx -= Math.sign(player.vx) * fr;
    }
    if (player.vx > 28) facing = 1;
    if (player.vx < -28) facing = -1;

    var bodies = solidsAt(time);
    player.x += player.vx * dt;
    resolve("x", bodies);

    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
    player.y += player.vy * dt;
    grounded = false;
    groundId = null;
    resolve("y", bodies);

    if (jumpBuffer > 0 && (grounded || coyote > 0)) {
      player.vy = JUMP_V;
      jumpBuffer = 0;
      coyote = 0;
      grounded = false;
      groundId = null;
      riding = null;
      jumpHold = keys.jump ? HOLD_TIME : 0;
      squash = 0;
      sfxJump();
    }
    if (jumpHold > 0) {
      if (keys.jump && player.vy < 0) {
        player.vy += HOLD_ACC * dt;
        jumpHold -= dt;
      } else jumpHold = 0;
    }

    if (grounded && !prevGrounded) squash = 0.16;
    prevGrounded = grounded;
    riding = groundId === "lift" || groundId === "slider" ? groundId : null;

    if (player.x < 0) {
      player.x = 0;
      if (player.vx < 0) player.vx = 0;
    }

    runPhase += Math.abs(player.vx) * dt * 0.055;
    if (Math.abs(player.vx) > 40 && grounded) keyAngle += dt * (6 + Math.abs(player.vx) / 50);

    if (!checkpointOn && player.x + PW > checkpointX && player.x < checkpointX + 36 && player.y + PH > 360 && player.y < 400) {
      checkpointOn = true;
      spawn.x = CHECK_SPAWN.x;
      spawn.y = CHECK_SPAWN.y;
      burst(checkpointX + 8, 360, 12, "#9ee0d6", 120, 30);
    }

    for (var i = 0; i < springs.length; i++) {
      var s = springs[i];
      if (s.got) continue;
      if (circleHits(playerBox(), s.x, s.y, 16)) {
        s.got = true;
        burst(s.x, s.y, 14, "#f3d48a", 150, 40);
        sfxCollect();
      }
    }

    if (iframes <= 0) {
      var hb = hurtBox();
      var gear = gearHazard();
      if (circleHits(hb, gear.x, gear.y, gear.r)) hurt();
      if (state === "play") {
        for (var v = 0; v < vents.length; v++) {
          if (steamMode(vents[v].phase) !== "hot") continue;
          var column = { x: vents[v].x - 24, y: 400 - 196, w: 48, h: 196 };
          if (overlap(hb, column)) {
            hurt();
            break;
          }
        }
      }
    }

    if (state === "play" && player.y > 640) hurt();

    if (state === "play" && overlap(playerBox(), goal)) showWin();

    for (var p = 0; p < vents.length; p++) {
      if (steamMode(vents[p].phase) === "puff" && Math.random() < 0.7) puff(vents[p].x, 392);
    }

    updateParticles(dt);
    updateCamera(dt);
    liftPrev.x = lift.x;
    liftPrev.y = lift.y;
    sliderPrev.x = slide.x;
    sliderPrev.y = slide.y;
  }

  function resolve(axis, bodies) {
    var box = playerBox();
    for (var i = 0; i < bodies.length; i++) {
      var s = bodies[i];
      box.x = player.x;
      box.y = player.y;
      if (!overlap(box, s)) continue;
      if (axis === "x") {
        if (player.vx > 0) player.x = s.x - PW;
        else if (player.vx < 0) player.x = s.x + s.w;
        else {
          var penL = player.x + PW - s.x;
          var penR = s.x + s.w - player.x;
          player.x = penL < penR ? s.x - PW : s.x + s.w;
        }
        player.vx = 0;
      } else if (player.vy > 0 || player.vy === 0) {
        player.y = s.y - PH;
        player.vy = 0;
        grounded = true;
        groundId = s.id;
      } else {
        player.y = s.y + s.h;
        player.vy = 0;
        jumpHold = 0;
      }
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      p.vy += (p.puff ? 20 : 520) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.age >= p.life) particles.splice(i, 1);
    }
  }

  function updateCamera(dt) {
    var px = player.x + PW * 0.5;
    var desired = cameraX;
    var left = cameraX + VIEW_W / 3;
    var right = cameraX + (2 * VIEW_W) / 3;
    if (px < left) desired = px - VIEW_W / 3;
    if (px > right) desired = px - (2 * VIEW_W) / 3;
    var max = WORLD_W - VIEW_W;
    if (desired < 0) desired = 0;
    if (desired > max) desired = max;
    cameraX += (desired - cameraX) * Math.min(1, dt * 6);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawGear(x, y, r, teeth, angle, fill, stroke) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    for (var i = 0; i < teeth; i++) {
      var a0 = (i / teeth) * Math.PI * 2;
      var a1 = ((i + 0.32) / teeth) * Math.PI * 2;
      var a2 = ((i + 0.58) / teeth) * Math.PI * 2;
      var a3 = ((i + 1) / teeth) * Math.PI * 2;
      var inner = r * 0.76;
      if (i === 0) ctx.moveTo(Math.cos(a0) * inner, Math.sin(a0) * inner);
      else ctx.lineTo(Math.cos(a0) * inner, Math.sin(a0) * inner);
      ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
      ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
      ctx.lineTo(Math.cos(a3) * inner, Math.sin(a3) * inner);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1612";
    ctx.fill();
    ctx.restore();
  }

  function drawRoof(p) {
    ctx.fillStyle = "#24382f";
    ctx.fillRect(p.x, p.y + 16, p.w, p.h - 16);
    var lip = ctx.createLinearGradient(p.x, p.y, p.x, p.y + 18);
    lip.addColorStop(0, "#d7b56a");
    lip.addColorStop(0.45, "#6e907c");
    lip.addColorStop(1, "#3c5c4c");
    ctx.fillStyle = lip;
    ctx.fillRect(p.x, p.y, p.w, 18);
    ctx.fillStyle = "rgba(12, 16, 14, 0.35)";
    for (var y = p.y + 36; y < p.y + Math.min(p.h, 160); y += 28) {
      ctx.fillRect(p.x + 8, y, p.w - 16, 3);
    }
    ctx.fillStyle = "#c6a15e";
    var rivets = Math.max(2, Math.floor(p.w / 48));
    for (var i = 0; i < rivets; i++) {
      var rx = p.x + 16 + ((p.w - 32) * i) / Math.max(1, rivets - 1);
      ctx.beginPath();
      ctx.arc(rx, p.y + 9, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(8, 10, 8, 0.28)";
    ctx.beginPath();
    ctx.ellipse(p.x + p.w * 0.3, p.y + 48, 18, 28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawChimney(p) {
    ctx.fillStyle = "#2c463c";
    ctx.fillRect(p.x, p.y + 10, p.w, p.h - 10);
    ctx.fillStyle = "#1b2e28";
    ctx.fillRect(p.x + 6, p.y + 24, p.w - 12, p.h);
    var cap = ctx.createLinearGradient(p.x, p.y, p.x, p.y + 14);
    cap.addColorStop(0, "#e6c98a");
    cap.addColorStop(1, "#5f866f");
    ctx.fillStyle = cap;
    ctx.fillRect(p.x - 4, p.y, p.w + 8, 12);
    ctx.fillStyle = "#0e1210";
    ctx.beginPath();
    ctx.ellipse(p.x + p.w * 0.5, p.y + 5, p.w * 0.22, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8d6a34";
    ctx.fillRect(p.x - 2, p.y + 28, p.w + 4, 6);
    ctx.fillStyle = "rgba(10, 8, 6, 0.35)";
    ctx.beginPath();
    ctx.ellipse(p.x + p.w * 0.72, p.y + 70, 10, 26, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStep(p) {
    ctx.fillStyle = "#3e5a4a";
    ctx.fillRect(p.x, p.y + 6, p.w, p.h - 6);
    ctx.fillStyle = "#e0b45a";
    ctx.fillRect(p.x, p.y, p.w, 7);
    ctx.fillStyle = "#8a6230";
    for (var x = p.x + 8; x < p.x + p.w - 4; x += 14) ctx.fillRect(x, p.y + p.h - 4, 6, 4);
  }

  function drawLift(rect) {
    ctx.fillStyle = "#6a5430";
    ctx.fillRect(rect.x + 8, rect.y + rect.h, 6, 18);
    ctx.fillRect(rect.x + rect.w - 14, rect.y + rect.h, 6, 18);
    drawGear(rect.x + 18, rect.y + rect.h + 8, 12, 8, time * 1.4, "#b8893e", "#5c431c");
    drawGear(rect.x + rect.w - 18, rect.y + rect.h + 8, 12, 8, -time * 1.4, "#b8893e", "#5c431c");
    ctx.fillStyle = "#314a3e";
    roundRect(rect.x, rect.y, rect.w, rect.h, 5);
    ctx.fill();
    ctx.fillStyle = "#e6c98a";
    ctx.fillRect(rect.x, rect.y, rect.w, 5);
    ctx.strokeStyle = "#d7b56a";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 3, rect.y + 7, rect.w - 6, 8);
  }

  function drawSlider(rect) {
    ctx.strokeStyle = "#8c6a32";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sliderDef.x0 - 10, sliderDef.y + rect.h + 6);
    ctx.lineTo(sliderDef.x1 + sliderDef.w + 10, sliderDef.y + rect.h + 6);
    ctx.stroke();
    ctx.fillStyle = "#c6a15e";
    ctx.fillRect(sliderDef.x0 - 4, sliderDef.y + rect.h + 2, 8, 10);
    ctx.fillRect(sliderDef.x1 + sliderDef.w - 4, sliderDef.y + rect.h + 2, 8, 10);
    ctx.fillStyle = "#355446";
    roundRect(rect.x, rect.y, rect.w, rect.h, 4);
    ctx.fill();
    ctx.fillStyle = "#e6c98a";
    ctx.fillRect(rect.x, rect.y, rect.w, 4);
    var spin = rect.x * 0.08;
    ctx.fillStyle = "#1a1612";
    ctx.beginPath();
    ctx.arc(rect.x + 16, rect.y + rect.h + 2, 6, 0, Math.PI * 2);
    ctx.arc(rect.x + rect.w - 16, rect.y + rect.h + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e0b45a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rect.x + 16, rect.y + rect.h + 2, 6, spin, spin + 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rect.x + rect.w - 16, rect.y + rect.h + 2, 6, spin, spin + 1.2);
    ctx.stroke();
  }

  function drawSpring(s) {
    if (s.got) return;
    var bob = Math.sin(time * 3 + s.x * 0.02) * 3;
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    ctx.strokeStyle = "#f0d48a";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    var steps = 28;
    for (var i = 0; i <= steps; i++) {
      var p = i / steps;
      var ang = p * Math.PI * 2 * 4.2;
      var px = Math.cos(ang) * 7;
      var py = -14 + p * 28;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = "#c4923a";
    ctx.fillRect(-8, -16, 16, 3);
    ctx.fillRect(-8, 12, 16, 3);
    ctx.restore();
  }

  function drawCourier() {
    var bob = 0;
    if (grounded && Math.abs(player.vx) < 16) bob = Math.sin(time * 2.6) * 2.3;
    else if (grounded) bob = Math.abs(Math.sin(runPhase)) * 2.2;
    var k = squash > 0 ? squash / 0.16 : 0;
    var sy = 1;
    if (k > 0) sy = 1 - 0.18 * Math.sin(Math.min(1, k) * Math.PI);
    else if (!grounded && player.vy < -40) sy = 1.1;
    var footX = player.x + PW * 0.5;
    var footY = player.y + PH + bob;
    var alpha = 1;
    if (iframes > 0 && state === "play") alpha = 0.45 + 0.55 * Math.abs(Math.sin(time * 18));
    if (state === "unwind") alpha = Math.max(0, unwind / 0.85);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(footX, player.y + PH + 2, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(footX, footY);
    ctx.scale(facing * (sy < 1 ? 1.08 : 1), sy);

    var swing = grounded ? Math.sin(runPhase) : 0.4;
    drawLeg(-7, swing);
    drawLeg(7, -swing * 0.9);

    ctx.save();
    ctx.translate(-16, -34);
    ctx.rotate(keyAngle);
    ctx.fillStyle = "#e7c56a";
    ctx.beginPath();
    ctx.arc(0, -6, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1612";
    ctx.beginPath();
    ctx.arc(0, -6, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e7c56a";
    ctx.fillRect(-1.4, -2, 2.8, 14);
    ctx.fillRect(-1.4, 8, 6, 2.2);
    ctx.fillRect(-1.4, 11.2, 4.5, 2.2);
    ctx.restore();

    var body = ctx.createRadialGradient(-6, -42, 2, 0, -32, 18);
    body.addColorStop(0, "#ffe3a4");
    body.addColorStop(0.55, "#e0b15a");
    body.addColorStop(1, "#8d6230");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, -32, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 58, 24, 0.7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, -32, 11, 0.4, 2.2);
    ctx.stroke();

    ctx.fillStyle = "#6a4e28";
    roundRect(10, -38, 12, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#1f7a72";
    ctx.fillRect(12, -36, 8, 8);
    ctx.strokeStyle = "#e6c98a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(12, -32);
    ctx.lineTo(20, -32);
    ctx.moveTo(16, -36);
    ctx.lineTo(16, -28);
    ctx.stroke();

    ctx.fillStyle = "#10221f";
    ctx.beginPath();
    ctx.ellipse(6, -34, 5, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9ee0d6";
    ctx.beginPath();
    ctx.arc(7.2, -34.2, 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawLeg(x, swing) {
    ctx.save();
    ctx.translate(x, -16);
    ctx.rotate(swing * 0.55);
    ctx.fillStyle = "#6d532c";
    roundRect(-3, 0, 6, 14, 3);
    ctx.fill();
    ctx.fillStyle = "#2a241c";
    ctx.fillRect(-4, 12, 9, 4);
    ctx.restore();
  }

  function drawTower() {
    var x = 5360;
    ctx.fillStyle = "#1c2c26";
    ctx.fillRect(x, 78, 280, 470);
    ctx.fillStyle = "#2a4238";
    ctx.beginPath();
    ctx.moveTo(x - 16, 90);
    ctx.lineTo(x + 140, 18);
    ctx.lineTo(x + 296, 90);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c6a15e";
    ctx.fillRect(x + 132, 18, 16, 22);

    var faceX = x + 140;
    var faceY = 132;
    ctx.fillStyle = "#e6c98a";
    ctx.beginPath();
    ctx.arc(faceX, faceY, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#14302e";
    ctx.beginPath();
    ctx.arc(faceX, faceY, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f3d48a";
    ctx.lineWidth = 2;
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(faceX + Math.cos(a) * 28, faceY + Math.sin(a) * 28);
      ctx.lineTo(faceX + Math.cos(a) * 34, faceY + Math.sin(a) * 34);
      ctx.stroke();
    }
    var ha = time * 0.15;
    var ma = time * 1.2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(faceX, faceY);
    ctx.lineTo(faceX + Math.cos(ha) * 16, faceY + Math.sin(ha) * 16);
    ctx.moveTo(faceX, faceY);
    ctx.lineTo(faceX + Math.cos(ma) * 26, faceY + Math.sin(ma) * 26);
    ctx.stroke();

    var near = Math.abs(player.x - goal.x) < 220;
    ctx.fillStyle = near || state === "win" ? "#9ee0d6" : "#1a3a36";
    roundRect(goal.x, goal.y, goal.w, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#070908";
    ctx.fillRect(goal.x + 8, goal.y + 4, goal.w - 16, 8);
    ctx.strokeStyle = "#e6c98a";
    ctx.lineWidth = 2;
    ctx.strokeRect(goal.x - 4, goal.y - 4, goal.w + 8, 24);
  }

  function drawCheckpoint() {
    ctx.fillStyle = "#8a6230";
    ctx.fillRect(checkpointX, 352, 6, 36);
    ctx.fillStyle = checkpointOn ? "#9ee0d6" : "#5c4a2c";
    ctx.beginPath();
    ctx.arc(checkpointX + 3, 346, 8, 0, Math.PI * 2);
    ctx.fill();
    if (checkpointOn) {
      ctx.fillStyle = "rgba(158, 224, 214, 0.25)";
      ctx.beginPath();
      ctx.arc(checkpointX + 3, 346, 16 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSteam() {
    for (var i = 0; i < vents.length; i++) {
      var vent = vents[i];
      var mode = steamMode(vent.phase);
      ctx.fillStyle = "#3a4e42";
      roundRect(vent.x - 18, 386, 36, 14, 3);
      ctx.fill();
      ctx.fillStyle = mode === "hot" ? "#f3d48a" : mode === "puff" ? "#e7a15a" : "#8a6a32";
      ctx.fillRect(vent.x - 12, 390, 24, 6);
      if (mode === "puff") {
        var u = ((time + vent.phase) % STEAM_PERIOD);
        var k = (u - 1.35) / 0.65;
        ctx.strokeStyle = "rgba(210, 255, 246, 0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(vent.x, 378, 16 + k * 22, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (mode === "hot") {
        var wob = Math.sin(time * 28 + i) * 3;
        var g = ctx.createLinearGradient(0, 200, 0, 400);
        g.addColorStop(0, "rgba(255, 255, 255, 0.05)");
        g.addColorStop(0.4, "rgba(190, 255, 244, 0.55)");
        g.addColorStop(1, "rgba(255, 248, 230, 0.85)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(vent.x - 16 + wob, 400);
        ctx.lineTo(vent.x + 16 + wob, 400);
        ctx.lineTo(vent.x + 10, 210);
        ctx.lineTo(vent.x - 10, 210);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawRails() {
    ctx.strokeStyle = "#6e5430";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(liftDef.x + 8, liftDef.yHigh - 10);
    ctx.lineTo(liftDef.x + 8, liftDef.yLow + 30);
    ctx.moveTo(liftDef.x + liftDef.w - 8, liftDef.yHigh - 10);
    ctx.lineTo(liftDef.x + liftDef.w - 8, liftDef.yLow + 30);
    ctx.stroke();
  }

  function drawHazardGear() {
    var g = gearHazard();
    var glow = ctx.createRadialGradient(g.x, g.y, 10, g.x, g.y, g.r + 30);
    glow.addColorStop(0, "rgba(240, 180, 80, 0.35)");
    glow.addColorStop(1, "rgba(240, 180, 80, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r + 28, 0, Math.PI * 2);
    ctx.fill();
    drawGear(g.x, g.y, g.r, 10, time * 0.65, "#e0b15a", "#8a5a28");
  }

  function drawParallax() {
    var sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, "#12383c");
    sky.addColorStop(0.42, "#1c6a62");
    sky.addColorStop(0.7, "#e39a55");
    sky.addColorStop(0.8, "#f2c48a");
    sky.addColorStop(1, "#140e0c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    var sunX = 760 - cameraX * 0.04;
    var sun = ctx.createRadialGradient(sunX, 150, 8, sunX, 150, 70);
    sun.addColorStop(0, "rgba(255, 228, 180, 0.95)");
    sun.addColorStop(1, "rgba(255, 180, 90, 0)");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(sunX, 150, 70, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(-cameraX * 0.16, 0);
    ctx.fillStyle = "#14343a";
    for (var i = 0; i < farCity.length; i++) {
      var b = farCity[i];
      var base = 430;
      if (b.x + b.w < cameraX * 0.16 - 40 || b.x > cameraX * 0.16 + VIEW_W + 40) continue;
      ctx.beginPath();
      ctx.moveTo(b.x, base);
      ctx.lineTo(b.x, base - b.h + 30);
      if (b.tip === 0) {
        ctx.lineTo(b.x + b.w * 0.5, base - b.h);
        ctx.lineTo(b.x + b.w, base - b.h + 30);
      } else if (b.tip === 1) {
        ctx.lineTo(b.x + 8, base - b.h);
        ctx.lineTo(b.x + b.w - 8, base - b.h);
        ctx.lineTo(b.x + b.w, base - b.h + 40);
      } else {
        ctx.lineTo(b.x, base - b.h + 10);
        ctx.lineTo(b.x + b.w, base - b.h + 24);
      }
      ctx.lineTo(b.x + b.w, base);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(242, 196, 138, 0.55)";
      for (var w = 0; w < b.windows; w++) {
        ctx.fillRect(b.x + 10 + w * 12, base - 70 - (w % 2) * 24, 4, 6);
      }
      ctx.fillStyle = "#14343a";
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-cameraX * 0.4, 0);
    for (var n = 0; n < nearCity.length; n++) {
      var c = nearCity[n];
      var left = cameraX * 0.4;
      if (c.x + 80 < left - 30 || c.x > left + VIEW_W + 30) continue;
      ctx.fillStyle = "#1a2422";
      ctx.fillRect(c.x, 400 - c.h, c.w, c.h + 40);
      ctx.fillStyle = "#101816";
      ctx.fillRect(c.x + c.w * 0.35, 400 - c.h - 18, c.w * 0.3, 22);
      if (c.gear) drawGear(c.x + c.w + 10, 390 - c.h * 0.3, c.gr, 7, time * 0.2, "#24302c", "#121816");
    }
    ctx.restore();
  }

  function drawMiniKey(x, y, lit) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = lit ? "#f3d48a" : "#4a4034";
    ctx.fillStyle = lit ? "#e0b45a" : "#2a241c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-1.5, 5, 3, 10);
    ctx.fillRect(-1.5, 12, 6, 2);
    ctx.restore();
  }

  function drawHud() {
    if (state === "start") return;
    for (var i = 0; i < LIVES_MAX; i++) drawMiniKey(36 + i * 22, 36, i < lives);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.font = '600 22px "Palatino Linotype", Palatino, Georgia, serif';
    ctx.textAlign = "left";
    ctx.fillText("Springs " + springsGot(), 118, 44);
    ctx.fillStyle = "#f6ecd4";
    ctx.fillText("Springs " + springsGot(), 116, 42);
  }

  function draw() {
    var cssW = window.innerWidth;
    var cssH = window.innerHeight;
    var scale = Math.min(cssW / VIEW_W, cssH / VIEW_H);
    var ox = (cssW - VIEW_W * scale) / 2;
    var oy = (cssH - VIEW_H * scale) / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#101614";
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.clip();

    if (shake > 0) {
      ctx.translate(Math.sin(time * 42) * shake, Math.cos(time * 37) * shake * 0.55);
    }

    drawParallax();

    ctx.save();
    ctx.translate(-Math.round(cameraX), 0);
    drawHazardGear();
    drawRails();
    drawTower();
    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (p.kind === "chimney") drawChimney(p);
      else if (p.kind === "step") drawStep(p);
      else drawRoof(p);
    }
    var lift = liftRect(time);
    var slide = sliderRect(time);
    drawLift(lift);
    drawSlider(slide);
    drawCheckpoint();
    for (var s = 0; s < springs.length; s++) drawSpring(springs[s]);
    drawSteam();
    drawCourier();
    for (var q = 0; q < particles.length; q++) {
      var part = particles[q];
      var fade = 1 - part.age / part.life;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = part.color;
      if (part.puff) {
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.size * fade, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(part.x, part.y, part.size, part.size);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (state === "start" || state === "win") {
      ctx.fillStyle = "rgba(8, 10, 10, 0.38)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    drawHud();
    ctx.restore();
  }

  startBtn.addEventListener("click", beginRun);
  replayBtn.addEventListener("click", function () {
    winCard.hidden = true;
    showStart();
  });
  muteBtn.addEventListener("click", function () {
    muted = !muted;
    muteBtn.textContent = muted ? "Unmute" : "Mute";
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    if (!muted) unlockAudio();
    muteBtn.blur();
  });

  window.addEventListener("resize", resize);
  resetRun();
  resize();
  startBtn.focus();

  var last = performance.now();
  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
