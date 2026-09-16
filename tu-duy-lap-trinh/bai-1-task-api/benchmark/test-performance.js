/**
 * Kịch bản kiểm thử hiệu năng API GET /tasks với 100 bản ghi
 * Tiêu chuẩn đề bài: Đảm bảo thời gian phản hồi dưới 200ms
 * Sử dụng native fetch của Node.js (không cần thêm dependency bên ngoài)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distAppModule = path.join(__dirname, '../dist/app.module.js');
if (!fs.existsSync(distAppModule)) {
  console.log('[Benchmark] Thư mục dist chưa được biên dịch. Đang tự động chạy `npm run build`...');
  execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
}

const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/app.module');

async function runPerformanceBenchmark() {
  console.log('===============================================================');
  console.log('  BÀI 1: KIỂM THỬ HIỆU NĂNG GET /tasks VỚI 100 BẢN GHI        ');
  console.log('  Tiêu chí đề bài: Phản hồi dưới 200ms                         ');
  console.log('===============================================================\n');

  // Khởi động server NestJS trên cổng ngẫu nhiên
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0);

  const serverUrl = await app.getUrl();
  console.log(`[Benchmark] Server đang chạy tại: ${serverUrl}`);

  console.log('1. Đang làm sạch và nạp đúng 100 bản ghi mẫu vào cơ sở dữ liệu SQLite...');
  const seedStart = performance.now();
  const seedRes = await fetch(`${serverUrl}/tasks/seed`, { method: 'POST' });
  const seedData = await seedRes.json();
  const seedTime = performance.now() - seedStart;

  if (!seedRes.ok) {
    throw new Error(`Không thể seed dữ liệu mẫu: ${seedData.message || seedRes.statusText}`);
  }

  console.log(`=> Nạp dữ liệu hoàn tất (${seedTime.toFixed(2)} ms): ${seedData.message}\n`);

  console.log('2. Bắt đầu đo thời gian phản hồi của GET /tasks (chạy 10 lần)...');
  const latencies = [];
  const iterations = 10;
  let recordCount = 0;

  for (let i = 1; i <= iterations; i++) {
    const start = performance.now();
    const res = await fetch(`${serverUrl}/tasks`);
    const data = await res.json();
    const end = performance.now();
    const duration = end - start;
    latencies.push(duration);
    recordCount = Array.isArray(data) ? data.length : 0;

    console.log(
      `  - Lần ${i}: Lấy thành công ${recordCount} tasks trong ${duration.toFixed(2)} ms (HTTP Status: ${res.status})`,
    );

    if (recordCount !== 100) {
      console.error(`❌ CẢNH BÁO: Số lượng bản ghi không đúng 100! Thực tế: ${recordCount}`);
      await app.close();
      process.exit(1);
    }
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / iterations;
  const maxLatency = Math.max(...latencies);
  const minLatency = Math.min(...latencies);
  const isPerformancePassed = avgLatency < 200 && recordCount === 100;

  console.log('\n===============================================================');
  console.log('                     TỔNG HỢP HIỆU NĂNG                        ');
  console.log('===============================================================');
  console.log(`- Số lượng bản ghi trong DB:          ${recordCount} bản ghi (Yêu cầu chính xác 100)`);
  console.log(`- Thời gian phản hồi nhanh nhất (Min): ${minLatency.toFixed(2)} ms`);
  console.log(`- Thời gian phản hồi chậm nhất (Max):  ${maxLatency.toFixed(2)} ms`);
  console.log(`- Thời gian phản hồi trung bình (Avg): ${avgLatency.toFixed(2)} ms`);
  console.log(`- Tiêu chuẩn đề bài yêu cầu:           < 200 ms`);
  console.log(
    `- ĐÁNH GIÁ KẾT QUẢ:                   ${isPerformancePassed ? 'ĐẠT TIÊU CHUẨN XUẤT SẮC ✅' : 'KHÔNG ĐẠT ❌'}`,
  );
  console.log('===============================================================\n');

  await app.close();
  if (!isPerformancePassed) {
    process.exit(1);
  }
  process.exit(0);
}

runPerformanceBenchmark().catch((err) => {
  console.error('Lỗi trong quá trình benchmark:', err);
  process.exit(1);
});
