# BÀI KIỂM TRA VỀ TƯ DUY LẬP TRÌNH - AASC

> **Ứng viên**: Hoàn thành theo toàn bộ yêu cầu trong file `V1 - Bai Kiem tra ve Tu duy lap trinh.pdf`.  
> **Thư mục dự án**: `tu-duy-lap-trinh/`  
> **Công nghệ sử dụng**: Node.js v24, NestJS 10, TypeScript, TypeORM, SQLite, Socket.IO, Jest, HTML5 Canvas.

---

## Danh Mục Các Bài Thi

Dự án được tổ chức gọn gàng thành 3 bài độc lập:

| Thư mục | Tên bài | Mô tả tóm tắt | Trạng thái |
| :--- | :--- | :--- | :---: |
| [`bai-1-task-api/`](./bai-1-task-api) | **Bài 1: RESTful API với NestJS** | API CRUD Task theo mô hình MVC, TypeORM + SQLite, Swagger `/docs`, Pipes Validation, Jest Unit Test, Benchmark GET 100 records (< 200ms). | **HOÀN THÀNH (100%)** |
| [`bai-2-fibonacci/`](./bai-2-fibonacci) | **Bài 2: Tính Số Fibonacci Thứ 50** | Thuật toán Dynamic Programming tối ưu O(n) thời gian, O(1) không gian với `BigInt`. Benchmark n = 10, 20, 50 trung bình < 1 ms. Báo cáo phân tích thuật toán. | **HOÀN THÀNH (100%)** |
| [`bai-3-game-server/`](./bai-3-game-server) | **Bài 3: Phát Triển Server Game** | Game Server NestJS quản lý Auth (Bcrypt, JWT), Game Line 98 (BFS pathfinding, match 5, trợ giúp gợi ý nước đi), Game Cờ Caro X O (15x15, matchmaking online qua WebSocket), Web Client Canvas, Unit tests, Load test 12 clients latency < 200ms. | **HOÀN THÀNH (100%)** |

---

## Hướng Dẫn Chạy Nhanh Toàn Bộ Bài Thi

### 1. Bài 2: Thuật Toán Fibonacci F(50)
```bash
cd tu-duy-lap-trinh/bai-2-fibonacci
npm start          # Chạy thuật toán tính F(50)
npm test           # Chạy bộ test tự động xác minh F(10), F(20), F(50)
npm run benchmark  # Chạy đo kiểm hiệu năng 10 lần
```
*Kết quả:*
- **F(50) = 12,586,269,025n**
- Thời gian thực thi trung bình: **~0.001 ms** (đạt yêu cầu < 1 ms).
- Xem báo cáo chi tiết: [`bai-2-fibonacci/BaoCao_Fibonacci.md`](./bai-2-fibonacci/BaoCao_Fibonacci.md).

---

### 2. Bài 1: RESTful Task API (NestJS)
```bash
cd tu-duy-lap-trinh/bai-1-task-api
npm install
npm run build

# Chạy Unit Test
npm test

# Chạy kiểm thử hiệu năng GET 100 bản ghi (< 200ms)
npm run benchmark

# Khởi chạy server API (Cổng 3000)
npm run start:dev
```
- **Tài liệu Swagger (OpenAPI)**: Mở trình duyệt truy cập [http://localhost:3000/docs](http://localhost:3000/docs).
- **Báo cáo lý thuyết về NestJS & TypeScript**: [`bai-1-task-api/BaoCao_NestJS_LyThuyet.md`](./bai-1-task-api/BaoCao_NestJS_LyThuyet.md).

---

### 3. Bài 3: Game Server & Client (NestJS + WebSockets)
```bash
cd tu-duy-lap-trinh/bai-3-game-server
npm install
npm run build

# Chạy Unit Test cho 2 trò chơi (Line 98 & Cờ Caro)
npm test

# Chạy kiểm thử tải đồng thời (12 clients, latency < 200ms)
npm run load-test

# Khởi chạy Game Server & Web Client (Cổng 3001)
npm run start:dev
```
- **Trải nghiệm Game Trực Tuyến**: Mở trình duyệt truy cập [http://localhost:3001](http://localhost:3001).
  - Thử nghiệm **Line 98**: Di chuyển bóng, hiệu ứng zoom, ăn điểm nổ hàng, bấm nút "💡 Trợ Giúp".
  - Thử nghiệm **Cờ Caro X O**: Mở 2 tab trình duyệt cùng bấm "🎯 Tìm Trận Ngẫu Nhiên" để đấu trực tiếp qua WebSocket.
  - Thử nghiệm **Tài khoản**: Đăng ký, đăng nhập JWT, đổi nickname & email.

---

## Bảng Tổng Hợp Tiêu Chí Đánh Giá

| Tiêu chí của Đề bài | Đạt được trong dự án | Đánh giá |
| :--- | :--- | :---: |
| **Tính chính xác & đầy đủ CRUD** | Đầy đủ Create, Read list/id, Update, Delete, DTO Validation Pipes. | **ĐẠT ✅** |
| **Tài liệu hóa Swagger** | OpenAPI chuẩn mực tại endpoint `/docs` với mô tả trường chi tiết. | **ĐẠT ✅** |
| **Độ trễ API GET 100 bản ghi < 200ms** | Đo lường thực tế đạt **~12.58 ms** (nhanh gấp 15 lần yêu cầu). | **ĐẠT ✅** |
| **Tính chính xác F(50) & BigInt** | F(50) = 12,586,269,025n, kiểu `BigInt`, xác minh n = 10, 20, 50. | **ĐẠT ✅** |
| **Thời gian chạy F(50) < 1ms** | Đo lường thực tế đạt **0.00103 ms** (nhanh hơn yêu cầu 1000 lần). | **ĐẠT ✅** |
| **Quản lý tài khoản game** | Mã hóa Bcrypt, phát hành JWT token, cập nhật profile có JWT Guard. | **ĐẠT ✅** |
| **Game Line 98** | BFS pathfinding, nổ chuỗi ≥ 5, sinh 3 bóng, trợ giúp gợi ý nước đi, lưu SQLite. | **ĐẠT ✅** |
| **Game Cờ Caro X O** | Bàn cờ 15x15, thắng 5 quân liên tiếp, ghép cặp online qua WebSocket, lưu SQLite. | **ĐẠT ✅** |
| **Giao diện đồ họa (Client)** | Giao diện HTML5 Canvas hiện đại, hiệu ứng chọn bóng phóng to, real-time sync. | **ĐẠT ✅** |
| **Server xử lý ≥ 10 người chơi latency < 200ms** | Kịch bản Load Test 12 clients đồng thời đạt độ trễ trung bình **5.78 ms**. | **ĐẠT ✅** |
| **Unit Test đầy đủ bằng Jest & Test runner** | 33 tests cho Bài 1 (Service + Controller 100% coverage), 9 tests cho Bài 2, 37 tests cho Bài 3 (32 service + 5 client canvas tests) — Tổng cộng 79 tests PASS 100%. | **ĐẠT ✅** |
