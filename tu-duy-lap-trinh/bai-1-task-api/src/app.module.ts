import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from './tasks/tasks.module';
import { Task } from './tasks/entities/task.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'tasks.sqlite',
      entities: [Task],
      synchronize: true, // Tự động sync schema cho môi trường dev/test
      logging: false,
    }),
    TasksModule,
  ],
})
export class AppModule {}
