# Tích Hợp Jotform & Bitrix24 CRM (Jotform to Bitrix24 CRM Integration)

Ứng dụng Node.js & TypeScript chuẩn doanh nghiệp, đóng vai trò Webhook Receiver trung gian tiếp nhận dữ liệu biểu mẫu người dùng từ **Jotform** (Form ID: `262582117734055`), chuẩn hóa và xác thực dữ liệu (Họ tên, Email RFC 5322, Số điện thoại E.164), sau đó tự động tạo bản ghi Contact tương ứng trong **Bitrix24 CRM** qua REST API Webhook.

Ứng dụng được tích hợp cơ chế phân giải DNS dự phòng (Google DNS `8.8.8.8` & Cloudflare DNS `1.1.1.1`) nhằm vượt qua rào cản mạng tại Việt Nam khi kết nối tới Jotform API, cùng hệ thống logging có cấu trúc ISO 8601 và xử lý ngoại lệ phòng thủ (Zero-Crash Policy).

---

## 1. Tính Năng Nổi Bật (Key Features)

1. **Đa dạng phương thức tiếp nhận Webhook (Multi-content Ingestion)**:
   - Hỗ trợ đầy đủ các định dạng: `multipart/form-data`, `application/x-www-form-urlencoded`, và `application/json`.
   - Tự động giải mã trường `rawRequest` dạng chuỗi JSON do Jotform gửi sang khi submit form thực tế.
2. **Trích xuất dữ liệu đa hình (Polymorphic Field Normalization)**:
   - **Họ và tên (`q3_name`)**: Hỗ trợ cả đối tượng `{ first, last }` và chuỗi đơn lẻ (`"Nguyễn Văn An"`), bảo toàn 100% tiếng Việt có dấu.
   - **Email (`q4_email`)**: Chuẩn hóa chữ thường, loại bỏ khoảng trắng, kiểm tra theo chuẩn RFC 5322.
   - **Số điện thoại (`q5_phoneNumber`)**: Hỗ trợ chuỗi hoặc đối tượng `{ full }`, `{ code, area, phone }`, giữ lại dấu `+` quốc tế và kiểm tra độ dài 9-15 chữ số.
3. **Ánh xạ chuẩn Bitrix24 CRM Multifield**:
   - Trường Họ tên ánh xạ vào `NAME` và `LAST_NAME`.
   - Số điện thoại ánh xạ vào mảng `PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }]`.
   - Email ánh xạ vào mảng `EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }]`.
   - Tắt thông báo bảng tin nội bộ bằng tham số `REGISTER_SONET_EVENT: 'N'`.
4. **Xác thực dữ liệu nghiêm ngặt phía máy khách (Strict Client Validation)**:
   - Ngăn chặn triệt để hiện tượng Bitrix24 tạo bản ghi rác mang tên mặc định "Liên lạc với #id" khi dữ liệu gửi sang bị trống hoặc sai định dạng.
5. **Bộ phân giải DNS dự phòng chịu lỗi (Resilient Custom DNS Resolver)**:
   - Tự động chuyển tiếp truy vấn sang `8.8.8.8` và `1.1.1.1` thông qua `dns.Resolver` khi DNS hệ điều hành trả về lỗi `ENOTFOUND` đối với tên miền `api.jotform.com`.
   - Tương thích hoàn toàn với tham số `options.all` trong TLS connection của Node.js.
6. **Logging có cấu trúc theo chuẩn ISO 8601**:
   - Ghi vết chi tiết từng giai đoạn: Tiếp nhận webhook, chuẩn hóa dữ liệu, kết quả kiểm tra tính hợp lệ, thời gian phản hồi từ Bitrix24 CRM và ID Contact tạo mới.
7. **Chiến lược phòng thủ không sập máy chủ (Zero-Crash Policy)**:
   - Bắt lỗi `SyntaxError` của JSON parser, cô lập lỗi mạng của Axios với timeout 10 giây, cùng các bộ lắng nghe `uncaughtException` và `unhandledRejection`.

---

## 2. Kiến Trúc Dự Án (Project Architecture)

