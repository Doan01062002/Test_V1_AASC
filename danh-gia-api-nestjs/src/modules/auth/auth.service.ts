import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Bitrix24Service } from '../bitrix24/bitrix24.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly bitrixService: Bitrix24Service,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Processes installation payload from GET query or POST body
   */
  async processInstall(payload: any) {
    this.logger.log(`Nhận payload cài đặt Bitrix24: ${JSON.stringify(payload)}`);

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Payload cài đặt không hợp lệ.');
    }

    const domain =
      payload.domain ||
      payload.DOMAIN ||
      payload.auth?.domain ||
      this.configService.get<string>('BITRIX24_DOMAIN') ||
      this.configService.get<string>('bitrixDomain');

    const memberId =
      payload.member_id ||
      payload.MEMBER_ID ||
      payload.memberId ||
      payload.auth?.member_id;

    const code = payload.code || payload.CODE;

    const accessToken =
      payload.AUTH_ID ||
      payload.access_token ||
      payload.accessToken ||
      payload.auth?.access_token;

    const refreshToken =
      payload.REFRESH_ID ||
      payload.refresh_token ||
      payload.refreshToken ||
      payload.auth?.refresh_token;

    const rawExpires =
      payload.AUTH_EXPIRES ||
      payload.expires_in ||
      payload.expiresIn ||
      payload.auth?.expires_in;

    const expiresIn =
      typeof rawExpires === 'number' ? rawExpires : parseInt(rawExpires, 10) || 3600;

    // Case 1: Direct tokens from Bitrix24 application iframe
    if (accessToken && refreshToken) {
      const clientEndpoint =
        payload.client_endpoint ||
        payload.CLIENT_ENDPOINT ||
        payload.auth?.client_endpoint ||
        (domain ? `https://${domain}/rest/` : undefined);

      const savedToken = await this.bitrixService.saveToken({
        domain,
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + (expiresIn - 60) * 1000),
        memberId,
        clientEndpoint,
      });

      return {
        success: true,
        status: 'installed',
        message: 'Cài đặt ứng dụng và lưu token thành công từ iframe payload.',
        domain: savedToken.domain,
      };
    }

    // Case 2: Authorization code exchange
    if (code) {
      const clientId =
        this.configService.get<string>('CLIENT_ID') ||
        this.configService.get<string>('clientId');
      const clientSecret =
        this.configService.get<string>('CLIENT_SECRET') ||
        this.configService.get<string>('clientSecret');

      try {
        const exchangeUrl = 'https://oauth.bitrix.info/oauth/token/';
        const params = {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
        };

        const res = await firstValueFrom(
          this.httpService.get(exchangeUrl, { params, timeout: 10000 }),
        );

        if (res.data && res.data.error) {
          throw new Error(res.data.error_description || res.data.error);
        }

        const {
          access_token,
          refresh_token,
          expires_in,
          client_endpoint,
          member_id: resMemberId,
          domain: resDomain,
        } = res.data;

        const targetDomain = domain || resDomain;
        const targetMemberId = memberId || resMemberId;
        const expiresInSec =
          typeof expires_in === 'number' ? expires_in : parseInt(expires_in, 10) || 3600;

        const savedToken = await this.bitrixService.saveToken({
          domain: targetDomain,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: new Date(Date.now() + (expiresInSec - 60) * 1000),
          memberId: targetMemberId,
          clientEndpoint:
            client_endpoint ||
            (targetDomain ? `https://${targetDomain}/rest/` : undefined),
        });

        return {
          success: true,
          status: 'installed',
          message: 'Trao đổi mã code và lưu token thành công.',
          domain: savedToken.domain,
        };
      } catch (err: any) {
        this.logger.error(
          'Lỗi khi trao đổi code OAuth:',
          err.response?.data || err.message,
        );
        throw new BadRequestException(
          'Không thể xác thực mã code với Bitrix24 OAuth server.',
        );
      }
    }

    throw new BadRequestException(
      'Payload cài đặt không hợp lệ. Cần có code hoặc AUTH_ID/access_token.',
    );
  }
}
