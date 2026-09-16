import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Line98Game } from './entities/line98-game.entity';

export interface Position {
  r: number;
  c: number;
  color?: number;
}

export interface Line98State {
  id?: string;
  userId?: string;
  board: number[][]; // 9x9 matrix, 0: trống, 1..5: màu bóng
  score: number;
  nextBalls: number[]; // 3 màu bóng dự báo kế tiếp
  isGameOver: boolean;
}

export const BOARD_SIZE = 9;
export const NUM_COLORS = 5;
export const LINE_LENGTH_TO_CLEAR = 5;

@Injectable()
export class Line98Service {
  constructor(
    @InjectRepository(Line98Game)
    private readonly gameRepository: Repository<Line98Game>,
  ) {}

  /**
   * Khởi tạo bàn cờ Line 98 mới
   */
  async createNewGame(userId?: string): Promise<Line98State> {
    const board: number[][] = Array(BOARD_SIZE)
      .fill(0)
      .map(() => Array(BOARD_SIZE).fill(0));

    // Sinh 5 bóng khởi đầu ngẫu nhiên
    this.spawnRandomBalls(board, 5);

    // Chuẩn bị 3 màu bóng cho lượt kế tiếp
    const nextBalls = this.generateRandomColors(3);

    const state: Line98State = {
      userId,
      board,
      score: 0,
      nextBalls,
      isGameOver: false,
    };

    // Lưu vào database
    const entity = this.gameRepository.create({
      userId,
      board: JSON.stringify(board),
      score: 0,
      nextBalls: JSON.stringify(nextBalls),
      isGameOver: false,
    });
    const saved = await this.gameRepository.save(entity);
    state.id = saved.id;

    return state;
  }

  /**
   * Lấy trạng thái game đã lưu hoặc tạo mới nếu chưa có
   */
  async getOrRestoreGame(gameId?: string, userId?: string): Promise<Line98State> {
    let entity: Line98Game | null = null;
    if (gameId) {
      entity = await this.gameRepository.findOne({ where: { id: gameId } });
    } else if (userId) {
      entity = await this.gameRepository.findOne({
        where: { userId, isGameOver: false },
        order: { updatedAt: 'DESC' },
      });
    }

    if (entity) {
      if (userId && !entity.userId) {
        entity.userId = userId;
        await this.gameRepository.update(entity.id, { userId });
      }
      return {
        id: entity.id,
        userId: entity.userId,
        board: JSON.parse(entity.board),
        score: entity.score,
        nextBalls: JSON.parse(entity.nextBalls),
        isGameOver: entity.isGameOver,
      };
    }
    return this.createNewGame(userId);
  }

  /**
   * Lưu trạng thái ván chơi vào DB
   */
  async saveGameState(state: Line98State): Promise<void> {
    if (!state.id) return;
    await this.gameRepository.update(state.id, {
      board: JSON.stringify(state.board),
      score: state.score,
      nextBalls: JSON.stringify(state.nextBalls),
      isGameOver: state.isGameOver,
    });
  }

  /**
   * Gắn userId của người dùng vào ván chơi Line 98 đang hoạt động khi đăng nhập
   */
  async linkUserToGame(gameId: string, userId: string): Promise<void> {
    if (gameId && userId) {
      await this.gameRepository.update(gameId, { userId });
    }
  }

