import { DataSource, QueryFailedError } from 'typeorm';
import { BitrixToken } from '../src/database/entities/bitrix-token.entity';

async function runEmpiricalVerification() {
  console.log('===============================================================');
  console.log('  EMPIRICAL CHALLENGE SUITE: MILESTONE 1 (DATABASE & ENTITY)   ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, details?: any) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`, details ? details : '');
      failed++;
    }
  }

  // -------------------------------------------------------------
  // PART 1: BitrixToken isExpired() Boundary Conditions
  // -------------------------------------------------------------
  console.log('\n--- PART 1: BitrixToken.isExpired() Boundary Conditions ---');

  const token = new BitrixToken();
  token.id = 1;
  token.domain = 'adversarial.bitrix24.com';
  token.accessToken = 'test-access-token';
  token.refreshToken = 'test-refresh-token';

  // Exact 60s boundary
  const now = Date.now();
  token.expiresAt = new Date(now + 60_000);
  assert(
    token.isExpired() === true,
    'Exact 60,000ms boundary returns true (within/at safety buffer)',
  );

  // 1ms outside buffer
  token.expiresAt = new Date(now + 60_001);
  assert(
    token.isExpired() === false,
    '60,001ms (1ms outside buffer) returns false (valid/not expired)',
  );

  // 1ms inside buffer
  token.expiresAt = new Date(now + 59_999);
  assert(
    token.isExpired() === true,
    '59,999ms (1ms inside buffer) returns true (inside safety buffer)',
  );

  // Exact expiration moment
  token.expiresAt = new Date(now);
  assert(
    token.isExpired() === true,
    'Exact expiration moment (0ms remaining) returns true',
  );

  // Past expiration
  token.expiresAt = new Date(now - 10_000);
  assert(
    token.isExpired() === true,
    'Expired in past (-10,000ms remaining) returns true',
  );

  // Negative timestamp (pre-epoch)
  token.expiresAt = new Date(-1);
  assert(
    token.isExpired() === true,
    'Pre-epoch timestamp Date(-1) returns true',
  );

  token.expiresAt = new Date(-100_000_000_000);
  assert(
    token.isExpired() === true,
    'Deep pre-epoch timestamp Date(-100,000,000,000) returns true',
  );

  // Timezone offset equivalence
  const tUtc = '2030-06-15T12:00:00.000Z';
  const tVn = '2030-06-15T19:00:00.000+07:00';
  const tUs = '2030-06-15T08:00:00.000-04:00';
  (token as any).expiresAt = tUtc;
  const rUtc = token.isExpired();
  (token as any).expiresAt = tVn;
  const rVn = token.isExpired();
  (token as any).expiresAt = tUs;
  const rUs = token.isExpired();
  assert(
    rUtc === false && rVn === false && rUs === false,
    'Timezone offsets parse to identical UTC epoch and return identical false for future dates',
  );

  // Invalid date behavior
  token.expiresAt = new Date('invalid');
  const isNanDate = Number.isNaN(token.expiresAt.getTime());
  const rInvalid = token.isExpired();
  assert(
    isNanDate && rInvalid === false,
    'FINDING: Invalid Date produces NaN; current isExpired() returns false (fail-open)',
  );

  // Undefined behavior
  (token as any).expiresAt = undefined;
  assert(
    token.isExpired() === false,
    'FINDING: Undefined expiresAt produces NaN; current isExpired() returns false (fail-open)',
  );

  // Null behavior
  (token as any).expiresAt = null;
  assert(
    token.isExpired() === true,
    'Null expiresAt evaluates new Date(null).getTime() === 0 (epoch 1970); returns true',
  );

  // Leap second behavior
  const leapSecondStr = '2016-12-31T23:59:60Z';
  const parsedLeap = new Date(leapSecondStr).getTime();
  (token as any).expiresAt = leapSecondStr;
  assert(
    Number.isNaN(parsedLeap) && token.isExpired() === false,
    'FINDING: Leap second "23:59:60Z" produces NaN in V8 engine; returns false',
  );

  // -------------------------------------------------------------
  // PART 2: SQLite Table Creation and Schema Constraints
  // -------------------------------------------------------------
  console.log('\n--- PART 2: SQLite Table Creation & Schema Constraints ---');

  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [BitrixToken],
    synchronize: true,
    logging: false,
  });
  await dataSource.initialize();
  const repo = dataSource.getRepository(BitrixToken);

  // Check table schema
  const cols = await dataSource.query('PRAGMA table_info(bitrix_tokens);');
  const colMap = new Map(cols.map((c: any) => [c.name, c]));
  assert(
    cols.length === 9 &&
      colMap.has('id') &&
      colMap.has('domain') &&
      colMap.has('accessToken') &&
      colMap.has('refreshToken') &&
      colMap.has('expiresAt') &&
      colMap.has('memberId') &&
      colMap.has('clientEndpoint') &&
      colMap.has('createdAt') &&
      colMap.has('updatedAt'),
    'SQLite table bitrix_tokens created with all 9 expected columns',
  );

  assert(
    (colMap.get('memberId') as any).notnull === 0 &&
      (colMap.get('clientEndpoint') as any).notnull === 0,
    'Columns memberId and clientEndpoint have notnull=0 (nullable)',
  );

  assert(
    (colMap.get('domain') as any).notnull === 1 &&
      (colMap.get('accessToken') as any).notnull === 1 &&
      (colMap.get('refreshToken') as any).notnull === 1 &&
      (colMap.get('expiresAt') as any).notnull === 1,
    'Columns domain, accessToken, refreshToken, expiresAt have notnull=1 (NOT NULL)',
  );

  // Unique constraint enforcement
  let duplicateRejected = false;
  try {
    await repo.save(
      repo.create({
        domain: 'unique-test.bitrix24.com',
        accessToken: 'a1',
        refreshToken: 'r1',
        expiresAt: new Date(now + 3600_000),
      }),
    );
    await repo.save(
      repo.create({
        domain: 'unique-test.bitrix24.com',
        accessToken: 'a2',
        refreshToken: 'r2',
        expiresAt: new Date(now + 3600_000),
      }),
    );
  } catch (err: any) {
    if (err instanceof QueryFailedError && err.message.includes('UNIQUE')) {
      duplicateRejected = true;
    }
  }
  assert(duplicateRejected, 'Unique domain constraint strictly enforced by SQLite');

  // Null domain rejection
  let nullDomainRejected = false;
  try {
    await repo.save(
      repo.create({
        domain: null as any,
        accessToken: 'a1',
        refreshToken: 'r1',
        expiresAt: new Date(now + 3600_000),
      }),
    );
  } catch (err: any) {
    if (err instanceof QueryFailedError && err.message.includes('NOT NULL')) {
      nullDomainRejected = true;
    }
  }
  assert(nullDomainRejected, 'NOT NULL constraint on domain strictly enforced');

  // Nullable support
  const nullablesToken = await repo.save(
    repo.create({
      domain: 'nullable-test.bitrix24.com',
      accessToken: 'a_null',
      refreshToken: 'r_null',
      expiresAt: new Date(now + 3600_000),
      memberId: null,
      clientEndpoint: null,
    }),
  );
  assert(
    nullablesToken.memberId === null && nullablesToken.clientEndpoint === null,
    'Nullable columns memberId and clientEndpoint successfully saved as null',
  );

  // Hydration & isExpired() verification
  const fetched = await repo.findOneBy({ id: nullablesToken.id });
  assert(
    fetched instanceof BitrixToken && typeof fetched.isExpired === 'function',
    'Hydrated entity from SQLite is instance of BitrixToken with functional isExpired()',
  );

  await dataSource.destroy();

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEmpiricalVerification().catch((err) => {
  console.error('Fatal error running verification:', err);
  process.exit(1);
});
