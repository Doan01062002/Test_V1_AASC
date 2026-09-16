import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CaroService } from './caro/caro.service';
import { GamesGateway } from './games.gateway';

@Controller('games')
export class GamesController {
  constructor(
    private readonly caroService: CaroService,
    private readonly gamesGateway: GamesGateway,
  ) {}

  @Get('caro/history')
  async getCaroHistory(@Query('limit') limit?: number) {
    const parsed = limit !== undefined ? Number(limit) : 10;
    const take = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 100) : 10;
    return await this.caroService.getRecentMatches(take);
  }

  @Post('caro/bot-match')
  async saveBotMatch(
    @Body()
    body: {
      playerUserId?: string;
      playerName?: string;
      winner: 'X' | 'O' | 'DRAW';
      movesCount: number;
      moves?: any[];
    },
  ) {
    const saved = await this.caroService.saveBotMatch(body);
    this.gamesGateway.server?.emit('caro:historyUpdated');
    return saved;
  }
}

