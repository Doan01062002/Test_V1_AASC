import { Controller, Get, Post, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Auth / OAuth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get(['install', 'oauth/install'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xử lý sự kiện cài đặt ứng dụng từ Bitrix24 (Redirect/GET)' })
  @ApiResponse({ status: 200, description: 'Cài đặt ứng dụng thành công' })
  async handleInstallGet(@Query() query: any) {
    return this.authService.processInstall(query);
  }

  @Post(['install', 'oauth/install'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xử lý sự kiện cài đặt ứng dụng từ Bitrix24 (Iframe/POST)' })
  @ApiResponse({ status: 200, description: 'Cài đặt ứng dụng thành công' })
  async handleInstallPost(@Body() body: any) {
    return this.authService.processInstall(body);
  }
}
