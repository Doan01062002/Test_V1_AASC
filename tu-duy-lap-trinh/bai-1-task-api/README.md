# Bài 1: RESTful API Quản Lý Task Với NestJS

Dự án này triển khai toàn bộ yêu cầu của **Bài 1: Nghiên cứu và Triển khai API với NestJS** theo mô hình kiến trúc MVC, tích hợp TypeORM với SQLite, tài liệu hóa Swagger tại `/docs`, xác thực dữ liệu qua Validation Pipes và kiểm thử tự động với Jest.

---

## 1. Cấu Trúc Dự Án (Mô hình MVC)

```text
src/
├── tasks/
│   ├── dto/
│   │   ├── create-task.dto.ts      # Xác thực dữ liệu đầu vào khi tạo task bằng Pipes
│   │   └── update-task.dto.ts      # DTO cập nhật task (kế thừa PartialType)
│   ├── entities/
│   │   └── task.entity.ts          # [Model]: Entity ánh xạ vào bảng SQLite
│   ├── tasks.controller.ts         # [Controller]: Xử lý HTTP requests & Swagger tags
│   ├── tasks.service.ts            # [Service]: Nghiệp vụ CRUD & tương tác Repository
│   ├── tasks.module.ts             # Đóng gói module tasks
│   └── tasks.service.spec.ts       # Unit tests với Jest
├── app.module.ts                   # Root module, cấu hình SQLite TypeORM
└── main.ts                         # Bootstrap, toàn cục ValidationPipe & Swagger /docs
benchmark/
└── test-performance.js             # Kịch bản kiểm thử hiệu năng với 100 bản ghi (< 200ms)
BaoCao_NestJS_LyThuyet.md           # Báo cáo lý thuyết về Modules, Controllers, Services & TypeScript
```

---

## 2. Hướng Dẫn Cài Đặt và Khởi Chạy

### Yêu cầu môi trường:
- Node.js version >= 18 (Đã kiểm thử mượt mà trên Node v24.18.0)
- npm version >= 9

### Các bước thực hiện:

1. **Cài đặt các thư viện phụ thuộc:**
   ```bash
   cd tu-duy-lap-trinh/bai-1-task-api
   npm install
   ```

2. **Khởi chạy ứng dụng:**
   ```bash
   # Chế độ phát triển (Development / Watch mode)
   npm run start:dev

   # Hoặc biên dịch và chạy bản build (Production)
   npm run build
   npm run start:prod
   ```

3. **Truy cập tài liệu API Swagger (OpenAPI):**
   - Mở trình duyệt và truy cập: [http://localhost:3000/docs](http://localhost:3000/docs)
   - Tại giao diện Swagger UI, bạn có thể xem đầy đủ schema của Entity `Task`, các DTOs và thử nghiệm trực tiếp (Try it out) các API CRUD:
     - `POST /tasks`: Tạo task mới (yêu cầu `title`, có thể truyền `description` và `status`).
     - `GET /tasks`: Lấy danh sách task (hỗ trợ query param `?status=Done`).
     - `GET /tasks/{id}`: Lấy chi tiết task theo UUID.
     - `PATCH /tasks/{id}`: Cập nhật task theo UUID.
     - `DELETE /tasks/{id}`: Xóa task theo UUID.
     - `POST /tasks/seed`: Nạp 100 bản ghi mẫu để kiểm thử hiệu năng.

---

## 3. Chạy Unit Test (Jest)

Kịch bản unit test kiểm tra toàn diện nghiệp vụ của `TasksService` (Mock TypeORM Repository, kiểm tra tạo, lấy danh sách, lấy theo ID, bắt lỗi `NotFoundException`, cập nhật, xóa và nạp dữ liệu mẫu):

```bash
npm test
```

**Kết quả chạy test thực tế:**
```text
PASS src/tasks/tasks.service.spec.ts
PASS src/tasks/tasks.controller.spec.ts

Test Suites: 2 passed, 2 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Coverage:    100% Statements, 100% Branches, 100% Functions, 100% Lines
```

---

## 4. Kiểm Thử Hiệu Năng (< 200ms với 100 bản ghi)

Chạy kịch bản benchmark tự động nạp 100 bản ghi vào database SQLite và thực hiện 10 lần yêu cầu `GET /tasks` liên tiếp để đo độ trễ:

```bash
npm run benchmark
```

**Kết quả kiểm thử thực tế:**
- Thời gian phản hồi nhanh nhất (Min): **6.88 ms**
- Thời gian phản hồi chậm nhất (Max): **19.64 ms**
- Thời gian phản hồi trung bình (Avg): **12.58 ms**
- **Đánh giá**: Vượt xa tiêu chuẩn đề bài yêu cầu (< 200ms), phản hồi chỉ trong ~12ms.
