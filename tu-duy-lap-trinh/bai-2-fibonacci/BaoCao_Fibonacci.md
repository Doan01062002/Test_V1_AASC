# Báo Cáo Thuật Toán: Tính Số Fibonacci Thứ 50 (F(50))

Bài kiểm tra: **Bài 2: Tính Số Fibonacci Thứ 50**  
Mục tiêu: Đánh giá khả năng viết thuật toán cơ bản và tối ưu hóa hiệu suất bằng JavaScript.

---

## 1. Mô Tả Thuật Toán

Dãy số Fibonacci được định nghĩa theo công thức đệ quy:
- `F(0) = 0`
- `F(1) = 1`
- `F(n) = F(n-1) + F(n-2)` với mọi `n ≥ 2`.

### Vấn đề của phương pháp Đệ quy thông thường (Naive Recursion)
- Nếu dùng đệ quy ngây thơ: `F(n) = F(n-1) + F(n-2)`, độ phức tạp thời gian là `O(2^n)`. Với `n = 50`, số lần gọi hàm lên tới hơn 2 × 10^14 phép tính, gây tràn ngăn xếp (Call Stack Overflow) hoặc treo trình duyệt/Node.js trong nhiều ngày.

### Giải pháp: Quy hoạch động (Dynamic Programming)
Trong bài này, chúng tôi triển khai 2 phương pháp quy hoạch động:
1. **Phương pháp 1 (Bottom-Up Tabulation - Khuyên dùng)**:
   - Thay vì lưu trữ toàn bộ mảng từ 0 đến n, ta nhận thấy để tính `F(i)` chỉ cần biết 2 giá trị liền trước: `F(i-1)` và `F(i-2)`.
   - Sử dụng 2 biến `prev2` và `prev1` để liên tục trượt và cộng dồn qua từng bước lặp từ 2 đến n.
2. **Phương pháp 2 (Top-Down Memoization)**:
   - Sử dụng đệ quy kết hợp với bảng băm (`Map`) để lưu nhớ các giá trị `F(k)` đã được tính. Khi gặp lại bài toán con, trả về ngay từ bộ nhớ đệm trong `O(1)`.

### Vì sao sử dụng `BigInt`?
- Trong JavaScript, kiểu số thông thường `Number` tuân theo chuẩn IEEE 754 (Double-precision 64-bit float). Giới hạn số nguyên an toàn lớn nhất là `Number.MAX_SAFE_INTEGER` (2^53 - 1 = 9,007,199,254,740,991).
- Mặc dù F(50) = 12,586,269,025 chưa vượt qua 2^53 - 1, nhưng việc tính toán Fibonacci tăng theo cấp số nhân (hằng số vàng φ^n), các số Fibonacci từ n ≥ 79 sẽ vượt giới hạn số nguyên an toàn và bị mất độ chính xác.
- Sử dụng kiểu `BigInt` (hậu tố `n`) theo đúng yêu cầu đề bài giúp đảm bảo:
  - Khả năng xử lý số nguyên lớn tùy ý với độ chính xác số học tuyệt đối 100%.
  - Sẵn sàng mở rộng cho bất kỳ giá trị n nào lớn hơn (n = 100, 500, 1000...) mà không lo tràn số.

---

## 2. Phân Tích Độ Phức Tạp

| Phương pháp | Độ phức tạp Thời gian (Time Complexity) | Độ phức tạp Không gian (Space Complexity) | Đánh giá |
| :--- | :---: | :---: | :--- |
| **Bottom-Up (2 biến)** | **O(n)** | **O(1)** | **Tối ưu nhất**: Vòng lặp đơn n - 1 bước, chỉ tốn 3 biến `BigInt`. |
| **Top-Down (Memoization)** | **O(n)** | **O(n)** | Tốn O(n) không gian cho `Map` và Call stack. |
| *Đệ quy ngây thơ* | *O(2^n)* | *O(n)* | *Không khả thi khi n ≥ 40.* |

---

## 3. Kết Quả Kiểm Tra Tính Đúng Đắn

Kiểm tra với các giá trị mốc:
- **n = 10**: F(10) = 55n (Đúng chuẩn lý thuyết toán học).
- **n = 20**: F(20) = 6765n (Đúng chuẩn lý thuyết toán học).
- **n = 50**: F(50) = 12586269025n (Chính xác 12,586,269,025).

---

## 4. Báo Cáo Thời Gian Thực Thi (Benchmark)

Thử nghiệm trên máy chạy CPU đa nhân, đo đạc qua 10 lần chạy lặp lại liên tiếp bằng `performance.now()` và `console.time` / `console.timeEnd`:

### Bảng kết quả đo lường:

| Giá trị n | Thời gian trung bình Bottom-Up O(1) | Thời gian trung bình Memoization O(n) | Yêu cầu đề bài | Kết luận |
| :---: | :---: | :---: | :---: | :---: |
| **n = 10** | **0.000570 ms** | 0.002270 ms | < 1 ms | **ĐẠT ✅** |
| **n = 20** | **0.000670 ms** | 0.007150 ms | < 1 ms | **ĐẠT ✅** |
| **n = 50** | **0.001030 ms** | 0.010160 ms | < 1 ms | **ĐẠT ✅** (Nhanh hơn yêu cầu ~1000 lần) |

- **Kết quả đo bằng `console.time` trực tiếp**:
  ```text
  console.time Đo F(50) Bottom-Up: 0.021ms
  Kết quả F(50): 12586269025
  ```

---

## 5. Hướng Dẫn Chạy Mã Nguồn

1. **Chạy file tính trực tiếp:**
   ```bash
   node fibonacci.js
   ```
2. **Chạy file benchmark và xác minh:**
   ```bash
   node benchmark.js
   ```
