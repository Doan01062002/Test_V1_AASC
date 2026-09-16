/**
 * Game Server - Client Script
 * Line 98 (3D Crystal Marbles & Web Audio) & Cờ Caro X O (15x15 Online & AI Bot)
 */

// =========================================================================
//                             1. KHỞI TẠO SOCKET & BIẾN TOÀN CỤC
// =========================================================================
const socket = io();

let currentUser = JSON.parse(localStorage.getItem('aasc_user') || 'null');
let authToken = localStorage.getItem('aasc_token') || null;

// Header & Navigation DOM
const latencyBadge = document.getElementById('latencyBadge');
const socketStatusDot = document.getElementById('socketStatusDot');
const latencyText = document.getElementById('latencyText');
// (userStatusText, headerAvatar already declared above)
// (navButtons, tabContents, userBadge already declared above)

let pingInterval = null;

function startPingMonitoring() {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (socket && socket.connected) {
      const start = performance.now();
      socket.emit('ping', { clientTime: start });
    }
  }, 3000);
}

// ---------------- Line 98 DOM & State ----------------
const lineCanvas = document.getElementById('line98Canvas');
const lineCtx = lineCanvas ? lineCanvas.getContext('2d') : null;
const lineScoreEl = document.getElementById('line98Score');
const lineHighScoreEl = document.getElementById('line98HighScore');
const lineNextBallsEl = document.getElementById('line98NextBalls');
const lineSuggestionEl = document.getElementById('line98Suggestion');
const btnLineHelp = document.getElementById('btnLine98Help');
const btnLineNewGame = document.getElementById('btnLine98NewGame');

// Modal Game Over Elements
const line98GameOverModal = document.getElementById('line98GameOverModal');
const modalFinalScore = document.getElementById('modalFinalScore');
const modalHighScore = document.getElementById('modalHighScore');
const modalNewRecordBadge = document.getElementById('modalNewRecordBadge');
const btnLine98ModalRestart = document.getElementById('btnLine98ModalRestart');
const btnLine98ModalClose = document.getElementById('btnLine98ModalClose');

const LINE_LOGICAL_SIZE = 450;
const LINE_SIZE = 9;
const CELL_SIZE = LINE_LOGICAL_SIZE / LINE_SIZE; // 50px
const dpr = window.devicePixelRatio || 1;

let currentHighScore = parseInt(localStorage.getItem('line98_high_score') || '0', 10);
if (lineHighScoreEl) lineHighScoreEl.textContent = currentHighScore;

let lineBoard = Array(LINE_SIZE).fill(0).map(() => Array(LINE_SIZE).fill(0));
let selectedBall = null; // { r, c }
let selectedBallColor = null;
let helpSuggestion = null;
let animationPulse = 0;
let isAnimating = false;
let animatingBall = null; // { x, y, color }
let currentAnimationId = 0;
let moveTimeoutTimer = null;
let lineHoverCell = null; // { r, c }
let lineParticles = [];
let lineFloatingScores = [];
let lineClearingBalls = [];

// ---------------- Caro DOM & State ----------------
const caroCanvas = document.getElementById('caroCanvas');
const caroCtx = caroCanvas ? caroCanvas.getContext('2d') : null;
const btnCaroFind = document.getElementById('btnCaroFindMatch');
const btnCaroCancel = document.getElementById('btnCaroCancelMatch');
const caroTurnIndicator = document.getElementById('caroTurnIndicator');
const caroMatchStatus = document.getElementById('caroMatchmakingStatus');
const caroPlayerXName = document.getElementById('caroPlayerXName');
const caroPlayerOName = document.getElementById('caroPlayerOName');
const caroPlayerXRole = document.getElementById('caroPlayerXRole');
const caroPlayerORole = document.getElementById('caroPlayerORole');
const caroMoveCounter = document.getElementById('caroMoveCounter');

const btnCaroModeOnline = document.getElementById('btnCaroModeOnline');
const btnCaroModeBot = document.getElementById('btnCaroModeBot');
const caroModeDesc = document.getElementById('caroModeDesc');
const caroOnlineControls = document.getElementById('caroOnlineControls');
const caroBotControls = document.getElementById('caroBotControls');
const btnCaroBotRestart = document.getElementById('btnCaroBotRestart');

const caroHistoryTableBody = document.getElementById('caroHistoryTableBody');
const btnRefreshHistory = document.getElementById('btnRefreshHistory');

const CARO_LOGICAL_SIZE = 480;
const CARO_GRID = 15;
const CARO_CELL = CARO_LOGICAL_SIZE / CARO_GRID; // 32px

let caroMode = 'online'; // 'online' hoặc 'bot'
let caroBoard = Array(CARO_GRID).fill(null).map(() => Array(CARO_GRID).fill(null));
let caroRoomId = null;
let myCaroSymbol = null; // 'X' hoặc 'O'
let caroCurrentTurn = null; // 'X' hoặc 'O'
let caroWinningLine = null;
let caroIsFinished = false;
let caroLastMove = null; // { r, c, player }
let caroHoverPos = null; // { r, c }
let caroMovesHistory = [];
let botTurnToken = 0;

function setupHiDPICanvas(canvas, logicalWidth, logicalHeight) {
  if (!canvas) return;
  canvas.width = Math.round(logicalWidth * dpr);
  canvas.height = Math.round(logicalHeight * dpr);
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.maxWidth = '100%';
  canvas.style.height = 'auto';
  canvas.style.aspectRatio = `${logicalWidth} / ${logicalHeight}`;
}

setupHiDPICanvas(lineCanvas, LINE_LOGICAL_SIZE, LINE_LOGICAL_SIZE);
setupHiDPICanvas(caroCanvas, CARO_LOGICAL_SIZE, CARO_LOGICAL_SIZE);

// =========================================================================
//                             2. HỆ THỐNG ÂM THANH (WEB AUDIO API SYNTH)
// =========================================================================
let audioCtx = null;
let isSoundMuted = localStorage.getItem('line98_sound_muted') === 'true';

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Mở khóa Web Audio context ngay khi người dùng tương tác lần đầu
window.addEventListener('pointerdown', () => {
  if (!audioCtx) getAudioContext();
}, { once: true });

const btnLine98Sound = document.getElementById('btnLine98Sound');
const btnCaroSound = document.getElementById('btnCaroSound');

function updateSoundButtons() {
  const icon = isSoundMuted ? '🔇' : '🔊';
  if (btnLine98Sound) btnLine98Sound.textContent = icon;
  if (btnCaroSound) btnCaroSound.textContent = icon;
}

function toggleSound() {
  isSoundMuted = !isSoundMuted;
  localStorage.setItem('line98_sound_muted', isSoundMuted ? 'true' : 'false');
  updateSoundButtons();
  if (!isSoundMuted) getAudioContext();
}

if (btnLine98Sound) {
  btnLine98Sound.textContent = isSoundMuted ? '🔇' : '🔊';
  btnLine98Sound.addEventListener('click', toggleSound);
}
if (btnCaroSound) {
  btnCaroSound.textContent = isSoundMuted ? '🔇' : '🔊';
  btnCaroSound.addEventListener('click', toggleSound);
}

function playBallClickSound() {
  if (isSoundMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

function playBallSlideSound() {
  if (isSoundMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(320, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);

  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

function playLineClearSound() {
  if (isSoundMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // Hợp âm arpeggio tươi vui C5, E5, G5, C6
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = ctx.currentTime + idx * 0.06;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.18, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.22);
  });
}

function playGameOverSound() {
  if (isSoundMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [440, 392, 349, 293];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = ctx.currentTime + idx * 0.12;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.25);
  });
}

function playCaroMoveSound() {
  if (isSoundMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(700, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.07);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.07);
}

// =========================================================================
//                             3. TAB NAVIGATION
// =========================================================================
const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const userBadge = document.getElementById('userBadge');

function switchTab(tabId) {
  navButtons.forEach((b) => {
    if (b.getAttribute('data-tab') === tabId) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  tabContents.forEach((c) => {
    if (c.id === `${tabId}Tab`) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });

  // Luôn vẽ lại bàn cờ ngay khi chuyển sang tab game tương ứng
  if (tabId === 'line98') {
    const hasBalls = lineBoard.some(row => row.some(cell => cell > 0));
    if (!hasBalls) {
      initLine98();
    }
    requestAnimationFrame(() => renderLine98());
  } else if (tabId === 'caro') {
    requestAnimationFrame(() => renderCaro());
  }
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    switchTab(tabId);
  });
});

userBadge.addEventListener('click', () => {
  switchTab('account');
});

// =========================================================================
//                             4. QUẢN LÝ TÀI KHOẢN (AUTH & PROFILE DASHBOARD)
// =========================================================================
let isRegisterMode = false;
const authBox = document.getElementById('authBox');
const profileDashboard = document.getElementById('profileDashboard');

const authFormTitle = document.getElementById('authFormTitle');
const authFormSubtitle = document.getElementById('authFormSubtitle');
const authForm = document.getElementById('authForm');
const registerExtraFields = document.getElementById('registerExtraFields');
const btnAuthSubmit = document.getElementById('btnAuthSubmit');
const switchLogin = document.getElementById('switchLogin');
const switchRegister = document.getElementById('switchRegister');
const authAlert = document.getElementById('authAlert');

