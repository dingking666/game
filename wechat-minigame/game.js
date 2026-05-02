const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const systemInfo = wx.getSystemInfoSync();

const dpr = systemInfo.pixelRatio || 1;
const width = systemInfo.windowWidth;
const height = systemInfo.windowHeight;

canvas.width = Math.floor(width * dpr);
canvas.height = Math.floor(height * dpr);
ctx.scale(dpr, dpr);

const state = {
  phase: 'ready',
  score: 0,
  best: 0,
  lives: 3,
  combo: 0,
  time: 0,
  spawnTimer: 0,
  difficulty: 1,
  lastFrame: 0,
  touching: false,
  player: {
    x: width / 2,
    y: height - 86,
    radius: 22,
    targetX: width / 2
  },
  drops: [],
  particles: []
};

const pauseButton = {
  x: width - 58,
  y: 20,
  w: 38,
  h: 34
};

function loadBestScore() {
  try {
    state.best = wx.getStorageSync('star-catcher-best') || 0;
  } catch (error) {
    state.best = 0;
  }
}

function saveBestScore() {
  if (state.score <= state.best) return;
  state.best = state.score;

  try {
    wx.setStorageSync('star-catcher-best', state.best);
  } catch (error) {
    // Storage may fail in some restricted simulator states; gameplay should continue.
  }
}

function resetGame() {
  state.phase = 'playing';
  state.score = 0;
  state.lives = 3;
  state.combo = 0;
  state.time = 0;
  state.spawnTimer = 0;
  state.difficulty = 1;
  state.drops = [];
  state.particles = [];
  state.player.x = width / 2;
  state.player.targetX = width / 2;
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isInside(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function spawnDrop() {
  const isMeteor = Math.random() < Math.min(0.34, 0.16 + state.difficulty * 0.018);
  const radius = isMeteor ? random(16, 24) : random(11, 17);

  state.drops.push({
    kind: isMeteor ? 'meteor' : 'star',
    x: random(radius + 12, width - radius - 12),
    y: -radius - 8,
    radius,
    speed: random(120, 185) + state.difficulty * 18,
    spin: random(-4, 4),
    angle: random(0, Math.PI * 2)
  });
}

function addParticles(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: random(-120, 120),
      vy: random(-170, 80),
      life: random(0.35, 0.75),
      maxLife: random(0.35, 0.75),
      radius: random(2, 4),
      color
    });
  }
}

function hitTestPlayer(drop) {
  const dx = drop.x - state.player.x;
  const dy = drop.y - state.player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < drop.radius + state.player.radius * 0.86;
}

function updateDrops(delta) {
  state.spawnTimer -= delta;
  state.difficulty = 1 + state.time / 22;

  if (state.spawnTimer <= 0) {
    spawnDrop();
    state.spawnTimer = Math.max(0.26, 0.82 - state.difficulty * 0.045);
  }

  for (let i = state.drops.length - 1; i >= 0; i -= 1) {
    const drop = state.drops[i];
    drop.y += drop.speed * delta;
    drop.angle += drop.spin * delta;

    if (hitTestPlayer(drop)) {
      if (drop.kind === 'star') {
        state.combo += 1;
        state.score += 10 + Math.min(40, state.combo * 2);
        addParticles(drop.x, drop.y, '#ffd166', 14);
      } else {
        state.lives -= 1;
        state.combo = 0;
        addParticles(drop.x, drop.y, '#ff6b6b', 22);

        if (wx.vibrateShort) {
          wx.vibrateShort({ type: 'medium' });
        }

        if (state.lives <= 0) {
          state.phase = 'over';
          saveBestScore();
        }
      }

      state.drops.splice(i, 1);
      continue;
    }

    if (drop.y - drop.radius > height + 20) {
      if (drop.kind === 'star') {
        state.combo = 0;
      }

      state.drops.splice(i, 1);
    }
  }
}

