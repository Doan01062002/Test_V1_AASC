import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Line98Game } from './line98/entities/line98-game.entity';
import { CaroMatch } from './caro/entities/caro-match.entity';
import { Line98Service } from './line98/line98.service';
import { CaroService } from './caro/caro.service';
import { GamesGateway } from './games.gateway';

import { GamesController } from './games.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Line98Game, CaroMatch])],
  controllers: [GamesController],
  providers: [Line98Service, CaroService, GamesGateway],
  exports: [Line98Service, CaroService, GamesGateway],
})
export class GamesModule {}
