import { IsNotEmpty, IsString, MinLength, IsOptional, IsEmail } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'Tên đăng nhập (username) không được để trống' })
  @IsString()
  @MinLength(3, { message: 'Username phải có ít nhất 3 ký tự' })
  username: string;

  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @IsOptional()
  @IsString()
  nickname?: string;
}