```
tich-hop-jotform-bitrix24/
├── src/
│   ├── config/
│   │   └── env.ts                     # Cấu hình biến môi trường & chuẩn hóa URL
│   ├── controllers/
│   │   ├── healthController.ts       # Endpoint kiểm tra sức khỏe (/health, /)
│   │   └── webhookController.ts      # Điều phối Webhook Jotform & Sync API
│   ├── services/
│   │   ├── bitrix24Service.ts        # Client gọi REST API Bitrix24 (crm.contact.add)
│   │   ├── jotformService.ts         # Client gọi Jotform API với Custom DNS Agent
│   │   ├── normalizer.ts             # Chuẩn hóa payload đa hình (q3, q4, q5, rawRequest)
│   │   └── validator.ts              # Kiểm tra hợp lệ Họ tên, Email RFC 5322, SĐT
│   ├── types/
│   │   ├── bitrix24.types.ts         # Khai báo kiểu dữ liệu Bitrix24 REST API
│   │   ├── common.types.ts           # Khai báo DTO chung và chuẩn phản hồi API
│   │   └── jotform.types.ts          # Khai báo cấu trúc biểu mẫu & câu trả lời Jotform
│   ├── utils/
│   │   ├── dnsResolver.ts            # Resolver DNS 8.8.8.8 & 1.1.1.1 cho https.Agent
│   │   └── logger.ts                 # Logger định dạng ISO 8601 UTC và cấp độ log
│   ├── app.ts                        # Khởi tạo Express, middlewares và routes
│   └── index.ts                      # Điểm khởi chạy ứng dụng & quản lý tiến trình
├── tests/
│   ├── unit/
│   │   ├── bitrix24Service.test.ts   # Kiểm thử client Bitrix24 và multifield
│   │   ├── dnsResolver.test.ts       # Kiểm thử cơ chế fallback DNS
│   │   ├── jotformService.test.ts    # Kiểm thử Jotform API client
│   │   ├── logger.test.ts            # Kiểm thử định dạng ISO 8601 & mức độ log
│   │   ├── normalizer.test.ts        # Kiểm thử trích xuất dữ liệu đa hình
│   │   └── validator.test.ts         # Kiểm thử hợp lệ dữ liệu đầu vào
│   └── integration/
│       ├── health.test.ts            # Kiểm thử endpoint /health
│       └── webhookController.test.ts # Kiểm thử toàn trình POST /webhook/jotform
├── .env.example                      # Mẫu biến môi trường
├── .gitignore                        # Cấu hình bỏ qua tệp git
├── jest.config.js                    # Cấu hình Jest & ts-jest
├── package.json                      # Quản lý thư viện và scripts npm
├── tsconfig.json                     # Cấu hình TypeScript Strict Mode
└── README.md                         # Hướng dẫn chi tiết
```

---

## 3. Cài Đặt & Chạy Ứng Dụng (Quick Start)

### 3.1 Yêu Cầu Môi Trường
- Node.js: phiên bản 18 trở lên (khuyến nghị Node.js v20+ hoặc v24).
- Trình quản lý gói: npm.

### 3.2 Cài Đặt Thư Viện
Mở terminal tại thư mục dự án:

```bash
cd d:/AASC/tich-hop-jotform-bitrix24
npm install
```

### 3.3 Cấu Hình Biến Môi Trường
Tạo tệp `.env` dựa trên tệp `.env.example`:

```bash
cp .env.example .env
```

Nội dung cấu hình mẫu trong `.env`:

```env
# Cổng chạy ứng dụng
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Bitrix24 Inbound Webhook URL (Bắt buộc kết thúc bằng dấu gạch chéo /)
BITRIX24_WEBHOOK_URL=https://your-domain.bitrix24.vn/rest/1/your_webhook_key_here/

# Jotform Form ID và API Key
JOTFORM_API_KEY=your_jotform_api_key_here
JOTFORM_FORM_ID=262582117734055

# Bộ máy chủ DNS dự phòng (phân cách bằng dấu phẩy)
DNS_SERVERS=8.8.8.8,1.1.1.1
REQUEST_TIMEOUT_MS=10000
```

### 3.4 Biên Dịch Mã Nguồn TypeScript
Biên dịch dự án sạch 100% không cảnh báo lỗi:

