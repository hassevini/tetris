// Lógica do Jogo

// Constantes
const COLS = 10,
  ROWS = 20,
  SIZE = 24;
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const holdCanvas = document.getElementById("hold");
const holdCtx = holdCanvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");

const COLORS = {
  I: "#00fff2",
  J: "#3b9dff",
  L: "#ffab4f",
  O: "#ffe93b",
  S: "#39ff8f",
  T: "#ff2bd6",
  Z: "#ff3b5c",
};

const SHAPES = {
  I: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  O: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
};

// Estados
let grid,
  current,
  next,
  holdPiece,
  canHold,
  score,
  level,
  lines,
  dropCounter,
  dropInterval,
  lastTime,
  paused,
  gameOver,
  animId;

let mode = "normal";
const GARBAGE_COLOR = "#4a4a5e";

// Dificuldades modo sobrevivência
const SURVIVAL_DIFFICULTIES = {
  easy: { label: "Fácil", initial: 12000, min: 6000, step: 1000, every: 20000 },
  medium: {
    label: "Médio",
    initial: 9000,
    min: 4000,
    step: 1000,
    every: 18000,
  },
  hard: { label: "Difícil", initial: 6000, min: 2500, step: 800, every: 15000 },
  insane: {
    label: "Insano",
    initial: 4000,
    min: 1500,
    step: 600,
    every: 12000,
  },
};
let survivalConfig = SURVIVAL_DIFFICULTIES.medium;
let survivalCounter = 0;
let survivalInterval = survivalConfig.initial;
let survivalGameElapsed = 0;
let survivalNextIntensifyAt = survivalConfig.every;

// Modo torre: altura
let TOWER_ROWS = 10;
let towerElapsed = 0;

// Sistema das peças
function emptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function freshPiece(type) {
  return {
    type,
    cells: SHAPES[type].map(([x, y]) => [x, y]),
    x: 3,
    y: 0,
    color: COLORS[type],
  };
}

function randomPiece() {
  const keys = Object.keys(SHAPES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  return freshPiece(type);
}

function rotateCells(cells) {
  const maxX = Math.max(...cells.map((c) => c[0]));
  const maxY = Math.max(...cells.map((c) => c[1]));
  const size = Math.max(maxX, maxY);
  return cells.map(([x, y]) => [size - y, x]);
}

function collides(cells, offX, offY) {
  for (const [cx, cy] of cells) {
    const x = cx + offX;
    const y = cy + offY;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && grid[y][x]) return true;
  }
  return false;
}

function merge() {
  for (const [cx, cy] of current.cells) {
    const x = current.x + cx;
    const y = current.y + cy;
    if (y >= 0) grid[y][x] = current.color;
  }
}

function clearLines() {
  let cleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (!grid[y][x]) continue outer;
    }
    grid.splice(y, 1);
    grid.unshift(Array(COLS).fill(null));
    cleared++;
    y++;
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800][cleared] * level;
    score += points;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 80);
    updateStats();
    if (mode === "tower" && countGarbage() === 0) {
      towerComplete();
    }
  }
}

function spawn() {
  current = next;
  current.x = 3;
  current.y = 0;
  next = randomPiece();
  canHold = true;
  drawNext();
  if (collides(current.cells, current.x, current.y)) {
    endGame();
  }
}

function holdSwap() {
  if (!canHold) return;
  canHold = false;
  if (holdPiece === null) {
    holdPiece = current.type;
    current = next;
    current.x = 3;
    current.y = 0;
    next = randomPiece();
    drawNext();
  } else {
    const temp = holdPiece;
    holdPiece = current.type;
    current = freshPiece(temp);
  }
  drawHold();
  draw();
}

function move(dx) {
  if (!collides(current.cells, current.x + dx, current.y)) {
    current.x += dx;
  }
}

function drop() {
  if (!collides(current.cells, current.x, current.y + 1)) {
    current.y++;
  } else {
    merge();
    clearLines();
    spawn();
  }
  dropCounter = 0;
}

function hardDrop() {
  while (!collides(current.cells, current.x, current.y + 1)) {
    current.y++;
  }
  merge();
  clearLines();
  spawn();
  dropCounter = 0;
}