function updateParticles(delta) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 320 * delta;

    if (particle.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

function update(delta) {
  if (state.phase !== 'playing') {
    updateParticles(delta);
    return;
  }

  state.time += delta;
  state.player.x += (state.player.targetX - state.player.x) * Math.min(1, delta * 16);
  updateDrops(delta);
  updateParticles(delta);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#10233d');
  gradient.addColorStop(0.52, '#1d4d62');
  gradient.addColorStop(1, '#19303c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  for (let i = 0; i < 54; i += 1) {
    const x = (i * 67 + Math.sin(state.time * 0.4 + i) * 12) % width;
    const y = (i * 97 + state.time * (8 + (i % 5) * 2)) % height;
    const size = 1 + (i % 3) * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(13, 30, 43, 0.54)';
  ctx.fillRect(0, height - 62, width, 62);
}

function drawPlayer() {
  const { x, y, radius } = state.player;

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#9be7ff';
  ctx.beginPath();
  ctx.moveTo(0, -radius - 8);
  ctx.lineTo(radius + 14, radius + 4);
  ctx.lineTo(8, radius - 2);
  ctx.lineTo(0, radius + 14);
  ctx.lineTo(-8, radius - 2);
  ctx.lineTo(-radius - 14, radius + 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#256d85';
  ctx.beginPath();
  ctx.ellipse(0, -3, 10, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 209, 102, 0.78)';
  ctx.beginPath();
  ctx.moveTo(-7, radius + 2);
  ctx.lineTo(0, radius + 28 + Math.sin(state.time * 16) * 6);
  ctx.lineTo(7, radius + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStar(drop) {
  ctx.save();
  ctx.translate(drop.x, drop.y);
  ctx.rotate(drop.angle);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();

  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? drop.radius : drop.radius * 0.45;
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 10;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMeteor(drop) {
  ctx.save();
  ctx.translate(drop.x, drop.y);
  ctx.rotate(drop.angle);

  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.arc(0, 0, drop.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.beginPath();
  ctx.arc(-drop.radius * 0.32, -drop.radius * 0.22, drop.radius * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#9d2f48';
  ctx.beginPath();
  ctx.arc(drop.radius * 0.25, drop.radius * 0.1, drop.radius * 0.18, 0, Math.PI * 2);
  ctx.arc(-drop.radius * 0.12, drop.radius * 0.38, drop.radius * 0.14, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawDrops() {
  state.drops.forEach((drop) => {
    if (drop.kind === 'star') {
      drawStar(drop);
    } else {
      drawMeteor(drop);
    }
  });
}

function drawParticles() {
  state.particles.forEach((particle) => {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function drawHud() {
  ctx.fillStyle = '#f7fbff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`分数 ${state.score}`, 18, 34);

  ctx.fillStyle = 'rgba(247, 251, 255, 0.72)';
  ctx.font = '13px sans-serif';
  ctx.fillText(`最高 ${state.best}`, 20, 55);

  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i < state.lives ? '#ff6b6b' : 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.arc(width / 2 - 24 + i * 24, 31, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  roundRect(pauseButton.x, pauseButton.y, pauseButton.w, pauseButton.h, 8);
  ctx.fill();
  ctx.fillStyle = '#f7fbff';
  ctx.fillRect(pauseButton.x + 12, pauseButton.y + 9, 4, 16);
  ctx.fillRect(pauseButton.x + 22, pauseButton.y + 9, 4, 16);
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = 'rgba(7, 18, 29, 0.72)';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7fbff';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(title, width / 2, height * 0.38);

  ctx.fillStyle = 'rgba(247, 251, 255, 0.8)';
  ctx.font = '15px sans-serif';
  ctx.fillText(subtitle, width / 2, height * 0.38 + 38);

  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('点击屏幕开始', width / 2, height * 0.38 + 78);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function render() {
  drawBackground();
  drawDrops();
  drawParticles();
  drawPlayer();
  drawHud();

  if (state.phase === 'ready') {
    drawOverlay('接星避陨石', '拖动飞船接住星星，避开红色陨石');
  }

  if (state.phase === 'paused') {
    drawOverlay('已暂停', '再次点击右上角继续');
  }

  if (state.phase === 'over') {
    drawOverlay('游戏结束', `本局 ${state.score} 分  最高 ${state.best} 分`);
  }
}

function loop(timestamp) {
  if (!state.lastFrame) {
    state.lastFrame = timestamp;
  }

  const delta = Math.min(0.033, (timestamp - state.lastFrame) / 1000);
  state.lastFrame = timestamp;

  update(delta);
  render();
  requestAnimationFrame(loop);
}

function setPlayerTarget(x) {
  state.player.targetX = clamp(x, state.player.radius + 12, width - state.player.radius - 12);
}

function handleTouchStart(touch) {
  const point = { x: touch.clientX, y: touch.clientY };

  if (isInside(point, pauseButton) && (state.phase === 'playing' || state.phase === 'paused')) {
    state.phase = state.phase === 'playing' ? 'paused' : 'playing';
    return;
  }

  if (state.phase === 'ready' || state.phase === 'over') {
    resetGame();
    setPlayerTarget(point.x);
    return;
  }

  if (state.phase === 'playing') {
    state.touching = true;
    setPlayerTarget(point.x);
  }
}

function handleTouchMove(touch) {
  if (state.phase !== 'playing' || !state.touching) return;
  setPlayerTarget(touch.clientX);
}

function registerInput() {
  wx.onTouchStart((event) => {
    const touch = event.touches && event.touches[0];
    if (touch) handleTouchStart(touch);
  });

  wx.onTouchMove((event) => {
    const touch = event.touches && event.touches[0];
    if (touch) handleTouchMove(touch);
  });

  wx.onTouchEnd(() => {
    state.touching = false;
  });

  wx.onHide(() => {
    if (state.phase === 'playing') {
      state.phase = 'paused';
    }
  });
}

loadBestScore();
registerInput();
requestAnimationFrame(loop);