const userStatusText = document.getElementById('userStatusText');
const headerAvatar = document.getElementById('headerAvatar');

// Profile Dashboard Elements
const profAvatar = document.getElementById('profAvatar');
const profDisplayName = document.getElementById('profDisplayName');
const profUsernameTag = document.getElementById('profUsernameTag');
const profNickname = document.getElementById('profNickname');
const profEmail = document.getElementById('profEmail');
const profId = document.getElementById('profId');
const profCreatedAt = document.getElementById('profCreatedAt');
const btnCopyUuid = document.getElementById('btnCopyUuid');
const btnLogout = document.getElementById('btnLogout');

const updateProfileForm = document.getElementById('updateProfileForm');
const updateNicknameInput = document.getElementById('updateNicknameInput');
const updateEmailInput = document.getElementById('updateEmailInput');
const profileAlert = document.getElementById('profileAlert');

function formatDateTime(dateStr) {
  if (!dateStr) return 'Mới tham gia';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

function updateAuthUI() {
  if (currentUser && authToken) {
    // Ẩn hoàn toàn form đăng nhập/đăng ký
    authBox.style.display = 'none';
    profileDashboard.style.display = 'block';

    const displayName = currentUser.nickname || currentUser.username;
    const initial = displayName.charAt(0).toUpperCase();

    userStatusText.textContent = `👤 ${displayName}`;
    headerAvatar.textContent = initial;

    profAvatar.textContent = initial;
    profDisplayName.textContent = displayName;
    profUsernameTag.textContent = `@${currentUser.username}`;
    profNickname.textContent = currentUser.nickname || 'Chưa thiết lập';
    profEmail.textContent = currentUser.email || 'Chưa thiết lập';
    profId.textContent = currentUser.id || 'N/A';
    profCreatedAt.textContent = formatDateTime(currentUser.createdAt);

    updateNicknameInput.value = currentUser.nickname || '';
    updateEmailInput.value = currentUser.email || '';
    if (caroPlayerXName && caroMode === 'bot') {
      caroPlayerXName.textContent = displayName;
    }
  } else {
    // Hiển thị duy nhất một form đăng nhập/đăng ký căn giữa
    authBox.style.display = 'block';
    profileDashboard.style.display = 'none';

    userStatusText.textContent = 'Khách (Chưa đăng nhập)';
    headerAvatar.textContent = '👤';
    if (caroPlayerXName && caroMode === 'bot') {
      caroPlayerXName.textContent = 'Bạn (X)';
    }
  }
}

function setAuthMode(register) {
  isRegisterMode = register;
  if (isRegisterMode) {
    switchRegister.classList.add('active');
    switchLogin.classList.remove('active');
    authFormTitle.textContent = 'Đăng Ký Tài Khoản Mới';
    authFormSubtitle.textContent = 'Tạo tài khoản để tham gia xếp hạng và lưu trữ lịch sử thi đấu.';
    registerExtraFields.style.display = 'block';
    btnAuthSubmit.textContent = 'Hoàn Tất Đăng Ký';
  } else {
    switchLogin.classList.add('active');
    switchRegister.classList.remove('active');
    authFormTitle.textContent = 'Đăng Nhập Tài Khoản';
    authFormSubtitle.textContent = 'Đăng nhập để đồng bộ kết quả ván đấu và lưu kỷ lục cá nhân.';
    registerExtraFields.style.display = 'none';
    btnAuthSubmit.textContent = 'Đăng Nhập';
  }
  authAlert.style.display = 'none';
}

switchLogin.addEventListener('click', (e) => {
  e.preventDefault();
  setAuthMode(false);
});

switchRegister.addEventListener('click', (e) => {
  e.preventDefault();
  setAuthMode(true);
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authAlert.style.display = 'none';

  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value;

  // Client-side Validation tức thời
  if (!username || username.length < 3) {
    authAlert.className = 'alert-message alert-error';
    authAlert.textContent = 'Tên đăng nhập (username) phải có tối thiểu 3 ký tự.';
    authAlert.style.display = 'block';
    return;
  }

  if (!password || password.length < 6) {
    authAlert.className = 'alert-message alert-error';
    authAlert.textContent = 'Mật khẩu phải có tối thiểu 6 ký tự.';
    authAlert.style.display = 'block';
    return;
  }

  const endpoint = isRegisterMode ? '/auth/register' : '/auth/login';
  const payload = { username, password };

  if (isRegisterMode) {
    const email = document.getElementById('emailInput').value.trim();
    const nickname = document.getElementById('nicknameInput').value.trim();
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        authAlert.className = 'alert-message alert-error';
        authAlert.textContent = 'Địa chỉ email không đúng định dạng (ví dụ: name@example.com).';
        authAlert.style.display = 'block';
        return;
      }
      payload.email = email;
    }
    if (nickname) payload.nickname = nickname;
  }

  btnAuthSubmit.disabled = true;
  btnAuthSubmit.textContent = 'Đang xử lý...';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = Array.isArray(data.message) ? data.message.join('. ') : (data.message || 'Xác thực không thành công.');
      throw new Error(errMsg);
    }

    authToken = data.accessToken;
    currentUser = data.user;
    localStorage.setItem('aasc_token', authToken);
    localStorage.setItem('aasc_user', JSON.stringify(currentUser));

    authAlert.className = 'alert-message alert-success';
    authAlert.textContent = `${isRegisterMode ? 'Đăng ký' : 'Đăng nhập'} thành công!`;
    authAlert.style.display = 'block';

    updateAuthUI();

    // Liên kết session đang hoạt động với userId (không gọi line98:init để tránh xóa ván chơi đang diễn ra)
    if (currentUser?.id) {
      socket.emit('auth:linkUser', { userId: currentUser.id });
    }
  } catch (err) {
    authAlert.className = 'alert-message alert-error';
    authAlert.textContent = err.message;
    authAlert.style.display = 'block';
  } finally {
    btnAuthSubmit.disabled = false;
    btnAuthSubmit.textContent = isRegisterMode ? 'Hoàn Tất Đăng Ký' : 'Đăng Nhập';
  }
});

updateProfileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  profileAlert.style.display = 'none';

  const email = updateEmailInput.value.trim();
  const nickname = updateNicknameInput.value.trim();
  const payload = {};
  if (nickname) payload.nickname = nickname;
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      profileAlert.className = 'alert-message alert-error';
      profileAlert.textContent = 'Địa chỉ email không đúng định dạng (ví dụ: name@example.com).';
      profileAlert.style.display = 'block';
      return;
    }
    payload.email = email;
  }

  const submitBtn = updateProfileForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang lưu...';
  }

  try {
    const res = await fetch('/user/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      authToken = null;
      currentUser = null;
      localStorage.removeItem('aasc_token');
      localStorage.removeItem('aasc_user');
      updateAuthUI();
      authAlert.className = 'alert-message alert-error';
      authAlert.textContent = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      authAlert.style.display = 'block';
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      const errMsg = Array.isArray(data.message) ? data.message.join('. ') : (data.message || 'Cập nhật thất bại.');
      throw new Error(errMsg);
    }

    currentUser = { ...currentUser, ...data.user };
    localStorage.setItem('aasc_user', JSON.stringify(currentUser));

    profileAlert.className = 'alert-message alert-success';
    profileAlert.textContent = 'Đã cập nhật thông tin cá nhân thành công!';
    profileAlert.style.display = 'block';

    updateAuthUI();
  } catch (err) {
    profileAlert.className = 'alert-message alert-error';
    profileAlert.textContent = err.message;
    profileAlert.style.display = 'block';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '💾 Lưu Thay Đổi';
    }
  }
});

btnLogout.addEventListener('click', () => {
  socket.emit('auth:logout');
  authToken = null;
  currentUser = null;
  localStorage.removeItem('aasc_token');
  localStorage.removeItem('aasc_user');
  authForm.reset();
  authAlert.style.display = 'none';
  profileAlert.style.display = 'none';
  updateAuthUI();
  initLine98();
});

async function syncUserProfile() {
  if (!authToken) return;
  try {
    const res = await fetch('/user/profile', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = { ...currentUser, ...data };
      localStorage.setItem('aasc_user', JSON.stringify(currentUser));
      updateAuthUI();
    } else if (res.status === 401) {
      authToken = null;
      currentUser = null;
      localStorage.removeItem('aasc_token');
      localStorage.removeItem('aasc_user');
      updateAuthUI();
    }
  } catch (err) {
    console.warn('Không thể đồng bộ hồ sơ người dùng:', err);
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    btnCopyUuid.textContent = '✅';
    setTimeout(() => { btnCopyUuid.textContent = '📋'; }, 1500);
  } catch (err) {
    console.error('Không thể sao chép UUID:', err);
  } finally {
    document.body.removeChild(ta);
  }
}

btnCopyUuid.addEventListener('click', () => {
  if (currentUser?.id) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(currentUser.id).then(() => {
        btnCopyUuid.textContent = '✅';
        setTimeout(() => { btnCopyUuid.textContent = '📋'; }, 1500);
      }).catch(() => fallbackCopyText(currentUser.id));
    } else {
      fallbackCopyText(currentUser.id);
    }
  }
});

updateAuthUI();
syncUserProfile();

