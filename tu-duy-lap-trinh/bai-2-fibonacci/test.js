/**
 * Bộ kiểm thử tự động cho Bài 2: Thuật toán Fibonacci
 * Kiểm tra tính đúng đắn cho F(10), F(20), F(50), các ca biên và xử lý ngoại lệ
 */

const assert = require('node:assert');
const test = require('node:test');
const { fibonacciBottomUp, fibonacciMemo } = require('./fibonacci');

test('Bài 2: Kiểm thử tính đúng đắn Fibonacci F(10), F(20), F(50)', async (t) => {
  await t.test('Ca cơ sở: F(0) = 0n và F(1) = 1n', () => {
    assert.strictEqual(fibonacciBottomUp(0), 0n);
    assert.strictEqual(fibonacciMemo(0), 0n);
    assert.strictEqual(fibonacciBottomUp(1), 1n);
    assert.strictEqual(fibonacciMemo(1), 1n);
  });

  await t.test('Yêu cầu trọng tâm: F(10) == 55n', () => {
    assert.strictEqual(fibonacciBottomUp(10), 55n);
    assert.strictEqual(fibonacciMemo(10), 55n);
  });

  await t.test('Yêu cầu trọng tâm: F(20) == 6765n', () => {
    assert.strictEqual(fibonacciBottomUp(20), 6765n);
    assert.strictEqual(fibonacciMemo(20), 6765n);
  });

  await t.test('Yêu cầu trọng tâm: F(50) == 12586269025n (Vượt ngưỡng 32-bit an toàn)', () => {
    const expected = 12586269025n;
    assert.strictEqual(fibonacciBottomUp(50), expected);
    assert.strictEqual(fibonacciMemo(50), expected);
  });

  await t.test('Tính đúng đắn với các số Fibonacci lớn hơn: F(70) và F(80)', () => {
    assert.strictEqual(fibonacciBottomUp(70), 190392490709135n);
    assert.strictEqual(fibonacciMemo(70), 190392490709135n);
    assert.strictEqual(fibonacciBottomUp(80), 23416728348467685n);
    assert.strictEqual(fibonacciMemo(80), 23416728348467685n);
  });

  await t.test('Tính nhất quán giữa Bottom-Up DP và Top-Down Memoization', () => {
    const values = [2, 3, 5, 8, 13, 25, 40, 50, 70];
    for (const n of values) {
      assert.strictEqual(fibonacciBottomUp(n), fibonacciMemo(n));
    }
  });

  await t.test('Kiểm thử hàm calculateWithTiming đo thời gian F(10) và F(50)', () => {
    const { calculateWithTiming } = require('./fibonacci');
    const res10 = calculateWithTiming(10, fibonacciBottomUp);
    assert.strictEqual(res10, 55n);
    const res50 = calculateWithTiming(50, fibonacciBottomUp);
    assert.strictEqual(res50, 12586269025n);
    const res50Memo = calculateWithTiming(50, fibonacciMemo);
    assert.strictEqual(res50Memo, 12586269025n);
  });

  await t.test('Kiểm tra xử lý ngoại lệ với đầu vào không hợp lệ', () => {
    // Số âm
    assert.throws(() => fibonacciBottomUp(-1), /Tham số n phải là một số nguyên không âm/);
    assert.throws(() => fibonacciMemo(-5), /Tham số n phải là một số nguyên không âm/);

    // Số thực
    assert.throws(() => fibonacciBottomUp(3.14), /Tham số n phải là một số nguyên không âm/);
    assert.throws(() => fibonacciMemo(10.5), /Tham số n phải là một số nguyên không âm/);

    // NaN và Infinity
    assert.throws(() => fibonacciBottomUp(NaN), /Tham số n phải là một số nguyên không âm/);
    assert.throws(() => fibonacciMemo(NaN), /Tham số n phải là một số nguyên không âm/);
    assert.throws(() => fibonacciBottomUp(Infinity), /Tham số n phải là một số nguyên không âm/);
    assert.throws(() => fibonacciMemo(-Infinity), /Tham số n phải là một số nguyên không âm/);

    // Kiểu dữ liệu không phải number (string, null, undefined, boolean, object)
    assert.throws(() => fibonacciBottomUp('50'), /Tham số n phải là một số nguyên không âm/);
    assert.throws(() => fibonacciMemo(null), /Tham số n phải là một số nguyên không âm/);
    assert.throws(() => fibonacciBottomUp(undefined), /Tham số n phải là một số nguyên không âm/);
    assert.throws(() => fibonacciBottomUp(true), /Tham số n phải là một số nguyên không âm/);
    assert.throws(() => fibonacciMemo({}), /Tham số n phải là một số nguyên không âm/);
    assert.throws(() => fibonacciBottomUp([]), /Tham số n phải là một số nguyên không âm/);
  });
});
