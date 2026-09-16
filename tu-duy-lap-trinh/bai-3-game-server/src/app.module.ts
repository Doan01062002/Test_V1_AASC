import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { User } from './users/entities/user.entity';
import { Line98Game } from './games/line98/entities/line98-game.entity';
import { CaroMatch } from './games/caro/entities/caro-match.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { GamesModule } from './games/games.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'game_server.sqlite',
      entities: [User, Line98Game, CaroMatch],
      synchronize: true,
      logging: false,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/auth/(.*)', '/user/(.*)', '/socket.io/(.*)'],
    }),
    UsersModule,
    AuthModule,
    GamesModule,
  ],
})
export class AppModule {}