```bash
npm run build
```

### 3.5 Khởi Chạy Ứng Dụng
- Chạy môi trường phát triển (tự động nạp TypeScript):
  ```bash
  npm run dev
  ```
- Chạy môi trường sản xuất (sau khi build ra thư mục dist):
  ```bash
  npm start
  ```

---

## 4. Hướng Dẫn Thiết Lập Bitrix24 Inbound Webhook

1. Đăng nhập vào cổng quản trị Bitrix24 của bạn (ví dụ: `https://your-domain.bitrix24.vn`).
2. Điều hướng tới menu bên trái: **Developer Resources** (Tài nguyên cho nhà phát triển) -> chọn **Other** (Khác) -> chọn **Inbound Webhook** (Webhook gửi đến).
3. Tại mục **Assign permissions** (Gán quyền):
   - Tìm và tích chọn quyền **CRM** (Customer Relationship Management).
4. Nhấn **Save** (Lưu).
5. Hệ thống sẽ cung cấp một đường dẫn URL dạng:
   `https://your-domain.bitrix24.vn/rest/1/your_webhook_key_here/`
6. Sao chép đường dẫn này và dán vào biến `BITRIX24_WEBHOOK_URL` trong tệp `.env`.

*Lưu ý quan trọng:* Hệ thống của chúng tôi đã tự động chuẩn hóa dấu gạch chéo cuối (`/`), chống lỗi mã hóa UTF-8 BOM, và tự động chuyển đổi số điện thoại, email thành mảng Multifield (`crm_multifield`) để Bitrix24 nhận diện chính xác.

---

## 5. Hướng Dẫn Thiết Lập Biểu Mẫu & Webhook Trên Jotform

### 5.1 Cấu Trúc Biểu Mẫu Chuẩn (Form ID: 262582117734055)
Biểu mẫu trên Jotform cần có 3 trường thông tin:
1. **Họ và tên (Full Name)**: Trường văn bản hoặc widget Full Name (định danh `q3_name`).
2. **Email**: Trường Email (định danh `q4_email`).
3. **Số điện thoại (Phone Number)**: Trường Phone (định danh `q5_phoneNumber`).

### 5.2 Mở Đường Truyền Công Khai Bằng Ngrok (Dành cho Môi trường Local)
Để Jotform trên internet có thể gửi webhook về máy chủ của bạn:

```bash
ngrok http 3000
```

Ngrok sẽ cung cấp đường dẫn HTTPS công khai, ví dụ:
`https://abc123-your-subdomain.ngrok-free.app`

Đường dẫn Webhook của bạn sẽ là:
`https://abc123-your-subdomain.ngrok-free.app/webhook/jotform`

### 5.3 Cấu Hình Webhook Trên Giao Diện Jotform
1. Đăng nhập vào trang quản trị Jotform và mở biểu mẫu cần tích hợp (Form ID: `262582117734055`).
2. Chuyển sang thẻ **Settings** (Cài đặt) ở thanh menu trên cùng.
3. Ở menu bên trái, chọn **Integrations** (Tích hợp).
4. Nhập từ khóa **WebHooks** vào ô tìm kiếm và bấm chọn.
5. Tại ô **Add WebHook**, dán đường dẫn Webhook của bạn:
   `https://abc123-your-subdomain.ngrok-free.app/webhook/jotform`
6. Nhấn nút **Complete Integration** (Hoàn tất tích hợp).
7. Bây giờ, mỗi khi người dùng gửi biểu mẫu trên Jotform, toàn bộ dữ liệu sẽ tự động được đẩy về máy chủ của bạn và tạo bản ghi Contact mới trên Bitrix24 CRM ngay lập tức.

---

## 6. Kiểm Thử Hệ Thống (Testing & Verification)

### 6.1 Chạy Bộ Kiểm Thử Tự Động (Jest Test Suite)
Dự án được trang bị 8 bộ kiểm thử bao phủ toàn bộ các tầng ứng dụng (Unit Tests và Integration Tests):

```bash
npm test
```

Kết quả kỳ vọng: **100% bộ kiểm thử (8 test suites, 61 tests) vượt qua thành công**.

