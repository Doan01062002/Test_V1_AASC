import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { Bitrix24Module } from '../bitrix24/bitrix24.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    Bitrix24Module,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
