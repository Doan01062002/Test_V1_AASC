import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskStatus } from './entities/task.entity';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới một Task' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Task đã được tạo thành công.',
    type: Task,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu đầu vào không hợp lệ (ví dụ: title để trống).',
  })
  create(@Body() createTaskDto: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách tất cả các Task',
    description: 'Hỗ trợ lọc theo trạng thái status và sắp xếp theo thời gian mới nhất.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TaskStatus,
    description: 'Lọc task theo trạng thái ("To Do", "In Progress", "Done")',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách các task thỏa mãn điều kiện.',
    type: [Task],
  })
  findAll(@Query('status') status?: TaskStatus): Promise<Task[]> {
    return this.tasksService.findAll(status);
  }

  @Post('seed')
  @ApiOperation({
    summary: 'Khởi tạo 100 bản ghi mẫu để kiểm thử hiệu năng API',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Đã tạo 100 bản ghi mẫu thành công.',
  })
  seed(): Promise<{ count: number; message: string }> {
    return this.tasksService.seedTasks(100);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một Task theo ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID của task',
    example: 'd3b07384-d113-4944-9cbf-70562725e219',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thông tin chi tiết của task.',
    type: Task,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy Task với ID tương ứng.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'ID truyền vào không đúng định dạng UUID.',
  })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Task> {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin một Task theo ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID của task cần cập nhật',
    example: 'd3b07384-d113-4944-9cbf-70562725e219',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Task đã được cập nhật thành công.',
    type: Task,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy Task.',
  })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ): Promise<Task> {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa một Task theo ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID của task cần xóa',
    example: 'd3b07384-d113-4944-9cbf-70562725e219',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Task đã được xóa thành công.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy Task.',
  })
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.tasksService.remove(id);
  }
}
