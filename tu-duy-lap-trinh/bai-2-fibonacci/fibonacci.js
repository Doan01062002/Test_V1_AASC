/**
 * Bài 2: Tính Số Fibonacci Thứ 50
 * Triển khai thuật toán Dynamic Programming sử dụng BigInt
 */

/**
 * Phương pháp 1: Dynamic Programming - Bottom-Up (Tabulation) tối ưu không gian O(1)
 * Sử dụng 2 biến tích lũy để tính Fibonacci thứ n.
 *
 * Độ phức tạp thời gian: O(n)
 * Độ phức tạp không gian: O(1)
 *
 * @param {number} n Thứ tự số Fibonacci cần tính (n >= 0)
 * @returns {bigint} Số Fibonacci thứ n dưới dạng BigInt
 */
function fibonacciBottomUp(n) {
  if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) {
    throw new Error('Tham số n phải là một số nguyên không âm.');
  }

  if (n === 0) return 0n;
  if (n === 1) return 1n;

  let prev2 = 0n; // F(i-2)
  let prev1 = 1n; // F(i-1)
  let current = 0n;

  for (let i = 2; i <= n; i++) {
    current = prev1 + prev2;
    prev2 = prev1;
    prev1 = current;
  }

  return current;
}

/**
 * Phương pháp 2: Dynamic Programming - Top-Down với Memoization
 * Sử dụng bộ nhớ đệm (Cache) để lưu trữ các giá trị đã tính toán.
 *
 * Độ phức tạp thời gian: O(n)
 * Độ phức tạp không gian: O(n) do mảng đệm và call stack
 *
 * @param {number} n
 * @param {Map<number, bigint>} memo
 * @returns {bigint}
 */
function fibonacciMemo(n, memo = new Map()) {
  if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) {
    throw new Error('Tham số n phải là một số nguyên không âm.');
  }

  if (n === 0) return 0n;
  if (n === 1) return 1n;

  if (memo.has(n)) {
    return memo.get(n);
  }

  const result = fibonacciMemo(n - 1, memo) + fibonacciMemo(n - 2, memo);
  memo.set(n, result);
  return result;
}

/**
 * Hàm đo thời gian thực thi tính F(n) bằng console.time & console.timeEnd
 * @param {number} n
 * @param {Function} [fn=fibonacciBottomUp]
 * @returns {bigint}
 */
function calculateWithTiming(n, fn = fibonacciBottomUp) {
  const label = `Thời gian tính F(${n}) [${fn.name}]`;
  console.time(label);
  const result = fn(n);
  console.timeEnd(label);
  return result;
}

module.exports = {
  fibonacciBottomUp,
  fibonacciMemo,
  calculateWithTiming,
};

// Nếu chạy trực tiếp file này
if (require.main === module) {
  console.log('====================================================');
  console.log('       BÀI 2: TÍNH SỐ FIBONACCI THỨ 50 (F(50))      ');
  console.log('====================================================\n');

  console.log('1. Chạy với phương pháp Bottom-Up (Tối ưu không gian O(1)):');
  const result50 = calculateWithTiming(50, fibonacciBottomUp);
  console.log(`=> Kết quả F(50): ${result50.toString()}\n`);

  console.log('2. Chạy với phương pháp Top-Down Memoization (Không gian O(n)):');
  const result50Memo = calculateWithTiming(50, fibonacciMemo);
  console.log(`=> Kết quả F(50): ${result50Memo.toString()}\n`);
}