function rotate() {
  const rotated = rotateCells(current.cells);
  const kicks = [0, -1, 1, -2, 2];
  for (const k of kicks) {
    if (!collides(rotated, current.x + k, current.y)) {
      current.cells = rotated;
      current.x += k;
      return;
    }
  }
}

// Sistema de Visualização
function updateStats() {
  document.getElementById("score").textContent = score;
  document.getElementById("level").textContent = level;
  document.getElementById("lines").textContent = lines;
}

function drawCell(c, x, y, color) {
  c.fillStyle = color;
  c.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);
  c.strokeStyle = "rgba(255,255,255,0.15)";
  c.strokeRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);
}

function draw() {
  ctx.fillStyle = "#05010f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x]) drawCell(ctx, x, y, grid[y][x]);
    }
  }

  // peça fantasma
  let ghostY = current.y;
  while (!collides(current.cells, current.x, ghostY + 1)) ghostY++;
  ctx.globalAlpha = 0.25;
  for (const [cx, cy] of current.cells) {
    drawCell(ctx, current.x + cx, ghostY + cy, current.color);
  }
  ctx.globalAlpha = 1;

  for (const [cx, cy] of current.cells) {
    const y = current.y + cy;
    if (y >= 0) drawCell(ctx, current.x + cx, y, current.color);
  }
}

function drawNext() {
  nextCtx.fillStyle = "#05010f";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const s = 20;
  const offX = next.type === "I" || next.type === "O" ? 10 : 20;
  for (const [cx, cy] of next.cells) {
    nextCtx.fillStyle = next.color;
    nextCtx.fillRect(offX + cx * s + 1, 10 + cy * s + 1, s - 2, s - 2);
  }
}

function drawHold() {
  holdCtx.fillStyle = "#05010f";
  holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (!holdPiece) return;
  const s = 20;
  const cells = SHAPES[holdPiece];
  const offX = holdPiece === "I" || holdPiece === "O" ? 10 : 20;
  const color = canHold ? COLORS[holdPiece] : "#555577";
  for (const [cx, cy] of cells) {
    holdCtx.fillStyle = color;
    holdCtx.fillRect(offX + cx * s + 1, 10 + cy * s + 1, s - 2, s - 2);
  }
}

// Modo Sobrevivência
function addGarbageLine() {
  const topRowHadBlock = grid[0].some((c) => c);
  grid.shift();
  const holeCol = Math.floor(Math.random() * COLS);
  const newRow = Array.from({ length: COLS }, (_, i) =>
    i === holeCol ? null : GARBAGE_COLOR,
  );
  grid.push(newRow);
  current.y -= 1;
  draw();
  if (topRowHadBlock || collides(current.cells, current.x, current.y)) {
    endGame();
  }
}

function updateSurvivalUI() {
  if (mode !== "survival") return;
  const remaining = Math.max(
    0,
    Math.ceil((survivalInterval - survivalCounter) / 1000),
  );
  document.getElementById("survivalTimer").textContent = remaining + "s";
  document.getElementById("survivalSub").textContent =
    `${survivalConfig.label} · a cada ${(survivalInterval / 1000).toFixed(1)}s`;
}

// Modo Torre
function buildTower() {
  for (let y = ROWS - TOWER_ROWS; y < ROWS; y++) {
    const holeCol = Math.floor(Math.random() * COLS);
    grid[y] = Array.from({ length: COLS }, (_, x) =>
      x === holeCol ? null : GARBAGE_COLOR,
    );
  }
}

function countGarbage() {
  let count = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === GARBAGE_COLOR) count++;
    }
  }
  return count;
}

