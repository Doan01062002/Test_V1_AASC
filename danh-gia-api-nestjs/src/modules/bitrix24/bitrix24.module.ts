import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BitrixToken } from '../../database/entities/bitrix-token.entity';
import { Bitrix24Service } from './bitrix24.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BitrixToken]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  providers: [Bitrix24Service],
  exports: [Bitrix24Service],
})
export class Bitrix24Module {}
