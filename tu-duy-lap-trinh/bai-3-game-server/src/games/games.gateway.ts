import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Line98Service, Position, Line98State } from './line98/line98.service';
import { CaroService } from './caro/caro.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GamesGateway.name);

  // Lưu trạng thái Line 98 theo socket id
  private line98Sessions = new Map<string, Line98State>();

  constructor(
    private readonly line98Service: Line98Service,
    private readonly caroService: CaroService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client đã kết nối WebSocket: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client đã ngắt kết nối WebSocket: ${client.id}`);

    // Xóa session Line 98
    this.line98Sessions.delete(client.id);

    // Xử lý thoát phòng Caro nếu đang trong trận
    const leftRoom = await this.caroService.handlePlayerDisconnect(client.id);
    if (leftRoom) {
      this.server.to(leftRoom.id).emit('caro:playerLeft', {
        message: 'Đối thủ đã ngắt kết nối. Bạn đã giành chiến thắng!',
        winner: leftRoom.winner,
      });
      this.server.emit('caro:historyUpdated');
    }
  }

  // =========================================================================
  //                         CÁC SỰ KIỆN GAME LINE 98
  // =========================================================================

  @SubscribeMessage('line98:init')
  async handleLine98Init(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { gameId?: string; userId?: string },
  ) {
    let state = this.line98Sessions.get(client.id);
    const userChanged = data?.userId && state?.userId && data.userId !== state.userId;
    const loggedOut = !data?.userId && state?.userId;

    if (!state || (data?.gameId && state.id !== data.gameId) || userChanged || loggedOut) {
      state = await this.line98Service.getOrRestoreGame(data?.gameId, data?.userId);
      this.line98Sessions.set(client.id, state);
    } else if (data?.userId && !state.userId) {
      state.userId = data.userId;
      if (state.id) {
        await this.line98Service.linkUserToGame(state.id, data.userId);
      }
    }
    client.emit('line98:gameState', state);
  }

  @SubscribeMessage('line98:newGame')
  async handleLine98NewGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string },
  ) {
    const state = await this.line98Service.createNewGame(data?.userId);
    this.line98Sessions.set(client.id, state);
    client.emit('line98:gameState', state);
  }

  @SubscribeMessage('line98:move')
  async handleLine98Move(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { from: Position; to: Position },
  ) {
    let state = this.line98Sessions.get(client.id);
    if (!state) {
      state = await this.line98Service.createNewGame();
      this.line98Sessions.set(client.id, state);
    }

    const result = await this.line98Service.handleMove(state, payload.from, payload.to);

    client.emit('line98:moveResult', {
      ...result,
      state: {
        id: state.id,
        board: state.board,
        score: state.score,
        nextBalls: state.nextBalls,
        isGameOver: state.isGameOver,
      },
    });
  }

  @SubscribeMessage('line98:help')
  handleLine98Help(@ConnectedSocket() client: Socket) {
    const state = this.line98Sessions.get(client.id);
    if (!state) {
      client.emit('line98:helpResult', { success: false, error: 'Chưa khởi tạo ván chơi.' });
      return;
    }

    const suggestion = this.line98Service.getHelpSuggestion(state.board);
    if (suggestion) {
      client.emit('line98:helpResult', { success: true, suggestion });
    } else {
      client.emit('line98:helpResult', { success: false, error: 'Không tìm thấy nước đi khả thi.' });
    }
  }

  // =========================================================================
  //                         CÁC SỰ KIỆN CỜ CARO X O
  // =========================================================================

  @SubscribeMessage('caro:findMatch')
  handleCaroFindMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string; name?: string },
  ) {
    const playerName = data?.name || `Người chơi_${client.id.substring(0, 4)}`;
    const matchedRoom = this.caroService.joinMatchmaking({
      socketId: client.id,
      userId: data?.userId,
      name: playerName,
    });

    if (matchedRoom) {
      // Ghép thành công 2 người chơi!
      const socketX = this.server.sockets.sockets.get(matchedRoom.playerX.socketId);
      const socketO = this.server.sockets.sockets.get(matchedRoom.playerO.socketId);

      socketX?.join(matchedRoom.id);
      socketO?.join(matchedRoom.id);

      // Báo tin cho Player X
      socketX?.emit('caro:matchFound', {
        roomId: matchedRoom.id,
        yourSymbol: 'X',
        opponentName: matchedRoom.playerO.name,
        currentTurn: matchedRoom.currentTurn,
        board: matchedRoom.board,
      });

      // Báo tin cho Player O
      socketO?.emit('caro:matchFound', {
        roomId: matchedRoom.id,
        yourSymbol: 'O',
        opponentName: matchedRoom.playerX.name,
        currentTurn: matchedRoom.currentTurn,
        board: matchedRoom.board,
      });

      this.logger.log(`Tạo phòng Caro ${matchedRoom.id}: ${matchedRoom.playerX.name} (X) vs ${matchedRoom.playerO.name} (O)`);
    } else {
      client.emit('caro:waitingMatch', {
        message: 'Đang tìm đối thủ trong hệ thống... Vui lòng đợi trong giây lát.',
      });
    }
  }

  @SubscribeMessage('caro:cancelFind')
  handleCaroCancelFind(@ConnectedSocket() client: Socket) {
    this.caroService.leaveQueue(client.id);
    client.emit('caro:findCancelled', { message: 'Đã hủy tìm kiếm trận đấu.' });
  }

  @SubscribeMessage('caro:leaveMatch')
  async handleCaroLeaveMatch(@ConnectedSocket() client: Socket) {
    const leftRoom = await this.caroService.handlePlayerLeave(client.id);
    if (leftRoom) {
      this.server.to(leftRoom.id).emit('caro:playerLeft', {
        message: 'Đối thủ đã rời khỏi ván đấu. Bạn đã giành chiến thắng!',
        winner: leftRoom.winner,
      });
      this.server.emit('caro:historyUpdated');
    }
    return { success: true };
  }

  @SubscribeMessage('caro:move')
  async handleCaroMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; r: number; c: number },
  ) {
    const moveResult = await this.caroService.makeMove(data.roomId, client.id, data.r, data.c);

    if (!moveResult.success) {
      client.emit('caro:moveError', { error: moveResult.error });
      return;
    }

    // Broadcast nước đi cho cả 2 người chơi trong phòng
    this.server.to(data.roomId).emit('caro:moved', {
      r: data.r,
      c: data.c,
      player: moveResult.room!.board[data.r][data.c],
      currentTurn: moveResult.room!.currentTurn,
      winningLine: moveResult.winningLine,
      winner: moveResult.room!.winner,
      isFinished: moveResult.room!.isFinished,
    });

    if (moveResult.room!.isFinished) {
      this.server.emit('caro:historyUpdated');
    }
  }

  @SubscribeMessage('caro:getHistory')
  async handleCaroGetHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { limit?: number },
  ) {
    const limit = data?.limit !== undefined ? Number(data.limit) : 10;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 10;
    const history = await this.caroService.getRecentMatches(safeLimit);
    client.emit('caro:history', history);
  }

  @SubscribeMessage('caro:saveBotMatch')
  async handleCaroSaveBotMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      playerUserId?: string;
      playerName?: string;
      winner: 'X' | 'O' | 'DRAW';
      movesCount: number;
      moves?: any[];
    },
  ) {
    const saved = await this.caroService.saveBotMatch(data);
    this.server.emit('caro:historyUpdated');
    return saved;
  }

  @SubscribeMessage('auth:linkUser')
  async handleAuthLinkUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (!data?.userId) return { success: false };
    let state = this.line98Sessions.get(client.id);
    if (!state) {
      state = await this.line98Service.getOrRestoreGame(undefined, data.userId);
      this.line98Sessions.set(client.id, state);
    } else if (!state.userId) {
      state.userId = data.userId;
      if (state.id) {
        await this.line98Service.linkUserToGame(state.id, data.userId);
      }
    }
    client.emit('line98:gameState', state);
    return { success: true };
  }

  @SubscribeMessage('auth:logout')
  handleAuthLogout(@ConnectedSocket() client: Socket) {
    this.line98Sessions.delete(client.id);
    return { success: true };
  }

  // =========================================================================
  //                KIỂM THỬ ĐỘ TRỄ (PING / PONG CHO LOAD TEST)
  // =========================================================================

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() data: { clientTime: number }) {
    client.emit('pong', {
      clientTime: data?.clientTime,
      serverTime: Date.now(),
    });
  }
}
