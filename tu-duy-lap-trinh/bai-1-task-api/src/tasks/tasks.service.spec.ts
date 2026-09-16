import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Task, TaskStatus } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

describe('TasksService (Unit Tests)', () => {
  let service: TasksService;
  let repository: Repository<Task>;

  const mockTask: Task = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    title: 'Học NestJS và TypeScript',
    description: 'Nghiên cứu kiến trúc MVC và Dependency Injection',
    status: TaskStatus.TODO,
    createdAt: new Date('2026-09-16T00:00:00.000Z'),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(Task),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    repository = module.get<Repository<Task>>(getRepositoryToken(Task));
    jest.clearAllMocks();
  });

  it('nên được khởi tạo thành công', () => {
    expect(service).toBeDefined();
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('nên tạo mới và lưu một Task thành công', async () => {
      const dto: CreateTaskDto = {
        title: 'Task mới',
        description: 'Mô tả task mới',
        status: TaskStatus.TODO,
      };

      mockRepository.create.mockReturnValue(mockTask);
      mockRepository.save.mockResolvedValue(mockTask);

      const result = await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        title: dto.title,
        description: dto.description,
        status: dto.status,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockTask);
      expect(result).toEqual(mockTask);
    });

    it('nên gán trạng thái mặc định "To Do" nếu không truyền status', async () => {
      const dto: CreateTaskDto = {
        title: 'Task không có status',
      };

      mockRepository.create.mockReturnValue({ ...mockTask, status: TaskStatus.TODO });
      mockRepository.save.mockResolvedValue({ ...mockTask, status: TaskStatus.TODO });

      const result = await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        title: dto.title,
        description: undefined,
        status: TaskStatus.TODO,
      });
      expect(result.status).toEqual(TaskStatus.TODO);
    });
  });

  describe('findAll', () => {
    it('nên trả về toàn bộ danh sách tasks khi không truyền status', async () => {
      const tasksList = [mockTask];
      mockRepository.find.mockResolvedValue(tasksList);

      const result = await service.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(tasksList);
    });

    it('nên lọc tasks theo status khi có tham số status', async () => {
      const tasksList = [{ ...mockTask, status: TaskStatus.DONE }];
      mockRepository.find.mockResolvedValue(tasksList);

      const result = await service.findAll(TaskStatus.DONE);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { status: TaskStatus.DONE },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(tasksList);
    });
  });

  describe('findOne', () => {
    it('nên trả về thông tin task nếu tìm thấy theo ID', async () => {
      mockRepository.findOne.mockResolvedValue(mockTask);

      const result = await service.findOne(mockTask.id);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTask.id },
      });
      expect(result).toEqual(mockTask);
    });

    it('nên ném lỗi NotFoundException nếu không tìm thấy task', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('nên cập nhật task thành công', async () => {
      const updateDto: UpdateTaskDto = {
        status: TaskStatus.IN_PROGRESS,
        description: 'Cập nhật mô tả mới',
      };
      const updatedTask = { ...mockTask, ...updateDto };

      mockRepository.findOne.mockResolvedValue({ ...mockTask });
      mockRepository.save.mockResolvedValue(updatedTask);

      const result = await service.update(mockTask.id, updateDto);

      expect(result.status).toEqual(TaskStatus.IN_PROGRESS);
      expect(result.description).toEqual('Cập nhật mô tả mới');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('nên ném lỗi NotFoundException khi cập nhật task không tồn tại', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('invalid-uuid', { title: 'Tên mới' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('nên xóa task thành công nếu task tồn tại', async () => {
      mockRepository.findOne.mockResolvedValue(mockTask);
      mockRepository.remove.mockResolvedValue(mockTask);

      const result = await service.remove(mockTask.id);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockTask);
      expect(result.success).toBe(true);
      expect(result.message).toContain(mockTask.id);
    });

    it('nên ném lỗi NotFoundException khi xóa task không tồn tại', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('invalid-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('seedTasks', () => {
    it('nên làm sạch dữ liệu cũ và tạo đúng số lượng bản ghi được yêu cầu', async () => {
      mockRepository.clear.mockResolvedValue(undefined);
      mockRepository.create.mockImplementation((obj) => obj);
      mockRepository.save.mockResolvedValue([]);

      const result = await service.seedTasks(100);

      expect(mockRepository.clear).toHaveBeenCalled();
      expect(result.count).toEqual(100);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('nên tự động mặc định nạp 100 bản ghi khi không truyền tham số count', async () => {
      mockRepository.clear.mockResolvedValue(undefined);
      mockRepository.create.mockImplementation((obj) => obj);
      mockRepository.save.mockResolvedValue([]);

      const result = await service.seedTasks();

      expect(mockRepository.clear).toHaveBeenCalled();
      expect(result.count).toEqual(100);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });
});
