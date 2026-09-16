================================================================================
BÀI THI ĐÁNH GIÁ NĂNG LỰC LẬP TRÌNH - HÃNG KIỂM TOÁN AASC
================================================================================

Tác giả / Ứng viên: Nguyễn Văn Đoàn
Repository: https://github.com/Doan01062002/Test_V1_AASC.git
Yêu cầu môi trường: Node.js >= 18 (khuyến nghị v20+ hoặc v24) và npm.

--------------------------------------------------------------------------------
1. DANH MỤC CÁC DỰ ÁN TRONG REPOSITORY
--------------------------------------------------------------------------------
Repository gồm 3 dự án độc lập tương ứng với 3 đề bài kiểm tra:

1. tich-hop-jotform-bitrix24/
   - Đề bài: "V1 - Bai Kiem tra Co ban ve Tich hop - Version 2.pdf"
   - Tiếp nhận Webhook Jotform (Form ID: 262582117734055), chuẩn hóa dữ liệu,
     DNS Fallback chống chặn mạng, tự động tạo Contact trên Bitrix24 CRM.
   - Kết quả: 123 Jest Unit Tests + 109 Adversarial Stress Tests PASS 100%.

2. danh-gia-api-nestjs/
   - Đề bài: "V1 - Bai Kiem tra Danh gia API co ban.pdf"
   - RESTful API tích hợp Bitrix24 OAuth 2.0, tự động refresh token, SQLite
     TypeORM, CRUD Contact & Banking Requisites (ENTITY_TYPE_ID = 3), Swagger UI.
   - Kết quả: 81 Jest Unit Tests (10 test suites) PASS 100%.

3. tu-duy-lap-trinh/
   - Đề bài: "V1 - Bai Kiem tra ve Tu duy lap trinh.pdf"
   - Bài 1 (bai-1-task-api): RESTful Task API NestJS + SQLite, benchmark GET 100
     bản ghi đạt ~12.58 ms (< 200 ms). Có báo cáo lý thuyết NestJS & TypeScript.
   - Bài 2 (bai-2-fibonacci): Thuật toán Dynamic Programming BigInt O(n) tính F(50)
     = 12586269025n, thời gian thực thi ~0.001 ms (< 1 ms). Có báo cáo phân tích.
   - Bài 3 (bai-3-game-server): Game Server NestJS + Socket.IO + Web Client Canvas
     gồm trò chơi Line 98 (BFS, trợ giúp gợi ý) và Cờ Caro X O 15x15 (Bot AI +
     online matchmaking), tải 12 clients đồng thời đạt độ trễ ~5.78 ms (< 200 ms).
   - Kết quả: 79 Jest Tests PASS 100%.

--------------------------------------------------------------------------------
2. HƯỚNG DẪN CÀI ĐẶT VÀ KHỞI CHẠY TỪNG DỰ ÁN
--------------------------------------------------------------------------------

A. DỰ ÁN TÍCH HỢP JOTFORM & BITRIX24:
   1. Di chuyển vào thư mục:
      cd tich-hop-jotform-bitrix24
   2. Cài đặt thư viện:
      npm install
   3. Cấu hình biến môi trường:
      Tạo file .env từ .env.example và điền webhook URL Bitrix24:
      BITRIX24_WEBHOOK_URL=https://your-domain.bitrix24.vn/rest/1/webhook-key/
      JOTFORM_FORM_ID=262582117734055
      PORT=3000
   4. Khởi chạy ứng dụng (Cổng 3000):
      npm run dev
   5. Mở tunnel công khai cho Jotform gọi về (chạy ở terminal khác):
      .\ngrok.exe http 3000
      (hoặc dùng: cloudflared tunnel --url http://localhost:3000)
   6. Chạy toàn bộ 123 unit tests:
      npm test

B. DỰ ÁN ĐÁNH GIÁ API VỚI NESTJS (CRM CONTACT & REQUISITES):
   1. Di chuyển vào thư mục:
      cd danh-gia-api-nestjs
   2. Cài đặt thư viện:
      npm install
   3. Khởi chạy server API (Cổng 3000):
      npm run start:dev
   4. Truy cập tài liệu tương tác Swagger UI:
      Mở trình duyệt: http://localhost:3000/docs
      Bấm nút "Authorize" và nhập x-api-key: aasc-test-secret-key-2024
   5. Chạy toàn bộ 81 unit tests:
      npm test

C. DỰ ÁN TƯ DUY LẬP TRÌNH:
   - Bài 2 (Fibonacci F(50)):
      cd tu-duy-lap-trinh/bai-2-fibonacci
      npm start           # In kết quả F(50)
      npm test            # 9 tests PASS 100%
      npm run benchmark   # Đo hiệu năng < 1 ms

   - Bài 1 (Task API):
      cd tu-duy-lap-trinh/bai-1-task-api
      npm install
      npm test            # 33 tests PASS 100%
      npm run benchmark   # Đo hiệu năng GET 100 bản ghi < 200 ms
      npm run start:dev   # Chạy server cổng 3000, Swagger tại http://localhost:3000/docs

   - Bài 3 (Game Server & Web Client):
      cd tu-duy-lap-trinh/bai-3-game-server
      npm install
      npm test            # 37 tests PASS 100%
      npm run load-test   # Đo kiểm tải 12 clients latency < 200 ms
      npm run start:dev   # Chạy server cổng 3001
      Mở trình duyệt trải nghiệm game tại: http://localhost:3001

--------------------------------------------------------------------------------
3. KIỂM THỬ TOÀN BỘ HỆ THỐNG (ALL-IN-ONE)
--------------------------------------------------------------------------------
Tất cả 283 unit tests Jest và 109 adversarial stress tests trên 3 dự án đều
đạt tỷ lệ 100% PASS:

  cd tich-hop-jotform-bitrix24 && npm test
  cd ../danh-gia-api-nestjs && npm test
  cd ../tu-duy-lap-trinh/bai-1-task-api && npm test
  cd ../tu-duy-lap-trinh/bai-2-fibonacci && npm test
  cd ../tu-duy-lap-trinh/bai-3-game-server && npm test

================================================================================
