import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';

export class CreateContactDto {
  @ApiProperty({
    description: 'Tên của contact (bắt buộc)',
    example: 'Nguyễn Văn An',
  })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @IsString({ message: 'Tên phải là chuỗi ký tự' })
  name: string;

  @ApiProperty({
    description: 'Số điện thoại hợp lệ (+84 hoặc 0 bắt đầu, 10-11 chữ số)',
    example: '0912345678',
  })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @Matches(/^(\+84|0)[0-9]{9,10}$/, { message: 'Số điện thoại không hợp lệ' })
  phone: string;

  @ApiProperty({
    description: 'Email theo chuẩn RFC 5322',
    example: 'nguyenvanan@example.com',
  })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ Website',
    example: 'https://example.com',
  })
  @IsOptional()
  @IsUrl(
    { require_protocol: true, require_tld: false },
    { message: 'Website không đúng định dạng URL' },
  )
  website?: string;

  @ApiPropertyOptional({
    description: 'Số nhà, tên đường',
    example: 'Số 123 Đường Lê Lợi',
  })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({
    description: 'Phường/Xã',
    example: 'Phường Bến Nghé',
  })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional({
    description: 'Quận/Huyện',
    example: 'Quận 1',
  })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({
    description: 'Tỉnh/Thành phố',
    example: 'Thành phố Hồ Chí Minh',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Tên ngân hàng',
    example: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)',
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Số tài khoản ngân hàng',
    example: '0071001234567',
  })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({
    description: 'Chi nhánh ngân hàng',
    example: 'Chi nhánh Bến Thành',
  })
  @IsOptional()
  @IsString()
  bankBranch?: string;

  @ApiPropertyOptional({
    description: 'Tên chủ tài khoản ngân hàng',
    example: 'NGUYEN VAN AN',
  })
  @IsOptional()
  @IsString()
  accountHolder?: string;

  @ApiPropertyOptional({
    description: 'Bí danh tên chủ tài khoản (accountName)',
    example: 'NGUYEN VAN AN',
  })
  @IsOptional()
  @IsString()
  accountName?: string;
}
