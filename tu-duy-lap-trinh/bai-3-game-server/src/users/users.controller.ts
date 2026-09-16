import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    const user = await this.usersService.findById(req.user.id);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      nickname: user.nickname,
      createdAt: user.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    const updated = await this.usersService.updateProfile(req.user.id, updateUserDto);
    return {
      message: 'Cập nhật thông tin thành công',
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        nickname: updated.nickname,
        createdAt: updated.createdAt,
      },
    };
  }
}
