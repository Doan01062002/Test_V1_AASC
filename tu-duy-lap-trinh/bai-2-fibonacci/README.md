# Bài 2: Tính Số Fibonacci Thứ 50 bằng JavaScript (Dynamic Programming)

Thư mục này chứa mã nguồn và báo cáo kiểm tra thuật toán tính số Fibonacci thứ 50 theo yêu cầu của đề bài.

## Cấu Trúc Thư Mục

- `fibonacci.js`: Chứa hàm triển khai thuật toán DP tối ưu với `BigInt` và hàm đo thời gian bằng `console.time`.
- `test.js`: Bộ kiểm thử tự động xác minh tính đúng đắn cho F(10), F(20), F(50), các ca biên và ngoại lệ.
- `benchmark.js`: Kịch bản kiểm tra tính đúng đắn cho n = 10, 20, 50 và đo thời gian thực thi trung bình qua 10 lần chạy.
- `BaoCao_Fibonacci.md`: Báo cáo chi tiết mô tả thuật toán, độ phức tạp thời gian/không gian (O(n), O(1)), bảng kết quả thực thi và giải thích việc dùng `BigInt`.

## Cách Chạy

Yêu cầu môi trường: Node.js (phiên bản >= 16).

```bash
# Di chuyển vào thư mục bài 2
cd tu-duy-lap-trinh/bai-2-fibonacci

# 1. Chạy thuật toán tính F(50)
npm start          # hoặc: node fibonacci.js

# 2. Chạy kiểm thử tự động F(10), F(20), F(50)
npm test           # hoặc: node test.js

# 3. Chạy kịch bản kiểm tra tính đúng đắn & benchmark 10 lần
npm run benchmark  # hoặc: node benchmark.js
```
