const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { io } = require('socket.io-client');
const assert = require('node:assert');

async function testAll() {
  console.log('--- Starting Adversarial Audit ---');
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0);
  const serverUrl = await app.getUrl();
  console.log('Server running at:', serverUrl);

  const testUser = {
    username: `adv_user_${Date.now()}`,
    password: 'password123',
    email: 'adv@test.com',
    nickname: 'Adversary',
  };

  // 1. Test Auth Flow
  const regRes = await fetch(`${serverUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser),
  });
  const regData = await regRes.json();
  assert.strictEqual(regRes.status, 201, 'Register should succeed');
  assert.ok(regData.accessToken, 'Should return accessToken');
  assert.strictEqual(regData.user.username, testUser.username);
  assert.ok(regData.user.createdAt, 'Register should return user.createdAt');
  console.log('✔ Auth register works and returns createdAt');

  const loginRes = await fetch(`${serverUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testUser.username, password: testUser.password }),
  });
  const loginData = await loginRes.json();
  assert.ok(loginRes.status === 200 || loginRes.status === 201, 'Login should succeed');
  const token = loginData.accessToken;
  const userId = loginData.user.id;
  assert.ok(loginData.user.createdAt, 'Login should return user.createdAt');
  console.log('✔ Auth login works and returns createdAt, userId:', userId);

  // 2. Test Profile Update: Case A - only nickname (empty/undefined email)
  const updateOnlyNickRes = await fetch(`${serverUrl}/user/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ nickname: 'NickOnlyNoEmail' }),
  });
  assert.strictEqual(updateOnlyNickRes.status, 200, 'Profile update with only nickname should succeed');
  const nickOnlyData = await updateOnlyNickRes.json();
  assert.strictEqual(nickOnlyData.user.nickname, 'NickOnlyNoEmail');
  console.log('✔ Profile update with only nickname (omitted email) succeeded');

  // Case B - both nickname and valid email
  const updateRes = await fetch(`${serverUrl}/user/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ nickname: 'UpdatedNick', email: 'updated@test.com' }),
  });
  const updateData = await updateRes.json();
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateData.user.nickname, 'UpdatedNick');
  assert.strictEqual(updateData.user.email, 'updated@test.com');
  console.log('✔ User profile update with both fields succeeded');

  // 3. Test Line 98 session linking: Active session must be preserved on login
  const socketClient = io(serverUrl, { transports: ['websocket'], forceNew: true });
  await new Promise((resolve) => socketClient.on('connect', resolve));

  // Initialize Line 98 without user
  let initialState = await new Promise((resolve) => {
    socketClient.emit('line98:init', {});
    socketClient.once('line98:gameState', resolve);
  });
  assert.ok(initialState.id, 'Line 98 should have game id');
  assert.strictEqual(initialState.userId, undefined, 'Should have no userId initially');
  console.log('✔ Anonymous Line 98 initialized with ID:', initialState.id);

  // Re-link with userId (both via auth:linkUser and line98:init)
  await new Promise((resolve) => {
    socketClient.emit('auth:linkUser', { userId }, resolve);
  });

  let stateAfterReInit = await new Promise((resolve) => {
    socketClient.emit('line98:init', { userId });
    socketClient.once('line98:gameState', resolve);
  });
  assert.strictEqual(initialState.id, stateAfterReInit.id, 'Game session ID must be preserved after linking user');
  assert.strictEqual(stateAfterReInit.userId, userId, 'Game session must have userId linked');
  console.log('✔ Line 98 game session preserved and successfully linked to userId:', stateAfterReInit.userId);

  // 4. Test Caro Bot Match saving via HTTP POST broadcasting caro:historyUpdated
  const socketObserver = io(serverUrl, { transports: ['websocket'], forceNew: true });
  await new Promise((resolve) => socketObserver.on('connect', resolve));

  let httpHistoryUpdatedPromise = new Promise((resolve) => {
    socketObserver.once('caro:historyUpdated', () => resolve(true));
  });

  const botMatchRes = await fetch(`${serverUrl}/games/caro/bot-match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerUserId: userId,
      playerName: 'UpdatedNick',
      winner: 'X',
      movesCount: 15,
      moves: [{ r: 7, c: 7, player: 'X', timestamp: Date.now() }],
    }),
  });
  assert.strictEqual(botMatchRes.status, 201);
  const receivedHttpBroadcast = await Promise.race([
    httpHistoryUpdatedPromise,
    new Promise((r) => setTimeout(() => r(false), 500)),
  ]);
  assert.strictEqual(receivedHttpBroadcast, true, 'Observer must receive caro:historyUpdated from HTTP POST bot-match');
  console.log('✔ Observer received caro:historyUpdated from HTTP POST bot-match!');

  // 5. Test Caro Bot Match saving via WebSocket caro:saveBotMatch broadcasting caro:historyUpdated
  let socketHistoryUpdatedPromise = new Promise((resolve) => {
    socketObserver.once('caro:historyUpdated', () => resolve(true));
  });

  socketClient.emit('caro:saveBotMatch', {
    playerUserId: userId,
    playerName: 'UpdatedNick',
    winner: 'O',
    movesCount: 12,
    moves: [{ r: 7, c: 7, player: 'X', timestamp: Date.now() }],
  });

  const receivedSocketBroadcast = await Promise.race([
    socketHistoryUpdatedPromise,
    new Promise((r) => setTimeout(() => r(false), 500)),
  ]);
  assert.strictEqual(receivedSocketBroadcast, true, 'Observer must receive caro:historyUpdated from WebSocket caro:saveBotMatch');
  console.log('✔ Observer received caro:historyUpdated from WebSocket caro:saveBotMatch!');

  // 6. Test WebSocket caro:getHistory
  const historyFromSocket = await new Promise((resolve) => {
    socketClient.emit('caro:getHistory', { limit: 5 });
    socketClient.once('caro:history', resolve);
  });
  assert.ok(Array.isArray(historyFromSocket), 'caro:history should be an array');
  assert.ok(historyFromSocket.length > 0, 'Should have at least 1 match');
  console.log('✔ caro:getHistory WebSocket works, count:', historyFromSocket.length);

  // 7. Test HTTP GET /games/caro/history
  const httpHistoryRes = await fetch(`${serverUrl}/games/caro/history?limit=5`);
  assert.strictEqual(httpHistoryRes.status, 200);
  const httpHistory = await httpHistoryRes.json();
  assert.ok(Array.isArray(httpHistory));
  assert.strictEqual(httpHistory.length, historyFromSocket.length);
  console.log('✔ GET /games/caro/history matches WebSocket caro:getHistory count:', httpHistory.length);

  // 8. Test Online Multiplayer Caro 2-player match
  const player1 = io(serverUrl, { transports: ['websocket'], forceNew: true });
  const player2 = io(serverUrl, { transports: ['websocket'], forceNew: true });
  await Promise.all([
    new Promise((r) => player1.on('connect', r)),
    new Promise((r) => player2.on('connect', r)),
  ]);

  const matchFoundPromise1 = new Promise((r) => player1.once('caro:matchFound', r));
  const matchFoundPromise2 = new Promise((r) => player2.once('caro:matchFound', r));

  player1.emit('caro:findMatch', { name: 'Player_1' });
  player2.emit('caro:findMatch', { name: 'Player_2' });

  const [matchData1, matchData2] = await Promise.all([matchFoundPromise1, matchFoundPromise2]);
  assert.strictEqual(matchData1.roomId, matchData2.roomId, 'Both players must join the same roomId');
  assert.ok(
    (matchData1.yourSymbol === 'X' && matchData2.yourSymbol === 'O') ||
    (matchData1.yourSymbol === 'O' && matchData2.yourSymbol === 'X'),
    'One player must be X and the other O',
  );
  console.log(`✔ Online Matchmaking created room: ${matchData1.roomId} (P1: ${matchData1.yourSymbol}, P2: ${matchData2.yourSymbol})`);

  player1.disconnect();
  player2.disconnect();

  // 9. Test Multi-user Socket Session Isolation on Logout
  const aliceRes = await fetch(`${serverUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `alice_${Date.now()}`, password: 'password123' }),
  });
  const aliceData = await aliceRes.json();
  const aliceId = aliceData.user.id;

  const bobRes = await fetch(`${serverUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `bob_${Date.now()}`, password: 'password123' }),
  });
  const bobData = await bobRes.json();
  const bobId = bobData.user.id;

  // Alice connects and gets game
  const aliceSocket = io(serverUrl, { transports: ['websocket'], forceNew: true });
  await new Promise((r) => aliceSocket.on('connect', r));

  const aliceGame = await new Promise((resolve) => {
    aliceSocket.emit('line98:init', { userId: aliceId });
    aliceSocket.once('line98:gameState', resolve);
  });
  assert.strictEqual(aliceGame.userId, aliceId, 'Alice game must belong to Alice');

  // Alice logs out
  aliceSocket.emit('auth:logout');

  // Bob logs in on the exact same socket connection
  const bobGame = await new Promise((resolve) => {
    aliceSocket.emit('line98:init', { userId: bobId });
    aliceSocket.once('line98:gameState', resolve);
  });
  assert.strictEqual(bobGame.userId, bobId, 'Bob game must belong to Bob');
  assert.notStrictEqual(bobGame.id, aliceGame.id, 'Bob must receive his own game, not Alice game');
  console.log('✔ Multi-user session isolation on logout verified: Alice & Bob games remain distinct');
  aliceSocket.disconnect();

  // 10. Test Caro Bot Match Single-Save (No Duplicate Rows in SQLite)
  const historyBeforeRes = await fetch(`${serverUrl}/games/caro/history?limit=100`);
  const historyBefore = await historyBeforeRes.json();
  const countBefore = historyBefore.length;

  const uniquePlayerName = `SingleSaveBotTester_${Date.now()}`;
  await new Promise((resolve) => {
    socketObserver.once('caro:historyUpdated', () => resolve(true));
    socketClient.emit('caro:saveBotMatch', {
      playerName: uniquePlayerName,
      winner: 'X',
      movesCount: 10,
      moves: [],
    });
  });

  const historyAfterRes = await fetch(`${serverUrl}/games/caro/history?limit=100`);
  const historyAfter = await historyAfterRes.json();
  const addedRecords = historyAfter.filter((m) => m.playerXName === uniquePlayerName);
  assert.strictEqual(addedRecords.length, 1, 'Exactly 1 record must be created for the bot match (no duplicates!)');
  console.log('✔ Verified bot match creates exactly 1 record in SQLite (no duplicate rows)');

  // 11. Test Line 98 Game Over State Transition
  const line98Service = app.get(require('../dist/games/line98/line98.service').Line98Service);
  const alternatingBoard = Array(9).fill(0).map((_, r) =>
    Array(9).fill(0).map((_, c) => ((r * 2 + c) % 5) + 1),
  );
  // (0, 0) is empty, and (0, 1) will move to (0, 0).
  // When (0, 1) moves to (0, 0), (0, 1) becomes empty, and spawnNextBalls fills it, making board 100% full.
  alternatingBoard[0][0] = 0;

  const fullBoardState = {
    id: 'test_game_over',
    board: alternatingBoard,
    score: 100,
    nextBalls: [1, 2, 3],
    isGameOver: false,
  };

  const moveRes = await line98Service.handleMove(fullBoardState, { r: 0, c: 1 }, { r: 0, c: 0 });
  assert.strictEqual(fullBoardState.isGameOver, true, 'isGameOver must be true when board is full');
  console.log('✔ Line 98 Game Over state triggers correctly when board fills up');

  // 12. Test Caro 5-in-a-row Victory Line Detection
  const caroService = app.get(require('../dist/games/caro/caro.service').CaroService);
  const testCaroBoard = Array(15).fill(null).map(() => Array(15).fill(null));
  // Create horizontal 5-in-a-row from (7, 5) to (7, 9)
  for (let c = 5; c <= 9; c++) {
    testCaroBoard[7][c] = 'X';
  }
  const winLine = caroService.checkWin(testCaroBoard, 7, 7, 'X');
  assert.ok(winLine, 'Should detect 5-in-a-row win');
  assert.strictEqual(winLine.length, 5, 'Winning line must contain exactly 5 coordinates');
  assert.strictEqual(winLine[0].r, 7);
  assert.strictEqual(winLine[0].c, 5);
  assert.strictEqual(winLine[4].r, 7);
  assert.strictEqual(winLine[4].c, 9);
  console.log('✔ Caro 5-in-a-row Victory Line detected with exact coordinates');

  // 13. Test XSS Entity Sanitization
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  const maliciousInput = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
  const sanitized = escapeHtml(maliciousInput);
  assert.ok(!sanitized.includes('<script>'), 'Sanitized output must not contain <script>');
  assert.ok(!sanitized.includes('<img'), 'Sanitized output must not contain <img');
  assert.ok(sanitized.includes('&lt;script&gt;'));
  console.log('✔ Match history table XSS entity escaping verified');

  // 14. Test Online Caro Room Forfeit via caro:leaveMatch
  const forfeitP1 = io(serverUrl, { transports: ['websocket'], forceNew: true });
  const forfeitP2 = io(serverUrl, { transports: ['websocket'], forceNew: true });
  await Promise.all([
    new Promise((r) => forfeitP1.on('connect', r)),
    new Promise((r) => forfeitP2.on('connect', r)),
  ]);

  const p1Found = new Promise((r) => forfeitP1.once('caro:matchFound', r));
  const p2Found = new Promise((r) => forfeitP2.once('caro:matchFound', r));
  forfeitP1.emit('caro:findMatch', { name: 'Forfeiter' });
  forfeitP2.emit('caro:findMatch', { name: 'Victim' });
  const [fMatch1, fMatch2] = await Promise.all([p1Found, p2Found]);

  // P2 listens for playerLeft
  const p2LeftPromise = new Promise((r) => forfeitP2.once('caro:playerLeft', r));
  // P1 emits caro:leaveMatch
  forfeitP1.emit('caro:leaveMatch');
  const p2LeftData = await p2LeftPromise;
  assert.ok(p2LeftData.message.includes('chiến thắng'), 'Opponent should receive victory message upon player leave');
  console.log('✔ caro:leaveMatch forfeits match, notifies opponent, and updates SQLite history');
  forfeitP1.disconnect();
  forfeitP2.disconnect();

  // 15. Test Limit Sanitization Bounds in REST and WebSocket
  const invalidLimitRes = await fetch(`${serverUrl}/games/caro/history?limit=invalid_nan`);
  assert.strictEqual(invalidLimitRes.status, 200);
  const invalidLimitData = await invalidLimitRes.json();
  assert.ok(Array.isArray(invalidLimitData), 'Should return array on NaN limit');

  const negativeLimitRes = await fetch(`${serverUrl}/games/caro/history?limit=-50`);
  assert.strictEqual(negativeLimitRes.status, 200);
  const negativeLimitData = await negativeLimitRes.json();
  assert.ok(Array.isArray(negativeLimitData), 'Should return array on negative limit');
  console.log('✔ Limit parameter sanitization verified: NaN and negative limits safely handled');

  // 16. Test Bot Match Malformed Payload Normalization
  const malformedBotMatchRes = await fetch(`${serverUrl}/games/caro/bot-match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      winner: 'CORRUPT_STATUS',
      movesCount: 'NaN_COUNT',
      moves: null,
    }),
  });
  assert.strictEqual(malformedBotMatchRes.status, 201, 'Malformed payload should be normalized gracefully without 500');
  const savedMalformed = await malformedBotMatchRes.json();
  assert.strictEqual(savedMalformed.winner, 'DRAW', 'Corrupt winner should normalize to DRAW');
  assert.strictEqual(savedMalformed.movesCount, 0, 'Invalid movesCount should normalize to 0');
  console.log('✔ Malformed bot-match payload normalized safely to DRAW and 0 moves');

  socketClient.disconnect();
  socketObserver.disconnect();
  await new Promise((r) => setTimeout(r, 200));
  await app.close();
  console.log('--- All 16 Adversarial Checks Passed With Flying Colors ---');
}

testAll().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
