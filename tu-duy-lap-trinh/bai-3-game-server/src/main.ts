import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('GameServer');
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`🎮 Game Server đã khởi động tại: http://localhost:${port}`);
  logger.log(`🌐 Giao diện Web Game sẵn sàng tại: http://localhost:${port}`);
  logger.log(`🔌 WebSocket Gateway đã mở và lắng nghe các kết nối thời gian thực.`);
}

bootstrap();
