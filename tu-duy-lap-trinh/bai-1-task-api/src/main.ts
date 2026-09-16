import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Bật CORS cho phép gọi từ nhiều client
  app.enableCors();

  // Kích hoạt ValidationPipe toàn cục để kiểm tra dữ liệu đầu vào bằng DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Loại bỏ các trường không được định nghĩa trong DTO
      forbidNonWhitelisted: true, // Báo lỗi nếu client gửi trường lạ
      transform: true, // Tự động chuyển đổi kiểu dữ liệu tương ứng DTO
    }),
  );

  // Cấu hình tài liệu hóa Swagger (OpenAPI) tại endpoint /docs
  const config = new DocumentBuilder()
    .setTitle('Task Management API - NestJS')
    .setDescription(
      'API RESTful quản lý công việc (Task) với NestJS, TypeORM và SQLite theo mô hình MVC.\n' +
        'Bài kiểm tra năng lực về tư duy lập trình (Bài 1).',
    )
    .setVersion('1.0')
    .addTag('tasks', 'Các thao tác CRUD quản lý thực thể Task')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 Ứng dụng Task API đang chạy tại: http://localhost:${port}`);
  logger.log(`📚 Tài liệu Swagger (OpenAPI) truy cập tại: http://localhost:${port}/docs`);
}

bootstrap();
