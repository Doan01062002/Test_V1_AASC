import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers || {};
    const apiKey =
      headers['x-api-key'] ||
      headers['X-API-KEY'] ||
      headers['X-Api-Key'];

    if (!apiKey) {
      throw new UnauthorizedException('Thiếu header x-api-key');
    }

    const expectedKey =
      this.configService?.get<string>('API_KEY') ||
      this.configService?.get<string>('apiKey') ||
      process.env.API_KEY ||
      'default-secret-api-key';

    if (apiKey !== expectedKey) {
      throw new UnauthorizedException('API Key không hợp lệ');
    }

    return true;
  }
}
