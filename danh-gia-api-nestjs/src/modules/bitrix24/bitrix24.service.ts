import {
  Injectable,
  Logger,
  BadGatewayException,
  UnauthorizedException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { BitrixToken } from '../../database/entities/bitrix-token.entity';

@Injectable()
export class Bitrix24Service {
  private readonly logger = new Logger(Bitrix24Service.name);

  constructor(
    @InjectRepository(BitrixToken)
    private readonly tokenRepository: Repository<BitrixToken>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Retrieves a valid token for the domain, automatically refreshing if expired
   */
  async getValidToken(domain?: string): Promise<BitrixToken> {
    const targetDomain =
      domain ||
      this.configService.get<string>('BITRIX24_DOMAIN') ||
      this.configService.get<string>('bitrixDomain');

    let token: BitrixToken | null = null;

    if (targetDomain) {
      token = await this.tokenRepository.findOne({ where: { domain: targetDomain } });
    }

    if (!token) {
      // Fallback to latest stored token in SQLite if domain is not matched
      token = await this.tokenRepository.findOne({ order: { updatedAt: 'DESC' } });
    }

    if (!token) {
      throw new UnauthorizedException(
        'Chưa có thông tin xác thực Bitrix24. Vui lòng cài đặt ứng dụng qua /install.',
      );
    }

    if (token.isExpired()) {
      this.logger.log(`Token cho domain ${token.domain} đã hết hạn hoặc sắp hết hạn. Đang làm mới token...`);
      token = await this.refreshToken(token);
    }

    return token;
  }

  /**
   * Refreshes OAuth token using refresh_token at https://oauth.bitrix.info/oauth/token/
   */
  async refreshToken(token: BitrixToken): Promise<BitrixToken> {
    const clientId =
      this.configService.get<string>('CLIENT_ID') ||
      this.configService.get<string>('clientId');
    const clientSecret =
      this.configService.get<string>('CLIENT_SECRET') ||
      this.configService.get<string>('clientSecret');

    const refreshUrl = 'https://oauth.bitrix.info/oauth/token/';
    const params = {
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refreshToken,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get(refreshUrl, { params, timeout: 10000 }),
      );

      if (response.data && response.data.error) {
        throw new Error(response.data.error_description || response.data.error);
      }

      const { access_token, refresh_token, expires_in, client_endpoint, member_id } =
        response.data;

      token.accessToken = access_token;
      if (refresh_token) {
        token.refreshToken = refresh_token;
      }
      const expiresInSec =
        typeof expires_in === 'number' ? expires_in : parseInt(expires_in, 10) || 3600;
      token.expiresAt = new Date(Date.now() + (expiresInSec - 60) * 1000);

      if (client_endpoint) {
        token.clientEndpoint = client_endpoint;
      }
      if (member_id) {
        token.memberId = member_id;
      }

      const updated = await this.tokenRepository.save(token);
      this.logger.log(`Làm mới token thành công cho domain: ${token.domain}`);
      return updated;
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi làm mới token: ${error.message}`,
        error.response?.data,
      );
      throw new UnauthorizedException(
        'Không thể làm mới token Bitrix24. Vui lòng cài đặt lại ứng dụng.',
      );
    }
  }

  /**
   * Generic API call wrapper with timeout (10s), error handling, and 1-time retry on expired token
   */
  async callBitrixAPI<T = any>(
    method: string,
    payload: Record<string, any> = {},
    domain?: string,
    isRetry = false,
  ): Promise<T> {
    const token = await this.getValidToken(domain);
    let endpoint = token.clientEndpoint || `https://${token.domain}/rest/`;
    if (!endpoint.endsWith('/')) {
      endpoint += '/';
    }
    const cleanMethod = method.endsWith('.json') ? method : `${method}.json`;
    const url = `${endpoint}${cleanMethod}`;

    try {
      const body = {
        ...payload,
        auth: token.accessToken,
      };

      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      if (response.data && response.data.error) {
        const bitrixError: any = new Error(
          response.data.error_description || response.data.error,
        );
        bitrixError.response = response;
        throw bitrixError;
      }

      return response.data.result;
    } catch (error: any) {
      const resData = error.response?.data;
      const errorCode = typeof resData?.error === 'string' ? resData.error : '';
      const errorDesc =
        typeof resData?.error_description === 'string'
          ? resData.error_description
          : '';
      const status = error.response?.status;

      // Check for token expiration signals from Bitrix24
      const isTokenExpired =
        status === 401 ||
        errorCode === 'expired_token' ||
        errorCode === 'invalid_token' ||
        errorDesc.toLowerCase().includes('expired_token') ||
        errorDesc.toLowerCase().includes('token has expired');

      if (isTokenExpired && !isRetry) {
        this.logger.warn(
          `Nhận lỗi token hết hạn từ Bitrix24 (${errorCode || status}). Đang làm mới và thử lại...`,
        );
        await this.refreshToken(token);
        return this.callBitrixAPI<T>(method, payload, domain, true);
      }

      this.logger.error(
        `Lỗi khi gọi Bitrix API [${method}]: ${errorCode || error.message} - ${errorDesc}`,
        error.stack,
      );

      if (
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.toLowerCase().includes('timeout')
      ) {
        throw new BadGatewayException('Kết nối đến Bitrix24 quá thời gian chờ (Timeout).');
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new BadGatewayException('Không thể kết nối đến máy chủ Bitrix24 (Network Error).');
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadGatewayException(
        `Bitrix24 API Error [${method}]: ${errorDesc || errorCode || error.message || 'Lỗi không xác định'}`,
      );
    }
  }

  /**
   * Saves or updates token for a portal
   */
  async saveToken(data: Partial<BitrixToken>): Promise<BitrixToken> {
    const domain =
      data.domain ||
      this.configService.get<string>('BITRIX24_DOMAIN') ||
      this.configService.get<string>('bitrixDomain');

    if (!domain) {
      throw new BadRequestException('Domain không được để trống khi lưu token.');
    }

    const tokenData = { ...data, domain };
    let token = await this.tokenRepository.findOne({ where: { domain } });
    if (!token) {
      token = this.tokenRepository.create(tokenData);
    } else {
      Object.assign(token, tokenData);
    }
    return this.tokenRepository.save(token);
  }
}
