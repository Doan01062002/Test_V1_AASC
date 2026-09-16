import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { BitrixToken } from './entities/bitrix-token.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbPath =
          configService.get<string>('DATABASE_PATH') ||
          configService.get<string>('databasePath') ||
          process.env.DATABASE_PATH ||
          'data/bitrix24.sqlite';

        const dir = path.dirname(path.resolve(dbPath));
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        return {
          type: 'sqlite',
          database: dbPath,
          entities: [BitrixToken],
          synchronize: true,
          logging: ['error', 'warn'],
        };
      },
    }),
    TypeOrmModule.forFeature([BitrixToken]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
