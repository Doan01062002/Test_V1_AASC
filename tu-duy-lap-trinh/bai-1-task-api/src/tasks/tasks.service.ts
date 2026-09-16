import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  /**
   * Tạo một task mới
   * @param createTaskDto Dữ liệu tạo task
   * @returns Task vừa được tạo
   */
  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepository.create({
      title: createTaskDto.title,
      description: createTaskDto.description,
      status: createTaskDto.status || TaskStatus.TODO,
    });
    return await this.taskRepository.save(task);
  }

  /**
   * Lấy danh sách tất cả các task (có hỗ trợ lọc theo status)
   * @param status Trạng thái lọc tùy chọn
   * @returns Mảng danh sách tasks
   */
  async findAll(status?: TaskStatus): Promise<Task[]> {
    if (status) {
      return await this.taskRepository.find({
        where: { status },
        order: { createdAt: 'DESC' },
      });
    }
    return await this.taskRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Lấy thông tin chi tiết một task theo ID (UUID)
   * @param id UUID của task
   * @returns Task tìm thấy
   * @throws NotFoundException nếu không tìm thấy task
   */
  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Không tìm thấy Task với mã định danh ID: "${id}"`);
    }
    return task;
  }

  /**
   * Cập nhật thông tin task theo ID
   * @param id UUID của task
   * @param updateTaskDto Dữ liệu cập nhật
   * @returns Task sau khi cập nhật
   */
  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);
    Object.assign(task, updateTaskDto);
    return await this.taskRepository.save(task);
  }

  /**
   * Xóa một task theo ID
   * @param id UUID của task
   * @returns Thông báo xóa thành công
   */
  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const task = await this.findOne(id);
    await this.taskRepository.remove(task);
    return {
      success: true,
      message: `Đã xóa thành công Task với ID: "${id}"`,
    };
  }

  /**
   * Hàm hỗ trợ nạp dữ liệu mẫu (Seed 100 bản ghi) để kiểm thử hiệu năng
   * Tự động dọn dẹp các bản ghi cũ trước khi nạp để đảm bảo chính xác 100 bản ghi
   * @param count Số lượng bản ghi cần seed (mặc định 100)
   */
  async seedTasks(count: number = 100): Promise<{ count: number; message: string }> {
    // Dọn dẹp dữ liệu cũ trước khi nạp để bảo đảm chính xác số lượng 100 bản ghi
    await this.taskRepository.clear();

    const statuses = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];
    const tasksToInsert: Task[] = [];

    for (let i = 1; i <= count; i++) {
      const task = this.taskRepository.create({
        title: `Nhiệm vụ kiểm thử tự động #${i}`,
        description: `Mô tả chi tiết cho nhiệm vụ kiểm thử số ${i} nhằm kiểm tra hiệu năng hệ thống.`,
        status: statuses[i % 3],
      });
      tasksToInsert.push(task);
    }

    await this.taskRepository.save(tasksToInsert);
    return {
      count: tasksToInsert.length,
      message: `Đã làm sạch dữ liệu cũ và khởi tạo thành công ${tasksToInsert.length} bản ghi kiểm thử.`,
    };
  }
}
