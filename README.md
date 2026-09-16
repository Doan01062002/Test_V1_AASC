# TỔNG HỢP BÀI THI ĐÁNH GIÁ NĂNG LỰC LẬP TRÌNH - AASC

> **Ứng viên**: Hoàn thành theo toàn bộ yêu cầu trong 3 tài liệu đề thi chính thức:
> 1. [`V1 - Bai Kiem tra ve Tu duy lap trinh.pdf`](./V1%20-%20Bai%20Kiem%20tra%20ve%20Tu%20duy%20lap%20trinh.pdf)
> 2. [`V1 - Bai Kiem tra Danh gia API co ban.pdf`](./V1%20-%20Bai%20Kiem%20tra%20Danh%20gia%20API%20co%20ban.pdf)
> 3. [`V1 - Bai Kiem tra Co ban ve Tich hop - Version 2.pdf`](./V1%20-%20Bai%20Kiem%20tra%20Co%20ban%20ve%20Tich%20hop%20-%20Version%202.pdf)  
>
> **Công nghệ sử dụng**: Node.js, NestJS 10, Express, TypeScript, TypeORM, SQLite, Socket.IO, @nestjs/axios, Swagger OpenAPI, class-validator, Jest, HTML5 Canvas, Jotform REST API, Bitrix24 REST API.

---

## Danh Mục Các Dự Án Trong Repository

Repository được tổ chức chuẩn mực thành 3 thư mục dự án độc lập tương ứng với 3 phần thi:

| Thư mục dự án | Đề bài tương ứng | Nội dung triển khai | Trạng thái |
| :--- | :--- | :--- | :---: |
| [`tich-hop-jotform-bitrix24/`](./tich-hop-jotform-bitrix24) | **Tích Hợp Jotform và Bitrix24 CRM** | Webhook receiver (`POST /webhook/jotform`), Jotform API Submissions Sync, DNS Fallback chống chặn mạng, ánh xạ Contact Bitrix24 (`crm.contact.add`), Structured Logging ISO 8601, 123 unit tests + 109 adversarial stress tests PASS 100%. | **HOÀN THÀNH (100%) ✅** |
| [`danh-gia-api-nestjs/`](./danh-gia-api-nestjs) | **Đánh Giá Kỹ Năng Lập Trình API với NestJS** | Tích hợp Bitrix24 REST API qua OAuth 2.0, tự động refresh token, SQLite TypeORM, CRUD Contact & Banking Requisites, ApiKeyGuard (`x-api-key`), Swagger `/docs`, 10 test suites (81 tests PASS 100%). | **HOÀN THÀNH (100%) ✅** |
| [`tu-duy-lap-trinh/`](./tu-duy-lap-trinh) | **Bài Kiểm Tra Về Tư Duy Lập Trình** | Bao gồm 3 bài toán: Bài 1 RESTful Task API, Bài 2 Tính số Fibonacci F(50) BigInt O(n)/O(1), Bài 3 Game Server Line 98 & Cờ Caro X O WebSocket Client Canvas (79 tests PASS 100%). | **HOÀN THÀNH (100%) ✅** |

---

# PHẦN 1: TÍCH HỢP JOTFORM VÀ BITRIX24 CRM

> **Thư mục**: [`tich-hop-jotform-bitrix24/`](./tich-hop-jotform-bitrix24)  
> **Xem tài liệu chi tiết**: [`tich-hop-jotform-bitrix24/README.md`](./tich-hop-jotform-bitrix24/README.md)

### 1.1. Các Tính Năng Đã Triển Khai
1. **Tiếp Nhận Dữ Liệu Webhook Từ Jotform**:
   - Endpoint `POST /webhook/jotform` tiếp nhận submission tự động khi người dùng điền biểu mẫu.
   - Hỗ trợ đa định dạng dữ liệu: `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`, và tự động giải mã chuỗi `rawRequest` JSON từ Jotform.
   - Trích xuất thông tin chuẩn xác:
     - Họ và tên: `q3_name` (hỗ trợ cả `{ first, last }` và chuỗi gộp, bảo toàn tiếng Việt có dấu).
     - Địa chỉ Email: `q4_email` (chuẩn hóa chữ thường, xác thực theo RFC 5322).
     - Số điện thoại: `q5_phoneNumber` (làm sạch ký tự định dạng, giữ nguyên mã quốc gia `+`).
