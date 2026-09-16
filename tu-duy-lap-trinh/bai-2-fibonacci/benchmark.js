/**
 * Bài 2: Benchmark & Kiểm tra tính đúng đắn cho F(10), F(20), F(50)
 * Đo thời gian thực thi trung bình qua 10 lần chạy
 */

const { performance } = require('perf_hooks');
const { fibonacciBottomUp, fibonacciMemo } = require('./fibonacci');

function runVerification() {
  console.log('========================================================');
  console.log('       1. KIỂM TRA TÍNH ĐÚNG ĐẮN VỚI n = 10, 20, 50     ');
  console.log('========================================================\n');

  const testCases = [
    { n: 10, expected: 55n },
    { n: 20, expected: 6765n },
    { n: 50, expected: 12586269025n },
  ];

  for (const tc of testCases) {
    const bottomUpRes = fibonacciBottomUp(tc.n);
    const memoRes = fibonacciMemo(tc.n);
    const isBottomUpValid = bottomUpRes === tc.expected;
    const isMemoValid = memoRes === tc.expected;

    console.log(`[Test n = ${tc.n}]`);
    console.log(`  - Giá trị kỳ vọng:             ${tc.expected}`);
    console.log(`  - Kết quả Bottom-Up (O(1)):     ${bottomUpRes} -> ${isBottomUpValid ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  - Kết quả Memoization (O(n)):  ${memoRes} -> ${isMemoValid ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log('');

    if (!isBottomUpValid || !isMemoValid) {
      console.error(`❌ Kiểm tra tính đúng đắn thất bại tại n = ${tc.n}!`);
      process.exit(1);
    }
  }
}

function runBenchmark(iterations = 10) {
  console.log('========================================================');
  console.log(`  2. BÁO CÁO THỜI GIAN THỰC THI TRUNG BÌNH (${iterations} LẦN CHẠY) `);
  console.log('========================================================\n');

  const testValues = [10, 20, 50];

  for (const n of testValues) {
    console.log(`--- Đang đo cho n = ${n} ---`);
    const timingsBottomUp = [];
    const timingsMemo = [];

    // Chạy warmup
    fibonacciBottomUp(n);
    fibonacciMemo(n);

    // Chạy 10 lần
    for (let i = 1; i <= iterations; i++) {
      // Đo Bottom-Up
      const startBU = performance.now();
      fibonacciBottomUp(n);
      const endBU = performance.now();
      const durBU = endBU - startBU;
      timingsBottomUp.push(durBU);

      // Đo Memo
      const startMemo = performance.now();
      fibonacciMemo(n, new Map());
      const endMemo = performance.now();
      const durMemo = endMemo - startMemo;
      timingsMemo.push(durMemo);
    }

    const avgBU = timingsBottomUp.reduce((a, b) => a + b, 0) / iterations;
    const avgMemo = timingsMemo.reduce((a, b) => a + b, 0) / iterations;

    console.log(`- Bottom-Up DP [O(1) Space]:`);
    console.log(`  + Các lần chạy (ms): [${timingsBottomUp.map(t => t.toFixed(5)).join(', ')}]`);
    console.log(`  + Thời gian trung bình: ${avgBU.toFixed(6)} ms (Đạt yêu cầu < 1ms: ${avgBU < 1.0 ? 'ĐẠT ✅' : 'KHÔNG ĐẠT ❌'})`);

    console.log(`- Top-Down DP Memoization [O(n) Space]:`);
    console.log(`  + Thời gian trung bình: ${avgMemo.toFixed(6)} ms (Đạt yêu cầu < 1ms: ${avgMemo < 1.0 ? 'ĐẠT ✅' : 'KHÔNG ĐẠT ❌'})`);
    console.log('');
  }

  // Đo trực tiếp bằng console.time / console.timeEnd theo đúng yêu cầu đề bài
  console.log('--- Đo thực tế bằng console.time / console.timeEnd cho F(50) ---');
  console.time('console.time Đo F(50) Bottom-Up');
  const res50 = fibonacciBottomUp(50);
  console.timeEnd('console.time Đo F(50) Bottom-Up');
  console.log(`Kết quả F(50): ${res50.toString()}\n`);
}

if (require.main === module) {
  runVerification();
  runBenchmark(10);
}
