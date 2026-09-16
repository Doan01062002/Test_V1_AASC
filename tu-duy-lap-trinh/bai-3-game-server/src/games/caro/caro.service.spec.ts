import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CaroService, CARO_BOARD_SIZE } from './caro.service';
import { CaroMatch } from './entities/caro-match.entity';

describe('CaroService (Unit Tests)', () => {
  let service: CaroService;

  const mockMatchRepository = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockResolvedValue({ id: 'match-123' }),
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaroService,
        {
          provide: getRepositoryToken(CaroMatch),
          useValue: mockMatchRepository,
        },
      ],
    }).compile();

    service = module.get<CaroService>(CaroService);
    jest.clearAllMocks();
  });

  describe('Thuật toán kiểm tra thắng cuộc (Check Win Condition)', () => {
    it('nên phát hiện chiến thắng 5 quân liên tiếp theo hàng ngang', () => {
      const board = Array(CARO_BOARD_SIZE)
        .fill(null)
        .map(() => Array(CARO_BOARD_SIZE).fill(null));

      // Đánh 5 quân X liên tiếp từ (5, 3) đến (5, 7)
      for (let c = 3; c <= 7; c++) {
        board[5][c] = 'X';
      }

      const winningLine = service.checkWin(board, 5, 7, 'X');
      expect(winningLine).not.toBeNull();
      expect(winningLine!.length).toBe(5);
    });

    it('nên phát hiện chiến thắng 5 quân liên tiếp theo hàng dọc', () => {
      const board = Array(CARO_BOARD_SIZE)
        .fill(null)
        .map(() => Array(CARO_BOARD_SIZE).fill(null));

      // Đánh 5 quân O liên tiếp từ (2, 4) đến (6, 4)
      for (let r = 2; r <= 6; r++) {
        board[r][4] = 'O';
      }

      const winningLine = service.checkWin(board, 4, 4, 'O');
      expect(winningLine).not.toBeNull();
      expect(winningLine!.length).toBe(5);
    });

    it('nên phát hiện chiến thắng 5 quân liên tiếp theo đường chéo chính', () => {
      const board = Array(CARO_BOARD_SIZE)
        .fill(null)
        .map(() => Array(CARO_BOARD_SIZE).fill(null));

      // Đánh 5 quân X từ (1, 1) đến (5, 5)
      for (let i = 1; i <= 5; i++) {
        board[i][i] = 'X';
      }

      const winningLine = service.checkWin(board, 3, 3, 'X');
      expect(winningLine).not.toBeNull();
      expect(winningLine!.length).toBe(5);
    });

    it('nên phát hiện chiến thắng 5 quân liên tiếp theo đường chéo phụ', () => {
      const board = Array(CARO_BOARD_SIZE)
        .fill(null)
        .map(() => Array(CARO_BOARD_SIZE).fill(null));

      // Đánh 5 quân O chéo phụ: (0, 4), (1, 3), (2, 2), (3, 1), (4, 0)
      for (let i = 0; i < 5; i++) {
        board[i][4 - i] = 'O';
      }

      const winningLine = service.checkWin(board, 2, 2, 'O');
      expect(winningLine).not.toBeNull();
      expect(winningLine!.length).toBe(5);
    });

    it('không phát hiện thắng khi mới chỉ có 4 quân', () => {
      const board = Array(CARO_BOARD_SIZE)
        .fill(null)
        .map(() => Array(CARO_BOARD_SIZE).fill(null));

      // Chỉ có 4 quân X
      for (let c = 0; c < 4; c++) {
        board[0][c] = 'X';
      }

      const winningLine = service.checkWin(board, 0, 3, 'X');
      expect(winningLine).toBeNull();
    });
  });

  describe('Hệ thống Ghép cặp ngẫu nhiên (Matchmaking Queue)', () => {
    it('khi người chơi thứ nhất vào hàng đợi thì chờ, khi người thứ 2 vào thì tạo phòng thành công', () => {
      const p1 = { socketId: 'socket-1', name: 'Alice' };
      const p2 = { socketId: 'socket-2', name: 'Bob' };

      const room1 = service.joinMatchmaking(p1);
      expect(room1).toBeNull(); // Đang chờ đối thủ

      const room2 = service.joinMatchmaking(p2);
      expect(room2).not.toBeNull(); // Đã tạo phòng!
      expect(room2!.currentTurn).toBe('X');
      expect([room2!.playerX.socketId, room2!.playerO.socketId]).toContain('socket-1');
      expect([room2!.playerX.socketId, room2!.playerO.socketId]).toContain('socket-2');
    });
  });

  describe('Nghiệp vụ Đánh cờ luân phiên (Turn-based Move Logic)', () => {
    it('không cho phép người chơi đánh khi chưa tới lượt', async () => {
      const room = service.joinMatchmaking({ socketId: 's1', name: 'P1' }) ||
        service.joinMatchmaking({ socketId: 's2', name: 'P2' });

      expect(room).not.toBeNull();

      // Giả sử player O cố tình đánh trước khi lượt là X
      const playerOWhoIsNotTurn = room!.playerO.socketId;
      const res = await service.makeMove(room!.id, playerOWhoIsNotTurn, 0, 0);

      expect(res.success).toBe(false);
      expect(res.error).toContain('Chưa tới lượt');
    });

    it('cho phép người chơi đúng lượt đánh và chuyển lượt sau đó', async () => {
      // Clear queues & create fresh room
      const pX = { socketId: 'sx', name: 'PX' };
      const pO = { socketId: 'so', name: 'PO' };
      service.joinMatchmaking(pX);
      const room = service.joinMatchmaking(pO)!;

      const playerXSocket = room.playerX.socketId;
      const res = await service.makeMove(room.id, playerXSocket, 7, 7);

      expect(res.success).toBe(true);
      expect(room.board[7][7]).toBe('X');
      expect(room.currentTurn).toBe('O'); // Đã chuyển sang lượt O
    });

    it('từ chối nước đi khi phòng chơi không tồn tại', async () => {
      const res = await service.makeMove('non-existent-room-id', 'some-socket', 0, 0);
      expect(res.success).toBe(false);
      expect(res.error).toContain('không tồn tại');
    });

    it('từ chối nước đi khi tọa độ nằm ngoài bàn cờ', async () => {
      const p1 = { socketId: 's10', name: 'P10' };
      const p2 = { socketId: 's20', name: 'P20' };
      service.joinMatchmaking(p1);
      const room = service.joinMatchmaking(p2)!;

      const currentTurnSocket = room.currentTurn === 'X' ? room.playerX.socketId : room.playerO.socketId;
      const resNeg = await service.makeMove(room.id, currentTurnSocket, -1, 0);
      expect(resNeg.success).toBe(false);
      expect(resNeg.error).toContain('ngoài bàn cờ');

      const resOver = await service.makeMove(room.id, currentTurnSocket, 0, CARO_BOARD_SIZE);
      expect(resOver.success).toBe(false);
      expect(resOver.error).toContain('ngoài bàn cờ');
    });

    it('từ chối đánh vào ô đã có quân cờ', async () => {
      const p1 = { socketId: 's11', name: 'P11' };
      const p2 = { socketId: 's22', name: 'P22' };
      service.joinMatchmaking(p1);
      const room = service.joinMatchmaking(p2)!;

      const playerXSocket = room.playerX.socketId;
      await service.makeMove(room.id, playerXSocket, 5, 5);

      const playerOSocket = room.playerO.socketId;
      const resOccupied = await service.makeMove(room.id, playerOSocket, 5, 5);
      expect(resOccupied.success).toBe(false);
      expect(resOccupied.error).toContain('đã được đánh');
    });
  });

  describe('Xử lý thoát trận và ngắt kết nối (Player Disconnect)', () => {
    it('khi một người chơi thoát trận, xử người còn lại thắng cuộc', async () => {
      const p1 = { socketId: 'sA', name: 'Alice' };
      const p2 = { socketId: 'sB', name: 'Bob' };
      service.joinMatchmaking(p1);
      const room = service.joinMatchmaking(p2)!;

      const finishedRoom = await service.handlePlayerDisconnect(room.playerX.socketId);
      expect(finishedRoom).not.toBeNull();
      expect(finishedRoom!.isFinished).toBe(true);
      expect(finishedRoom!.winner).toBe('O'); // Player X thoát -> O thắng
    });

    it('khi một socket có phòng cũ đã kết thúc và phòng mới đang diễn ra, ngắt kết nối phải xử lý đúng phòng mới', async () => {
      const p1 = { socketId: 'sMulti', name: 'Alice' };
      const p2 = { socketId: 'sBob', name: 'Bob' };
      service.joinMatchmaking(p1);
      const room1 = service.joinMatchmaking(p2)!;

      // Giả lập phòng 1 đã kết thúc trước đó
      room1.isFinished = true;
      room1.winner = 'X';

      // Alice tiếp tục tìm trận và vào phòng 2 với Charlie
      const p3 = { socketId: 'sCharlie', name: 'Charlie' };
      service.joinMatchmaking(p1);
      const room2 = service.joinMatchmaking(p3)!;

      // Alice bị rớt mạng
      const disconnectedRoom = await service.handlePlayerDisconnect('sMulti');

      expect(disconnectedRoom).not.toBeNull();
      expect(disconnectedRoom!.id).toBe(room2.id); // Phải là phòng 2, không được là phòng 1
      expect(disconnectedRoom!.isFinished).toBe(true);
      // Charlie phải được xử thắng cuộc
      const winnerExpected = room2.playerX.socketId === 'sMulti' ? 'O' : 'X';
      expect(disconnectedRoom!.winner).toBe(winnerExpected);
    });

    it('lấy lịch sử các trận gần nhất thành công', async () => {
      const matches = await service.getRecentMatches(5);
      expect(Array.isArray(matches)).toBe(true);
    });

    it('lưu trận đấu với AI Bot thành công', async () => {
      const botMatch = await service.saveBotMatch({
        playerName: 'Tester',
        winner: 'X',
        movesCount: 9,
      });
      expect(botMatch).toBeDefined();
      expect(mockMatchRepository.save).toHaveBeenCalled();
    });
  });
});