2. **Cơ Chế DNS Fallback Vượt Chặn Mạng**:
   - Tích hợp Custom DNS Resolver (`dnsResolver.ts`) với máy chủ Google (`8.8.8.8`) và Cloudflare (`1.1.1.1`) để tự động vượt qua tình trạng chặn DNS của các nhà mạng tại Việt Nam khi gọi Jotform API.
3. **Ánh Xạ & Tạo Bản Ghi Contact Trên Bitrix24 CRM**:
   - Gọi phương thức `crm.contact.add.json` tới Webhook Bitrix24 đã được cấp quyền CRM.
   - Tự động chuyển đổi số điện thoại và email thành mảng Multifield (`VALUE_TYPE: 'WORK'`) đúng chuẩn CRM.
4. **Hệ Thống Logging ISO 8601 & Phòng Thủ Zero-Crash**:
   - Ghi log có cấu trúc rõ ràng: thời điểm nhận dữ liệu, payload thô, payload đã chuẩn hóa, ID của Contact vừa được tạo trên CRM và thông báo lỗi chi tiết nếu có sự cố.
   - Trả về mã lỗi HTTP 400 kèm danh sách lỗi chi tiết nếu dữ liệu không hợp lệ mà không bao giờ gây crash ứng dụng.
5. **Kiểm Thử Toàn Diện**:
   - 9 test suites / **123 unit tests** Jest PASS 100%.
   - **109 test cases** kiểm thử áp lực đối kháng (Challenger stress tests) PASS 100%.

### 1.2. Hướng Dẫn Chạy Nhanh
```bash
cd tich-hop-jotform-bitrix24
npm install
npm run build

# Chạy toàn bộ 123 unit tests
npm test

# Khởi chạy server tại cổng 3000
npm run dev
```

---

# PHẦN 2: BÀI KIỂM TRA ĐÁNH GIÁ KỸ NĂNG LẬP TRÌNH API VỚI NESTJS

> **Thư mục**: [`danh-gia-api-nestjs/`](./danh-gia-api-nestjs)  
> **Xem tài liệu chi tiết**: [`danh-gia-api-nestjs/README.md`](./danh-gia-api-nestjs/README.md)

### 2.1. Các Tính Năng Đã Triển Khai
1. **OAuth 2.0 & Quản lý Token Bitrix24**:
   - Endpoint `/install` (hỗ trợ cả GET redirect code và POST iframe payload).
   - Trao đổi Authorization Code lấy `access_token` và `refresh_token`.
   - Lưu trữ an toàn trong SQLite qua TypeORM (`BitrixToken` entity).
   - Tự động làm mới token chủ động (trước khi hết hạn 60s) và bị động (khi nhận lỗi `expired_token`).
2. **RESTful API Quản lý Contact & Requisites Ngân Hàng**:
   - `GET /contacts`: Lấy danh sách contact kết hợp thông tin ngân hàng (`crm.contact.list` + `crm.requisite.list` + `crm.requisite.bankdetail.list`).
   - `GET /contacts/:id`: Lấy chi tiết contact kèm thông tin ngân hàng.
   - `POST /contacts`: Tạo mới contact với địa chỉ chi tiết, tự động tạo Requisite ngân hàng (`ENTITY_TYPE_ID = 3`) và Bank Detail.
   - `PUT /contacts/:id`: Cập nhật thông tin contact và thông tin tài khoản ngân hàng.
   - `DELETE /contacts/:id`: Xóa contact và toàn bộ requisites liên quan khỏi Bitrix24.
3. **Bảo Mật & Xác Thực Dữ Liệu**:
   - Bảo vệ toàn bộ endpoint CRM bằng Guard tùy biến (`ApiKeyGuard`), kiểm tra header `x-api-key`.
   - DTO Validation nghiêm ngặt với `class-validator` (Email RFC 5322, SĐT hợp lệ).
4. **Tài Liệu Swagger & Kiểm Thử**:
   - Swagger UI tương tác tại `/docs` kèm hỗ trợ nút Authorize nhập `x-api-key`.
   - **10 test suites, 81 tests PASS 100%** trên Jest.

