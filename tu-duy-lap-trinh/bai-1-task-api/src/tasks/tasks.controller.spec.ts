import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task, TaskStatus } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

describe('TasksController (Unit Tests)', () => {
  let controller: TasksController;
  let service: TasksService;

  const validUuid = 'd3b07384-d113-4944-9cbf-70562725e219';
  const invalidUuid = 'not-a-valid-uuid-string';

  const mockTask: Task = {
    id: validUuid,
    title: 'Nhiệm vụ kiểm thử Controller',
    description: 'Chi tiết nhiệm vụ kiểm thử',
    status: TaskStatus.TODO,
    createdAt: new Date('2026-09-16T00:00:00.000Z'),
  };

  const mockTasksService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    seedTasks: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  it('nên được khởi tạo thành công', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('create (POST /tasks)', () => {
    it('nên gọi service.create và trả về Task mới', async () => {
      const dto: CreateTaskDto = {
        title: 'Task mới từ controller',
        description: 'Mô tả chi tiết',
        status: TaskStatus.TODO,
      };

      mockTasksService.create.mockResolvedValue(mockTask);

      const result = await controller.create(dto);

      expect(mockTasksService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTask);
    });

    it('nên chuyển tiếp lỗi nếu service ném lỗi', async () => {
      const dto: CreateTaskDto = { title: 'Lỗi' };
      mockTasksService.create.mockRejectedValue(new Error('Lỗi database'));

      await expect(controller.create(dto)).rejects.toThrow('Lỗi database');
    });
  });

  describe('findAll (GET /tasks)', () => {
    it('nên lấy tất cả tasks khi không có query status', async () => {
      const tasks = [mockTask];
      mockTasksService.findAll.mockResolvedValue(tasks);

      const result = await controller.findAll();

      expect(mockTasksService.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(tasks);
    });

    it('nên truyền status khi có filter query', async () => {
      const doneTask = { ...mockTask, status: TaskStatus.DONE };
      mockTasksService.findAll.mockResolvedValue([doneTask]);

      const result = await controller.findAll(TaskStatus.DONE);

      expect(mockTasksService.findAll).toHaveBeenCalledWith(TaskStatus.DONE);
      expect(result).toEqual([doneTask]);
    });

    it('nên truyền status khi lọc theo TaskStatus.TODO', async () => {
      mockTasksService.findAll.mockResolvedValue([mockTask]);
      const result = await controller.findAll(TaskStatus.TODO);
      expect(mockTasksService.findAll).toHaveBeenCalledWith(TaskStatus.TODO);
      expect(result).toEqual([mockTask]);
    });

    it('nên truyền status khi lọc theo TaskStatus.IN_PROGRESS', async () => {
      const inProgressTask = { ...mockTask, status: TaskStatus.IN_PROGRESS };
      mockTasksService.findAll.mockResolvedValue([inProgressTask]);
      const result = await controller.findAll(TaskStatus.IN_PROGRESS);
      expect(mockTasksService.findAll).toHaveBeenCalledWith(TaskStatus.IN_PROGRESS);
      expect(result).toEqual([inProgressTask]);
    });
  });

  describe('seed (POST /tasks/seed)', () => {
    it('nên gọi service.seedTasks với 100 bản ghi', async () => {
      const seedResponse = {
        count: 100,
        message: 'Đã làm sạch dữ liệu cũ và khởi tạo thành công 100 bản ghi kiểm thử.',
      };
      mockTasksService.seedTasks.mockResolvedValue(seedResponse);

      const result = await controller.seed();

      expect(mockTasksService.seedTasks).toHaveBeenCalledWith(100);
      expect(result).toEqual(seedResponse);
    });

    it('nên chuyển tiếp lỗi nếu service.seedTasks thất bại', async () => {
      mockTasksService.seedTasks.mockRejectedValue(new Error('Lỗi database khi seed'));
      await expect(controller.seed()).rejects.toThrow('Lỗi database khi seed');
    });
  });

  describe('findOne (GET /tasks/:id)', () => {
    it('nên trả về chi tiết task khi tìm thấy ID', async () => {
      mockTasksService.findOne.mockResolvedValue(mockTask);

      const result = await controller.findOne(validUuid);

      expect(mockTasksService.findOne).toHaveBeenCalledWith(validUuid);
      expect(result).toEqual(mockTask);
    });

    it('nên ném NotFoundException khi không tìm thấy task', async () => {
      mockTasksService.findOne.mockRejectedValue(
        new NotFoundException(`Không tìm thấy Task với mã định danh ID: "${validUuid}"`),
      );

      await expect(controller.findOne(validUuid)).rejects.toThrow(NotFoundException);
      expect(mockTasksService.findOne).toHaveBeenCalledWith(validUuid);
    });
  });

  describe('update (PATCH /tasks/:id)', () => {
    it('nên cập nhật task thành công', async () => {
      const updateDto: UpdateTaskDto = {
        title: 'Tiêu đề đã sửa',
        status: TaskStatus.IN_PROGRESS,
      };
      const updatedTask = { ...mockTask, ...updateDto };
      mockTasksService.update.mockResolvedValue(updatedTask);

      const result = await controller.update(validUuid, updateDto);

      expect(mockTasksService.update).toHaveBeenCalledWith(validUuid, updateDto);
      expect(result).toEqual(updatedTask);
    });

    it('nên ném NotFoundException khi cập nhật task không tồn tại', async () => {
      mockTasksService.update.mockRejectedValue(
        new NotFoundException(`Không tìm thấy Task với mã định danh ID: "${validUuid}"`),
      );

      await expect(
        controller.update(validUuid, { status: TaskStatus.DONE }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove (DELETE /tasks/:id)', () => {
    it('nên xóa task thành công và trả về thông báo xác nhận', async () => {
      const removeResponse = {
        success: true,
        message: `Đã xóa thành công Task với ID: "${validUuid}"`,
      };
      mockTasksService.remove.mockResolvedValue(removeResponse);

      const result = await controller.remove(validUuid);

      expect(mockTasksService.remove).toHaveBeenCalledWith(validUuid);
      expect(result).toEqual(removeResponse);
    });

    it('nên ném NotFoundException khi xóa task không tồn tại', async () => {
      mockTasksService.remove.mockRejectedValue(
        new NotFoundException(`Không tìm thấy Task với mã định danh ID: "${validUuid}"`),
      );

      await expect(controller.remove(validUuid)).rejects.toThrow(NotFoundException);
    });
  });

  describe('UUID v4 Validation (ParseUUIDPipe)', () => {
    let pipe: ParseUUIDPipe;

    beforeEach(() => {
      pipe = new ParseUUIDPipe({ version: '4' });
    });

    it('nên chấp nhận UUID v4 hợp lệ', async () => {
      const result = await pipe.transform(validUuid, {
        type: 'param',
        metatype: String,
        data: 'id',
      });
      expect(result).toBe(validUuid);
    });

    it('nên từ chối chuỗi không phải UUID và ném BadRequestException', async () => {
      await expect(
        pipe.transform(invalidUuid, {
          type: 'param',
          metatype: String,
          data: 'id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên từ chối chuỗi rỗng và ném BadRequestException', async () => {
      await expect(
        pipe.transform('', {
          type: 'param',
          metatype: String,
          data: 'id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên từ chối giá trị undefined/null và ném BadRequestException', async () => {
      await expect(
        pipe.transform(undefined as any, {
          type: 'param',
          metatype: String,
          data: 'id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên từ chối UUID không phải v4 (ví dụ v1) và ném BadRequestException', async () => {
      // UUID v1 (timestamp-based)
      const uuidV1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      await expect(
        pipe.transform(uuidV1, {
          type: 'param',
          metatype: String,
          data: 'id',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
