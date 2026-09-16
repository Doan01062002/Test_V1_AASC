/**
 * Kịch bản kiểm thử tải đồng thời (Concurrency & Latency Load Test)
 * Yêu cầu: Đảm bảo server xử lý được ít nhất 10 người chơi đồng thời với độ trễ latency < 200ms
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distAppModule = path.join(__dirname, '../dist/app.module.js');
if (!fs.existsSync(distAppModule)) {
  console.log('[LoadTest] Thư mục dist chưa được biên dịch. Đang tự động chạy `npm run build`...');
  execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
}

const { NestFactory } = require('@nestjs/core');
const { io } = require('socket.io-client');
const { AppModule } = require('../dist/app.module');

async function runConcurrencyLoadTest() {
  console.log('===============================================================');
  console.log('   BÀI 3: KIỂM THỬ KHẢ NĂNG XỬ LÝ ĐỒNG THỜI (CONCURRENCY)     ');
  console.log('   Tiêu chí: Ít nhất 10 người chơi đồng thời & Latency < 200ms ');
  console.log('===============================================================\n');

  // Khởi động server Game NestJS
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0);
  const serverUrl = await app.getUrl();
  console.log(`[LoadTest] Game Server đang chạy tại: ${serverUrl}`);

  const NUM_CLIENTS = 12; // Kiểm thử với 12 clients đồng thời (vượt mức 10 yêu cầu)
  const PINGS_PER_CLIENT = 5;
  const clients = [];
  const latencies = [];

  console.log(`\n1. Đang kết nối ${NUM_CLIENTS} WebSocket clients đồng thời...`);

  // Kết nối đồng thời tất cả clients
  for (let i = 1; i <= NUM_CLIENTS; i++) {
    const socket = io(serverUrl, {
      transports: ['websocket'],
      forceNew: true,
    });
    clients.push(socket);
  }

  // Chờ tất cả kết nối thành công
  await Promise.all(
    clients.map(
      (socket, index) =>
        new Promise((resolve, reject) => {
          socket.on('connect', () => {
            resolve(true);
          });
          socket.on('connect_error', reject);
        }),
    ),
  );
  console.log(`=> Đã kết nối thành công ${NUM_CLIENTS}/${NUM_CLIENTS} clients qua WebSocket!\n`);

  console.log(`2. Thực hiện đo đạc độ trễ (latency) khi ${NUM_CLIENTS} clients tương tác đồng thời...`);

  const measureLatency = (socket, clientId) => {
    return new Promise((resolve) => {
      const clientLatencies = [];
      let count = 0;

      const sendPing = () => {
        if (count >= PINGS_PER_CLIENT) {
          socket.off('pong', onPong);
          return resolve(clientLatencies);
        }

        const start = performance.now();
        socket.emit('ping', { clientTime: start });

        function onPong() {
          const end = performance.now();
          const latency = end - start;
          clientLatencies.push(latency);
          latencies.push(latency);
          count++;
          setTimeout(sendPing, 20); // gửi ping tiếp theo
        }

        socket.once('pong', onPong);
      };

      sendPing();
    });
  };

  // Kích hoạt đo đạc đồng thời trên toàn bộ các client
  await Promise.all(clients.map((s, idx) => measureLatency(s, idx + 1)));

  // Ngắt kết nối tất cả clients
  clients.forEach((s) => s.disconnect());
  await app.close();

  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  console.log('\n===============================================================');
  console.log('              KẾT QUẢ ĐO TẢI ĐỒNG THỜI (BENCHMARK)             ');
  console.log('===============================================================');
  console.log(`- Số lượng người chơi kết nối đồng thời: ${NUM_CLIENTS} clients (Yêu cầu: >= 10)`);
  console.log(`- Tổng số lượt tương tác đo đạc:         ${latencies.length} lượt`);
  console.log(`- Độ trễ nhanh nhất (Min Latency):       ${minLatency.toFixed(2)} ms`);
  console.log(`- Độ trễ chậm nhất (Max Latency):        ${maxLatency.toFixed(2)} ms`);
  console.log(`- Độ trễ trung bình (Avg Latency):       ${avgLatency.toFixed(2)} ms`);
  console.log(`- Tiêu chuẩn đề bài:                     Latency < 200 ms`);
  console.log(
    `- ĐÁNH GIÁ KẾT QUẢ:                      ${avgLatency < 200 ? 'ĐẠT TIÊU CHUẨN XUẤT SẮC ✅' : 'KHÔNG ĐẠT ❌'}`,
  );
  console.log('===============================================================\n');

  process.exit(0);
}

runConcurrencyLoadTest().catch((err) => {
  console.error('Lỗi khi chạy Load Test:', err);
  process.exit(1);
});
