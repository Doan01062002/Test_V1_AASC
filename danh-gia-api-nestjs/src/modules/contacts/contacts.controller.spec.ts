import { Test, TestingModule } from '@nestjs/testing';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ConfigService } from '@nestjs/config';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

describe('ContactsController', () => {
  let controller: ContactsController;
  let service: ContactsService;

  const mockContactsService = {
    getContacts: jest.fn(),
    getContactById: jest.fn(),
    createContact: jest.fn(),
    updateContact: jest.fn(),
    deleteContact: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [
        {
          provide: ContactsService,
          useValue: mockContactsService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-api-key'),
          },
        },
      ],
    }).compile();

    controller = module.get<ContactsController>(ContactsController);
    service = module.get<ContactsService>(ContactsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getContacts', () => {
    it('TC-CTRL-01: should return array of contacts', async () => {
      const mockResult = [{ id: 1, name: 'Nguyen Van A' }];
      mockContactsService.getContacts.mockResolvedValueOnce(mockResult);

      const result = await controller.getContacts();
      expect(result).toBe(mockResult);
      expect(service.getContacts).toHaveBeenCalledTimes(1);
    });
  });

  describe('getContactById', () => {
    it('TC-CTRL-02: should return single contact by id', async () => {
      const mockResult = { id: 10, name: 'Le Van B' };
      mockContactsService.getContactById.mockResolvedValueOnce(mockResult);

      const result = await controller.getContactById(10);
      expect(result).toBe(mockResult);
      expect(service.getContactById).toHaveBeenCalledWith(10);
    });
  });

  describe('createContact', () => {
    it('TC-CTRL-03: should create contact and return 201 response data', async () => {
      const dto: CreateContactDto = {
        name: 'Tran C',
        phone: '0912345678',
        email: 'c@example.com',
      };
      const mockResult = { id: 25, ...dto };
      mockContactsService.createContact.mockResolvedValueOnce(mockResult);

      const result = await controller.createContact(dto);
      expect(result).toBe(mockResult);
      expect(service.createContact).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateContact', () => {
    it('TC-CTRL-04: should update contact and return 200 response data', async () => {
      const dto: UpdateContactDto = { name: 'Tran C Updated' };
      const mockResult = { statusCode: 200, message: 'Cập nhật contact thành công', id: 25 };
      mockContactsService.updateContact.mockResolvedValueOnce(mockResult);

      const result = await controller.updateContact(25, dto);
      expect(result).toBe(mockResult);
      expect(service.updateContact).toHaveBeenCalledWith(25, dto);
    });
  });

  describe('deleteContact', () => {
    it('TC-CTRL-05: should delete contact and return 200 response data', async () => {
      const mockResult = { statusCode: 200, message: 'Contact đã được xóa thành công', id: 25 };
      mockContactsService.deleteContact.mockResolvedValueOnce(mockResult);

      const result = await controller.deleteContact(25);
      expect(result).toBe(mockResult);
      expect(service.deleteContact).toHaveBeenCalledWith(25);
    });
  });
});