  /**
   * Tìm đường đi hợp lệ từ (fromR, fromC) tới (toR, toC) bằng thuật toán BFS
   * @returns Mảng các tọa độ trên đường đi nếu tìm thấy, ngược lại trả về null
   */
  findPath(board: number[][], from: Position, to: Position): Position[] | null {
    if (
      from.r < 0 || from.r >= BOARD_SIZE || from.c < 0 || from.c >= BOARD_SIZE ||
      to.r < 0 || to.r >= BOARD_SIZE || to.c < 0 || to.c >= BOARD_SIZE
    ) {
      return null;
    }

    if (board[from.r][from.c] === 0 || board[to.r][to.c] !== 0) {
      return null; // Ô xuất phát không có bóng hoặc ô đích đã bị chiếm
    }

    const queue: Position[] = [from];
    const visited: boolean[][] = Array(BOARD_SIZE)
      .fill(false)
      .map(() => Array(BOARD_SIZE).fill(false));
    const parent: (Position | null)[][] = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));

    visited[from.r][from.c] = true;

    const dr = [-1, 1, 0, 0];
    const dc = [0, 0, -1, 1];

    let found = false;

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.r === to.r && curr.c === to.c) {
        found = true;
        break;
      }

      for (let i = 0; i < 4; i++) {
        const nr = curr.r + dr[i];
        const nc = curr.c + dc[i];

        if (
          nr >= 0 && nr < BOARD_SIZE &&
          nc >= 0 && nc < BOARD_SIZE &&
          !visited[nr][nc] &&
          board[nr][nc] === 0
        ) {
          visited[nr][nc] = true;
          parent[nr][nc] = curr;
          queue.push({ r: nr, c: nc });
        }
      }
    }

    if (!found) return null;

    // Truy vết đường đi từ đích về điểm bắt đầu
    const path: Position[] = [];
    let curr: Position | null = to;
    while (curr !== null) {
      path.unshift(curr);
      if (curr.r === from.r && curr.c === from.c) break;
      curr = parent[curr.r][curr.c];
    }

    return path;
  }

  /**
   * Quét và kiểm tra các hàng >= 5 bóng cùng màu (Ngang, Dọc, Chéo chính, Chéo phụ)
   * @returns Danh sách các ô bị nổ bóng
   */
  checkAndClearLines(board: number[][]): Position[] {
    const toClearSet = new Set<string>();

    const checkSequence = (cells: Position[]) => {
      if (cells.length < LINE_LENGTH_TO_CLEAR) return;

      let currentStreak: Position[] = [];
      let currentColor = 0;

      for (const cell of cells) {
        const color = board[cell.r][cell.c];
        if (color !== 0 && color === currentColor) {
          currentStreak.push(cell);
        } else {
          if (currentStreak.length >= LINE_LENGTH_TO_CLEAR) {
            currentStreak.forEach((pos) => toClearSet.add(`${pos.r},${pos.c}`));
          }
          if (color !== 0) {
            currentStreak = [cell];
            currentColor = color;
          } else {
            currentStreak = [];
            currentColor = 0;
          }
        }
      }

      if (currentStreak.length >= LINE_LENGTH_TO_CLEAR) {
        currentStreak.forEach((pos) => toClearSet.add(`${pos.r},${pos.c}`));
      }
    };

    // 1. Quét theo hàng ngang
    for (let r = 0; r < BOARD_SIZE; r++) {
      const row: Position[] = [];
      for (let c = 0; c < BOARD_SIZE; c++) row.push({ r, c });
      checkSequence(row);
    }

    // 2. Quét theo hàng dọc
    for (let c = 0; c < BOARD_SIZE; c++) {
      const col: Position[] = [];
      for (let r = 0; r < BOARD_SIZE; r++) col.push({ r, c });
      checkSequence(col);
    }

    // 3. Quét theo đường chéo chính (\)
    for (let k = -(BOARD_SIZE - LINE_LENGTH_TO_CLEAR); k <= BOARD_SIZE - LINE_LENGTH_TO_CLEAR; k++) {
      const diag: Position[] = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        const c = r + k;
        if (c >= 0 && c < BOARD_SIZE) diag.push({ r, c });
      }
      checkSequence(diag);
    }

    // 4. Quét theo đường chéo phụ (/)
    for (let k = LINE_LENGTH_TO_CLEAR - 1; k < 2 * BOARD_SIZE - LINE_LENGTH_TO_CLEAR; k++) {
      const antiDiag: Position[] = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        const c = k - r;
        if (c >= 0 && c < BOARD_SIZE) antiDiag.push({ r, c });
      }
      checkSequence(antiDiag);
    }

    const clearedPositions: Position[] = [];
    toClearSet.forEach((key) => {
      const [r, c] = key.split(',').map(Number);
      const color = board[r][c];
      clearedPositions.push({ r, c, color });
      board[r][c] = 0; // Xóa bóng trên bàn cờ
    });

    return clearedPositions;
  }

  /**
   * Xử lý di chuyển một bóng từ from -> to
   */
  async handleMove(
    state: Line98State,
    from: Position,
    to: Position,
  ): Promise<{
    success: boolean;
    path?: Position[];
    cleared?: Position[];
    spawned?: { pos: Position; color: number }[];
    scoreGained?: number;
    error?: string;
  }> {
    if (state.isGameOver) {
      return { success: false, error: 'Trò chơi đã kết thúc!' };
    }

    const path = this.findPath(state.board, from, to);
    if (!path) {
      return { success: false, error: 'Không có đường đi hợp lệ tới ô này!' };
    }

    // Thực hiện di chuyển bóng
    const ballColor = state.board[from.r][from.c];
    state.board[from.r][from.c] = 0;
    state.board[to.r][to.c] = ballColor;

    // Kiểm tra xem nước đi có nổ hàng không
    const cleared = this.checkAndClearLines(state.board);
    let scoreGained = 0;
    let spawned: { pos: Position; color: number }[] = [];

    if (cleared.length > 0) {
      // Ăn điểm: 5 bóng = 10đ, mỗi bóng thêm +3đ
      scoreGained = 10 + (cleared.length - 5) * 3;
      state.score += scoreGained;
    } else {
      // Không tạo hàng -> Sinh ngẫu nhiên 3 bóng mới từ nextBalls
      spawned = this.spawnNextBalls(state.board, state.nextBalls);

      // Kiểm tra xem 3 bóng mới sinh có tình cờ tạo hàng nổ không
      const clearedAfterSpawn = this.checkAndClearLines(state.board);
      if (clearedAfterSpawn.length > 0) {
        const extraScore = 10 + (clearedAfterSpawn.length - 5) * 3;
        scoreGained += extraScore;
        state.score += extraScore;
        cleared.push(...clearedAfterSpawn);
      }

      // Tạo 3 bóng tiếp theo mới
      state.nextBalls = this.generateRandomColors(3);

      // Kiểm tra bàn cờ đã đầy chưa
      if (this.getEmptyCells(state.board).length === 0) {
        state.isGameOver = true;
      }
    }

    await this.saveGameState(state);

    return {
      success: true,
      path,
      cleared,
      spawned,
      scoreGained,
    };
  }

  /**
   * Tính năng Trợ Giúp (Help): Tìm kiếm và gợi ý một nước đi hợp lệ
   * Ưu tiên nước đi tạo hàng nổ ngay, hoặc nước đi xếp được nhiều bóng cùng màu nhất,
   * hoặc ngẫu nhiên một nước đi hợp lệ.
   */
  getHelpSuggestion(board: number[][]): { from: Position; to: Position; reason: string } | null {
    const balls: Position[] = [];
    const emptyCells = this.getEmptyCells(board);

    if (emptyCells.length === 0) return null;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== 0) {
          balls.push({ r, c });
        }
      }
    }

    if (balls.length === 0) return null;

    let bestMove: { from: Position; to: Position; score: number; reason: string } | null = null;

    for (const ball of balls) {
      const color = board[ball.r][ball.c];

      for (const target of emptyCells) {
        const path = this.findPath(board, ball, target);
        if (path) {
          // Thử mô phỏng nước đi
          board[ball.r][ball.c] = 0;
          board[target.r][target.c] = color;

          // Kiểm tra xem có tạo được chuỗi nổ ngay không
          const testBoard = board.map((row) => [...row]);
          const cleared = this.checkAndClearLines(testBoard);

          // Khôi phục lại
          board[target.r][target.c] = 0;
          board[ball.r][ball.c] = color;

          if (cleared.length >= 5) {
            return {
              from: ball,
              to: target,
              reason: `Nước đi tuyệt vời! Tạo chuỗi ${cleared.length} bóng để xóa hàng và ghi điểm.`,
            };
          }

          // Đánh giá sơ bộ xem nước đi có cạnh bóng cùng màu không
          let adjacentSameColor = 0;
          const dr = [-1, 1, 0, 0, -1, -1, 1, 1];
          const dc = [0, 0, -1, 1, -1, 1, -1, 1];
          for (let i = 0; i < 8; i++) {
            const adjR = target.r + dr[i];
            const adjC = target.c + dc[i];
            if (
              adjR >= 0 && adjR < BOARD_SIZE &&
              adjC >= 0 && adjC < BOARD_SIZE &&
              board[adjR][adjC] === color
            ) {
              adjacentSameColor++;
            }
          }

          if (!bestMove || adjacentSameColor > bestMove.score) {
            bestMove = {
              from: ball,
              to: target,
              score: adjacentSameColor,
              reason: adjacentSameColor > 0
                ? `Gợi ý ghép bóng cạnh ${adjacentSameColor} bóng cùng màu.`
                : 'Gợi ý di chuyển hợp lệ.',
            };
          }
        }
      }
    }

    if (bestMove) {
      return { from: bestMove.from, to: bestMove.to, reason: bestMove.reason };
    }

    return null;
  }

  // --- Các hàm tiện ích bổ trợ ---

  getEmptyCells(board: number[][]): Position[] {
    const empty: Position[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === 0) empty.push({ r, c });
      }
    }
    return empty;
  }

  generateRandomColors(count: number): number[] {
    const colors: number[] = [];
    for (let i = 0; i < count; i++) {
      colors.push(Math.floor(Math.random() * NUM_COLORS) + 1);
    }
    return colors;
  }

  spawnRandomBalls(board: number[][], count: number): { pos: Position; color: number }[] {
    const colors = this.generateRandomColors(count);
    return this.spawnNextBalls(board, colors);
  }

  spawnNextBalls(board: number[][], colors: number[]): { pos: Position; color: number }[] {
    const spawned: { pos: Position; color: number }[] = [];
    const empty = this.getEmptyCells(board);

    // Shuffle mảng ô trống
    for (let i = empty.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [empty[i], empty[j]] = [empty[j], empty[i]];
    }

    const ballsToSpawn = Math.min(colors.length, empty.length);
    for (let i = 0; i < ballsToSpawn; i++) {
      const pos = empty[i];
      const color = colors[i];
      board[pos.r][pos.c] = color;
      spawned.push({ pos, color });
    }

    return spawned;
  }
}
