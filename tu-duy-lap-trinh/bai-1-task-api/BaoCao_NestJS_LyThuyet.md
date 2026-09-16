# Báo Cáo Lý Thuyết: Nghiên Cứu và Hiểu Biết về NestJS

Bài kiểm tra: **Bài 1: Nghiên cứu và Triển khai API với NestJS**  
Phần 1: **Hiểu biết về NestJS**

---

## 1. Vai Trò Của Các Thành Phần Chính Trong NestJS

NestJS là một framework Node.js tiến bộ (progressive framework) được thiết kế theo kiến trúc module hóa chặt chẽ, lấy cảm hứng từ kiến trúc của Angular và áp dụng sâu sắc các nguyên lý thiết kế phần mềm như **Dependency Injection (DI)**, **Inversion of Control (IoC)**, và **Separation of Concerns (SoC)**.

Ba thành phần rường cột tạo nên kiến trúc cốt lõi của NestJS bao gồm:

```
┌────────────────────────────────────────────────────────┐
│                      Client                            │
└──────────────────────────┬─────────────────────────────┘
                           │  HTTP Request
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Controllers                          │
│  - Tiếp nhận Request & định tuyến (Routing)             │
│  - Chuyển giao dữ liệu vào Pipes để Validate            │
│  - Gọi Service tương ứng và trả về HTTP Response        │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                     Services                           │
│  - Chứa toàn bộ Business Logic (Nghiệp vụ cốt lõi)     │
│  - Xử lý tính toán, tương tác với Database/Repository  │
│  - Được đánh dấu là @Injectable()                      │
└──────────────────────────▲─────────────────────────────┘
                           │
       Quản lý DI Scope & Đóng gói tính năng
                           │
┌──────────────────────────┴─────────────────────────────┐
│                     Modules                            │
│  - Đóng gói Controllers, Providers (Services)           │
│  - Export các Provider cần chia sẻ ra bên ngoài         │
│  - Import các Module phụ thuộc khác                    │
└────────────────────────────────────────────────────────┘
```

### 1.1. Modules (`@Module()`)
- **Vai trò**: Module là đơn vị tổ chức cơ bản của ứng dụng NestJS. Mỗi ứng dụng có ít nhất một **Root Module** (`AppModule`) và có thể có nhiều **Feature Modules** (ví dụ: `TasksModule`, `UsersModule`).
- **Nhiệm vụ chính**:
  - **Đóng gói (Encapsulation)**: Nhóm các thành phần có liên quan chặt chẽ về mặt nghiệp vụ lại với nhau.
  - **Quản lý ranh giới Dependency Injection**: Module khai báo rõ ràng các `controllers` thuộc về nó, các `providers` (services, repositories) được khởi tạo nội bộ, và các providers nào được `exports` để các module khác có thể tái sử dụng.
  - **Cấu hình**: Nhận các cấu hình bên ngoài thông qua dynamic modules (ví dụ: `TypeOrmModule.forRoot(...)`).

### 1.2. Controllers (`@Controller()`)
- **Vai trò**: Là tầng tiếp nhận và phản hồi các yêu cầu từ bên ngoài (HTTP Requests, WebSockets, gRPC, Microservices).
- **Nhiệm vụ chính**:
  - **Định tuyến (Routing)**: Ánh xạ các đường dẫn URL và phương thức HTTP (`@Get()`, `@Post()`, `@Patch()`, `@Delete()`) tới các hàm xử lý cụ thể.
  - **Xử lý đầu vào và đầu ra**: Nhận tham số từ request (Query params, Route params, Body, Headers) và trả về response tương ứng (mã trạng thái HTTP, JSON payload).
  - **Uỷ thác nghiệp vụ**: Controller **không chứa nghiệp vụ phức tạp**, mà chỉ đóng vai trò điều phối: nhận dữ liệu, kích hoạt Pipes để kiểm tra hợp lệ, gọi hàm tương ứng trong Service, và trả về kết quả.

