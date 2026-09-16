import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaroMatch } from './entities/caro-match.entity';

export const CARO_BOARD_SIZE = 15;
export const CARO_WIN_LENGTH = 5;

export interface CaroMove {
  r: number;
  c: number;
  player: 'X' | 'O';
  timestamp: number;
}

export interface CaroRoom {
  id: string;
  playerX: { socketId: string; userId?: string; name: string };
  playerO: { socketId: string; userId?: string; name: string };
  currentTurn: 'X' | 'O';
  board: (string | null)[][]; // 15x15 matrix chứa 'X', 'O' hoặc null
  moves: CaroMove[];
  winner: 'X' | 'O' | 'DRAW' | null;
  isFinished: boolean;
}

@Injectable()
export class CaroService {
  // Quản lý các phòng chơi đang hoạt động trong RAM
  private activeRooms = new Map<string, CaroRoom>();

  // Hàng đợi ghép cặp ngẫu nhiên (Matchmaking Queue)
  private waitingQueue: { socketId: string; userId?: string; name: string }[] = [];

  constructor(
    @InjectRepository(CaroMatch)
    private readonly matchRepository: Repository<CaroMatch>,
  ) {}

  /**
   * Đưa người chơi vào hàng đợi ghép cặp
   * @returns Nếu đủ 2 người, trả về phòng chơi mới tạo; nếu chưa thì trả về null
   */
  joinMatchmaking(player: { socketId: string; userId?: string; name: string }): CaroRoom | null {
    // Loại bỏ socketId cũ nếu người chơi gửi lại
    this.waitingQueue = this.waitingQueue.filter((p) => p.socketId !== player.socketId);

    // Dọn dẹp các phòng cũ của socket này: phòng kết thúc thì xóa, phòng đang đánh thì xử forfeit
    for (const [id, r] of this.activeRooms.entries()) {
      if (r.playerX.socketId === player.socketId || r.playerO.socketId === player.socketId) {
        if (!r.isFinished) {
          r.winner = r.playerX.socketId === player.socketId ? 'O' : 'X';
          r.isFinished = true;
          this.saveMatchHistory(r);
        }
        this.activeRooms.delete(id);
      }
    }

    if (this.waitingQueue.length > 0) {
      const opponent = this.waitingQueue.shift()!;
      // Ngẫu nhiên ai là X (đi trước) và ai là O (đi sau)
      const isFirst = Math.random() < 0.5;
      const playerX = isFirst ? player : opponent;
      const playerO = isFirst ? opponent : player;

      const roomId = `caro_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const room: CaroRoom = {
        id: roomId,
        playerX,
        playerO,
        currentTurn: 'X',
        board: Array(CARO_BOARD_SIZE)
          .fill(null)
          .map(() => Array(CARO_BOARD_SIZE).fill(null)),
        moves: [],
        winner: null,
        isFinished: false,
      };

      this.activeRooms.set(roomId, room);
      return room;
    } else {
      this.waitingQueue.push(player);
      return null;
    }
  }

  /**
   * Xóa người chơi khỏi hàng đợi khi disconnect hoặc hủy tìm trận
   */
  leaveQueue(socketId: string) {
    this.waitingQueue = this.waitingQueue.filter((p) => p.socketId !== socketId);
  }

  /**
   * Tìm phòng chơi của một socket (ưu tiên phòng đang diễn ra)
   */
  findRoomBySocketId(socketId: string, onlyActive = true): CaroRoom | null {
    for (const room of this.activeRooms.values()) {
      if (onlyActive && room.isFinished) {
        continue;
      }
      if (room.playerX.socketId === socketId || room.playerO.socketId === socketId) {
        return room;
      }
    }
    return null;
  }

  /**
   * Lấy thông tin phòng theo roomId
   */
  getRoom(roomId: string): CaroRoom | undefined {
    return this.activeRooms.get(roomId);
  }

  /**
   * Thực hiện nước đi của một người chơi
   */
  async makeMove(
    roomId: string,
    socketId: string,
    r: number,
    c: number,
  ): Promise<{
    success: boolean;
    error?: string;
    room?: CaroRoom;
    winningLine?: { r: number; c: number }[];
  }> {
    const room = this.activeRooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Phòng chơi không tồn tại hoặc đã kết thúc.' };
    }

    if (room.isFinished) {
      return { success: false, error: 'Ván đấu đã kết thúc.' };
    }

    // Xác định người chơi là X hay O
    let playerSymbol: 'X' | 'O';
    if (room.playerX.socketId === socketId) {
      playerSymbol = 'X';
    } else if (room.playerO.socketId === socketId) {
      playerSymbol = 'O';
    } else {
      return { success: false, error: 'Bạn không phải là người chơi trong ván đấu này.' };
    }

    // Kiểm tra đúng lượt đi
    if (room.currentTurn !== playerSymbol) {
      return { success: false, error: 'Chưa tới lượt đi của bạn.' };
    }

    // Kiểm tra tọa độ hợp lệ
    if (r < 0 || r >= CARO_BOARD_SIZE || c < 0 || c >= CARO_BOARD_SIZE) {
      return { success: false, error: 'Tọa độ nước đi nằm ngoài bàn cờ.' };
    }

    // Kiểm tra ô đã được đánh chưa
    if (room.board[r][c] !== null) {
      return { success: false, error: 'Ô này đã được đánh cờ.' };
    }

    // Đánh cờ
    room.board[r][c] = playerSymbol;
    room.moves.push({ r, c, player: playerSymbol, timestamp: Date.now() });

    // Kiểm tra điều kiện thắng (5 quân liên tiếp)
    const winningLine = this.checkWin(room.board, r, c, playerSymbol);

    if (winningLine) {
      room.winner = playerSymbol;
      room.isFinished = true;
      await this.saveMatchHistory(room);
    } else if (room.moves.length === CARO_BOARD_SIZE * CARO_BOARD_SIZE) {
      // Đầy bàn cờ mà không ai thắng -> Hòa
      room.winner = 'DRAW';
      room.isFinished = true;
      await this.saveMatchHistory(room);
    } else {
      // Chuyển lượt cho đối thủ
      room.currentTurn = playerSymbol === 'X' ? 'O' : 'X';
    }

    return {
      success: true,
      room,
      winningLine: winningLine || undefined,
    };
  }

  /**
   * Xử lý khi một người chơi bị mất kết nối hoặc thoát trận giữa chừng
   */
  async handlePlayerDisconnect(socketId: string): Promise<CaroRoom | null> {
    this.leaveQueue(socketId);

    // Dọn dẹp các phòng đã kết thúc của socket này khỏi activeRooms
    for (const [id, r] of this.activeRooms.entries()) {
      if (r.isFinished && (r.playerX.socketId === socketId || r.playerO.socketId === socketId)) {
        this.activeRooms.delete(id);
      }
    }

    const room = this.findRoomBySocketId(socketId, true);
    if (!room || room.isFinished) return null;

    // Người chơi còn lại thắng
    if (room.playerX.socketId === socketId) {
      room.winner = 'O';
    } else {
      room.winner = 'X';
    }
    room.isFinished = true;
    await this.saveMatchHistory(room);

    // Xóa phòng đã kết thúc khỏi activeRooms để giải phóng bộ nhớ
    this.activeRooms.delete(room.id);

    return room;
  }

  /**
   * Thuật toán kiểm tra 5 quân liên tiếp theo 4 hướng:
   * 1. Ngang (Horizontal)
   * 2. Dọc (Vertical)
   * 3. Chéo chính (Diagonal \)
   * 4. Chéo phụ (Anti-diagonal /)
   * @returns Tọa độ 5 ô tạo thành đường thắng, hoặc null nếu chưa thắng
   */
  checkWin(
    board: (string | null)[][],
    r: number,
    c: number,
    player: 'X' | 'O',
  ): { r: number; c: number }[] | null {
    const directions = [
      { dr: 0, dc: 1 },  // Ngang
      { dr: 1, dc: 0 },  // Dọc
      { dr: 1, dc: 1 },  // Chéo chính (\)
      { dr: 1, dc: -1 }, // Chéo phụ (/)
    ];

    for (const { dr, dc } of directions) {
      const line: { r: number; c: number }[] = [{ r, c }];

      // Đi về phía trước theo hướng (+dr, +dc)
      let step = 1;
      while (true) {
        const nr = r + dr * step;
        const nc = c + dc * step;
        if (
          nr >= 0 && nr < CARO_BOARD_SIZE &&
          nc >= 0 && nc < CARO_BOARD_SIZE &&
          board[nr][nc] === player
        ) {
          line.push({ r: nr, c: nc });
          step++;
        } else {
          break;
        }
      }

      // Đi về phía sau theo hướng ngược lại (-dr, -dc)
      step = 1;
      while (true) {
        const nr = r - dr * step;
        const nc = c - dc * step;
        if (
          nr >= 0 && nr < CARO_BOARD_SIZE &&
          nc >= 0 && nc < CARO_BOARD_SIZE &&
          board[nr][nc] === player
        ) {
          line.unshift({ r: nr, c: nc });
          step++;
        } else {
          break;
        }
      }

      if (line.length >= CARO_WIN_LENGTH) {
        return line;
      }
    }

    return null;
  }

  /**
   * Lưu kết quả trận đấu vào cơ sở dữ liệu SQLite
   */
  async saveMatchHistory(room: CaroRoom): Promise<void> {
    try {
      const match = this.matchRepository.create({
        playerXId: room.playerX.userId || room.playerX.socketId,
        playerOId: room.playerO.userId || room.playerO.socketId,
        playerXName: room.playerX.name,
        playerOName: room.playerO.name,
        winner: room.winner || 'DRAW',
        movesCount: room.moves.length,
        movesHistory: JSON.stringify(room.moves),
      });
      await this.matchRepository.save(match);
    } catch (err) {
      console.error('Lỗi khi lưu lịch sử trận đấu Caro:', err);
    }
  }

  /**
   * Lấy lịch sử trận đấu gần nhất (mặc định 10, tối đa 100)
   */
  async getRecentMatches(limit = 10): Promise<CaroMatch[]> {
    const parsedLimit = Number(limit);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.floor(parsedLimit), 100)
      : 10;

    return await this.matchRepository.find({
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });
  }

  /**
   * Rời khỏi trận đấu giữa chừng (xử thua đối thủ)
   */
  async handlePlayerLeave(socketId: string): Promise<CaroRoom | null> {
    return this.handlePlayerDisconnect(socketId);
  }

  /**
   * Lưu kết quả trận đấu với AI Bot vào database SQLite
   */
  async saveBotMatch(data: {
    playerUserId?: string;
    playerName?: string;
    winner: 'X' | 'O' | 'DRAW';
    movesCount: number;
    moves?: any[];
  }): Promise<CaroMatch> {
    const validWinner = (data.winner === 'X' || data.winner === 'O' || data.winner === 'DRAW')
      ? data.winner
      : 'DRAW';

    const match = this.matchRepository.create({
      playerXId: data.playerUserId || 'human_player',
      playerOId: 'bot_ai',
      playerXName: data.playerName || 'Người chơi',
      playerOName: '🤖 AI Bot',
      winner: validWinner,
      movesCount: Number(data.movesCount) || 0,
      movesHistory: JSON.stringify(Array.isArray(data.moves) ? data.moves : []),
    });
    return await this.matchRepository.save(match);
  }
}
