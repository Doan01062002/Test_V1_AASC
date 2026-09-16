import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable shutdown hooks for graceful termination
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Validation Pipe with strict transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Enable CORS
  app.enableCors();

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Bitrix24 RESTful API Integration')
    .setDescription(
      'Hệ thống RESTful API tích hợp Bitrix24 CRM qua OAuth 2.0, quản lý Contact và Requisites ngân hàng, bảo mật qua API Key (x-api-key).',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description:
          'Nhập API Key để xác thực các endpoint quản lý Contact (mặc định: default-secret-api-key)',
      },
      'x-api-key',
    )
    .addTag('Auth / OAuth', 'Quản lý cài đặt ứng dụng và vòng đời token OAuth 2.0')
    .addTag('Contacts', 'Quản lý thông tin Contact và Requisites ngân hàng trên Bitrix24 CRM')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Bitrix24 API Documentation - Swagger UI',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
  logger.log(`Server is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/docs`);
}
bootstrap();
