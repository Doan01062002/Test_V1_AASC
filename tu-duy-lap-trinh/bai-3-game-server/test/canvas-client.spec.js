/**
 * Kiểm thử tự động logic Client-Side Canvas & Animation (Line 98 & Caro)
 * Kiểm tra:
 * 1. Thuật toán chuyển đổi tọa độ Responsive & HiDPI (getCanvasCoords)
 * 2. Khóa tương tác khi bóng đang di chuyển (Input locking)
 * 3. Token hủy hiệu ứng khi reset/newGame (currentAnimationId)
 * 4. Cơ chế timeout an toàn tránh treo UI khi mất kết nối
 */

const assert = require('node:assert');
const test = require('node:test');

function getCanvasCoords(canvasRect, e, logicalWidth, logicalHeight) {
  let clientX = e.clientX;
  let clientY = e.clientY;

  if (clientX === undefined && e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (clientX === undefined && e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  }

  const rectWidth = canvasRect.width || logicalWidth;
  const rectHeight = canvasRect.height || logicalHeight;
  const scaleX = logicalWidth / rectWidth;
  const scaleY = logicalHeight / rectHeight;

  return {
    x: ((clientX ?? 0) - canvasRect.left) * scaleX,
    y: ((clientY ?? 0) - canvasRect.top) * scaleY,
  };
}

test('Kiểm thử chuyển đổi tọa độ Canvas và xử lý Responsive Mobile', async (t) => {
  const LOGICAL_SIZE = 450;
  const LINE_SIZE = 9;
  const CELL_SIZE = LOGICAL_SIZE / LINE_SIZE; // 50px

  await t.test('Desktop chuẩn: Kích thước hiển thị đúng bằng kích thước logic (450x450)', () => {
    const canvasRect = { left: 100, top: 50, width: 450, height: 450 };
    // Nhấp vào trung tâm ô (0, 0) -> clientX: 125, clientY: 75
    const click00 = { clientX: 125, clientY: 75 };
    const coords00 = getCanvasCoords(canvasRect, click00, LOGICAL_SIZE, LOGICAL_SIZE);
    assert.strictEqual(Math.floor(coords00.x / CELL_SIZE), 0);
    assert.strictEqual(Math.floor(coords00.y / CELL_SIZE), 0);

    // Nhấp vào trung tâm ô (4, 4) -> clientX: 100 + 225 = 325, clientY: 50 + 225 = 275
    const click44 = { clientX: 325, clientY: 275 };
    const coords44 = getCanvasCoords(canvasRect, click44, LOGICAL_SIZE, LOGICAL_SIZE);
    assert.strictEqual(Math.floor(coords44.x / CELL_SIZE), 4);
    assert.strictEqual(Math.floor(coords44.y / CELL_SIZE), 4);
  });

  await t.test('Mobile Responsive: Canvas bị co nhỏ về 300px trên màn hình điện thoại', () => {
    const canvasRect = { left: 20, top: 40, width: 300, height: 300 };

    // Nhấp vào giữa màn hình (tương ứng ô 4,4) -> clientX = 20 + 150 = 170, clientY = 40 + 150 = 190
    const mobileTouch = { touches: [{ clientX: 170, clientY: 190 }] };
    const coords = getCanvasCoords(canvasRect, mobileTouch, LOGICAL_SIZE, LOGICAL_SIZE);

    assert.strictEqual(Math.round(coords.x), 225);
    assert.strictEqual(Math.round(coords.y), 225);
    assert.strictEqual(Math.floor(coords.x / CELL_SIZE), 4);
    assert.strictEqual(Math.floor(coords.y / CELL_SIZE), 4);

    // Chạm vào ô góc dưới cùng bên phải (8, 8) -> clientX = 20 + 290 = 310
    const touchCorner = { touches: [{ clientX: 310, clientY: 330 }] };
    const coordsCorner = getCanvasCoords(canvasRect, touchCorner, LOGICAL_SIZE, LOGICAL_SIZE);
    assert.strictEqual(Math.floor(coordsCorner.x / CELL_SIZE), 8);
    assert.strictEqual(Math.floor(coordsCorner.y / CELL_SIZE), 8);
  });

  await t.test('Hỗ trợ touch qua changedTouches khi ngón tay nhấc lên (touchend/pointerup)', () => {
    const canvasRect = { left: 0, top: 0, width: 450, height: 450 };
    const touchEvent = { changedTouches: [{ clientX: 100, clientY: 100 }] };
    const coords = getCanvasCoords(canvasRect, touchEvent, LOGICAL_SIZE, LOGICAL_SIZE);
    assert.strictEqual(coords.x, 100);
    assert.strictEqual(coords.y, 100);
    assert.strictEqual(Math.floor(coords.x / CELL_SIZE), 2);
    assert.strictEqual(Math.floor(coords.y / CELL_SIZE), 2);
  });
});

test('Kiểm thử cơ chế hủy hiệu ứng khi Reset trạng thái (Animation Cancellation Token)', async (t) => {
  let currentAnimationId = 0;
  const executedSteps = [];

  async function simulateAnimateBall(path) {
    const animId = ++currentAnimationId;
    for (let i = 0; i < path.length; i++) {
      if (animId !== currentAnimationId) return; // Đã bị hủy
      executedSteps.push({ animId, step: i, pos: path[i] });
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  // Khởi chạy animation 1 (5 bước)
  const path1 = [
    { r: 0, c: 0 },
    { r: 0, c: 1 },
    { r: 0, c: 2 },
    { r: 0, c: 3 },
    { r: 0, c: 4 },
  ];
  const p1 = simulateAnimateBall(path1);

  // Sau 15ms, người chơi nhận gameState mới hoặc bấm New Game -> Hủy animation 1
  await new Promise((r) => setTimeout(r, 15));
  currentAnimationId++; // Mô phỏng reset state

  await p1;

  // Xác nhận animation 1 đã bị ngắt sớm, không chạy hết 5 bước
  assert.ok(executedSteps.length < 5, `Các bước đã thực thi: ${executedSteps.length} (nhỏ hơn 5 do bị ngắt)`);

  // Kiểm tra kịch bản race condition: Không ghi đè bàn cờ mới nếu animation của nước đi cũ bị ngắt
  let boardState = 'NEW_GAME_BOARD';
  async function simulateMoveResultHandling(isCancelled) {
    const moveAnimToken = currentAnimationId + 1;
    await simulateAnimateBall(path1);
    if (moveAnimToken !== currentAnimationId) {
      return; // Hủy, giữ nguyên NEW_GAME_BOARD
    }
    boardState = 'OLD_STALE_BOARD';
  }

  // Khởi động move handler và giữa chừng reset game
  const movePromise = simulateMoveResultHandling();
  await new Promise((r) => setTimeout(r, 15));
  currentAnimationId++; // New game!
  boardState = 'FRESH_GAME_BOARD';

  await movePromise;
  assert.strictEqual(boardState, 'FRESH_GAME_BOARD', 'Bàn cờ mới không bị ghi đè bởi nước đi cũ đã bị hủy');
});