### 2.2. Hướng Dẫn Chạy Nhanh
```bash
cd danh-gia-api-nestjs
npm install
npm run build
npm test
npm run start:dev
```
- Swagger UI: [http://localhost:3000/docs](http://localhost:3000/docs)

---

# PHẦN 3: BÀI KIỂM TRA VỀ TƯ DUY LẬP TRÌNH

> **Thư mục**: [`tu-duy-lap-trinh/`](./tu-duy-lap-trinh)  
> **Xem tài liệu chi tiết**: [`tu-duy-lap-trinh/README.md`](./tu-duy-lap-trinh/README.md)

### 3.1. Danh Sách 3 Bài Thi
1. **Bài 1: RESTful API Quản Lý Task (NestJS)**:
   - Thư mục: `tu-duy-lap-trinh/bai-1-task-api/`
   - Kiến trúc MVC chuẩn NestJS, TypeORM + SQLite, Validation Pipes, Swagger `/docs`.
   - Benchmark GET 100 bản ghi đạt **~12.58 ms** (yêu cầu < 200ms).
   - Báo cáo lý thuyết NestJS & TypeScript: [`BaoCao_NestJS_LyThuyet.md`](./tu-duy-lap-trinh/bai-1-task-api/BaoCao_NestJS_LyThuyet.md).
2. **Bài 2: Tính Số Fibonacci Thứ 50**:
   - Thư mục: `tu-duy-lap-trinh/bai-2-fibonacci/`
   - Thuật toán Dynamic Programming tối ưu O(n) thời gian, O(1) không gian với `BigInt`.
   - Kết quả: **F(50) = 12,586,269,025n**, thời gian thực thi: **~0.001 ms** (yêu cầu < 1 ms).
   - Báo cáo phân tích thuật toán: [`BaoCao_Fibonacci.md`](./tu-duy-lap-trinh/bai-2-fibonacci/BaoCao_Fibonacci.md).
3. **Bài 3: Phát Triển Server Game (Line 98 & Cờ Caro)**:
   - Thư mục: `tu-duy-lap-trinh/bai-3-game-server/`
   - Quản lý tài khoản: Bcrypt hash, JWT auth, cập nhật profile.
   - **Game Line 98**: BFS tìm đường đi ngắn nhất, nổ hàng ≥ 5 bóng, sinh 3 bóng mới, tính năng trợ giúp gợi ý nước đi tối ưu, bóng pha lê 3D với hiệu ứng nổ điểm.
   - **Game Cờ Caro X O**: Bàn cờ 15x15, thắng 5 quân liên tiếp, chế độ luyện tập với Bot AI offline và ghép cặp online qua WebSocket.
   - Web Client Canvas hiện đại, Load test 12 clients latency **~5.78 ms** (yêu cầu < 200ms).

### 3.2. Hướng Dẫn Chạy Nhanh
```bash
# Bài 2: Fibonacci
cd tu-duy-lap-trinh/bai-2-fibonacci
npm start && npm test && npm run benchmark

# Bài 1: Task API
cd ../bai-1-task-api
npm install && npm test && npm run benchmark && npm run start:dev

# Bài 3: Game Server & Client
cd ../bai-3-game-server
npm install && npm test && npm run load-test && npm run start:dev
```
- Web Client Game: [http://localhost:3001](http://localhost:3001)

---

## Bảng Tổng Hợp Kiểm Thử Toàn Bộ Repository

| Dự án | Số lượng Unit Tests | Tỷ lệ PASS | Build sạch |
| :--- | :---: | :---: | :---: |
| **tich-hop-jotform-bitrix24** | 123 tests Jest (+109 stress tests) | **100% PASS ✅** | **0 lỗi ✅** |
| **danh-gia-api-nestjs** | 81 tests / 10 suites | **100% PASS ✅** | **0 lỗi ✅** |
| **tu-duy-lap-trinh / Bài 1** | 33 tests / 2 suites | **100% PASS ✅** | **0 lỗi ✅** |
| **tu-duy-lap-trinh / Bài 2** | 9 tests / 1 suite | **100% PASS ✅** | **0 lỗi ✅** |
| **tu-duy-lap-trinh / Bài 3** | 37 tests / 5 suites | **100% PASS ✅** | **0 lỗi ✅** |
| **TỔNG CỘNG** | **283 Jest tests (+109 stress tests)** | **100% PASS ✅** | **0 lỗi ✅** |
