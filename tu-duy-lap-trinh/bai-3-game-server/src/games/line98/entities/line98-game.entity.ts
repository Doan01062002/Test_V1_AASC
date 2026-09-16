import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity('line98_games')
export class Line98Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  userId: string;

  @Column({ type: 'text' })
  board: string; // JSON biểu diễn ma trận 9x9 (mỗi ô là màu 0: trống, 1..5: màu bóng)

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'text' })
  nextBalls: string; // JSON biểu diễn mảng 3 màu bóng tiếp theo [c1, c2, c3]

  @Column({ type: 'boolean', default: false })
  isGameOver: boolean;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