function formatTime(ms) {
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const s = (total % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

function updateTowerUI() {
  if (mode !== "tower") return;
  document.getElementById("towerTimer").textContent = formatTime(towerElapsed);
  document.getElementById("towerSub").textContent = `${TOWER_ROWS} fileiras`;
}

function towerComplete() {
  gameOver = true;
  overlayTitle.textContent = `TORRE LIMPA! ${formatTime(towerElapsed)}`;
  overlay.classList.add("show");
  cancelAnimationFrame(animId);
}

// Fluxo do Jogo
function endGame() {
  gameOver = true;
  overlayTitle.textContent = "GAME OVER";
  overlay.classList.add("show");
  cancelAnimationFrame(animId);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  document.getElementById("pauseBtn").textContent = paused
    ? "CONTINUAR"
    : "PAUSAR";
  if (!paused) {
    lastTime = performance.now();
    animId = requestAnimationFrame(update);
  } else {
    cancelAnimationFrame(animId);
  }
}

function update(time = 0) {
  if (paused || gameOver) return;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval) {
    drop();
  }
  if (mode === "survival") {
    survivalCounter += delta;
    survivalGameElapsed += delta;
    if (survivalGameElapsed >= survivalNextIntensifyAt) {
      survivalInterval = Math.max(
        survivalConfig.min,
        survivalInterval - survivalConfig.step,
      );
      survivalNextIntensifyAt += survivalConfig.every;
    }
    if (survivalCounter > survivalInterval) {
      survivalCounter = 0;
      addGarbageLine();
    }
    updateSurvivalUI();
    if (gameOver) return;
  }
  if (mode === "tower") {
    towerElapsed += delta;
    updateTowerUI();
  }
  draw();
  animId = requestAnimationFrame(update);
}

function resetGame() {
  grid = emptyGrid();
  if (mode === "tower") buildTower();
  score = 0;
  level = 1;
  lines = 0;
  dropCounter = 0;
  dropInterval = 1000;
  survivalCounter = 0;
  survivalGameElapsed = 0;
  survivalInterval = survivalConfig.initial;
  survivalNextIntensifyAt = survivalConfig.every;
  towerElapsed = 0;
  paused = false;
  gameOver = false;
  holdPiece = null;
  canHold = true;
  overlay.classList.remove("show");
  document.getElementById("pauseBtn").textContent = "PAUSAR";
  document
    .getElementById("survivalBox")
    .classList.toggle("show", mode === "survival");
  document
    .getElementById("towerBox")
    .classList.toggle("show", mode === "tower");
  updateSurvivalUI();
  updateTowerUI();
  next = randomPiece();
  spawn();
  updateStats();
  drawNext();
  drawHold();
  lastTime = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(update);
}

// Menus
function startGame(selectedMode, options = {}) {
  mode = selectedMode;
  if (mode === "survival") {
    survivalConfig =
      SURVIVAL_DIFFICULTIES[options.difficulty] || SURVIVAL_DIFFICULTIES.medium;
  }
  if (mode === "tower") {
    TOWER_ROWS = options.height || 10;
  }
  document.getElementById("startMenu").style.display = "none";
  document.getElementById("survivalMenu").style.display = "none";
  document.getElementById("towerMenu").style.display = "none";
  document.getElementById("gameWrap").style.display = "flex";
  resetGame();
}

function openMenu(menuId) {
  document.getElementById("startMenu").style.display = "none";
  document.getElementById("survivalMenu").style.display = "none";
  document.getElementById("towerMenu").style.display = "none";
  document.getElementById(menuId).style.display = "flex";
}

function backToMenu() {
  cancelAnimationFrame(animId);
  gameOver = true;
  overlay.classList.remove("show");
  document.getElementById("gameWrap").style.display = "none";
  openMenu("startMenu");
}

// Controles do Teclado
document.addEventListener("keydown", (e) => {
  if (document.getElementById("gameWrap").style.display === "none") return;
  if (gameOver) return;
  if (e.key === "p" || e.key === "P") {
    togglePause();
    return;
  }
  if (paused) return;
  switch (e.key) {
    case "ArrowLeft":
      move(-1);
      draw();
      break;
    case "ArrowRight":
      move(1);
      draw();
      break;
    case "ArrowDown":
      drop();
      draw();
      break;
    case "ArrowUp":
      rotate();
      draw();
      break;
    case " ":
      e.preventDefault();
      hardDrop();
      draw();
      break;
    case "c":
    case "C":
      holdSwap();
      break;
  }
});
