import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum TaskStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done',
}

@Entity('tasks')
export class Task {
  @ApiProperty({
    description: 'Định danh duy nhất của Task (UUID v4)',
    example: 'd3b07384-d113-4944-9cbf-70562725e219',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Tiêu đề của task',
    example: 'Hoàn thành bài kiểm tra NestJS',
  })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({
    description: 'Mô tả chi tiết nội dung công việc',
    example: 'Triển khai API RESTful quản lý task theo mô hình MVC',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({
    description: 'Trạng thái hiện tại của task',
    enum: TaskStatus,
    default: TaskStatus.TODO,
    example: TaskStatus.IN_PROGRESS,
  })
  @Column({
    type: 'varchar',
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @ApiProperty({
    description: 'Thời điểm tạo task',
    example: '2026-09-16T02:30:00.000Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
