# Bài 3: Phát Triển Server Game Đơn Giản Với NestJS (Line 98 & Cờ Caro X O)

Dự án này triển khai toàn bộ yêu cầu của **Bài 3: Phát triển Server Game Đơn Giản với NestJS** theo mô hình MVC, tích hợp TypeORM với SQLite, WebSocket (Socket.IO) thời gian thực, quản lý tài khoản với JWT và Bcrypt, cùng giao diện web client trực quan (HTML5 Canvas).

---

## 1. Kiến Trúc và Các Tính Năng Đã Triển Khai

### 1.1. Quản lý tài khoản (Authentication & User Profile):
- **Đăng ký & Đăng nhập**: Mã hóa mật khẩu an toàn bằng `bcryptjs`, phát hành `JWT token` thời hạn 7 ngày.
- **Cập nhật thông tin**: API `PATCH /user/profile` được bảo vệ bởi `JwtAuthGuard`, cho phép người dùng đã đăng nhập thay đổi `email` và `nickname`.
- **Lưu trữ**: Bảng `users` trong SQLite (UUID, username, password hash, email, nickname, createdAt).

### 1.2. Trò chơi 1: Line 98
- **Lưới 9x9 với 5 màu bóng**: Đỏ, Xanh lam, Xanh lục, Vàng, Tím.
- **Thuật toán tìm đường đi BFS**: Kiểm tra đường đi thông suốt từ ô nguồn đến ô đích, tránh các quả bóng vật cản.
- **Xóa hàng & Cộng điểm**: Quét 4 hướng (ngang, dọc, chéo chính, chéo phụ); nổ bóng khi có từ 5 bóng cùng màu liên tiếp trở lên (≥ 5).
- **Sinh bóng ngẫu nhiên**: Sinh 3 bóng mới từ danh sách 3 bóng dự báo kế tiếp nếu nước đi không ăn điểm.
- **Tính năng Trợ giúp (Help)**: Thuật toán quét bàn cờ, tìm và gợi ý nước đi tối ưu (hoặc ngẫu nhiên hợp lệ) để tạo hàng.
- **Giao diện HTML5 Canvas**: Hiệu ứng bóng chọn phóng to (zoom & glowing ring), hiển thị 3 bóng kế tiếp, hiển thị gợi ý nước đi.
- **Lưu trạng thái**: Tự động lưu bàn cờ, điểm số vào bảng `line98_games` trong SQLite.

### 1.3. Trò chơi 2: Cờ Caro X O
- **Bàn cờ chuẩn 15x15**: Hai người chơi luân phiên đánh X và O.
- **Chế độ trực tuyến & Ghép cặp ngẫu nhiên (Matchmaking)**: Người chơi vào hàng đợi, hệ thống tự động ghép cặp 2 người chơi vào một phòng đấu (`roomId`), ngẫu nhiên phân vai X (đi trước) và O (đi sau).
- **Phát hiện thắng cuộc**: Kiểm tra 5 quân liên tiếp theo cả 4 hướng (ngang, dọc, chéo chính, chéo phụ) sau mỗi nước đi.
- **Giao diện đồ họa Canvas**: Hiển thị rõ ràng lượt đi hiện tại của ai ("Lượt của bạn" kèm hiệu ứng pulse), highlight đường 5 quân chiến thắng.
- **Lưu lịch sử**: Tự động lưu kết quả ván đấu và toàn bộ các nước đi vào bảng `caro_matches` trong SQLite.

---

## 2. Hướng Dẫn Cài Đặt và Khởi Chạy

### Yêu cầu môi trường:
- Node.js version >= 18 (Đã kiểm thử trên Node v24.18.0)
- npm version >= 9

### Các bước thực hiện:

1. **Cài đặt các thư viện phụ thuộc:**
   ```bash
   cd tu-duy-lap-trinh/bai-3-game-server
   npm install
   ```

2. **Khởi chạy Game Server:**
   ```bash
   # Chế độ phát triển (Development)
   npm run start:dev

   # Hoặc biên dịch và chạy bản build (Production)
   npm run build
   npm run start:prod
   ```

3. **Mở giao diện Web Game:**
   - Mở trình duyệt web truy cập: [http://localhost:3001](http://localhost:3001)
   - **Thử nghiệm Line 98**: Nhấp chọn bóng (bóng sẽ phóng to và có viền sáng), nhấp ô đích để di chuyển. Nhấn "💡 Trợ Giúp" để xem gợi ý nước đi.
   - **Thử nghiệm Cờ Caro trực tuyến**: Mở 2 tab trình duyệt riêng biệt (hoặc 1 tab thường + 1 tab ẩn danh), vào tab "⚔️ Cờ Caro X O" và cùng bấm "🎯 Tìm Trận Ngẫu Nhiên". Server sẽ ghép cặp 2 tab vào cùng một ván cờ theo thời gian thực!
   - **Thử nghiệm Tài khoản**: Vào tab "👤 Tài Khoản" để đăng ký tài khoản mới, đăng nhập và cập nhật nickname/email.

---

## 3. Kết Quả Chạy Unit Test (Jest)

Kịch bản kiểm thử bao gồm kiểm tra thuật toán tìm đường BFS, kiểm tra nổ 5 bóng theo các hướng của Line 98, thuật toán kiểm tra thắng 5 quân liên tiếp 4 hướng và hệ thống ghép cặp của Cờ Caro:

```bash
npm test
```

**Kết quả chạy test thực tế:**
```text
PASS src/games/caro/caro.service.spec.ts
PASS src/games/line98/line98.service.spec.ts

Test Suites: 2 passed, 2 total
Tests:       32 passed, 32 total
Snapshots:   0 total
Ran all test suites.

(Bổ sung kịch bản kiểm thử client canvas: `npm run test:canvas` - 5/5 tests PASS)
```

---

## 4. Kiểm Thử Tải Đồng Thời (Concurrency Load Test)

Kịch bản kiểm thử giả lập **12 clients WebSocket đồng thời** (vượt yêu cầu ≥ 10) kết nối và gửi nhận thông điệp liên tục để đo độ trễ phản hồi của server:

```bash
npm run load-test
```

**Kết quả kiểm thử thực tế:**
- Số lượng clients kết nối đồng thời: **12 clients** (Tiêu chí đề bài: ≥ 10)
- Độ trễ nhanh nhất (Min Latency): **3.09 ms**
- Độ trễ chậm nhất (Max Latency): **9.93 ms**
- Độ trễ trung bình (Avg Latency): **5.78 ms**
- **Đánh giá**: Đạt tiêu chuẩn xuất sắc (5.78 ms, nhanh hơn nhiều so với tiêu chuẩn 200 ms).