// =========================================================================
//                             5. TRÒ CHƠI 1: LINE 98 (3D CRYSTAL SPHERES)
// =========================================================================
// (Line 98 DOM, HiDPI canvas, and dimensions already declared above)

function getCanvasCoords(canvas, e, logicalWidth, logicalHeight) {
  const rect = canvas.getBoundingClientRect();
  let clientX = e.clientX;
  let clientY = e.clientY;

  if (clientX === undefined && e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (clientX === undefined && e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  }

  const rectWidth = rect.width || logicalWidth;
  const rectHeight = rect.height || logicalHeight;
  const scaleX = logicalWidth / rectWidth;
  const scaleY = logicalHeight / rectHeight;

  return {
    x: ((clientX ?? 0) - rect.left) * scaleX,
    y: ((clientY ?? 0) - rect.top) * scaleY,
  };
}

// 5 Bảng màu đá quý pha lê 3D cao cấp (Ruby, Sapphire, Emerald, Topaz, Amethyst)
const GEMSTONE_PALETTES = {
  1: { // Ruby Hồng Ngọc
    name: 'Ruby',
    base: '#dc2626',
    rim: '#f87171',
    shadow: '#450a0a',
    specular: '#fee2e2',
    glow: 'rgba(239, 68, 68, 0.65)',
  },
  2: { // Sapphire Lam Ngọc
    name: 'Sapphire',
    base: '#2563eb',
    rim: '#60a5fa',
    shadow: '#0f172a',
    specular: '#dbeafe',
    glow: 'rgba(59, 130, 246, 0.65)',
  },
  3: { // Emerald Ngọc Lục Bảo
    name: 'Emerald',
    base: '#059669',
    rim: '#34d399',
    shadow: '#022c22',
    specular: '#d1fae5',
    glow: 'rgba(16, 185, 129, 0.65)',
  },
  4: { // Topaz Hoàng Ngọc
    name: 'Topaz',
    base: '#d97706',
    rim: '#fbbf24',
    shadow: '#451a03',
    specular: '#fef3c7',
    glow: 'rgba(245, 158, 11, 0.65)',
  },
  5: { // Amethyst Thạch Anh Tím
    name: 'Amethyst',
    base: '#7c3aed',
    rim: '#a78bfa',
    shadow: '#2e1065',
    specular: '#f3e8ff',
    glow: 'rgba(139, 92, 246, 0.65)',
  },
};

// (Line 98 state variables already declared above)

function initLine98() {
  currentAnimationId++;
  clearTimeout(moveTimeoutTimer);
  isAnimating = false;
  animatingBall = null;
  lineParticles = [];
  lineFloatingScores = [];
  lineClearingBalls = [];
  socket.emit('line98:init', { userId: currentUser?.id });
}

socket.on('line98:gameState', (state) => {
  currentAnimationId++;
  clearTimeout(moveTimeoutTimer);
  isAnimating = false;
  animatingBall = null;
  lineCanvas.style.cursor = 'default';
  btnLineHelp.disabled = false;
  btnLineNewGame.disabled = false;

  lineBoard = state.board;
  lineScoreEl.textContent = state.score;
  updateNextBallsPreview(state.nextBalls);
  selectedBall = null;
  selectedBallColor = null;
  helpSuggestion = null;

  if (state.isGameOver) {
    showGameOverModal(state.score);
  }

  renderLine98();
});

// Hiệu ứng di chuyển mượt (Smooth Interpolation) dọc theo đường BFS
async function animateBallMove(path, ballColor) {
  const animId = ++currentAnimationId;
  isAnimating = true;
  lineCanvas.style.cursor = 'wait';
  btnLineHelp.disabled = true;
  btnLineNewGame.disabled = true;

  playBallSlideSound();

  try {
    const startPos = path[0];
    lineBoard[startPos.r][startPos.c] = 0;

    // Duyệt qua từng đoạn đường với sub-stepping mượt mà
    const STEPS_PER_SEGMENT = 4;
    const STEP_DELAY = 12; // ~50ms mỗi ô chuyển động cực mượt

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];

      for (let s = 0; s <= STEPS_PER_SEGMENT; s++) {
        if (animId !== currentAnimationId) return;
        const progress = s / STEPS_PER_SEGMENT;
        const curR = from.r + (to.r - from.r) * progress;
        const curC = from.c + (to.c - from.c) * progress;

        animatingBall = {
          r: curR,
          c: curC,
          color: ballColor,
        };
        renderLine98();
        await new Promise((r) => setTimeout(r, STEP_DELAY));
      }
    }
  } finally {
    if (animId === currentAnimationId) {
      animatingBall = null;
      isAnimating = false;
      lineCanvas.style.cursor = 'default';
      btnLineHelp.disabled = false;
      btnLineNewGame.disabled = false;
    }
  }
}

// Kích hoạt hạt nổ pha lê khi xóa hàng
function triggerClearParticles(clearedPositions, clearedColor) {
  clearedPositions.forEach((pos) => {
    const cx = pos.c * CELL_SIZE + CELL_SIZE / 2;
    const cy = pos.r * CELL_SIZE + CELL_SIZE / 2;
    const colorId = pos.color || (lineBoard[pos.r] && lineBoard[pos.r][pos.c]) || clearedColor || 1;
    const gem = GEMSTONE_PALETTES[colorId] || GEMSTONE_PALETTES[1];

    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.4;
      const speed = 1.5 + Math.random() * 3.5;
      lineParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: gem.rim,
        glow: gem.glow,
        size: 3 + Math.random() * 3.5,
        alpha: 1,
        decay: 0.035 + Math.random() * 0.02,
      });
    }
  });
}

// Hiển thị điểm bay lên (+10, +13, ...)
function triggerFloatingScore(score, positions) {
  if (!positions || positions.length === 0) return;
  // Lấy tọa độ trung tâm của các ô bị nổ
  let sumR = 0;
  let sumC = 0;
  positions.forEach((p) => { sumR += p.r; sumC += p.c; });
  const avgR = sumR / positions.length;
  const avgC = sumC / positions.length;

  lineFloatingScores.push({
    x: avgC * CELL_SIZE + CELL_SIZE / 2,
    y: avgR * CELL_SIZE + CELL_SIZE / 2,
    text: `+${score}`,
    alpha: 1,
    vy: -1.2,
  });
}

function showGameOverModal(finalScore) {
  modalFinalScore.textContent = finalScore;
  let highScore = parseInt(localStorage.getItem('line98_high_score') || '0', 10);
  let isNewRecord = false;

  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem('line98_high_score', highScore);
    currentHighScore = highScore;
    lineHighScoreEl.textContent = highScore;
    isNewRecord = true;
  }

  modalHighScore.textContent = highScore;
  modalNewRecordBadge.style.display = isNewRecord ? 'block' : 'none';
  line98GameOverModal.style.display = 'flex';

  playGameOverSound();
}

btnLine98ModalRestart.addEventListener('click', () => {
  line98GameOverModal.style.display = 'none';
  currentAnimationId++;
  clearTimeout(moveTimeoutTimer);
  isAnimating = false;
  animatingBall = null;
  lineParticles = [];
  lineFloatingScores = [];
  lineClearingBalls = [];
  socket.emit('line98:newGame', { userId: currentUser?.id });
});

btnLine98ModalClose.addEventListener('click', () => {
  line98GameOverModal.style.display = 'none';
});

socket.on('line98:moveResult', async (data) => {
  clearTimeout(moveTimeoutTimer);

  if (!data.success) {
    isAnimating = false;
    lineCanvas.style.cursor = 'default';
    btnLineHelp.disabled = false;
    btnLineNewGame.disabled = false;
    lineSuggestionEl.textContent = data.error || 'Nước đi không hợp lệ!';
    renderLine98();
    return;
  }

  const moveAnimToken = currentAnimationId + 1;
  selectedBall = null;
  helpSuggestion = null;

  const path = data.path;
  const startPos = path && path.length > 0 ? path[0] : null;
  const destPos = path && path.length > 0 ? path[path.length - 1] : null;

  let ballColor = selectedBallColor || 1;
  if (startPos && lineBoard[startPos.r] && lineBoard[startPos.r][startPos.c] !== 0) {
    ballColor = lineBoard[startPos.r][startPos.c];
  } else if (destPos && data.state.board[destPos.r]) {
    ballColor = data.state.board[destPos.r][destPos.c] || ballColor;
  }
  selectedBallColor = null;

  if (path && path.length > 1) {
    await animateBallMove(path, ballColor);
    if (moveAnimToken !== currentAnimationId) return;
  }

  // Nếu có nổ hàng, tạo hiệu ứng hạt, bóng tan biến mượt mà và điểm bay
  if (data.cleared && data.cleared.length > 0) {
    data.cleared.forEach((pos) => {
      const col = pos.color || (lineBoard[pos.r] && lineBoard[pos.r][pos.c]) || ballColor || 1;
      lineClearingBalls.push({
        r: pos.r,
        c: pos.c,
        color: col,
        scale: 1.0,
        alpha: 1.0,
      });
    });
    triggerClearParticles(data.cleared, ballColor);
    triggerFloatingScore(data.scoreGained, data.cleared);
    playLineClearSound();
  }

  lineBoard = data.state.board;
  lineScoreEl.textContent = data.state.score;
  updateNextBallsPreview(data.state.nextBalls);
  selectedBall = null;
  selectedBallColor = null;
  helpSuggestion = null;

  // Cập nhật kỷ lục cá nhân
  if (data.state.score > currentHighScore) {
    currentHighScore = data.state.score;
    localStorage.setItem('line98_high_score', currentHighScore);
    lineHighScoreEl.textContent = currentHighScore;
  }

  if (data.scoreGained > 0) {
    lineSuggestionEl.textContent = `Tuyệt vời! Bạn ghi được +${data.scoreGained} điểm! 🎉`;
  } else {
    lineSuggestionEl.textContent = 'Bấm nút "Trợ Giúp" để xem gợi ý nước đi.';
  }

  if (data.state.isGameOver) {
    showGameOverModal(data.state.score);
  }

  renderLine98();
});