### 1.3. Services (`@Injectable()`)
- **Vai trò**: Là nơi tập trung toàn bộ **Business Logic (Logic nghiệp vụ)** và thao tác với tầng dữ liệu (Data Access Layer / Repository).
- **Nhiệm vụ chính**:
  - **Thực thi nghiệp vụ**: Thực hiện các phép tính toán, xử lý ràng buộc dữ liệu, quy tắc logic (ví dụ: kiểm tra trùng lặp, hash mật khẩu, cập nhật trạng thái...).
  - **Tương tác với Database**: Truy vấn, lưu trữ, cập nhật, xóa dữ liệu qua ORM (TypeORM, Prisma) hoặc ODM (Mongoose).
  - **Tính tái sử dụng & Độc lập**: Service không quan tâm request đến từ đâu (HTTP API hay WebSocket hay CLI command). Nhờ cơ chế Dependency Injection, Service có thể dễ dàng được inject vào nhiều Controller khác nhau và cực kỳ thuận tiện cho việc viết **Unit Test** độc lập thông qua mock repositories.

---

## 2. Cách NestJS Sử Dụng TypeScript Để Hỗ Trợ Phát Triển Ứng Dụng

NestJS được xây dựng 100% bằng TypeScript và tận dụng triệt để những tính năng mạnh mẽ nhất của ngôn ngữ này:

### 2.1. Hệ thống Decorators và Metadata Reflection (`reflect-metadata`)
- NestJS sử dụng TypeScript Decorators ở khắp mọi nơi (`@Module`, `@Controller`, `@Injectable`, `@Get`, `@Post`, `@Body`, `@Param`, `@InjectRepository`...).
- TypeScript kết hợp với `emitDecoratorMetadata` cho phép NestJS đọc được kiểu dữ liệu (type) của các tham số constructor tại runtime. Nhờ đó, NestJS IoC Container có thể tự động phân giải (resolve) và tiêm (inject) các phụ thuộc (Dependencies) mà lập trình viên không cần phải khởi tạo thủ công bằng từ khóa `new`.

### 2.2. Type Safety và Interface / Types Rõ Ràng
- TypeScript cung cấp tính năng kiểm tra kiểu tĩnh (Static Type Checking) ngay tại thời điểm biên dịch (compile-time), giúp phát hiện hơn 80% lỗi tiềm ẩn liên quan đến gõ sai tên trường (typo), truyền thiếu tham số hoặc sai kiểu dữ liệu (`string` thay vì `number`).
- Định nghĩa rõ ràng các giao diện (`interfaces`), các kiểu dữ liệu trả về của hàm (`Promise<Task>`), giúp mã nguồn dễ hiểu, tự tài liệu hóa và IDE hỗ trợ autocomplete tuyệt đối.

### 2.3. Data Transfer Objects (DTO) kết hợp với Validation Pipes
- Trong NestJS, DTO được khai báo dưới dạng **TypeScript Class**.
- Khi kết hợp với các decorator của `class-validator` (như `@IsNotEmpty()`, `@IsString()`, `@IsEnum()`), NestJS sử dụng `ValidationPipe` toàn cục để tự động xác thực payload request gửi lên từ client. Nếu dữ liệu không hợp lệ, hệ thống tự động trả về HTTP 400 Bad Request kèm thông báo lỗi chi tiết mà không cần viết các câu lệnh `if-else` thủ công.

### 2.4. Tự động sinh tài liệu Swagger / OpenAPI
- Nhờ khả năng phân tích AST và reflection của TypeScript, thư viện `@nestjs/swagger` có thể tự động trích xuất các kiểu dữ liệu trong DTO và Entity để dựng nên tài liệu tương tác Swagger UI trực quan tại `/docs`, giảm thiểu tối đa công sức viết và duy trì tài liệu API thủ công.
