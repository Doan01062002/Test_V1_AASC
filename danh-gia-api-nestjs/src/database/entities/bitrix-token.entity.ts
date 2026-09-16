import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('bitrix_tokens')
export class BitrixToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  domain: string;

  @Column({ type: 'text' })
  accessToken: string;

  @Column({ type: 'text' })
  refreshToken: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ nullable: true })
  memberId: string;

  @Column({ nullable: true })
  clientEndpoint: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Checks if token is expired or within 60s safety buffer.
   * Defensively fails closed (returns true) if expiresAt is null, undefined,
   * an invalid Date, or yields NaN.
   */
  isExpired(): boolean {
    if (!this.expiresAt) {
      return true;
    }
    const expiresTime =
      this.expiresAt instanceof Date
        ? this.expiresAt.getTime()
        : new Date(this.expiresAt).getTime();
    if (Number.isNaN(expiresTime)) {
      return true;
    }
    const marginMs = 60 * 1000;
    return Date.now() >= expiresTime - marginMs;
  }
}