socket.on('line98:helpResult', (data) => {
  if (data.success && data.suggestion) {
    helpSuggestion = data.suggestion;
    lineSuggestionEl.textContent = data.suggestion.reason;
    selectedBall = data.suggestion.from;
    if (data.suggestion.from && lineBoard[data.suggestion.from.r]) {
      selectedBallColor = lineBoard[data.suggestion.from.r][data.suggestion.from.c] || null;
    }
    renderLine98();
  } else {
    lineSuggestionEl.textContent = data.error || 'Không tìm thấy nước đi khả thi.';
  }
});

btnLineHelp.addEventListener('click', () => {
  if (isAnimating) return;
  socket.emit('line98:help');
});

btnLineNewGame.addEventListener('click', () => {
  if (isAnimating) return;
  currentAnimationId++;
  clearTimeout(moveTimeoutTimer);
  isAnimating = false;
  animatingBall = null;
  socket.emit('line98:newGame', { userId: currentUser?.id });
});

function updateNextBallsPreview(nextColors) {
  if (!nextColors) return;
  lineNextBallsEl.innerHTML = '';
  nextColors.forEach((colId) => {
    const gem = GEMSTONE_PALETTES[colId] || GEMSTONE_PALETTES[1];
    const ballDiv = document.createElement('div');
    ballDiv.className = 'next-ball-slot';
    ballDiv.title = gem.name;

    // Mini preview canvas
    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = 36 * dpr;
    miniCanvas.height = 36 * dpr;
    miniCanvas.style.width = '36px';
    miniCanvas.style.height = '36px';
    const mCtx = miniCanvas.getContext('2d');
    mCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw3DCrystalMarble(mCtx, 18, 18, 14, colId, false, 0);

    ballDiv.appendChild(miniCanvas);
    lineNextBallsEl.appendChild(ballDiv);
  });
}

function onLineCanvasAction(e) {
  if (isAnimating) return;

  const { x, y } = getCanvasCoords(lineCanvas, e, LINE_LOGICAL_SIZE, LINE_LOGICAL_SIZE);
  const c = Math.floor(x / CELL_SIZE);
  const r = Math.floor(y / CELL_SIZE);

  if (r < 0 || r >= LINE_SIZE || c < 0 || c >= LINE_SIZE) return;

  const clickedColor = lineBoard[r][c];

  if (clickedColor !== 0) {
    selectedBall = { r, c };
    selectedBallColor = clickedColor;
    helpSuggestion = null;
    playBallClickSound();
    renderLine98();
  } else if (selectedBall) {
    isAnimating = true;
    lineCanvas.style.cursor = 'wait';
    clearTimeout(moveTimeoutTimer);
    moveTimeoutTimer = setTimeout(() => {
      if (isAnimating && !animatingBall) {
        isAnimating = false;
        lineCanvas.style.cursor = 'default';
        btnLineHelp.disabled = false;
        btnLineNewGame.disabled = false;
        lineSuggestionEl.textContent = 'Hết thời gian chờ phản hồi từ máy chủ.';
        renderLine98();
      }
    }, 5000);

    socket.emit('line98:move', {
      from: selectedBall,
      to: { r, c },
    });
  }
}

lineCanvas.addEventListener('pointermove', (e) => {
  const { x, y } = getCanvasCoords(lineCanvas, e, LINE_LOGICAL_SIZE, LINE_LOGICAL_SIZE);
  const c = Math.floor(x / CELL_SIZE);
  const r = Math.floor(y / CELL_SIZE);
  if (r >= 0 && r < LINE_SIZE && c >= 0 && c < LINE_SIZE) {
    lineHoverCell = { r, c };
    if (!isAnimating) {
      if (lineBoard[r][c] !== 0 || (selectedBall && lineBoard[r][c] === 0)) {
        lineCanvas.style.cursor = 'pointer';
      } else {
        lineCanvas.style.cursor = 'default';
      }
    }
  } else {
    lineHoverCell = null;
    if (!isAnimating) lineCanvas.style.cursor = 'default';
  }
  if (!isAnimating) renderLine98();
});

lineCanvas.addEventListener('pointerleave', () => {
  lineHoverCell = null;
  if (!isAnimating) lineCanvas.style.cursor = 'default';
  if (!isAnimating) renderLine98();
});

if (window.PointerEvent) {
  lineCanvas.addEventListener('pointerdown', onLineCanvasAction);
} else {
  lineCanvas.addEventListener('click', onLineCanvasAction);
}

