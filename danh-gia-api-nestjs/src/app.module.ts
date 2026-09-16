import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { Bitrix24Module } from './modules/bitrix24/bitrix24.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContactsModule } from './modules/contacts/contacts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    Bitrix24Module,
    AuthModule,
    ContactsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
