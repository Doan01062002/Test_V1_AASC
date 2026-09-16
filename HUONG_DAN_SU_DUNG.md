# HƯỚNG DẪN SỬ DỤNG VÀ ĐÁNH GIÁ NHANH (QUICK START GUIDE)

> **Dự án**: Tổng hợp bài thi Đánh giá Năng lực Lập trình - AASC  
> **Cấu trúc**: Gồm 3 dự án độc lập nằm trong 3 thư mục riêng biệt tại thư mục gốc `d:/AASC`.  
> **Yêu cầu môi trường**: Node.js >= 18 (khuyến nghị Node.js v20+ hoặc v24) và `npm`.

---

## 📌 BẢNG TỔNG QUAN CÁC DỰ ÁN & CỔNG DỊCH VỤ

| Dự án | Thư mục | Cổng (Port) | Đường dẫn trải nghiệm / Kiểm tra |
| :--- | :--- | :---: | :--- |
| **Phần 1: Tích hợp Jotform & Bitrix24** | `tich-hop-jotform-bitrix24/` | `3000` | Health: `http://localhost:3000/health`<br>Webhook: `POST /webhook/jotform` |
| **Phần 2: Đánh giá API với NestJS** | `danh-gia-api-nestjs/` | `3000` | Swagger UI: `http://localhost:3000/docs`<br>Endpoints: `/contacts`, `/install` |
| **Phần 3: Tư duy Lập trình (Game & Task)** | `tu-duy-lap-trinh/` | `3001` & `3000` | Game Client: `http://localhost:3001`<br>Task Swagger: `http://localhost:3000/docs` |

---

## ⚡ HƯỚNG DẪN CHẠY & ĐÁNH GIÁ TỪNG PHẦN THI

---

### PHẦN 1: TÍCH HỢP JOTFORM VÀ BITRIX24 CRM
> Thư mục: `tich-hop-jotform-bitrix24/`  
> Tính năng: Webhook nhận form Jotform (Họ tên, SĐT, Email), chống chặn DNS, tự động tạo Contact trên Bitrix24 CRM.

#### 1. Khởi động ứng dụng:
Mở terminal tại thư mục dự án:
```bash
cd tich-hop-jotform-bitrix24
npm install
npm run dev
```
*(Server sẽ lắng nghe tại cổng `http://localhost:3000`)*

#### 2. Mở kết nối công khai (Ngrok / Cloudflare Tunnel):
Mở thêm một tab terminal khác tại thư mục dự án và chạy:
```powershell
.\ngrok.exe http 3000
```
*(Hoặc dùng Cloudflare: `cloudflared tunnel --url http://localhost:3000`)*