// Vẽ quả bóng pha lê 3D với drop shadow, specular glint và refraction
function draw3DCrystalMarble(ctx, cx, cy, radius, colorId, isSelected, pulse = 0) {
  const gem = GEMSTONE_PALETTES[colorId] || GEMSTONE_PALETTES[1];

  ctx.save();

  // 1. Hiệu ứng chọn bóng: Phóng to, hào quang phát sáng và vòng sáng nhịp thở
  if (isSelected) {
    radius = radius * (1.12 + 0.08 * pulse);
    ctx.shadowColor = gem.glow;
    ctx.shadowBlur = 14 + 10 * pulse;

    // Vòng hào quang ngoài
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5 + 3 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = gem.rim;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // 2. Bóng đổ phía dưới (Realistic Drop Shadow)
  ctx.beginPath();
  ctx.ellipse(cx, cy + radius * 0.88, radius * 0.72, radius * 0.28, 0, 0, Math.PI * 2);
  const shadowGrad = ctx.createRadialGradient(
    cx,
    cy + radius * 0.88,
    0,
    cx,
    cy + radius * 0.88,
    radius * 0.75,
  );
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.fill();

  // 3. Khối cầu đá quý 3D đa lớp (Radial Gradient)
  const sphereGrad = ctx.createRadialGradient(
    cx - radius * 0.38,
    cy - radius * 0.38,
    radius * 0.08,
    cx,
    cy,
    radius,
  );
  sphereGrad.addColorStop(0, gem.rim);
  sphereGrad.addColorStop(0.35, gem.base);
  sphereGrad.addColorStop(0.85, gem.shadow);
  sphereGrad.addColorStop(1, '#05070d');

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = sphereGrad;
  ctx.fill();

  // 4. Ánh sáng khúc xạ thứ cấp bên trong (Secondary bounce glow)
  const bounceGrad = ctx.createRadialGradient(
    cx + radius * 0.35,
    cy + radius * 0.35,
    0,
    cx + radius * 0.35,
    cy + radius * 0.35,
    radius * 0.65,
  );
  bounceGrad.addColorStop(0, gem.rim);
  bounceGrad.addColorStop(1, 'transparent');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.92, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = bounceGrad;
  ctx.globalAlpha = 0.45;
  ctx.fill();
  ctx.restore();

  // 5. Vết lóa phản quang mặt kính (Specular Glint / Highlight)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    cx - radius * 0.32,
    cy - radius * 0.36,
    radius * 0.38,
    radius * 0.22,
    -Math.PI / 4.5,
    0,
    Math.PI * 2,
  );
  const specGrad = ctx.createLinearGradient(
    cx - radius * 0.45,
    cy - radius * 0.45,
    cx - radius * 0.15,
    cy - radius * 0.25,
  );
  specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  specGrad.addColorStop(0.5, gem.specular);
  specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = specGrad;
  ctx.fill();

  // Điểm sáng kim cương nhỏ bổ trợ
  ctx.beginPath();
  ctx.arc(cx - radius * 0.18, cy - radius * 0.45, radius * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function renderLine98() {
  lineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lineCtx.clearRect(0, 0, LINE_LOGICAL_SIZE, LINE_LOGICAL_SIZE);

  const pulse = 0.5 + 0.5 * Math.sin((animationPulse / 30) * Math.PI);

  // 1. Vẽ lưới bàn cờ hiện đại
  for (let r = 0; r < LINE_SIZE; r++) {
    for (let c = 0; c < LINE_SIZE; c++) {
      const isAlt = (r + c) % 2 === 0;
      lineCtx.fillStyle = isAlt ? '#1a2744' : '#101a2e';
      lineCtx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);

      lineCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      lineCtx.lineWidth = 1;
      lineCtx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  // 2. Hiệu ứng Hover Preview trên ô trống (Cell hover preview indicators)
  if (lineHoverCell && !isAnimating) {
    const hr = lineHoverCell.r;
    const hc = lineHoverCell.c;
    if (hr >= 0 && hr < LINE_SIZE && hc >= 0 && hc < LINE_SIZE && lineBoard[hr][hc] === 0) {
      lineCtx.save();
      const hx = hc * CELL_SIZE;
      const hy = hr * CELL_SIZE;

      if (selectedBall) {
        // Đã chọn bóng -> Tâm ngắm hạ cánh màu viên bóng đó
        const gem = GEMSTONE_PALETTES[selectedBallColor] || GEMSTONE_PALETTES[1];
        lineCtx.fillStyle = gem.glow.replace('0.65', '0.15');
        lineCtx.fillRect(hx + 2, hy + 2, CELL_SIZE - 4, CELL_SIZE - 4);

        lineCtx.strokeStyle = gem.rim;
        lineCtx.lineWidth = 1.5;
        lineCtx.setLineDash([4, 2]);
        lineCtx.strokeRect(hx + 2, hy + 2, CELL_SIZE - 4, CELL_SIZE - 4);

        // Điểm ngắm ở tâm
        lineCtx.beginPath();
        lineCtx.arc(hx + CELL_SIZE / 2, hy + CELL_SIZE / 2, 5, 0, Math.PI * 2);
        lineCtx.fillStyle = gem.rim;
        lineCtx.fill();
      } else {
        // Chưa chọn bóng -> Viền sáng nhẹ
        lineCtx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        lineCtx.fillRect(hx + 2, hy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        lineCtx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        lineCtx.lineWidth = 1;
        lineCtx.strokeRect(hx + 2, hy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }
      lineCtx.restore();
    }
  }

  // 3. Highlight gợi ý nước đi (Help Suggestion)
  if (helpSuggestion) {
    const from = helpSuggestion.from;
    const to = helpSuggestion.to;

    lineCtx.save();
    if (from) {
      const fx = from.c * CELL_SIZE;
      const fy = from.r * CELL_SIZE;
      lineCtx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      lineCtx.fillRect(fx + 2, fy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      lineCtx.strokeStyle = '#10b981';
      lineCtx.lineWidth = 2;
      lineCtx.strokeRect(fx + 2, fy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
    if (to) {
      const tx = to.c * CELL_SIZE;
      const ty = to.r * CELL_SIZE;
      lineCtx.fillStyle = `rgba(139, 92, 246, ${0.2 + 0.15 * pulse})`;
      lineCtx.fillRect(tx + 2, ty + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      lineCtx.strokeStyle = '#a78bfa';
      lineCtx.lineWidth = 2.5;
      lineCtx.setLineDash([4, 2]);
      lineCtx.strokeRect(tx + 2, ty + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
    lineCtx.restore();
  }

  // 4. Vẽ các quả bóng pha lê tĩnh trên bàn cờ
  for (let r = 0; r < LINE_SIZE; r++) {
    for (let c = 0; c < LINE_SIZE; c++) {
      const colorId = lineBoard[r][c];
      if (colorId !== 0) {
        const isSelected = selectedBall && selectedBall.r === r && selectedBall.c === c;
        const cx = c * CELL_SIZE + CELL_SIZE / 2;
        const cy = r * CELL_SIZE + CELL_SIZE / 2;
        const baseRadius = CELL_SIZE * 0.38;

        draw3DCrystalMarble(lineCtx, cx, cy, baseRadius, colorId, isSelected, pulse);
      }
    }
  }

  // 5. Vẽ bóng đang chạy animation di chuyển
  if (animatingBall) {
    const cx = animatingBall.c * CELL_SIZE + CELL_SIZE / 2;
    const cy = animatingBall.r * CELL_SIZE + CELL_SIZE / 2;
    const baseRadius = CELL_SIZE * 0.40;
    draw3DCrystalMarble(lineCtx, cx, cy, baseRadius, animatingBall.color, false, 0);
  }

  // 5b. Hiệu ứng bóng tan biến mượt mà (Smooth Ball Disappearance)
  for (let i = lineClearingBalls.length - 1; i >= 0; i--) {
    const cb = lineClearingBalls[i];
    cb.scale -= 0.08;
    cb.alpha -= 0.08;
    if (cb.scale <= 0 || cb.alpha <= 0) {
      lineClearingBalls.splice(i, 1);
      continue;
    }
    const cx = cb.c * CELL_SIZE + CELL_SIZE / 2;
    const cy = cb.r * CELL_SIZE + CELL_SIZE / 2;
    const radius = CELL_SIZE * 0.38 * Math.max(0, cb.scale);
    lineCtx.save();
    lineCtx.globalAlpha = Math.max(0, cb.alpha);
    draw3DCrystalMarble(lineCtx, cx, cy, radius, cb.color, false, 0);
    lineCtx.restore();
  }

  // 6. Vẽ và cập nhật hạt nổ pha lê (Particle Burst)
  for (let i = lineParticles.length - 1; i >= 0; i--) {
    const p = lineParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.alpha -= p.decay;

    if (p.alpha <= 0) {
      lineParticles.splice(i, 1);
      continue;
    }

    lineCtx.save();
    lineCtx.globalAlpha = Math.max(0, p.alpha);
    lineCtx.fillStyle = p.color;
    lineCtx.shadowColor = p.glow;
    lineCtx.shadowBlur = 8;
    lineCtx.beginPath();
    lineCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    lineCtx.fill();
    lineCtx.restore();
  }

  // 7. Vẽ điểm số bay lên (+10 Pts)
  for (let i = lineFloatingScores.length - 1; i >= 0; i--) {
    const fs = lineFloatingScores[i];
    fs.y += fs.vy;
    fs.alpha -= 0.02;

    if (fs.alpha <= 0) {
      lineFloatingScores.splice(i, 1);
      continue;
    }

    lineCtx.save();
    lineCtx.globalAlpha = Math.max(0, fs.alpha);
    lineCtx.font = 'bold 22px "Segoe UI", sans-serif';
    lineCtx.fillStyle = '#facc15';
    lineCtx.shadowColor = 'rgba(250, 204, 21, 0.8)';
    lineCtx.shadowBlur = 10;
    lineCtx.textAlign = 'center';
    lineCtx.fillText(fs.text, fs.x, fs.y);
    lineCtx.restore();
  }
}

// Vòng lặp cập nhật animation và vẽ liên tục khi tab active
setInterval(() => {
  animationPulse = (animationPulse + 1) % 60;
  const isLineTabActive = document.getElementById('line98Tab')?.classList.contains('active');
  const isCaroTabActive = document.getElementById('caroTab')?.classList.contains('active');

  if (isLineTabActive) {
    renderLine98();
  }
  if (isCaroTabActive) {
    renderCaro();
  }
}, 40);

// =========================================================================
//                             6. TRÒ CHƠI 2: CỜ CARO X O (15x15)
// =========================================================================
// (Caro DOM, dimensions, and state variables already declared above)

// Chuyển đổi chế độ chơi Online / AI Bot
btnCaroModeOnline.addEventListener('click', () => {
  botTurnToken++;
  caroMode = 'online';
  btnCaroModeOnline.classList.add('active');
  btnCaroModeBot.classList.remove('active');
  caroOnlineControls.style.display = 'block';
  caroBotControls.style.display = 'none';
  caroModeDesc.textContent = 'Chế độ nhiều người chơi: Tự động ghép cặp đấu ngẫu nhiên qua WebSocket máy chủ.';
  resetCaroBoard();
  updateCaroTurnStatus();
  renderCaro();
});

btnCaroModeBot.addEventListener('click', () => {
  if (btnCaroCancel.style.display === 'block') {
    socket.emit('caro:cancelFind');
    btnCaroFind.style.display = 'block';
    btnCaroCancel.style.display = 'none';
  }
  // Nếu đang trong trận online chưa kết thúc, báo rời trận để giải phóng đối thủ
  if (caroRoomId && !caroIsFinished) {
    socket.emit('caro:leaveMatch');
  }
  botTurnToken++;
  caroMode = 'bot';
  btnCaroModeBot.classList.add('active');
  btnCaroModeOnline.classList.remove('active');
  caroOnlineControls.style.display = 'none';
  caroBotControls.style.display = 'block';
  caroModeDesc.textContent = 'Chế độ luyện tập: Thi đấu trực tiếp với máy (AI Minimax 15x15) tức thì trong 1 tab.';
  startCaroBotGame();
});

btnCaroBotRestart.addEventListener('click', () => {
  botTurnToken++;
  startCaroBotGame();
});

function resetCaroBoard() {
  caroBoard = Array(CARO_GRID).fill(null).map(() => Array(CARO_GRID).fill(null));
  caroRoomId = null;
  myCaroSymbol = null;
  caroCurrentTurn = null;
  caroWinningLine = null;
  caroIsFinished = false;
  caroLastMove = null;
  caroHoverPos = null;
  caroMovesHistory = [];
  caroMoveCounter.textContent = 'Nước đi: 0';
  caroPlayerXName.textContent = 'Chờ đối thủ...';
  caroPlayerOName.textContent = 'Chờ đối thủ...';
  caroPlayerXRole.textContent = 'Đi trước';
  caroPlayerORole.textContent = 'Đi sau';
  caroTurnIndicator.textContent = 'Chưa vào trận';
  caroTurnIndicator.className = 'turn-indicator';
  caroMatchStatus.textContent = 'Nhấn "Tìm Trận" để bắt đầu ghép cặp trực tuyến!';
}

function startCaroBotGame() {
  caroBoard = Array(CARO_GRID).fill(null).map(() => Array(CARO_GRID).fill(null));
  caroRoomId = `bot_${Date.now()}`;
  myCaroSymbol = 'X';
  caroCurrentTurn = 'X';
  caroWinningLine = null;
  caroIsFinished = false;
  caroLastMove = null;
  caroMovesHistory = [];
  caroMoveCounter.textContent = 'Nước đi: 0';

  caroPlayerXName.textContent = currentUser?.nickname || currentUser?.username || 'Bạn (X)';
  caroPlayerOName.textContent = '🤖 AI Bot Pro (O)';
  caroPlayerXRole.textContent = 'Đi trước (Bạn)';
  caroPlayerORole.textContent = 'Đi sau (Máy)';

  updateCaroTurnStatus();
  renderCaro();
}

// ---------------- Thuật toán AI Bot Caro 15x15 Cực Thông Minh ----------------
function evaluateCaroPosition(board, r, c, player) {
  const opponent = player === 'X' ? 'O' : 'X';
  const directions = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 },
  ];

  let totalScore = 0;

  for (const { dr, dc } of directions) {
    let count = 1;
    let openEnds = 0;

    // Tiến
    let step = 1;
    while (true) {
      const nr = r + dr * step;
      const nc = c + dc * step;
      if (nr >= 0 && nr < CARO_GRID && nc >= 0 && nc < CARO_GRID) {
        if (board[nr][nc] === player) {
          count++;
          step++;
        } else if (board[nr][nc] === null) {
          openEnds++;
          break;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Lùi
    step = 1;
    while (true) {
      const nr = r - dr * step;
      const nc = c - dc * step;
      if (nr >= 0 && nr < CARO_GRID && nc >= 0 && nc < CARO_GRID) {
        if (board[nr][nc] === player) {
          count++;
          step++;
        } else if (board[nr][nc] === null) {
          openEnds++;
          break;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    if (count >= 5) totalScore += 100000;
    else if (count === 4) totalScore += openEnds === 2 ? 10000 : 2500;
    else if (count === 3) totalScore += openEnds === 2 ? 1500 : 300;
    else if (count === 2) totalScore += openEnds === 2 ? 100 : 20;
  }

  return totalScore;
}

function findBestBotMove() {
  // Nếu bàn cờ trống rỗng, đánh vào tâm (7,7)
  if (caroMovesHistory.length === 0) {
    return { r: 7, c: 7 };
  }

  let bestScore = -Infinity;
  let candidates = [];

  for (let r = 0; r < CARO_GRID; r++) {
    for (let c = 0; c < CARO_GRID; c++) {
      if (caroBoard[r][c] !== null) continue;

      // Đánh giá tấn công (Bot O) và phòng thủ (chặn người chơi X)
      caroBoard[r][c] = 'O';
      const attackScore = evaluateCaroPosition(caroBoard, r, c, 'O');
      caroBoard[r][c] = 'X';
      const defendScore = evaluateCaroPosition(caroBoard, r, c, 'X');
      caroBoard[r][c] = null;

      // Trọng số kết hợp giữa công và thủ, ưu tiên gần tâm
      const distFromCenter = Math.abs(r - 7) + Math.abs(c - 7);
      const score = attackScore * 1.1 + defendScore * 1.0 - distFromCenter * 0.1;

      if (score > bestScore) {
        bestScore = score;
        candidates = [{ r, c }];
      } else if (Math.abs(score - bestScore) < 1) {
        candidates.push({ r, c });
      }
    }
  }

  // Chọn ngẫu nhiên trong các nước đi tối ưu nhất để tăng tính tự nhiên
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function checkCaroWin(board, r, c, player) {
  const directions = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 },
  ];

  for (const { dr, dc } of directions) {
    const line = [{ r, c }];

    let step = 1;
    while (true) {
      const nr = r + dr * step;
      const nc = c + dc * step;
      if (nr >= 0 && nr < CARO_GRID && nc >= 0 && nc < CARO_GRID && board[nr][nc] === player) {
        line.push({ r: nr, c: nc });
        step++;
      } else break;
    }

    step = 1;
    while (true) {
      const nr = r - dr * step;
      const nc = c - dc * step;
      if (nr >= 0 && nr < CARO_GRID && nc >= 0 && nc < CARO_GRID && board[nr][nc] === player) {
        line.unshift({ r: nr, c: nc });
        step++;
      } else break;
    }

    if (line.length >= 5) {
      return line;
    }
  }
  return null;
}

async function handleBotTurn() {
  if (caroIsFinished || caroCurrentTurn !== 'O' || caroMode !== 'bot') return;

  const currentTurnId = ++botTurnToken;
  caroMatchStatus.textContent = '🤖 AI Bot đang tính toán nước đi...';
  renderCaro();

  // Tạo độ trễ tự nhiên (300ms)
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (caroIsFinished || caroMode !== 'bot' || caroCurrentTurn !== 'O' || botTurnToken !== currentTurnId) return;

  const botMove = findBestBotMove();
  if (!botMove) return;

  caroBoard[botMove.r][botMove.c] = 'O';
  caroLastMove = { r: botMove.r, c: botMove.c, player: 'O' };
  caroMovesHistory.push({ r: botMove.r, c: botMove.c, player: 'O', timestamp: Date.now() });
  caroMoveCounter.textContent = `Nước đi: ${caroMovesHistory.length}`;

  playCaroMoveSound();

  const winLine = checkCaroWin(caroBoard, botMove.r, botMove.c, 'O');
  if (winLine) {
    caroWinningLine = winLine;
    caroIsFinished = true;
    caroTurnIndicator.textContent = '🤖 AI Bot Chiến Thắng!';
    caroTurnIndicator.className = 'turn-indicator';
    caroMatchStatus.textContent = 'AI Bot đã xếp được 5 quân liên tiếp! Bấm "Ván Mới" để phục thù.';
    saveBotMatchResult('O');
  } else if (caroMovesHistory.length === CARO_GRID * CARO_GRID) {
    caroIsFinished = true;
    caroTurnIndicator.textContent = 'Ván Đấu Hòa!';
    caroMatchStatus.textContent = 'Bàn cờ đã kín!';
    saveBotMatchResult('DRAW');
  } else {
    caroCurrentTurn = 'X';
    updateCaroTurnStatus();
  }

  renderCaro();
}

async function saveBotMatchResult(winner) {
  const matchData = {
    playerUserId: currentUser?.id,
    playerName: currentUser?.nickname || currentUser?.username || 'Người chơi',
    winner,
    movesCount: caroMovesHistory.length,
    moves: caroMovesHistory,
  };

  if (socket && socket.connected) {
    socket.emit('caro:saveBotMatch', matchData);
  } else {
    try {
      await fetch('/games/caro/bot-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchData),
      });
      fetchCaroHistory();
    } catch (err) {
      console.error('Lỗi lưu trận bot:', err);
    }
  }
}

// ---------------- Sự kiện WebSocket cho Caro Online ----------------
btnCaroFind.addEventListener('click', () => {
  if (caroRoomId && !caroIsFinished) {
    socket.emit('caro:leaveMatch');
  }
  resetCaroBoard();
  renderCaro();
  btnCaroFind.style.display = 'none';
  btnCaroCancel.style.display = 'block';
  caroMatchStatus.textContent = '⏳ Đang tìm đối thủ trong hệ thống... Vui lòng đợi!';

  const playerName = currentUser?.nickname || currentUser?.username || 'Người chơi ẩn danh';
  socket.emit('caro:findMatch', {
    userId: currentUser?.id,
    name: playerName,
  });
});

btnCaroCancel.addEventListener('click', () => {
  socket.emit('caro:cancelFind');
  btnCaroFind.style.display = 'block';
  btnCaroCancel.style.display = 'none';
  caroMatchStatus.textContent = 'Đã hủy tìm trận đấu.';
});

socket.on('caro:waitingMatch', (data) => {
  caroMatchStatus.textContent = data.message;
});

socket.on('caro:findCancelled', (data) => {
  caroMatchStatus.textContent = data.message;
});

socket.on('caro:matchFound', (data) => {
  caroRoomId = data.roomId;
  myCaroSymbol = data.yourSymbol;
  caroCurrentTurn = data.currentTurn;
  caroBoard = data.board;
  caroWinningLine = null;
  caroIsFinished = false;
  caroLastMove = null;
  caroMovesHistory = [];
  caroMoveCounter.textContent = 'Nước đi: 0';

  btnCaroFind.style.display = 'none';
  btnCaroCancel.style.display = 'none';

  const myDisplayName = currentUser?.nickname || currentUser?.username || 'Bạn';

  if (myCaroSymbol === 'X') {
    caroPlayerXName.textContent = myDisplayName;
    caroPlayerOName.textContent = data.opponentName;
    caroPlayerXRole.textContent = 'Đi trước (Bạn)';
    caroPlayerORole.textContent = 'Đi sau (Đối thủ)';
  } else {
    caroPlayerXName.textContent = data.opponentName;
    caroPlayerOName.textContent = myDisplayName;
    caroPlayerXRole.textContent = 'Đi trước (Đối thủ)';
    caroPlayerORole.textContent = 'Đi sau (Bạn)';
  }

  updateCaroTurnStatus();
  renderCaro();
});

socket.on('caro:moved', (data) => {
  caroBoard[data.r][data.c] = data.player;
  caroCurrentTurn = data.currentTurn;
  caroWinningLine = data.winningLine;
  caroIsFinished = data.isFinished;
  caroLastMove = { r: data.r, c: data.c, player: data.player };
  caroMovesHistory.push(caroLastMove);
  caroMoveCounter.textContent = `Nước đi: ${caroMovesHistory.length}`;

  playCaroMoveSound();

  if (data.isFinished) {
    if (data.winner === 'DRAW') {
      caroTurnIndicator.textContent = 'Ván cờ kết thúc: Hòa!';
      caroTurnIndicator.className = 'turn-indicator';
      caroMatchStatus.textContent = 'Bàn cờ đã đầy mà không ai thắng!';
    } else {
      const isWinner = data.winner === myCaroSymbol;
      caroTurnIndicator.textContent = `Người chơi ${data.winner} Chiến Thắng!`;
      caroTurnIndicator.className = 'turn-indicator';
      caroMatchStatus.textContent = isWinner ? '🎉 Chúc mừng bạn đã chiến thắng!' : '😢 Rất tiếc, bạn đã thua!';
    }
    btnCaroFind.style.display = 'block';
    fetchCaroHistory();
  } else {
    updateCaroTurnStatus();
  }

  renderCaro();
});

socket.on('caro:playerLeft', (data) => {
  caroIsFinished = true;
  caroTurnIndicator.textContent = `Chiến thắng!`;
  caroMatchStatus.textContent = data.message;
  btnCaroFind.style.display = 'block';
  fetchCaroHistory();
  renderCaro();
});

socket.on('caro:moveError', (data) => {
  caroMatchStatus.textContent = `Lỗi: ${data.error}`;
});

socket.on('caro:historyUpdated', () => {
  fetchCaroHistory();
});

function updateCaroTurnStatus() {
  if (!caroCurrentTurn || !myCaroSymbol) {
    caroTurnIndicator.textContent = 'Chưa vào trận';
    caroTurnIndicator.className = 'turn-indicator';
    caroMatchStatus.textContent = caroMode === 'online'
      ? 'Nhấn "Tìm Trận" để bắt đầu ghép cặp trực tuyến!'
      : 'Nhấn "Ván Mới Với Máy" để bắt đầu luyện tập!';
    return;
  }
  const isMyTurn = caroCurrentTurn === myCaroSymbol;
  caroTurnIndicator.textContent = isMyTurn ? `Lượt của bạn (${myCaroSymbol})` : `Lượt đối thủ (${caroCurrentTurn})`;
  caroTurnIndicator.className = isMyTurn ? 'turn-indicator your-turn' : 'turn-indicator';
  caroMatchStatus.textContent = isMyTurn ? 'Hãy chọn một ô trống trên bàn cờ để đánh.' : 'Đang đợi đối thủ suy nghĩ...';
}

function onCaroCanvasAction(e) {
  if (caroIsFinished) return;

  const { x, y } = getCanvasCoords(caroCanvas, e, CARO_LOGICAL_SIZE, CARO_LOGICAL_SIZE);
  const c = Math.floor(x / CARO_CELL);
  const r = Math.floor(y / CARO_CELL);

  if (r < 0 || r >= CARO_GRID || c < 0 || c >= CARO_GRID) return;
  if (caroBoard[r][c] !== null) {
    caroMatchStatus.textContent = 'Ô này đã có quân cờ!';
    return;
  }

  if (caroMode === 'bot') {
    // Chế độ đánh với AI Bot
    if (caroCurrentTurn !== 'X') return;

    caroBoard[r][c] = 'X';
    caroLastMove = { r, c, player: 'X' };
    caroMovesHistory.push({ r, c, player: 'X', timestamp: Date.now() });
    caroMoveCounter.textContent = `Nước đi: ${caroMovesHistory.length}`;
    playCaroMoveSound();

    const winLine = checkCaroWin(caroBoard, r, c, 'X');
    if (winLine) {
      caroWinningLine = winLine;
      caroIsFinished = true;
      caroTurnIndicator.textContent = '🎉 Bạn Đã Chiến Thắng!';
      caroTurnIndicator.className = 'turn-indicator your-turn';
      caroMatchStatus.textContent = 'Xuất sắc! Bạn đã tạo được 5 quân liên tiếp và hạ gục AI Bot.';
      saveBotMatchResult('X');
    } else if (caroMovesHistory.length === CARO_GRID * CARO_GRID) {
      caroIsFinished = true;
      caroTurnIndicator.textContent = 'Ván Đấu Hòa!';
      caroMatchStatus.textContent = 'Bàn cờ đã đầy!';
      saveBotMatchResult('DRAW');
    } else {
      caroCurrentTurn = 'O';
      updateCaroTurnStatus();
      handleBotTurn();
    }
    renderCaro();
  } else {
    // Chế độ Online qua WebSocket
    if (!caroRoomId) return;
    if (caroCurrentTurn !== myCaroSymbol) {
      caroMatchStatus.textContent = 'Chưa tới lượt đi của bạn!';
      return;
    }

    socket.emit('caro:move', {
      roomId: caroRoomId,
      r,
      c,
    });
  }
}

caroCanvas.addEventListener('pointermove', (e) => {
  const { x, y } = getCanvasCoords(caroCanvas, e, CARO_LOGICAL_SIZE, CARO_LOGICAL_SIZE);
  const c = Math.floor(x / CARO_CELL);
  const r = Math.floor(y / CARO_CELL);
  if (r >= 0 && r < CARO_GRID && c >= 0 && c < CARO_GRID) {
    caroHoverPos = { r, c };
    const isMyTurn = (caroMode === 'bot' && caroCurrentTurn === 'X') ||
      (caroMode === 'online' && myCaroSymbol && caroCurrentTurn === myCaroSymbol);
    if (!caroIsFinished && isMyTurn && caroBoard[r][c] === null) {
      caroCanvas.style.cursor = 'pointer';
    } else {
      caroCanvas.style.cursor = 'default';
    }
  } else {
    caroHoverPos = null;
    caroCanvas.style.cursor = 'default';
  }
  renderCaro();
});

caroCanvas.addEventListener('pointerleave', () => {
  caroHoverPos = null;
  caroCanvas.style.cursor = 'default';
  renderCaro();
});

if (window.PointerEvent) {
  caroCanvas.addEventListener('pointerdown', onCaroCanvasAction);
} else {
  caroCanvas.addEventListener('click', onCaroCanvasAction);
}

// ---------------- Vẽ Bàn Cờ Caro & Quân Cờ Neon 3D ----------------
function renderCaro() {
  caroCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  caroCtx.clearRect(0, 0, CARO_LOGICAL_SIZE, CARO_LOGICAL_SIZE);

  // 1. Nền bàn cờ Obsidian Dark Wood cao cấp
  const bgGrad = caroCtx.createRadialGradient(
    CARO_LOGICAL_SIZE / 2,
    CARO_LOGICAL_SIZE / 2,
    50,
    CARO_LOGICAL_SIZE / 2,
    CARO_LOGICAL_SIZE / 2,
    CARO_LOGICAL_SIZE * 0.75,
  );
  bgGrad.addColorStop(0, '#1a2438');
  bgGrad.addColorStop(1, '#0e1626');
  caroCtx.fillStyle = bgGrad;
  caroCtx.fillRect(0, 0, CARO_LOGICAL_SIZE, CARO_LOGICAL_SIZE);

  // 2. Lưới ô vuông 15x15
  caroCtx.strokeStyle = 'rgba(100, 116, 139, 0.75)';
  caroCtx.lineWidth = 1.2;

  for (let i = 0; i < CARO_GRID; i++) {
    const pos = i * CARO_CELL + CARO_CELL / 2;

    // Đường ngang
    caroCtx.beginPath();
    caroCtx.moveTo(CARO_CELL / 2, pos);
    caroCtx.lineTo(CARO_LOGICAL_SIZE - CARO_CELL / 2, pos);
    caroCtx.stroke();

    // Đường dọc
    caroCtx.beginPath();
    caroCtx.moveTo(pos, CARO_CELL / 2);
    caroCtx.lineTo(pos, CARO_LOGICAL_SIZE - CARO_CELL / 2);
    caroCtx.stroke();
  }

  // 3. Các điểm sao chuẩn quốc tế (Hoshi & Tengen)
  const starPoints = [3, 7, 11];
  caroCtx.fillStyle = '#94a3b8';
  for (const r of starPoints) {
    for (const c of starPoints) {
      caroCtx.beginPath();
      caroCtx.arc(c * CARO_CELL + CARO_CELL / 2, r * CARO_CELL + CARO_CELL / 2, 3.5, 0, Math.PI * 2);
      caroCtx.fill();
    }
  }

  // 4. Ghost Hover Piece Preview (Hiển thị bóng mờ quân cờ dự kiến trước khi đặt)
  if (caroHoverPos && !caroIsFinished) {
    const hr = caroHoverPos.r;
    const hc = caroHoverPos.c;
    if (caroBoard[hr][hc] === null) {
      const isMyTurn = (caroMode === 'bot' && caroCurrentTurn === 'X') ||
        (caroMode === 'online' && myCaroSymbol && caroCurrentTurn === myCaroSymbol);

      if (isMyTurn) {
        const symbolToPreview = caroMode === 'bot' ? 'X' : myCaroSymbol;
        caroCtx.save();
        caroCtx.globalAlpha = 0.38;
        if (symbolToPreview === 'X') {
          drawNeonX(hr, hc);
        } else {
          drawNeonO(hr, hc);
        }
        caroCtx.restore();
      }
    }
  }

  // 5. Vẽ các quân cờ X và O đã đánh
  for (let r = 0; r < CARO_GRID; r++) {
    for (let c = 0; c < CARO_GRID; c++) {
      const val = caroBoard[r][c];
      if (val === 'X') {
        drawNeonX(r, c);
      } else if (val === 'O') {
        drawNeonO(r, c);
      }
    }
  }

  // 6. Last Move Indicator: Vòng tròn kim cương vàng nhấp nháy tại nước đi vừa đánh
  if (caroLastMove) {
    const cx = caroLastMove.c * CARO_CELL + CARO_CELL / 2;
    const cy = caroLastMove.r * CARO_CELL + CARO_CELL / 2;
    const pulse = 0.5 + 0.5 * Math.sin((animationPulse / 20) * Math.PI);

    caroCtx.save();
    caroCtx.strokeStyle = '#facc15';
    caroCtx.lineWidth = 2.5;
    caroCtx.shadowColor = 'rgba(250, 204, 21, 0.8)';
    caroCtx.shadowBlur = 10 + 6 * pulse;

    // Vòng bo tròn ngoài
    caroCtx.beginPath();
    caroCtx.arc(cx, cy, CARO_CELL * 0.44 + 2 * pulse, 0, Math.PI * 2);
    caroCtx.stroke();

    // Dấu chấm tâm
    caroCtx.beginPath();
    caroCtx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    caroCtx.fillStyle = '#fef08a';
    caroCtx.fill();
    caroCtx.restore();
  }

  // 7. Golden Victory Line Overlay (Đường chiến thắng 5 quân)
  if (caroWinningLine && caroWinningLine.length >= 5) {
    caroCtx.save();
    caroCtx.strokeStyle = '#facc15';
    caroCtx.lineWidth = 5;
    caroCtx.lineCap = 'round';
    caroCtx.shadowColor = 'rgba(250, 204, 21, 0.9)';
    caroCtx.shadowBlur = 16;

    caroCtx.beginPath();
    const first = caroWinningLine[0];
    const last = caroWinningLine[caroWinningLine.length - 1];
    caroCtx.moveTo(first.c * CARO_CELL + CARO_CELL / 2, first.r * CARO_CELL + CARO_CELL / 2);
    caroCtx.lineTo(last.c * CARO_CELL + CARO_CELL / 2, last.r * CARO_CELL + CARO_CELL / 2);
    caroCtx.stroke();

    // Vòng phát sáng tại các ô thắng
    caroWinningLine.forEach((cell) => {
      caroCtx.beginPath();
      caroCtx.arc(cell.c * CARO_CELL + CARO_CELL / 2, cell.r * CARO_CELL + CARO_CELL / 2, CARO_CELL * 0.4, 0, Math.PI * 2);
      caroCtx.fillStyle = 'rgba(250, 204, 21, 0.22)';
      caroCtx.fill();
    });

    caroCtx.restore();
  }
}

function drawNeonX(r, c) {
  const cx = c * CARO_CELL + CARO_CELL / 2;
  const cy = r * CARO_CELL + CARO_CELL / 2;
  const size = CARO_CELL * 0.29;

  caroCtx.save();
  caroCtx.strokeStyle = '#ef4444';
  caroCtx.lineWidth = 3.5;
  caroCtx.lineCap = 'round';
  caroCtx.shadowColor = 'rgba(239, 68, 68, 0.75)';
  caroCtx.shadowBlur = 8;

  caroCtx.beginPath();
  caroCtx.moveTo(cx - size, cy - size);
  caroCtx.lineTo(cx + size, cy + size);
  caroCtx.moveTo(cx + size, cy - size);
  caroCtx.lineTo(cx - size, cy + size);
  caroCtx.stroke();

  // Lõi sáng trắng bên trong
  caroCtx.strokeStyle = '#fecaca';
  caroCtx.lineWidth = 1.4;
  caroCtx.beginPath();
  caroCtx.moveTo(cx - size * 0.8, cy - size * 0.8);
  caroCtx.lineTo(cx + size * 0.8, cy + size * 0.8);
  caroCtx.moveTo(cx + size * 0.8, cy - size * 0.8);
  caroCtx.lineTo(cx - size * 0.8, cy + size * 0.8);
  caroCtx.stroke();

  caroCtx.restore();
}

function drawNeonO(r, c) {
  const cx = c * CARO_CELL + CARO_CELL / 2;
  const cy = r * CARO_CELL + CARO_CELL / 2;
  const radius = CARO_CELL * 0.31;

  caroCtx.save();
  caroCtx.strokeStyle = '#3b82f6';
  caroCtx.lineWidth = 3.5;
  caroCtx.shadowColor = 'rgba(59, 130, 246, 0.75)';
  caroCtx.shadowBlur = 8;

  caroCtx.beginPath();
  caroCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  caroCtx.stroke();

  // Lõi sáng trắng bên trong
  caroCtx.strokeStyle = '#bfdbfe';
  caroCtx.lineWidth = 1.4;
  caroCtx.beginPath();
  caroCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  caroCtx.stroke();

  caroCtx.restore();
}

// ---------------- Lấy và Hiển Thị Lịch Sử Trận Đấu (SQLite) ----------------
socket.on('caro:history', (history) => {
  renderCaroHistoryTable(history);
});

async function fetchCaroHistory() {
  if (socket && socket.connected) {
    socket.emit('caro:getHistory', { limit: 10 });
  } else {
    try {
      const res = await fetch('/games/caro/history?limit=10');
      if (!res.ok) return;
      const history = await res.json();
      renderCaroHistoryTable(history);
    } catch (err) {
      console.error('Lỗi khi tải lịch sử:', err);
    }
  }
}

btnRefreshHistory.addEventListener('click', () => {
  fetchCaroHistory();
});

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderCaroHistoryTable(matches) {
  if (!caroHistoryTableBody) return;
  if (!matches || matches.length === 0) {
    caroHistoryTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">
          Chưa có trận đấu nào được ghi lại trong cơ sở dữ liệu.
        </td>
      </tr>
    `;
    return;
  }

  caroHistoryTableBody.innerHTML = '';
  matches.forEach((m) => {
    const row = document.createElement('tr');

    let winnerClass = 'draw';
    let winnerText = 'Hòa';
    if (m.winner === 'X') {
      winnerClass = 'x-win';
      winnerText = `${m.playerXName || 'X'} Thắng`;
    } else if (m.winner === 'O') {
      winnerClass = 'o-win';
      winnerText = `${m.playerOName || 'O'} Thắng`;
    }

    const shortId = m.id ? (m.id.length > 8 ? m.id.substring(0, 8) + '...' : m.id) : 'N/A';

    row.innerHTML = `
      <td>${formatDateTime(m.createdAt)}</td>
      <td><code style="color: #38bdf8; font-size: 0.8rem;">${escapeHtml(shortId)}</code></td>
      <td><strong style="color: #f87171;">X:</strong> ${escapeHtml(m.playerXName || 'Player X')}</td>
      <td><strong style="color: #60a5fa;">O:</strong> ${escapeHtml(m.playerOName || 'Player O')}</td>
      <td><span class="winner-badge ${winnerClass}">${escapeHtml(winnerText)}</span></td>
      <td>${Number(m.movesCount) || 0} nước</td>
    `;
    caroHistoryTableBody.appendChild(row);
  });
}

// =========================================================================
//                             7. KHỞI ĐỘNG ỨNG DỤNG & KẾT NỐI SOCKET
// =========================================================================
function initAppSocket() {
  socket.on('pong', (data) => {
    if (data && data.clientTime) {
      const lat = Math.max(1, Math.round(performance.now() - data.clientTime));
      if (latencyText) latencyText.textContent = `${lat} ms`;
      if (socketStatusDot) socketStatusDot.className = 'status-dot connected';
    }
  });

  socket.on('connect', () => {
    if (socketStatusDot) socketStatusDot.className = 'status-dot connected';
    if (latencyText) latencyText.textContent = 'Đã kết nối';
    startPingMonitoring();

    // Tái liên kết phiên làm việc nếu người dùng đã đăng nhập
    if (currentUser?.id) {
      socket.emit('auth:linkUser', { userId: currentUser.id });
    }

    // Khởi tạo trạng thái game
    initLine98();
    fetchCaroHistory();
  });

  socket.on('disconnect', () => {
    if (socketStatusDot) socketStatusDot.className = 'status-dot disconnected';
    if (latencyText) latencyText.textContent = 'Mất kết nối';
  });

  if (socket.connected) {
    if (socketStatusDot) socketStatusDot.className = 'status-dot connected';
    if (latencyText) latencyText.textContent = 'Đã kết nối';
    startPingMonitoring();
    if (currentUser?.id) {
      socket.emit('auth:linkUser', { userId: currentUser.id });
    }
    initLine98();
    fetchCaroHistory();
  }
}

initAppSocket();
renderCaro();
renderLine98();
fetchCaroHistory();
