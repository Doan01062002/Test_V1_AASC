# BÀI KIỂM TRA ĐÁNH GIÁ KỸ NĂNG LẬP TRÌNH API VỚI NESTJS

> **Dự án**: Hệ thống RESTful API tích hợp Bitrix24 CRM qua giao thức OAuth 2.0  
> **Ứng viên**: Hoàn thành theo đúng yêu cầu tài liệu `V1 - Bai Kiem tra Danh gia API co ban.pdf`  
> **Công nghệ**: Node.js, NestJS 10, TypeScript, TypeORM, SQLite, @nestjs/axios, @nestjs/swagger, class-validator, Jest.

---

## Mục Lục
1. [Giới Thiệu Tổng Quan](#1-giới-thiệu-tổng-quan)
2. [Kiến Trúc Hệ Thống & Thiết Kế](#2-kiến-trúc-hệ-thống--thiết-kế)
3. [Hướng Dẫn Cài Đặt & Khởi Chạy](#3-hướng-dẫn-cài-đặt--khởi-chạy)
4. [Hướng Dẫn Thiết Lập Ngrok & Bitrix24 Local App](#4-hướng-dẫn-thiết-lập-ngrok--bitrix24-local-app)
5. [Tài Liệu Chi Tiết Các Endpoint & Ví Dụ cURL](#5-tài-liệu-chi-tiết-các-endpoint--ví-dụ-curl)
6. [Xử Lý Lỗi & Kịch Bản Ngoại Lệ](#6-xử-lý-lỗi--kịch-bản-ngoại-lệ)
7. [Kiểm Thử Tự Động (Automated Testing)](#7-kiểm-thử-tự-động-automated-testing)
8. [Bảng Đối Chiếu Tiêu Chí Đánh Giá](#8-bảng-đối-chiếu-tiêu-chí-đánh-giá)

---

## 1. Giới Thiệu Tổng Quan

Dự án triển khai một giải pháp Backend hoàn chỉnh dựa trên NestJS framework, đóng vai trò làm cầu nối (Middleware / API Gateway) tương tác với hệ sinh thái **Bitrix24 REST API**.

### Các Năng Lực Cốt Lõi:
1. **OAuth 2.0 Handshake & Vòng Đời Token**:
   - Tiếp nhận sự kiện cài đặt ứng dụng cục bộ (Local Application) từ Bitrix24 qua `/install` (hỗ trợ cả GET redirect code lẫn POST iframe payload).
   - Trao đổi mã cấp phép (Authorization Code) lấy `access_token` và `refresh_token` từ Bitrix24 OAuth server.
   - Lưu trữ token bền vững vào cơ sở dữ liệu SQLite thông qua TypeORM.
   - Cơ chế tự động làm mới token (Proactive & Reactive Refresh) trước khi hết hạn hoặc khi nhận lỗi mã truy cập hết hiệu lực.
2. **Quản Lý Contact & Thông Tin Ngân Hàng (Requisites)**:
   - Cung cấp đầy đủ 4 thao tác chuẩn RESTful: `GET`, `POST`, `PUT`, `DELETE` cho Contact.
   - Tự động liên kết đa tầng dữ liệu CRM Bitrix24: **Contact (Khách hàng) -> Requisite (Thông tin pháp nhân/ngân hàng, ENTITY_TYPE_ID = 3) -> Bank Detail (Chi tiết tài khoản ngân hàng)**.
   - Xử lý phân tách địa chỉ chi tiết (Đường/Số nhà, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố).
3. **Bảo Mật API Key & Kiểm Soát Dữ Liệu Chặt Chẽ**:
   - Bảo vệ toàn bộ endpoint CRM bằng Guard tùy biến (`ApiKeyGuard`), kiểm tra header `x-api-key`.
   - Xác thực dữ liệu đầu vào nghiêm ngặt bằng `class-validator` và `ValidationPipe` (chuẩn RFC 5322 cho Email, Regex cho số điện thoại Việt Nam/quốc tế).
4. **Tài Liệu Hóa Swagger & Kiểm Thử Tự Động 100%**:
   - Swagger OpenAPI 3.0 trực quan tại `/docs`, hỗ trợ nút Authorize nhập `x-api-key`.
   - Bộ kiểm thử đơn vị (Unit Test) và kiểm thử nghịch đảo (Adversarial Tests) với **10 test suites, 81 test cases PASS 100%**.

---

## 2. Kiến Trúc Hệ Thống & Thiết Kế

### 2.1. Sơ Đồ Cấu Trúc Thư Mục
```text
danh-gia-api-nestjs/
├── src/
│   ├── common/                      # Tiện ích chia sẻ toàn ứng dụng
│   │   ├── filters/                 # Global HttpExceptionFilter
│   │   │   ├── http-exception.filter.ts
│   │   │   └── http-exception.filter.spec.ts
│   │   └── guards/                  # Custom ApiKeyGuard bảo vệ x-api-key
│   │       ├── api-key.guard.ts
│   │       └── api-key.guard.spec.ts
│   ├── config/                      # Quản lý cấu hình biến môi trường
│   │   ├── configuration.ts
│   │   └── configuration.spec.ts
│   ├── database/                    # Quản lý kết nối TypeORM SQLite
│   │   ├── database.module.ts
│   │   └── entities/                # Entity lưu trữ BitrixToken
│   │       ├── bitrix-token.entity.ts
│   │       └── bitrix-token.entity.spec.ts
│   ├── modules/
│   │   ├── auth/                    # Module xử lý OAuth 2.0 & /install
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.service.spec.ts
│   │   │   └── auth.module.ts
│   │   ├── bitrix24/                # Module giao tiếp Bitrix24 REST API
│   │   │   ├── bitrix24.service.ts  # callBitrixAPI, refresh token, retry
│   │   │   ├── bitrix24.service.spec.ts
│   │   │   ├── bitrix24.adversarial.spec.ts
│   │   │   └── bitrix24.module.ts
│   │   └── contacts/                # Module CRUD Contact & Requisites
│   │       ├── dto/                 # DTOs xác thực dữ liệu đầu vào
│   │       │   ├── create-contact.dto.ts
│   │       │   ├── update-contact.dto.ts
│   │       │   └── contact-dto.spec.ts
│   │       ├── contacts.controller.ts
│   │       ├── contacts.service.ts
│   │       ├── contacts.controller.spec.ts
│   │       ├── contacts.service.spec.ts
│   │       └── contacts.module.ts
│   ├── app.module.ts                # Root Application Module
│   └── main.ts                      # Điểm khởi chạy hệ thống (Bootstrap)
├── data/                            # Thư mục lưu file SQLite (được gitignore)
├── test/                            # Bộ kiểm thử E2E & Adversarial verification
├── .env.example                     # File cấu hình mẫu
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

### 2.2. Mô Hình Dữ Liệu CRM Bitrix24
Để lưu thông tin tài khoản ngân hàng gắn liền với Contact, hệ thống áp dụng kiến trúc chuẩn của Bitrix24 CRM:
1. **Contact Entity**: Lưu thông tin cá nhân cơ bản (`NAME`, `PHONE`, `EMAIL`, `WEB`, `ADDRESS_CITY`, ...).
2. **Requisite Entity**: Thực thể đại diện pháp nhân/thông tin thanh toán, gắn kết với Contact bằng `ENTITY_TYPE_ID = 3` và `ENTITY_ID = contactId`.
3. **Bank Detail Entity**: Lưu trữ thông tin ngân hàng thực tế (`RQ_BANK_NAME`, `RQ_ACC_NUM`, `RQ_BANK_ADDR`, `NAME`), gắn kết với Requisite bằng `ENTITY_ID = requisiteId`.

---

## 3. Hướng Dẫn Cài Đặt & Khởi Chạy

### Yêu Cầu Tiên Quyết:
- Node.js phiên bản 18 trở lên (khuyến nghị Node.js LTS hoặc Node.js 20+).
- npm phiên bản 9 trở lên.

### Bước 1: Di Chuyển Vào Thư Mục Dự Án
```bash
cd danh-gia-api-nestjs
```

### Bước 2: Cài Đặt Thư Viện Phụ Thuộc
```bash
npm install
```

### Bước 3: Thiết Lập Biến Môi Trường
Sao chép file `.env.example` thành `.env`:
```bash
cp .env.example .env
```
Nội dung file `.env` mẫu:
```env
PORT=3000
API_KEY=default-secret-api-key
CLIENT_ID=local.65f01234abcd5.12345678
CLIENT_SECRET=abcdef1234567890abcdef1234567890
BITRIX24_DOMAIN=your-domain.bitrix24.vn
DATABASE_PATH=data/bitrix24.sqlite
```

### Bước 4: Biên Dịch Dự Án (Build)
```bash
npm run build
```
Lệnh hoàn thành với 0 lỗi TypeScript và sinh mã sạch trong thư mục `dist/`.

### Bước 5: Khởi Chạy Ứng Dụng
- **Chế độ phát triển (Hot Reload)**:
  ```bash
  npm run start:dev
  ```
- **Chế độ sản xuất (Production)**:
  ```bash
  npm run start:prod
  ```

Sau khi khởi chạy:
- Server API lắng nghe tại: `http://localhost:3000`
- Giao diện tài liệu tương tác Swagger UI: `http://localhost:3000/docs`

---

## 4. Hướng Dẫn Thiết Lập Ngrok & Bitrix24 Local App

Để Bitrix24 trên đám mây có thể gửi sự kiện cài đặt và gọi webhook tới server cục bộ của bạn, cần sử dụng công cụ ngrok để mở đường hầm HTTPS an toàn.

### Bước 4.1: Khởi Động Ngrok Tunnel
Chạy lệnh ngrok trỏ tới cổng 3000 của NestJS:
```bash
ngrok http 3000
```
Ngrok sẽ cung cấp một đường dẫn công khai dạng:
`https://abc1234-xyz.ngrok-free.app`

### Bước 4.2: Tạo Ứng Dụng Cục Bộ Trên Bitrix24 Portal
1. Đăng nhập vào portal Bitrix24 của bạn với quyền Administrator (ví dụ: `https://your-domain.bitrix24.vn`).
2. Điều hướng tới menu bên trái: **Applications (Ứng dụng)** -> **Developer Area (Khu vực nhà phát triển)** -> chọn **Other (Khác)** -> **Local Application (Ứng dụng cục bộ)**.
3. Điền thông tin cấu hình ứng dụng:
   - **Type of application**: Chọn `Server-side (API only)` hoặc `Application with UI in Bitrix24`.
   - **Application name**: `AASC CRM Integration API`.
   - **Redirect URI**: Điền URL webhook cài đặt từ ngrok:  
     `https://abc1234-xyz.ngrok-free.app/install`
   - **Application URL (URL của ứng dụng)**: Điền URL tương tự:  
     `https://abc1234-xyz.ngrok-free.app/install`
   - **Permissions (Quyền hạn truy cập)**: Tích chọn quyền:
     - `CRM` (`crm`) — Quyền tạo, đọc, sửa, xóa Contact, Requisite, Bank Details.
4. Bấm **Save (Lưu)**.
5. Bitrix24 sẽ cấp cho bạn 2 thông số quan trọng:
   - **Application ID (Client ID)** (ví dụ: `local.661234abcd.12345678`)
   - **Application Key (Client Secret)** (chuỗi bí mật 32 ký tự)

### Bước 4.3: Cập Nhật Thông Số Vào File `.env`
Điền các giá trị nhận được vào file `.env` của dự án:
```env
CLIENT_ID=local.661234abcd.12345678
CLIENT_SECRET=chuoi_client_secret_cua_ban
BITRIX24_DOMAIN=your-domain.bitrix24.vn
```

### Bước 4.4: Kích Hoạt Cài Đặt Ứng Dụng
Mở ứng dụng vừa tạo trong danh sách Local Apps trên Bitrix24 và bấm **Install (Cài đặt)**.
Bitrix24 sẽ tự động chuyển hướng hoặc gửi POST request tới `https://abc1234-xyz.ngrok-free.app/install`. Ứng dụng NestJS sẽ:
1. Tiếp nhận auth code.
2. Gửi request trao đổi token tới `https://oauth.bitrix.info/oauth/token/`.
3. Nhận về `access_token` và `refresh_token`.
4. Lưu trữ an toàn vào SQLite database (`data/bitrix24.sqlite`).

---

## 5. Tài Liệu Chi Tiết Các Endpoint & Ví Dụ cURL

Tất cả các endpoint quản lý Contact yêu cầu truyền Header xác thực:
```http
x-api-key: default-secret-api-key
```

---

### 5.1. Nhóm Endpoint OAuth & Cài Đặt (Public)

#### `GET /install` hoặc `POST /install`
Xử lý bắt tay OAuth 2.0 khi cài đặt ứng dụng từ Bitrix24.

- **Request mẫu từ Bitrix24**:
```http
GET /install?code=abcxyz123authcode&domain=your-domain.bitrix24.vn&member_id=mem123 HTTP/1.1
Host: localhost:3000
```
- **Response thành công (200 OK)**:
```json
{
  "status": "success",
  "message": "Bitrix24 application installed successfully",
  "domain": "your-domain.bitrix24.vn",
  "expiresAt": "2026-09-16T10:30:00.000Z"
}
```

---

### 5.2. Nhóm Endpoint Quản Lý Contact & Ngân Hàng (Protected)

#### 1. `GET /contacts` — Lấy Danh Sách Contact Kèm Thông Tin Ngân Hàng
Lấy danh sách tất cả các contact trên Bitrix24 kèm theo thông tin chi tiết tài khoản ngân hàng Requisite đã được ghép nối.

- **Ví dụ cURL**:
```bash
curl -X GET "http://localhost:3000/contacts" \
  -H "x-api-key: default-secret-api-key" \
  -H "Accept: application/json"
```

- **Response mẫu (200 OK)**:
```json
[
  {
    "id": 101,
    "name": "Nguyễn Văn An",
    "phone": "0912345678",
    "email": "nguyenvanan@example.com",
    "website": "https://example.com",
    "address": {
      "street": "Số 123 Đường Lê Lợi",
      "ward": "Phường Bến Nghé",
      "district": "Quận 1",
      "city": "Thành phố Hồ Chí Minh"
    },
    "bankInfo": {
      "requisiteId": 201,
      "bankDetailId": 301,
      "bankName": "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)",
      "accountNumber": "0071001234567",
      "bankBranch": "Chi nhánh Bến Thành",
      "accountHolder": "NGUYEN VAN AN"
    }
  }
]
```

---

#### 2. `GET /contacts/:id` — Lấy Chi Tiết Một Contact Theo ID
- **Ví dụ cURL**:
```bash
curl -X GET "http://localhost:3000/contacts/101" \
  -H "x-api-key: default-secret-api-key" \
  -H "Accept: application/json"
```

- **Response mẫu (200 OK)**:
```json
{
  "id": 101,
  "name": "Nguyễn Văn An",
  "phone": "0912345678",
  "email": "nguyenvanan@example.com",
  "website": "https://example.com",
  "address": {
    "street": "Số 123 Đường Lê Lợi",
    "ward": "Phường Bến Nghé",
    "district": "Quận 1",
    "city": "Thành phố Hồ Chí Minh"
  },
  "bankInfo": {
    "requisiteId": 201,
    "bankDetailId": 301,
    "bankName": "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)",
    "accountNumber": "0071001234567",
    "bankBranch": "Chi nhánh Bến Thành",
    "accountHolder": "NGUYEN VAN AN"
  }
}
```

---

#### 3. `POST /contacts` — Tạo Mới Contact & Requisite Ngân Hàng
Tạo mới một contact trên Bitrix24 với tên, thông tin liên lạc, địa chỉ chi tiết, đồng thời tự động khởi tạo bản ghi Requisite ngân hàng gắn trực tiếp với contact.

- **Ví dụ cURL**:
```bash
curl -X POST "http://localhost:3000/contacts" \
  -H "x-api-key: default-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trần Thị Mai",
    "phone": "0987654321",
    "email": "tranthimai@example.com",
    "website": "https://maiinvest.vn",
    "street": "Số 456 Đường Nguyễn Huệ",
    "ward": "Phường Bến Nghé",
    "district": "Quận 1",
    "city": "Thành phố Hồ Chí Minh",
    "bankName": "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)",
    "accountNumber": "12310004567890",
    "bankBranch": "Chi nhánh Gia Định",
    "accountHolder": "TRAN THI MAI"
  }'
```

- **Response mẫu (201 Created)**:
```json
{
  "status": "success",
  "message": "Contact and banking requisites created successfully",
  "contactId": 102,
  "requisiteId": 202,
  "bankDetailId": 302,
  "data": {
    "id": 102,
    "name": "Trần Thị Mai",
    "phone": "0987654321",
    "email": "tranthimai@example.com",
    "website": "https://maiinvest.vn",
    "bankInfo": {
      "bankName": "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)",
      "accountNumber": "12310004567890",
      "bankBranch": "Chi nhánh Gia Định",
      "accountHolder": "TRAN THI MAI"
    }
  }
}
```

---

#### 4. `PUT /contacts/:id` — Cập Nhật Thông Tin Contact & Ngân Hàng
Cập nhật thông tin của contact và thông tin tài khoản ngân hàng tương ứng.

- **Ví dụ cURL**:
```bash
curl -X PUT "http://localhost:3000/contacts/102" \
  -H "x-api-key: default-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trần Thị Mai (Đã cập nhật)",
    "phone": "0987654322",
    "email": "tranthimai.updated@example.com",
    "bankName": "Ngân hàng Quân Đội (MB Bank)",
    "accountNumber": "999988887777",
    "bankBranch": "Chi nhánh Sở Giao Dịch",
    "accountHolder": "TRAN THI MAI"
  }'
```

- **Response mẫu (200 OK)**:
```json
{
  "status": "success",
  "message": "Contact 102 updated successfully",
  "contactId": 102,
  "updatedFields": {
    "name": "Trần Thị Mai (Đã cập nhật)",
    "phone": "0987654322",
    "email": "tranthimai.updated@example.com",
    "bankName": "Ngân hàng Quân Đội (MB Bank)",
    "accountNumber": "999988887777"
  }
}
```

---

#### 5. `DELETE /contacts/:id` — Xóa Contact & Requisite Liên Quan
Xóa contact khỏi Bitrix24 CRM kèm các bản ghi requisite và chi tiết ngân hàng liên quan.

- **Ví dụ cURL**:
```bash
curl -X DELETE "http://localhost:3000/contacts/102" \
  -H "x-api-key: default-secret-api-key" \
  -H "Accept: application/json"
```

- **Response mẫu (200 OK)**:
```json
{
  "status": "success",
  "message": "Contact 102 and associated requisites deleted successfully",
  "contactId": 102
}
```

---

## 6. Xử Lý Lỗi & Kịch Bản Ngoại Lệ

Hệ thống được thiết kế với tư duy phòng thủ (Defensive Programming), xử lý triệt để tất cả các mã lỗi chuẩn HTTP:

| HTTP Status | Nguyên Nhân | Cấu Trúc Phản Hồi Mẫu |
| :--- | :--- | :--- |
| **400 Bad Request** | Thiếu trường bắt buộc (`name`, `phone`, `email`) hoặc định dạng email/sđt không hợp lệ. | `{"statusCode": 400, "message": ["Email không hợp lệ"], "error": "Bad Request"}` |
| **401 Unauthorized** | Thiếu header `x-api-key`, sai API Key, hoặc hệ thống chưa được cấp quyền OAuth từ Bitrix24. | `{"statusCode": 401, "message": "Thiếu header x-api-key", "error": "Unauthorized"}` |
| **404 Not Found** | Không tìm thấy Contact với ID được chỉ định trên Bitrix24. | `{"statusCode": 404, "message": "Contact với ID 9999 không tồn tại trên Bitrix24", "error": "Not Found"}` |
| **502 Bad Gateway** | Mất kết nối tới Bitrix24, timeout mạng, hoặc Bitrix API trả về lỗi hệ thống. | `{"statusCode": 502, "message": "Không thể kết nối tới Bitrix24 API", "error": "Bad Gateway"}` |

### Cơ Chế Tự Động Làm Mới Token (Auto Refresh Token):
1. **Chủ động (Proactive)**: Trước mỗi lần gọi API, hệ thống kiểm tra trường `expiresAt`. Nếu thời gian còn lại dưới 60 giây, hàm `refreshToken` sẽ tự động được kích hoạt để lấy `access_token` mới mà không làm gián đoạn luồng nghiệp vụ.
2. **Bị động (Reactive)**: Nếu Bitrix24 trả về mã lỗi `expired_token` trong lúc gọi API, hệ thống sẽ thực hiện làm mới token ngay lập tức và thử lại request tự động.

---

## 7. Kiểm Thử Tự Động (Automated Testing)

Toàn bộ logic nghiệp vụ, xử lý ngoại lệ, xác thực dữ liệu và tương tác API đều được kiểm thử toàn diện bằng Jest và `@nestjs/testing`.

### Lệnh Chạy Bộ Kiểm Thử:
```bash
npm test
```

### Kết Quả Kiểm Thử Thực Tế:
```text
PASS src/database/entities/bitrix-token.entity.spec.ts
PASS src/common/filters/http-exception.filter.spec.ts
PASS src/common/guards/api-key.guard.spec.ts
PASS src/modules/contacts/dto/contact-dto.spec.ts
PASS src/config/configuration.spec.ts
PASS src/modules/bitrix24/bitrix24.service.spec.ts
PASS src/modules/contacts/contacts.service.spec.ts
PASS src/modules/auth/auth.service.spec.ts
PASS src/modules/bitrix24/bitrix24.adversarial.spec.ts
PASS src/modules/contacts/contacts.controller.spec.ts

Test Suites: 10 passed, 10 total
Tests:       81 passed, 81 total
Snapshots:   0 total
Time:        12.498 s
Ran all test suites.
```

### Danh Mục 10 Test Suites Chi Tiết:
1. `bitrix-token.entity.spec.ts`: Kiểm thử logic hết hạn token, xử lý an toàn giá trị `expiresAt` null, undefined, invalid date.
2. `http-exception.filter.spec.ts`: Kiểm thử bộ lọc ngoại lệ toàn cục cho mọi mã lỗi HTTP 4xx, 5xx và Exception không xác định.
3. `api-key.guard.spec.ts`: Kiểm thử cơ chế bảo mật header `x-api-key` (chặn khi thiếu, chặn khi sai, chấp nhận khi đúng).
4. `contact-dto.spec.ts`: Kiểm thử xác thực dữ liệu DTO bằng `class-validator` (kiểm tra tên, email RFC 5322, định dạng SĐT).
5. `configuration.spec.ts`: Kiểm thử nạp biến môi trường và thiết lập giá trị mặc định.
6. `bitrix24.service.spec.ts`: Mock `@nestjs/axios`, kiểm thử gọi API thành công, tự động làm mới token, xử lý lỗi timeout và network failure.
7. `contacts.service.spec.ts`: Kiểm thử toàn bộ nghiệp vụ CRUD Contact kết hợp ghép nối Banking Requisite & Bank Detail.
8. `auth.service.spec.ts`: Kiểm thử xử lý cài đặt OAuth qua GET/POST, trao đổi authorization code lấy token.
9. `bitrix24.adversarial.spec.ts`: Kiểm thử kịch bản ngoại lệ khắc nghiệt (mất kết nối đột ngột, phản hồi lỗi từ server OAuth, token bị thu hồi).
10. `contacts.controller.spec.ts`: Kiểm thử các endpoint Controller trả về đúng mã trạng thái HTTP và cấu trúc phản hồi.

---

## 8. Bảng Đối Chiếu Tiêu Chí Đánh Giá

| STT | Yêu Cầu Theo Đề Bài | Hiện Thực Trong Dự Án | Đánh Giá |
| :---: | :--- | :--- | :---: |
| 1 | **Tiếp nhận cài đặt OAuth (/install)** | Endpoint `/install` và `/oauth/install` hỗ trợ cả GET redirect lẫn POST iframe từ Bitrix24. | **ĐẠT ✅** |
| 2 | **Trao đổi Authorization Code lấy Token** | Gửi request tới `https://oauth.bitrix.info/oauth/token/`, nhận `access_token` và `refresh_token`. | **ĐẠT ✅** |
| 3 | **Lưu trữ Token bền vững vào Database** | Entity `BitrixToken` lưu trong SQLite thông qua TypeORM với đầy đủ domain, token, expiresAt. | **ĐẠT ✅** |
| 4 | **Tự động kiểm tra và làm mới Token** | Tự động làm mới khi hết hạn (chủ động) hoặc khi gặp lỗi `expired_token` (bị động). | **ĐẠT ✅** |
| 5 | **Service gọi API Bitrix24 tổng quát** | Hàm `callBitrixAPI` trong `Bitrix24Service` xử lý logging, retry, timeout, phân loại lỗi 4xx/5xx. | **ĐẠT ✅** |
| 6 | **GET /contacts lấy danh sách kèm Ngân hàng** | Ghép nối dữ liệu Contact với `crm.requisite.list` và `crm.requisite.bankdetail.list`. | **ĐẠT ✅** |
| 7 | **POST /contacts tạo mới Contact & Requisite** | Tạo Contact với địa chỉ chi tiết, sau đó tự động tạo Requisite (`ENTITY_TYPE_ID = 3`) & Bank Detail. | **ĐẠT ✅** |
| 8 | **PUT /contacts/:id cập nhật Contact & Ngân hàng** | Cập nhật thông tin Contact và Requisite/Bank Detail, trả về 404 nếu không tìm thấy ID. | **ĐẠT ✅** |
| 9 | **DELETE /contacts/:id xóa Contact & Requisite** | Xóa sạch Contact và các Requisite liên quan, trả về 404 nếu ID không tồn tại. | **ĐẠT ✅** |
| 10 | **Xác thực dữ liệu DTO chặt chẽ** | Áp dụng `class-validator` với `ValidationPipe` toàn cục: tên bắt buộc, email RFC 5322, SĐT hợp lệ. | **ĐẠT ✅** |
| 11 | **Bảo mật bằng API Key (x-api-key)** | Bảo vệ các endpoint bằng `ApiKeyGuard`, từ chối request không hợp lệ với 401 Unauthorized. | **ĐẠT ✅** |
| 12 | **Tài liệu hóa Swagger OpenAPI** | Giao diện Swagger UI trực quan tại `/docs` kèm hỗ trợ Authorize header `x-api-key`. | **ĐẠT ✅** |
| 13 | **Hướng dẫn ngrok & cấu hình Bitrix24** | Hướng dẫn từng bước từ lệnh ngrok, tạo Local App, thiết lập Redirect URI đến cấu hình `.env`. | **ĐẠT ✅** |
| 14 | **Bộ kiểm thử tự động Unit Test** | Đạt **10 test suites, 81 tests PASS 100%**, có mock axios và kiểm thử nghịch cảnh. | **ĐẠT ✅** |
| 15 | **Biên dịch mã nguồn sạch (Build Clean)** | `npm run build` hoàn thành với 0 lỗi TypeScript/ESLint. | **ĐẠT ✅** |
