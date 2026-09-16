import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('caro_matches')
export class CaroMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  playerXId: string;

  @Column({ type: 'varchar', length: 100 })
  playerOId: string;

  @Column({ type: 'varchar', length: 100, default: 'Player X' })
  playerXName: string;

  @Column({ type: 'varchar', length: 100, default: 'Player O' })
  playerOName: string;

  @Column({ type: 'varchar', length: 50, default: 'IN_PROGRESS' }) // 'X' | 'O' | 'DRAW' | 'IN_PROGRESS'
  winner: string;

  @Column({ type: 'int', default: 0 })
  movesCount: number;

  @Column({ type: 'text', default: '[]' }) // JSON array chứa các nước đi: [{r, c, player, timestamp}]
  movesHistory: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
