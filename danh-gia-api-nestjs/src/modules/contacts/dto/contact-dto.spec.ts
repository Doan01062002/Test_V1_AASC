import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateContactDto } from './create-contact.dto';
import { UpdateContactDto } from './update-contact.dto';

describe('Contact DTOs Validation', () => {
  describe('CreateContactDto', () => {
    it('TC-DTO-01: should validate successfully with valid fields', async () => {
      const payload = {
        name: 'Nguyễn Văn An',
        phone: '0912345678',
        email: 'an@example.com',
        website: 'https://an.vn',
        street: '123 Lê Lợi',
        ward: 'Bến Nghé',
        district: 'Quận 1',
        city: 'TP. Hồ Chí Minh',
        bankName: 'Vietcombank',
        accountNumber: '0071001234567',
        accountHolder: 'NGUYEN VAN AN',
        bankBranch: 'Chi nhánh Bến Thành',
      };

      const dto = plainToInstance(CreateContactDto, payload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('TC-DTO-02: should accept phone starting with +84 and 9-10 digits', async () => {
      const payload = {
        name: 'Trần Văn Ba',
        phone: '+84912345678',
        email: 'ba@example.com',
      };

      const dto = plainToInstance(CreateContactDto, payload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('TC-DTO-03: should fail validation when name is empty', async () => {
      const payload = {
        name: '',
        phone: '0912345678',
        email: 'an@example.com',
      };

      const dto = plainToInstance(CreateContactDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find((e) => e.property === 'name');
      expect(nameError).toBeDefined();
      expect(Object.values(nameError.constraints)).toContain('Tên không được để trống');
    });

    it('TC-DTO-04: should fail validation when phone is invalid', async () => {
      const payload = {
        name: 'Nguyễn Văn An',
        phone: '12345',
        email: 'an@example.com',
      };

      const dto = plainToInstance(CreateContactDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const phoneError = errors.find((e) => e.property === 'phone');
      expect(phoneError).toBeDefined();
      expect(Object.values(phoneError.constraints)).toContain('Số điện thoại không hợp lệ');
    });

    it('TC-DTO-05: should fail validation when email format is invalid', async () => {
      const payload = {
        name: 'Nguyễn Văn An',
        phone: '0912345678',
        email: 'invalid-email-format',
      };

      const dto = plainToInstance(CreateContactDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
      expect(Object.values(emailError.constraints)).toContain('Email không hợp lệ');
    });

    it('TC-DTO-06: should fail validation when website is invalid URL', async () => {
      const payload = {
        name: 'Nguyễn Văn An',
        phone: '0912345678',
        email: 'an@example.com',
        website: 'not-a-url',
      };

      const dto = plainToInstance(CreateContactDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const webError = errors.find((e) => e.property === 'website');
      expect(webError).toBeDefined();
      expect(Object.values(webError.constraints)).toContain('Website không đúng định dạng URL');
    });
  });

  describe('UpdateContactDto', () => {
    it('TC-DTO-07: should validate partial fields successfully', async () => {
      const payload = {
        phone: '0987654321',
      };

      const dto = plainToInstance(UpdateContactDto, payload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('TC-DTO-08: should fail if provided partial field is invalid', async () => {
      const payload = {
        email: 'not-an-email',
      };

      const dto = plainToInstance(UpdateContactDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
    });
  });
});
