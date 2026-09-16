import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '../entities/task.entity';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Tiêu đề của task (bắt buộc, không được để trống)',
    example: 'Xây dựng API với NestJS',
  })
  @IsNotEmpty({ message: 'Tiêu đề (title) không được để trống.' })
  @IsString({ message: 'Tiêu đề (title) phải là chuỗi ký tự.' })
  title: string;

  @ApiPropertyOptional({
    description: 'Mô tả chi tiết công việc',
    example: 'Viết các controller, service và cấu hình TypeORM',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả (description) phải là chuỗi ký tự.' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái ban đầu của task',
    enum: TaskStatus,
    default: TaskStatus.TODO,
    example: TaskStatus.TODO,
  })
  @IsOptional()
  @IsEnum(TaskStatus, {
    message: 'Trạng thái (status) phải là một trong các giá trị: "To Do", "In Progress", "Done"',
  })
  status?: TaskStatus;
}