Để xuất báo cáo độ bao phủ mã nguồn (Coverage Report):

```bash
npm run test:coverage
```

### 6.2 Kiểm Thử Endpoint Bằng cURL

#### Kiểm Tra Sức Khỏe Máy Chủ (Health Check)
```bash
curl -X GET http://localhost:3000/health
```
Phản hồi mẫu:
```json
{
  "status": "ok",
  "service": "tich-hop-jotform-bitrix24",
  "uptime": 12.45,
  "timestamp": "2026-09-16T10:00:00.000Z",
  "env": "development",
  "config": {
    "port": 3000,
    "bitrixWebhookConfigured": true,
    "jotformFormId": "262582117734055",
    "dnsServers": ["8.8.8.8", "1.1.1.1"]
  }
}
```

#### Gửi Webhook Mẫu Định Dạng JSON
```bash
curl -X POST http://localhost:3000/webhook/jotform \
  -H "Content-Type: application/json" \
  -d "{\"q3_name\":{\"first\":\"Minh\",\"last\":\"Tran\"},\"q4_email\":\"minh.tran@example.com\",\"q5_phoneNumber\":\"0901234567\",\"submission_id\":\"sub_1001\"}"
```
Phản hồi thành công:
```json
{
  "success": true,
  "message": "Contact created successfully in Bitrix24 CRM",
  "data": {
    "contactId": 17,
    "normalized": {
      "name": "Minh",
      "lastName": "Tran",
      "email": "minh.tran@example.com",
      "phone": "0901234567",
      "submissionId": "sub_1001"
    }
  },
  "timestamp": "2026-09-16T10:00:01.250Z"
}
```

#### Gửi Webhook Mẫu Định Dạng Multipart Form-Data (Giống cách Jotform gửi)
```bash
curl -X POST http://localhost:3000/webhook/jotform \
  -F "rawRequest={\"q3_name\":\"Nguyễn Văn An\",\"q4_email\":\"an.nguyen@example.com\",\"q5_phoneNumber\":{\"full\":\"+84909112233\"},\"submission_id\":\"sub_2002\"}"
```

#### Thử Nghiệm Từ Chối Dữ Liệu Sai (Validation Error)
```bash
curl -X POST http://localhost:3000/webhook/jotform \
  -H "Content-Type: application/json" \
  -d "{\"q3_name\":\"\",\"q4_email\":\"invalid-email-address\",\"q5_phoneNumber\":\"123\"}"
```
Phản hồi HTTP 400 Bad Request:
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    "Name is required and must not be empty",
    "Invalid email format according to RFC 5322: \"invalid-email-address\"",
    "Invalid phone number format (must contain 9-15 digits): \"123\""
  ],
  "timestamp": "2026-09-16T10:00:02.100Z"
}
```

---

## 7. Xử Lý Ngoại Lệ & Bền Vững Hạ Tầng (Reliability & Fault Tolerance)

- **DNS Fallback Mechanics**: Trong môi trường mạng tại Việt Nam, một số ISP có thể phân giải lỗi tên miền `api.jotform.com` dẫn tới mã lỗi `ENOTFOUND`. Ứng dụng tích hợp bộ phân giải `createResilientLookup` sẽ tự động chuyển hướng qua Google DNS `8.8.8.8` và Cloudflare `1.1.1.1` khi có sự cố, đảm bảo kết nối luôn thông suốt mà không cần can thiệp cấu hình máy chủ cục bộ.
- **Phòng Ngừa Bản Ghi Rác Trên Bitrix24**: Bitrix24 REST API có cơ chế tự động tạo Contact rác ("Liên lạc với #id") nếu nhận dữ liệu trống. Tầng xác thực dữ liệu `validator.ts` ngăn chặn triệt để điều này bằng cách trả về mã lỗi 400 kèm thông báo chi tiết ngay tại máy chủ trung gian.
- **Bảo Vệ Đa Luồng**: Mọi lỗi kết nối mạng từ Bitrix24 hoặc Jotform đều được đóng gói thành các lỗi chuẩn (HTTP 502/504) và ghi nhận với dấu thời gian ISO 8601, bảo vệ tiến trình Node.js không bao giờ bị dừng đột ngột.