#### 3. Cách kiểm thử:
- **Cách 1 - Điền form thực tế trên web**:
  - Truy cập form Jotform: [https://form.jotform.com/262582117734055](https://form.jotform.com/262582117734055)
  - Điền Họ tên, Email, Số điện thoại và bấm **Submit**.
  - Kiểm tra log terminal server và mở Bitrix24 CRM để thấy Contact mới được tạo tự động.
- **Cách 2 - Bắn Webhook trực tiếp bằng cURL**:
  ```bash
  curl -X POST http://localhost:3000/webhook/jotform \
    -H "Content-Type: application/json" \
    -d "{\"rawRequest\":\"{\\\"q3_name\\\":{\\\"first\\\":\\\"Nguyễn\\\",\\\"last\\\":\\\"Văn An\\\"},\\\"q4_email\\\":\\\"an.nguyen@test.com\\\",\\\"q5_phoneNumber\\\":{\\\"full\\\":\\\"0912345678\\\"}}\"}"
  ```
- **Chạy kiểm thử tự động (Unit Test & Stress Test)**:
  ```bash
  npm test
  ```
  *(123 unit tests + 109 stress tests đều PASS 100%)*

---

### PHẦN 2: BÀI KIỂM TRA ĐÁNH GIÁ KỸ NĂNG API VỚI NESTJS
> Thư mục: `danh-gia-api-nestjs/`  
> Tính năng: OAuth 2.0 Bitrix24 Local App, lưu token SQLite, tự động refresh, CRUD Contact & Banking Requisites, bảo mật `x-api-key`, tài liệu Swagger.

#### 1. Khởi động ứng dụng:
```bash
cd danh-gia-api-nestjs
npm install
npm run start:dev
```
*(Server sẽ khởi động tại `http://localhost:3000`)*

#### 2. Cách kiểm thử:
- **Trải nghiệm qua giao diện Swagger UI trực quan**:
  - Truy cập trình duyệt: [http://localhost:3000/docs](http://localhost:3000/docs)
  - Bấm nút **Authorize** ở góc trên bên phải, nhập API Key mặc định: `aasc-test-secret-key-2024`
  - Thực hiện thử nghiệm các endpoint:
    - `POST /contacts`: Tạo mới Contact kèm địa chỉ chi tiết và thông tin tài khoản ngân hàng.
    - `GET /contacts`: Lấy danh sách Contact đã tích hợp Requisites ngân hàng.
    - `PUT /contacts/{id}`: Cập nhật Contact và tài khoản ngân hàng.
    - `DELETE /contacts/{id}`: Xóa Contact khỏi hệ thống.
- **Chạy toàn bộ 81 Unit Test tự động**:
  ```bash
  npm test
  ```

---

### PHẦN 3: BÀI KIỂM TRA VỀ TƯ DUY LẬP TRÌNH
> Thư mục: `tu-duy-lap-trinh/` (gồm 3 bài toán)

#### 1. Bài 2: Tính số Fibonacci thứ 50 (F(50) BigInt O(n) & O(1))
```bash
cd tu-duy-lap-trinh/bai-2-fibonacci
npm start          # In kết quả F(50) = 12586269025n
npm test           # Chạy unit test xác thực
npm run benchmark  # Đo hiệu năng (trung bình ~0.001 ms, yêu cầu < 1 ms)
```

#### 2. Bài 1: Task RESTful API (NestJS + SQLite + Swagger)
```bash
cd tu-duy-lap-trinh/bai-1-task-api
npm install
npm test           # 33 unit tests PASS 100%
npm run benchmark  # Đo kiểm hiệu năng GET 100 records (~12 ms, yêu cầu < 200ms)
npm run start:dev  # Khởi chạy server, mở http://localhost:3000/docs để xem Swagger
```

#### 3. Bài 3: Game Server Line 98 & Cờ Caro X O (Canvas Client + WebSockets)
```bash
cd tu-duy-lap-trinh/bai-3-game-server
npm install
npm test           # 37 unit tests PASS 100%
npm run load-test  # Đo kiểm tải 12 clients đồng thời (~5.78 ms, yêu cầu < 200ms)
npm run start:dev  # Khởi chạy Game Server & Web Client
```
* **Trải nghiệm Game trực tiếp trên trình duyệt**:
  - Mở: [http://localhost:3001](http://localhost:3001)
  - **Tab Tài khoản**: Đăng ký / Đăng nhập, cập nhật biệt danh và email.
  - **Tab Line 98**: Di chuyển bóng thủy tinh 3D, thuật toán tìm đường BFS, nổ chuỗi khi đủ 5 bóng cùng màu, nút "💡 Trợ Giúp" gợi ý nước đi tối ưu, lưu kỷ lục High Score.
  - **Tab Cờ Caro X O**: Chơi trực tiếp với **Bot AI** (1 tab) hoặc ghép cặp Online thời gian thực qua WebSocket (mở 2 tab trình duyệt).

---

## 🧪 LỆNH CHẠY KIỂM THỬ TOÀN BỘ HỆ THỐNG (ALL-IN-ONE)

Để kiểm tra tính toàn vẹn của mã nguồn và đảm bảo tất cả các bài đều vượt qua kiểm thử:

```bash
# 1. Kiểm thử Phần 1 (Tích hợp Jotform - Bitrix24): 123 tests PASS
cd d:/AASC/tich-hop-jotform-bitrix24 && npm test

# 2. Kiểm thử Phần 2 (Đánh giá API NestJS): 81 tests PASS
cd d:/AASC/danh-gia-api-nestjs && npm test

# 3. Kiểm thử Phần 3 - Bài 1 (Task API): 33 tests PASS
cd d:/AASC/tu-duy-lap-trinh/bai-1-task-api && npm test

# 4. Kiểm thử Phần 3 - Bài 2 (Fibonacci): 9 tests PASS
cd d:/AASC/tu-duy-lap-trinh/bai-2-fibonacci && npm test

# 5. Kiểm thử Phần 3 - Bài 3 (Game Server): 37 tests PASS
cd d:/AASC/tu-duy-lap-trinh/bai-3-game-server && npm test
```

> **Tổng kết chất lượng mã nguồn**: **283 Jest Unit Tests + 109 Adversarial Stress Tests PASS 100%**, toàn bộ các dự án biên dịch sạch sẽ (`0 errors`), tuân thủ chuẩn Clean Architecture, bảo mật và tài liệu hóa đầy đủ.
