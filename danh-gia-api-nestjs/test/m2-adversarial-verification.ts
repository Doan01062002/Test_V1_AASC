import { DataSource } from 'typeorm';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import {
  BadGatewayException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { BitrixToken } from '../src/database/entities/bitrix-token.entity';
import { Bitrix24Service } from '../src/modules/bitrix24/bitrix24.service';
import { AuthService } from '../src/modules/auth/auth.service';

async function runM2EmpiricalVerification() {
  console.log('========================================================================');
  console.log('  EMPIRICAL CHALLENGE SUITE: MILESTONE 2 (OAUTH 2.0 & BITRIX24 CLIENT)  ');
  console.log('========================================================================\n');

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

  // -------------------------------------------------------------------
  // PART 1: Real SQLite Persistence & Timestamp Tracking
  // -------------------------------------------------------------------
  console.log('\n--- PART 1: Real SQLite Persistence & Timestamps (saveToken & refreshToken) ---');

  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [BitrixToken],
    synchronize: true,
    logging: false,
  });
  await dataSource.initialize();
  const tokenRepo = dataSource.getRepository(BitrixToken);

  const mockHttpService: any = {
    post: () => {},
    get: () => {},
  };

  const mockConfigService: any = {
    get: (key: string) => {
      if (key === 'BITRIX24_DOMAIN') return 'test-portal.bitrix24.vn';
      if (key === 'CLIENT_ID') return 'mock_client_id';
      if (key === 'CLIENT_SECRET') return 'mock_client_secret';
      return null;
    },
  };

  const bitrixService = new Bitrix24Service(
    tokenRepo,
    mockHttpService,
    mockConfigService,
  );

  // 1.1 Initial saveToken
  const saved1 = await bitrixService.saveToken({
    domain: 'test-portal.bitrix24.vn',
    accessToken: 'initial_access_token_1',
    refreshToken: 'initial_refresh_token_1',
    expiresAt: new Date(Date.now() + 3600 * 1000),
    memberId: 'member_alpha',
    clientEndpoint: 'https://test-portal.bitrix24.vn/rest/',
  });

  const row1 = await tokenRepo.findOne({ where: { domain: 'test-portal.bitrix24.vn' } });
  assert(
    row1 !== null &&
      row1.accessToken === 'initial_access_token_1' &&
      row1.memberId === 'member_alpha' &&
      row1.createdAt instanceof Date &&
      row1.updatedAt instanceof Date,
    '1.1 saveToken persists complete record to SQLite with createdAt/updatedAt timestamps',
  );

  // 1.2 Upsert: update existing token record in SQLite
  const initialUpdatedAt = row1.updatedAt.getTime();
  // Small tick for timestamp divergence
  await new Promise((r) => setTimeout(r, 50));

  await bitrixService.saveToken({
    domain: 'test-portal.bitrix24.vn',
    accessToken: 'updated_access_token_2',
    refreshToken: 'updated_refresh_token_2',
  });

  const totalCount = await tokenRepo.count();
  const row2 = await tokenRepo.findOne({ where: { domain: 'test-portal.bitrix24.vn' } });

  assert(
    totalCount === 1 &&
      row2.accessToken === 'updated_access_token_2' &&
      row2.refreshToken === 'updated_refresh_token_2' &&
      row2.memberId === 'member_alpha',
    '1.2 saveToken accurately upserts existing SQLite record without duplicating rows',
  );

  // 1.3 saveToken without domain or config fallback throws BadRequestException
  const badConfigService: any = { get: () => null };
  const badBitrixService = new Bitrix24Service(tokenRepo, mockHttpService, badConfigService);
  let domainExceptionCaught = false;
  try {
    await badBitrixService.saveToken({ accessToken: 'no_domain_token' });
  } catch (err: any) {
    if (err instanceof BadRequestException) {
      domainExceptionCaught = true;
    }
  }
  assert(
    domainExceptionCaught,
    '1.3 saveToken throws BadRequestException when domain is missing',
  );

  // 1.4 refreshToken persistence with real SQLite
  const oauthRefreshResponse: AxiosResponse = {
    data: {
      access_token: 'refreshed_oauth_access_999',
      refresh_token: 'refreshed_oauth_refresh_999',
      expires_in: 7200,
      client_endpoint: 'https://test-portal.bitrix24.vn/rest/',
      member_id: 'member_refreshed_999',
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  };
  mockHttpService.get = () => of(oauthRefreshResponse);

  const beforeRefresh = Date.now();
  const refreshedToken = await bitrixService.refreshToken(row2);
  const row3 = await tokenRepo.findOne({ where: { domain: 'test-portal.bitrix24.vn' } });

  const expectedMinExpiry = beforeRefresh + (7200 - 60) * 1000 - 1000;
  const expectedMaxExpiry = beforeRefresh + (7200 - 60) * 1000 + 2000;
  const actualExpiry = row3.expiresAt.getTime();

  assert(
    row3.accessToken === 'refreshed_oauth_access_999' &&
      row3.refreshToken === 'refreshed_oauth_refresh_999' &&
      row3.memberId === 'member_refreshed_999' &&
      actualExpiry >= expectedMinExpiry &&
      actualExpiry <= expectedMaxExpiry,
    '1.4 refreshToken updates access_token, refresh_token, and accurate expiresAt in SQLite',
    { actualExpiry, expectedMinExpiry, expectedMaxExpiry },
  );

  // 1.5 refreshToken failure leaves SQLite in consistent state and throws UnauthorizedException
  mockHttpService.get = () =>
    throwError(() => ({
      response: { status: 400, data: { error: 'invalid_grant', error_description: 'Token expired or revoked' } },
      message: 'Request failed with status code 400',
    }));

  let refreshExceptionCaught = false;
  try {
    await bitrixService.refreshToken(row3);
  } catch (err: any) {
    if (err instanceof UnauthorizedException) {
      refreshExceptionCaught = true;
    }
  }
  assert(
    refreshExceptionCaught,
    '1.5 refreshToken throws UnauthorizedException when OAuth refresh_token exchange fails',
  );


  // -------------------------------------------------------------------
  // PART 2: callBitrixAPI Retry Logic & Infinite Loop Prevention
  // -------------------------------------------------------------------
  console.log('\n--- PART 2: callBitrixAPI Retry Logic & Infinite Loop Prevention ---');

  // 2.1 Retry exactly once on 401 expired_token and succeed
  let callCount21 = 0;
  let refreshCount21 = 0;
  mockHttpService.get = () => {
    refreshCount21++;
    return of({
      data: {
        access_token: 'brand_new_token_after_401',
        refresh_token: 'brand_new_refresh_after_401',
        expires_in: 3600,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  };

  mockHttpService.post = (url: string, body: any) => {
    callCount21++;
    if (callCount21 === 1) {
      return throwError(() => ({
        response: {
          status: 401,
          data: { error: 'expired_token', error_description: 'The access token provided has expired.' },
        },
      }));
    }
    return of({
      data: { result: { success: true, callAttempt: callCount21, usedAuth: body.auth } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  };

  const res21 = await bitrixService.callBitrixAPI('crm.contact.list', { test: true });
  assert(
    callCount21 === 2 &&
      refreshCount21 === 1 &&
      res21.success === true &&
      res21.usedAuth === 'brand_new_token_after_401',
    '2.1 Retries exactly once on 401 expired_token, refreshes token, and uses new auth header',
    { callCount21, refreshCount21, res21 },
  );

  // 2.2 Retry on 200 OK with Bitrix error body { error: 'expired_token' }
  let callCount22 = 0;
  let refreshCount22 = 0;
  mockHttpService.get = () => {
    refreshCount22++;
    return of({
      data: {
        access_token: 'brand_new_token_after_200err',
        refresh_token: 'brand_new_refresh_after_200err',
        expires_in: 3600,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  };

  mockHttpService.post = (url: string, body: any) => {
    callCount22++;
    if (callCount22 === 1) {
      return of({
        data: { error: 'expired_token', error_description: 'Bitrix token expired (in 200 body)' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });
    }
    return of({
      data: { result: 'recovered_after_200_error' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  };

  const res22 = await bitrixService.callBitrixAPI('crm.contact.get', { id: 1 });
  assert(
    callCount22 === 2 && refreshCount22 === 1 && res22 === 'recovered_after_200_error',
    '2.2 Retries and recovers when Bitrix returns 200 OK with { error: "expired_token" } in body',
    { callCount22, refreshCount22 },
  );

  // 2.3 ADVERSARIAL STRESS TEST: Retry ALSO FAILS with expired_token (Infinite Loop Attack)
  let callCount23 = 0;
  let refreshCount23 = 0;
  mockHttpService.get = () => {
    refreshCount23++;
    return of({
      data: {
        access_token: 'failing_token',
        refresh_token: 'failing_refresh',
        expires_in: 3600,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  };

  // Both first and subsequent calls fail with 401 expired_token
  mockHttpService.post = () => {
    callCount23++;
    return throwError(() => ({
      response: {
        status: 401,
        data: { error: 'expired_token', error_description: 'Persistent token expiration failure.' },
      },
    }));
  };

  let persistentExpiryCaught = false;
  let persistentExpiryError: any = null;
  try {
    await bitrixService.callBitrixAPI('crm.contact.list');
  } catch (err: any) {
    persistentExpiryCaught = true;
    persistentExpiryError = err;
  }

  assert(
    persistentExpiryCaught &&
      persistentExpiryError instanceof BadGatewayException &&
      callCount23 === 2 &&
      refreshCount23 === 1,
    '2.3 ADVERSARIAL: When retry also fails with expired_token, retries EXACTLY ONCE, prevents infinite loop, and throws BadGatewayException',
    { callCount23, refreshCount23, error: persistentExpiryError?.message },
  );

  // 2.4 ADVERSARIAL STRESS TEST: Retry ALSO FAILS with 200 OK { error: 'expired_token' }
  let callCount24 = 0;
  let refreshCount24 = 0;
  mockHttpService.get = () => {
    refreshCount24++;
    return of({
      data: {
        access_token: 'failing_token_24',
        refresh_token: 'failing_refresh_24',
        expires_in: 3600,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  };

  mockHttpService.post = () => {
    callCount24++;
    return of({
      data: { error: 'expired_token', error_description: 'Persistent 200 OK token expiration.' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  };

  let persistent200Caught = false;
  try {
    await bitrixService.callBitrixAPI('crm.contact.list');
  } catch (err: any) {
    persistent200Caught = true;
  }

  assert(
    persistent200Caught && callCount24 === 2 && refreshCount24 === 1,
    '2.4 ADVERSARIAL: When retry also fails with 200 OK { error: expired_token }, retries EXACTLY ONCE and halts',
    { callCount24, refreshCount24 },
  );

  // 2.5 ADVERSARIAL STRESS TEST: refreshToken fails during retry
  let callCount25 = 0;
  let refreshCount25 = 0;
  mockHttpService.post = () => {
    callCount25++;
    return throwError(() => ({
      response: {
        status: 401,
        data: { error: 'expired_token', error_description: 'Expired token' },
      },
    }));
  };

  mockHttpService.get = () => {
    refreshCount25++;
    return throwError(() => ({
      response: { status: 400, data: { error: 'invalid_grant' } },
      message: 'Refresh token revoked',
    }));
  };

  let refreshFailureCaught = false;
  let refreshFailureError: any = null;
  try {
    await bitrixService.callBitrixAPI('crm.contact.list');
  } catch (err: any) {
    refreshFailureCaught = true;
    refreshFailureError = err;
  }

  assert(
    refreshFailureCaught &&
      refreshFailureError instanceof UnauthorizedException &&
      callCount25 === 1 &&
      refreshCount25 === 1,
    '2.5 ADVERSARIAL: When refreshToken fails during retry, immediately throws UnauthorizedException without loop',
    { callCount25, refreshCount25, error: refreshFailureError?.message },
  );

  // 2.6 Non-auth Bitrix error (e.g. 404 / ERROR_METHOD_NOT_FOUND)
  let callCount26 = 0;
  let refreshCount26 = 0;
  mockHttpService.post = () => {
    callCount26++;
    return throwError(() => ({
      response: {
        status: 404,
        data: { error: 'ERROR_METHOD_NOT_FOUND', error_description: 'Method not found' },
      },
    }));
  };
  mockHttpService.get = () => {
    refreshCount26++;
    return of({});
  };

  let methodNotFoundCaught = false;
  try {
    await bitrixService.callBitrixAPI('invalid.method');
  } catch (err: any) {
    methodNotFoundCaught = true;
  }

  assert(
    methodNotFoundCaught && callCount26 === 1 && refreshCount26 === 0,
    '2.6 Non-auth Bitrix error does not trigger refresh and does not retry',
    { callCount26, refreshCount26 },
  );


  // -------------------------------------------------------------------
  // PART 3: Timeout (10s) & Connection Abortion / Network Failures
  // -------------------------------------------------------------------
  console.log('\n--- PART 3: Timeout (10s) & Network Error Resilience ---');

  // 3.1 Timeout configuration verification (10000ms in axios request config)
  let capturedConfig: any = null;
  mockHttpService.post = (url: string, body: any, config: any) => {
    capturedConfig = config;
    return of({ data: { result: 'ok' }, status: 200, statusText: 'OK', headers: {}, config: {} as any });
  };

  await bitrixService.callBitrixAPI('crm.contact.list');
  assert(
    capturedConfig !== null && capturedConfig.timeout === 10000,
    '3.1 Explicit 10,000ms timeout configured in HTTP POST call to Bitrix24',
    { timeout: capturedConfig?.timeout },
  );

  // 3.2 ECONNABORTED timeout error handling
  mockHttpService.post = () =>
    throwError(() => ({
      code: 'ECONNABORTED',
      message: 'timeout of 10000ms exceeded',
    }));

  let timeoutCaught = false;
  let timeoutError: any = null;
  try {
    await bitrixService.callBitrixAPI('crm.contact.list');
  } catch (err: any) {
    timeoutCaught = true;
    timeoutError = err;
  }

  assert(
    timeoutCaught &&
      timeoutError instanceof BadGatewayException &&
      timeoutError.message.includes('Timeout'),
    '3.2 ECONNABORTED mapped to BadGatewayException with Vietnamese Timeout message',
    { message: timeoutError?.message },
  );

  // 3.3 ETIMEDOUT error handling
  mockHttpService.post = () =>
    throwError(() => ({
      code: 'ETIMEDOUT',
      message: 'connect ETIMEDOUT 185.111.111.111:443',
    }));

  let etimedoutCaught = false;
  let etimedoutError: any = null;
  try {
    await bitrixService.callBitrixAPI('crm.contact.list');
  } catch (err: any) {
    etimedoutCaught = true;
    etimedoutError = err;
  }

  assert(
    etimedoutCaught &&
      etimedoutError instanceof BadGatewayException &&
      etimedoutError.message.includes('Timeout'),
    '3.3 ETIMEDOUT mapped to BadGatewayException with Timeout message',
    { message: etimedoutError?.message },
  );

  // 3.4 ENOTFOUND (DNS resolution failure) error handling
  mockHttpService.post = () =>
    throwError(() => ({
      code: 'ENOTFOUND',
      message: 'getaddrinfo ENOTFOUND invalid-portal.bitrix24.vn',
    }));

  let enotfoundCaught = false;
  let enotfoundError: any = null;
  try {
    await bitrixService.callBitrixAPI('crm.contact.list');
  } catch (err: any) {
    enotfoundCaught = true;
    enotfoundError = err;
  }

  assert(
    enotfoundCaught &&
      enotfoundError instanceof BadGatewayException &&
      enotfoundError.message.includes('Network Error'),
    '3.4 ENOTFOUND mapped to BadGatewayException with Network Error message',
    { message: enotfoundError?.message },
  );

  // 3.5 ECONNREFUSED error handling
  mockHttpService.post = () =>
    throwError(() => ({
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED 127.0.0.1:443',
    }));

  let econnrefusedCaught = false;
  let econnrefusedError: any = null;
  try {
    await bitrixService.callBitrixAPI('crm.contact.list');
  } catch (err: any) {
    econnrefusedCaught = true;
    econnrefusedError = err;
  }

  assert(
    econnrefusedCaught &&
      econnrefusedError instanceof BadGatewayException &&
      econnrefusedError.message.includes('Network Error'),
    '3.5 ECONNREFUSED mapped to BadGatewayException with Network Error message',
    { message: econnrefusedError?.message },
  );


  // -------------------------------------------------------------------
  // PART 4: AuthService Installation Processing
  // -------------------------------------------------------------------
  console.log('\n--- PART 4: AuthService Installation Handling ---');

  const authService = new AuthService(bitrixService, mockConfigService, mockHttpService);

  // 4.1 Iframe installation (POST body with AUTH_ID & REFRESH_ID)
  const iframeResult = await authService.processInstall({
    AUTH_ID: 'iframe_auth_token_123',
    REFRESH_ID: 'iframe_refresh_token_123',
    AUTH_EXPIRES: 3600,
    DOMAIN: 'iframe-installed.bitrix24.vn',
    MEMBER_ID: 'member_iframe_99',
  });

  const iframeDbRecord = await tokenRepo.findOne({
    where: { domain: 'iframe-installed.bitrix24.vn' },
  });

  assert(
    iframeResult.success === true &&
      iframeResult.status === 'installed' &&
      iframeDbRecord !== null &&
      iframeDbRecord.accessToken === 'iframe_auth_token_123' &&
      iframeDbRecord.refreshToken === 'iframe_refresh_token_123',
    '4.1 Iframe installation payload correctly parsed and persisted into SQLite',
  );

  // 4.2 OAuth authorization code exchange (GET redirect with code)
  mockHttpService.get = () =>
    of({
      data: {
        access_token: 'code_exchanged_access_token',
        refresh_token: 'code_exchanged_refresh_token',
        expires_in: 3600,
        member_id: 'member_oauth_code_88',
        domain: 'oauth-installed.bitrix24.vn',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

  const oauthResult = await authService.processInstall({
    code: 'valid_auth_code_xyz',
    domain: 'oauth-installed.bitrix24.vn',
  });

  const oauthDbRecord = await tokenRepo.findOne({
    where: { domain: 'oauth-installed.bitrix24.vn' },
  });

  assert(
    oauthResult.success === true &&
      oauthResult.status === 'installed' &&
      oauthDbRecord !== null &&
      oauthDbRecord.accessToken === 'code_exchanged_access_token' &&
      oauthDbRecord.refreshToken === 'code_exchanged_refresh_token',
    '4.2 OAuth code exchange successfully queries oauth.bitrix.info and saves tokens in SQLite',
  );

  // 4.3 Invalid payload rejection
  let invalidPayloadCaught = false;
  try {
    await authService.processInstall({});
  } catch (err: any) {
    if (err instanceof BadRequestException) {
      invalidPayloadCaught = true;
    }
  }

  let nullPayloadCaught = false;
  try {
    await authService.processInstall(null);
  } catch (err: any) {
    if (err instanceof BadRequestException) {
      nullPayloadCaught = true;
    }
  }

  assert(
    invalidPayloadCaught && nullPayloadCaught,
    '4.3 Invalid and null install payloads strictly rejected with BadRequestException',
  );

  await dataSource.destroy();

  console.log('\n========================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runM2EmpiricalVerification().catch((err) => {
  console.error('Fatal error during M2 empirical verification:', err);
  process.exit(1);
});
