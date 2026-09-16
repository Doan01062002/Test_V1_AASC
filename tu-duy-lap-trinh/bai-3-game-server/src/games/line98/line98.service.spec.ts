import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Line98Service, BOARD_SIZE } from './line98.service';
import { Line98Game } from './entities/line98-game.entity';

describe('Line98Service (Unit Tests)', () => {
  let service: Line98Service;

  const mockGameRepository = {
    create: jest.fn().mockImplementation((dto) => ({ id: 'mock-uuid', ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'mock-uuid', ...entity })),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Line98Service,
        {
          provide: getRepositoryToken(Line98Game),
          useValue: mockGameRepository,
        },
      ],
    }).compile();

    service = module.get<Line98Service>(Line98Service);
    jest.clearAllMocks();
  });

  describe('Thuật toán tìm đường đi (BFS Pathfinding)', () => {
    it('nên tìm được đường đi khi bàn cờ thông thoáng', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));

      board[0][0] = 1; // Quả bóng màu 1 tại (0,0)

      const path = service.findPath(board, { r: 0, c: 0 }, { r: 2, c: 2 });
      expect(path).not.toBeNull();
      expect(path![0]).toEqual({ r: 0, c: 0 });
      expect(path![path!.length - 1]).toEqual({ r: 2, c: 2 });
    });

    it('nên trả về null khi đường đi bị bóng khác chặn kín', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));

      board[0][0] = 1; // Bóng cần đi
      // Chặn kín xung quanh (0,0)
      board[0][1] = 2;
      board[1][0] = 3;

      const path = service.findPath(board, { r: 0, c: 0 }, { r: 4, c: 4 });
      expect(path).toBeNull();
    });

    it('nên trả về null nếu ô đích đã có bóng', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));

      board[0][0] = 1;
      board[2][2] = 2; // Đã có bóng

      const path = service.findPath(board, { r: 0, c: 0 }, { r: 2, c: 2 });
      expect(path).toBeNull();
    });

    it('nên trả về null nếu tọa độ xuất phát hoặc đích nằm ngoài biên bàn cờ', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));
      board[0][0] = 1;

      expect(service.findPath(board, { r: -1, c: 0 }, { r: 2, c: 2 })).toBeNull();
      expect(service.findPath(board, { r: 0, c: -1 }, { r: 2, c: 2 })).toBeNull();
      expect(service.findPath(board, { r: 0, c: 0 }, { r: BOARD_SIZE, c: 2 })).toBeNull();
      expect(service.findPath(board, { r: 0, c: 0 }, { r: 2, c: BOARD_SIZE })).toBeNull();
    });

    it('nên trả về null nếu ô xuất phát không có bóng', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));

      const path = service.findPath(board, { r: 0, c: 0 }, { r: 2, c: 2 });
      expect(path).toBeNull();
    });

    it('nên trả về null nếu ô xuất phát trùng với ô đích', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));
      board[1][1] = 1;

      const path = service.findPath(board, { r: 1, c: 1 }, { r: 1, c: 1 });
      expect(path).toBeNull();
    });
  });

  describe('Thuật toán kiểm tra và xóa hàng >= 5 bóng (Check & Clear Lines)', () => {
    it('nên xóa được hàng ngang khi có 5 bóng cùng màu', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));

      // Đặt 5 bóng màu 2 liên tiếp hàng 0: (0,0) đến (0,4)
      for (let c = 0; c < 5; c++) {
        board[0][c] = 2;
      }

      const cleared = service.checkAndClearLines(board);
      expect(cleared.length).toBe(5);

      // Kiểm tra bàn cờ đã được xóa về 0
      for (let c = 0; c < 5; c++) {
        expect(board[0][c]).toBe(0);
      }
    });

    it('nên xóa được hàng dọc khi có 5 bóng cùng màu', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));

      // Đặt 5 bóng màu 3 theo cột 2: (1,2) đến (5,2)
      for (let r = 1; r <= 5; r++) {
        board[r][2] = 3;
      }

      const cleared = service.checkAndClearLines(board);
      expect(cleared.length).toBe(5);

      for (let r = 1; r <= 5; r++) {
        expect(board[r][2]).toBe(0);
      }
    });

    it('nên xóa được hàng chéo chính khi có 5 bóng cùng màu', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));

      // Đặt 5 bóng màu 4 theo đường chéo chính: (2,2) đến (6,6)
      for (let i = 2; i <= 6; i++) {
        board[i][i] = 4;
      }

      const cleared = service.checkAndClearLines(board);
      expect(cleared.length).toBe(5);

      for (let i = 2; i <= 6; i++) {
        expect(board[i][i]).toBe(0);
      }
    });

    it('không xóa bóng khi chuỗi ít hơn 5 bóng', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));

      // Chỉ có 4 bóng
      for (let c = 0; c < 4; c++) {
        board[0][c] = 1;
      }

      const cleared = service.checkAndClearLines(board);
      expect(cleared.length).toBe(0);
      expect(board[0][0]).toBe(1);
    });
  });

  describe('Tính năng Trợ giúp (Help Suggestion)', () => {
    it('nên tìm thấy gợi ý nước đi khả thi', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));

      // Đặt 4 bóng cùng màu ở hàng ngang và 1 bóng cùng màu ở chỗ khác có đường đi tới
      board[3][0] = 1;
      board[3][1] = 1;
      board[3][2] = 1;
      board[3][3] = 1;
      // Ô (3,4) đang trống!
      board[0][4] = 1; // Bóng thứ 5 ở xa

      const suggestion = service.getHelpSuggestion(board);
      expect(suggestion).not.toBeNull();
      // Gợi ý nên chọn bóng (0,4) đến (3,4) để tạo chuỗi 5
      expect(suggestion!.to).toEqual({ r: 3, c: 4 });
    });

    it('nên xóa được hàng chéo phụ khi có 5 bóng cùng màu', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));

      // Đặt 5 bóng màu 5 theo đường chéo phụ: (4,0), (3,1), (2,2), (1,3), (0,4)
      for (let i = 0; i < 5; i++) {
        board[4 - i][i] = 5;
      }

      const cleared = service.checkAndClearLines(board);
      expect(cleared.length).toBe(5);

      for (let i = 0; i < 5; i++) {
        expect(board[4 - i][i]).toBe(0);
      }
    });

    it('nên trả về null nếu bàn cờ hoàn toàn trống (không có bóng nào)', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0));

      const suggestion = service.getHelpSuggestion(board);
      expect(suggestion).toBeNull();
    });

    it('nên trả về null nếu bàn cờ đã đầy kín (không còn ô trống)', () => {
      const board = Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(1));

      const suggestion = service.getHelpSuggestion(board);
      expect(suggestion).toBeNull();
    });
  });

  describe('Nghiệp vụ Di chuyển bóng (handleMove)', () => {
    it('từ chối di chuyển khi game đã kết thúc (isGameOver = true)', async () => {
      const state = {
        board: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
        score: 100,
        nextBalls: [1, 2, 3],
        isGameOver: true,
      };

      const result = await service.handleMove(state, { r: 0, c: 0 }, { r: 1, c: 1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('kết thúc');
    });

    it('từ chối di chuyển khi không có đường đi hợp lệ', async () => {
      const state = {
        board: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
        score: 0,
        nextBalls: [1, 2, 3],
        isGameOver: false,
      };
      state.board[0][0] = 1;
      // Chặn kín đường đi
      state.board[0][1] = 2;
      state.board[1][0] = 3;

      const result = await service.handleMove(state, { r: 0, c: 0 }, { r: 5, c: 5 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('đường đi');
    });

    it('thực hiện di chuyển thành công và ghi điểm khi tạo thành hàng 5 bóng', async () => {
      const state = {
        board: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
        score: 0,
        nextBalls: [1, 2, 3],
        isGameOver: false,
      };
      // Đặt 4 bóng màu 2 liên tiếp tại hàng 0
      state.board[0][0] = 2;
      state.board[0][1] = 2;
      state.board[0][2] = 2;
      state.board[0][3] = 2;
      // Quả bóng thứ 5 nằm tại (3, 4)
      state.board[3][4] = 2;

      // Di chuyển quả bóng từ (3, 4) đến (0, 4) để hoàn thành hàng 5 bóng
      const result = await service.handleMove(state, { r: 3, c: 4 }, { r: 0, c: 4 });
      expect(result.success).toBe(true);
      expect(result.cleared).toBeDefined();
      expect(result.cleared!.length).toBe(5);
      expect(result.scoreGained).toBe(10);
      expect(state.score).toBe(10);
      expect(state.board[0][4]).toBe(0); // Ô đích đã nổ bóng về 0
    });

    it('thực hiện di chuyển hợp lệ nhưng không nổ hàng -> Sinh 3 bóng mới', async () => {
      const state = {
        board: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
        score: 0,
        nextBalls: [1, 2, 3],
        isGameOver: false,
      };
      state.board[0][0] = 1;

      const result = await service.handleMove(state, { r: 0, c: 0 }, { r: 2, c: 2 });
      expect(result.success).toBe(true);
      expect(result.spawned).toBeDefined();
      expect(result.spawned!.length).toBe(3);
      expect(state.board[2][2]).toBe(1);
      expect(state.board[0][0]).toBe(0);
    });

    it('liên kết userId với ván chơi Line 98 thành công', async () => {
      await service.linkUserToGame('mock-game-id', 'user-123');
      expect(mockGameRepository.update).toHaveBeenCalledWith('mock-game-id', { userId: 'user-123' });
    });
  });
});
