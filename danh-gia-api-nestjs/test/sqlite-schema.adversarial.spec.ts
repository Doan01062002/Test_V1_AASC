import { DataSource, Repository, QueryFailedError } from 'typeorm';
import { BitrixToken } from '../src/database/entities/bitrix-token.entity';

describe('Adversarial Stress-Testing: SQLite Table Creation & Schema Constraints', () => {
  let dataSource: DataSource;
  let repository: Repository<BitrixToken>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [BitrixToken],
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();
    repository = dataSource.getRepository(BitrixToken);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await repository.clear();
  });

  describe('Table Creation & Schema Columns', () => {
    it('should create the bitrix_tokens table with exact expected columns and types', async () => {
      const columns = await dataSource.query('PRAGMA table_info(bitrix_tokens);');
      const columnMap = new Map(columns.map((c: any) => [c.name, c]));

      // Verify all 9 expected columns exist
      expect(columnMap.has('id')).toBe(true);
      expect(columnMap.has('domain')).toBe(true);
      expect(columnMap.has('accessToken')).toBe(true);
      expect(columnMap.has('refreshToken')).toBe(true);
      expect(columnMap.has('expiresAt')).toBe(true);
      expect(columnMap.has('memberId')).toBe(true);
      expect(columnMap.has('clientEndpoint')).toBe(true);
      expect(columnMap.has('createdAt')).toBe(true);
      expect(columnMap.has('updatedAt')).toBe(true);

      // Verify primary key
      const idCol = columnMap.get('id') as any;
      expect(idCol.pk).toBe(1);

      // Verify nullable vs not-nullable according to PRAGMA notnull flag (1 = NOT NULL, 0 = NULLABLE)
      expect((columnMap.get('domain') as any).notnull).toBe(1);
      expect((columnMap.get('accessToken') as any).notnull).toBe(1);
      expect((columnMap.get('refreshToken') as any).notnull).toBe(1);
      expect((columnMap.get('expiresAt') as any).notnull).toBe(1);

      // memberId and clientEndpoint must be nullable
      expect((columnMap.get('memberId') as any).notnull).toBe(0);
      expect((columnMap.get('clientEndpoint') as any).notnull).toBe(0);
    });

    it('should have a unique index on the domain column', async () => {
      const indices = await dataSource.query('PRAGMA index_list(bitrix_tokens);');
      const uniqueIndices = indices.filter((idx: any) => idx.unique === 1);
      expect(uniqueIndices.length).toBeGreaterThanOrEqual(1);

      // Check index info for domain
      let foundDomainIndex = false;
      for (const idx of uniqueIndices) {
        const info = await dataSource.query(`PRAGMA index_info('${idx.name}');`);
        if (info.some((col: any) => col.name === 'domain')) {
          foundDomainIndex = true;
          break;
        }
      }
      expect(foundDomainIndex).toBe(true);
    });
  });

  describe('Unique Domain Constraint Enforcement', () => {
    it('should successfully save a valid token with a unique domain', async () => {
      const token = repository.create({
        domain: 'tenant1.bitrix24.com',
        accessToken: 'access_1',
        refreshToken: 'refresh_1',
        expiresAt: new Date(Date.now() + 3600_000),
      });

      const saved = await repository.save(token);
      expect(saved.id).toBeDefined();
      expect(saved.domain).toBe('tenant1.bitrix24.com');
    });

    it('should reject a duplicate domain on INSERT with SQLITE_CONSTRAINT / UNIQUE constraint error', async () => {
      const token1 = repository.create({
        domain: 'duplicate.bitrix24.com',
        accessToken: 'access_original',
        refreshToken: 'refresh_original',
        expiresAt: new Date(Date.now() + 3600_000),
      });
      await repository.save(token1);

      const token2 = repository.create({
        domain: 'duplicate.bitrix24.com',
        accessToken: 'access_conflict',
        refreshToken: 'refresh_conflict',
        expiresAt: new Date(Date.now() + 7200_000),
      });

      await expect(repository.save(token2)).rejects.toThrow(QueryFailedError);
    });

    it('should reject updating an existing token domain to conflict with another existing domain', async () => {
      const tokenA = await repository.save(
        repository.create({
          domain: 'tenant-a.bitrix24.com',
          accessToken: 'acc_a',
          refreshToken: 'ref_a',
          expiresAt: new Date(Date.now() + 3600_000),
        }),
      );

      const tokenB = await repository.save(
        repository.create({
          domain: 'tenant-b.bitrix24.com',
          accessToken: 'acc_b',
          refreshToken: 'ref_b',
          expiresAt: new Date(Date.now() + 3600_000),
        }),
      );

      // Attempt to rename tokenB to tokenA's domain
      tokenB.domain = tokenA.domain;
      await expect(repository.save(tokenB)).rejects.toThrow(QueryFailedError);
    });
  });

  describe('Nullable and NOT NULL Column Enforcement', () => {
    it('should allow null for memberId and clientEndpoint', async () => {
      const token = repository.create({
        domain: 'nullables.bitrix24.com',
        accessToken: 'acc_null',
        refreshToken: 'ref_null',
        expiresAt: new Date(Date.now() + 3600_000),
        memberId: null,
        clientEndpoint: null,
      });

      const saved = await repository.save(token);
      expect(saved.memberId).toBeNull();
      expect(saved.clientEndpoint).toBeNull();

      const fetched = await repository.findOneBy({ id: saved.id });
      expect(fetched?.memberId).toBeNull();
      expect(fetched?.clientEndpoint).toBeNull();
    });

    it('should reject null domain with NOT NULL constraint violation', async () => {
      const token = repository.create({
        domain: null as any,
        accessToken: 'acc_val',
        refreshToken: 'ref_val',
        expiresAt: new Date(Date.now() + 3600_000),
      });

      await expect(repository.save(token)).rejects.toThrow(QueryFailedError);
    });

    it('should reject null accessToken with NOT NULL constraint violation', async () => {
      const token = repository.create({
        domain: 'null-access.bitrix24.com',
        accessToken: null as any,
        refreshToken: 'ref_val',
        expiresAt: new Date(Date.now() + 3600_000),
      });

      await expect(repository.save(token)).rejects.toThrow(QueryFailedError);
    });

    it('should reject null refreshToken with NOT NULL constraint violation', async () => {
      const token = repository.create({
        domain: 'null-refresh.bitrix24.com',
        accessToken: 'acc_val',
        refreshToken: null as any,
        expiresAt: new Date(Date.now() + 3600_000),
      });

      await expect(repository.save(token)).rejects.toThrow(QueryFailedError);
    });

    it('should reject null expiresAt with NOT NULL constraint violation', async () => {
      const token = repository.create({
        domain: 'null-expires.bitrix24.com',
        accessToken: 'acc_val',
        refreshToken: 'ref_val',
        expiresAt: null as any,
      });

      await expect(repository.save(token)).rejects.toThrow(QueryFailedError);
    });
  });

  describe('Timestamps & Hydration Lifecycle', () => {
    it('should automatically generate createdAt and updatedAt timestamps on creation', async () => {
      const token = repository.create({
        domain: 'timestamps.bitrix24.com',
        accessToken: 'acc_ts',
        refreshToken: 'ref_ts',
        expiresAt: new Date(Date.now() + 3600_000),
      });

      const saved = await repository.save(token);
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it('hydrated entity from database should have functioning isExpired() method', async () => {
      // Save future token
      const futureToken = await repository.save(
        repository.create({
          domain: 'future.bitrix24.com',
          accessToken: 'acc_future',
          refreshToken: 'ref_future',
          expiresAt: new Date(Date.now() + 3600_000),
        }),
      );

      // Save expired token
      const expiredToken = await repository.save(
        repository.create({
          domain: 'expired.bitrix24.com',
          accessToken: 'acc_exp',
          refreshToken: 'ref_exp',
          expiresAt: new Date(Date.now() - 3600_000),
        }),
      );

      const loadedFuture = await repository.findOneBy({ id: futureToken.id });
      const loadedExpired = await repository.findOneBy({ id: expiredToken.id });

      expect(loadedFuture).toBeInstanceOf(BitrixToken);
      expect(loadedExpired).toBeInstanceOf(BitrixToken);

      expect(loadedFuture!.isExpired()).toBe(false);
      expect(loadedExpired!.isExpired()).toBe(true);
    });
  });
});
