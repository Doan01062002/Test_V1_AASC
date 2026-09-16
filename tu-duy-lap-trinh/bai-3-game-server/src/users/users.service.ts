import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(username: string, plainPassword: string, email?: string, nickname?: string): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { username } });
    if (existing) {
      throw new ConflictException(`Tên đăng nhập "${username}" đã được sử dụng.`);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      email: email || null,
      nickname: nickname || username,
    });

    return await this.userRepository.save(user);
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng ID: "${id}"`);
    }
    return user;
  }

  async updateProfile(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (updateUserDto.email !== undefined) {
      user.email = updateUserDto.email;
    }
    if (updateUserDto.nickname !== undefined) {
      user.nickname = updateUserDto.nickname;
    }

    return await this.userRepository.save(user);
  }
}
