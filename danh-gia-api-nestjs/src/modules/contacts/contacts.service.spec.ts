import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { Bitrix24Service } from '../bitrix24/bitrix24.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

describe('ContactsService', () => {
  let service: ContactsService;
  let bitrixService: Bitrix24Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        {
          provide: Bitrix24Service,
          useValue: {
            callBitrixAPI: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    bitrixService = module.get<Bitrix24Service>(Bitrix24Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getContacts', () => {
    it('TC-CONTACT-GET-01: should return empty array when Bitrix returns empty list', async () => {
      jest.spyOn(bitrixService, 'callBitrixAPI').mockResolvedValueOnce([]);

      const result = await service.getContacts();
      expect(result).toEqual([]);
      expect(bitrixService.callBitrixAPI).toHaveBeenCalledWith('crm.contact.list', expect.any(Object));
    });

    it('TC-CONTACT-GET-02: should return merged contacts with banking requisites', async () => {
      const mockContacts = [
        {
          ID: '10',
          NAME: 'Nguyễn Văn An',
          LAST_NAME: 'An',
          PHONE: [{ VALUE: '0912345678', VALUE_TYPE: 'WORK' }],
          EMAIL: [{ VALUE: 'an@example.com', VALUE_TYPE: 'WORK' }],
          WEB: [{ VALUE: 'https://example.com', VALUE_TYPE: 'WORK' }],
          ADDRESS: '123 Lê Lợi',
          ADDRESS_2: 'Bến Nghé',
          ADDRESS_CITY: 'Quận 1',
          ADDRESS_PROVINCE: 'TP.HCM',
        },
        {
          ID: '20',
          NAME: 'Trần Thị Bình',
          PHONE: [{ VALUE: '0987654321' }],
          EMAIL: [{ VALUE: 'binh@example.com' }],
        },
      ];

      const mockRequisites = [
        { ID: '100', ENTITY_ID: '10', NAME: 'Requisite Contact 10' },
      ];

      const mockBankDetails = [
        {
          ID: '1000',
          ENTITY_ID: '100',
          RQ_BANK_NAME: 'Vietcombank',
          RQ_ACC_NUM: '0071001234567',
          RQ_COR_ACC_NUM: 'NGUYEN VAN AN',
          RQ_BANK_ADDR: 'Chi nhánh Bến Thành',
        },
      ];

      jest
        .spyOn(bitrixService, 'callBitrixAPI')
        .mockImplementation(async (method: string) => {
          if (method === 'crm.contact.list') return mockContacts;
          if (method === 'crm.requisite.list') return mockRequisites;
          if (method === 'crm.requisite.bankdetail.list') return mockBankDetails;
          return null;
        });

      const result = await service.getContacts();

      expect(result).toHaveLength(2);

      // First contact with requisites
      expect(result[0].id).toBe(10);
      expect(result[0].name).toBe('Nguyễn Văn An');
      expect(result[0].phone).toBe('0912345678');
      expect(result[0].email).toBe('an@example.com');
      expect(result[0].address.street).toBe('123 Lê Lợi');
      expect(result[0].address.ward).toBe('Bến Nghé');
      expect(result[0].address.district).toBe('Quận 1');
      expect(result[0].address.city).toBe('TP.HCM');
      expect(result[0].bankingRequisites).toBeDefined();
      expect(result[0].bankingRequisites.requisiteId).toBe(100);
      expect(result[0].bankingRequisites.bankName).toBe('Vietcombank');
      expect(result[0].bankingRequisites.accountNumber).toBe('0071001234567');
      expect(result[0].bankingRequisites.accountHolder).toBe('NGUYEN VAN AN');

      // Second contact without requisites
      expect(result[1].id).toBe(20);
      expect(result[1].name).toBe('Trần Thị Bình');
      expect(result[1].bankingRequisites).toBeNull();
    });

    it('TC-CONTACT-GET-03: findAll alias should invoke getContacts', async () => {
      jest.spyOn(service, 'getContacts').mockResolvedValueOnce([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
      expect(service.getContacts).toHaveBeenCalled();
    });
  });

  describe('getContactById', () => {
    it('TC-CONTACT-BYID-01: should return contact merged with requisites', async () => {
      const mockContact = {
        ID: '42',
        NAME: 'Lê Văn Cường',
        PHONE: [{ VALUE: '0901234567' }],
        EMAIL: [{ VALUE: 'cuong@example.com' }],
        ADDRESS: '456 Nguyễn Huệ',
        ADDRESS_CITY: 'Quận 1',
        ADDRESS_PROVINCE: 'TP.HCM',
      };

      const mockRequisites = [
        { ID: '201', ENTITY_ID: '42', NAME: 'Requisite 201' },
      ];

      const mockBankDetails = [
        {
          ID: '2001',
          ENTITY_ID: '201',
          RQ_BANK_NAME: 'Techcombank',
          RQ_ACC_NUM: '19030012345678',
        },
      ];

      jest
        .spyOn(bitrixService, 'callBitrixAPI')
        .mockImplementation(async (method: string) => {
          if (method === 'crm.contact.get') return mockContact;
          if (method === 'crm.requisite.list') return mockRequisites;
          if (method === 'crm.requisite.bankdetail.list') return mockBankDetails;
          return null;
        });

      const result = await service.getContactById(42);
      expect(result.id).toBe(42);
      expect(result.name).toBe('Lê Văn Cường');
      expect(result.bankingRequisites.bankName).toBe('Techcombank');
      expect(result.bankingRequisites.accountNumber).toBe('19030012345678');
    });

    it('TC-CONTACT-BYID-02: should throw NotFoundException when contact does not exist or Bitrix throws', async () => {
      jest
        .spyOn(bitrixService, 'callBitrixAPI')
        .mockRejectedValueOnce(new Error('NOT_FOUND'));

      await expect(service.getContactById(999)).rejects.toThrow(NotFoundException);
      await expect(service.getContactById(999)).rejects.toThrow('Contact không tồn tại');
    });

    it('TC-CONTACT-BYID-03: should throw NotFoundException when Bitrix returns empty or error object', async () => {
      jest.spyOn(bitrixService, 'callBitrixAPI').mockResolvedValueOnce(null);
      await expect(service.getContactById(999)).rejects.toThrow(NotFoundException);

      jest.spyOn(bitrixService, 'callBitrixAPI').mockResolvedValueOnce({ error: 'NOT_FOUND' });
      await expect(service.getContactById(999)).rejects.toThrow(NotFoundException);
    });

    it('TC-CONTACT-BYID-04: findOne alias should invoke getContactById', async () => {
      jest.spyOn(service, 'getContactById').mockResolvedValueOnce({ id: 1 } as any);
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
      expect(service.getContactById).toHaveBeenCalledWith(1);
    });
  });

  describe('createContact', () => {
    it('TC-CONTACT-CREATE-01: should create contact without banking info', async () => {
      const dto: CreateContactDto = {
        name: 'Đặng Thùy Dung',
        phone: '0912987654',
        email: 'dung@example.com',
        street: '789 Trần Hưng Đạo',
        ward: 'Cầu Kho',
        district: 'Quận 5',
        city: 'TP.HCM',
      };

      jest.spyOn(bitrixService, 'callBitrixAPI').mockResolvedValueOnce(55);

      const result = await service.createContact(dto);

      expect(result.id).toBe(55);
      expect(result.name).toBe('Đặng Thùy Dung');
      expect(result.bankingRequisites).toBeNull();
      expect(bitrixService.callBitrixAPI).toHaveBeenCalledTimes(1);
      expect(bitrixService.callBitrixAPI).toHaveBeenCalledWith('crm.contact.add', {
        fields: {
          NAME: 'Đặng Thùy Dung',
          PHONE: [{ VALUE: '0912987654', VALUE_TYPE: 'WORK' }],
          EMAIL: [{ VALUE: 'dung@example.com', VALUE_TYPE: 'WORK' }],
          ADDRESS: '789 Trần Hưng Đạo',
          ADDRESS_2: 'Cầu Kho',
          ADDRESS_CITY: 'Quận 5',
          ADDRESS_PROVINCE: 'TP.HCM',
          ADDRESS_REGION: 'TP.HCM',
        },
        params: { REGISTER_SONET_EVENT: 'N' },
      });
    });

    it('TC-CONTACT-CREATE-02: should create contact and cascade requisite & bank detail', async () => {
      const dto: CreateContactDto = {
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
        bankBranch: 'Bến Thành',
      };

      jest
        .spyOn(bitrixService, 'callBitrixAPI')
        .mockImplementation(async (method: string) => {
          if (method === 'crm.contact.add') return 77;
          if (method === 'crm.requisite.add') return 301;
          if (method === 'crm.requisite.bankdetail.add') return 401;
          return null;
        });

      const result = await service.createContact(dto);

      expect(result.id).toBe(77);
      expect(result.name).toBe('Nguyễn Văn An');
      expect(result.phone).toBe('0912345678');
      expect(result.email).toBe('an@example.com');
      expect(result.website).toBe('https://an.vn');
      expect(result.address.street).toBe('123 Lê Lợi');
      expect(result.address.ward).toBe('Bến Nghé');
      expect(result.address.district).toBe('Quận 1');
      expect(result.address.city).toBe('TP. Hồ Chí Minh');

      expect(result.bankingRequisites).toBeDefined();
      expect(result.bankingRequisites.requisiteId).toBe(301);
      expect(result.bankingRequisites.bankDetailId).toBe(401);
      expect(result.bankingRequisites.bankName).toBe('Vietcombank');
      expect(result.bankingRequisites.accountNumber).toBe('0071001234567');
      expect(result.bankingRequisites.accountHolder).toBe('NGUYEN VAN AN');
      expect(result.bankingRequisites.bankBranch).toBe('Bến Thành');

      expect(bitrixService.callBitrixAPI).toHaveBeenCalledWith('crm.contact.add', expect.any(Object));
      expect(bitrixService.callBitrixAPI).toHaveBeenCalledWith('crm.requisite.add', {
        fields: {
          ENTITY_TYPE_ID: 3,
          ENTITY_ID: 77,
          PRESET_ID: 1,
          NAME: 'Thông tin ngân hàng - Nguyễn Văn An',
          ACTIVE: 'Y',
        },
      });
      expect(bitrixService.callBitrixAPI).toHaveBeenCalledWith('crm.requisite.bankdetail.add', {
        fields: {
          ENTITY_ID: 301,
          NAME: 'Vietcombank',
          RQ_BANK_NAME: 'Vietcombank',
          RQ_ACC_NUM: '0071001234567',
          RQ_COR_ACC_NUM: 'NGUYEN VAN AN',
          RQ_BANK_ADDR: 'Bến Thành',
          COUNTRY_ID: 1,
        },
      });
    });

    it('TC-CONTACT-CREATE-03: create alias should invoke createContact', async () => {
      jest.spyOn(service, 'createContact').mockResolvedValueOnce({ id: 1 } as any);
      const dto = { name: 'A', phone: '0912345678', email: 'a@a.com' };
      const result = await service.create(dto);
      expect(result.id).toBe(1);
      expect(service.createContact).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateContact', () => {
    it('TC-CONTACT-UPDATE-01: should throw NotFoundException when contact does not exist', async () => {
      jest.spyOn(bitrixService, 'callBitrixAPI').mockResolvedValueOnce(null);

      await expect(
        service.updateContact(999, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateContact(999, { name: 'New Name' }),
      ).rejects.toThrow('Contact không tồn tại');
    });

    it('TC-CONTACT-UPDATE-02: should update contact fields and banking details when existing', async () => {
      const existingContact = { ID: '10', NAME: 'Old Name' };
      const existingRequisites = [{ ID: '100', ENTITY_ID: '10', NAME: 'Old Req' }];
      const existingBankDetails = [
        {
          ID: '1000',
          ENTITY_ID: '100',
          RQ_BANK_NAME: 'Old Bank',
          RQ_ACC_NUM: '111111',
          RQ_COR_ACC_NUM: 'Old Holder',
          RQ_BANK_ADDR: 'Old Branch',
        },
      ];

      jest
        .spyOn(bitrixService, 'callBitrixAPI')
        .mockImplementation(async (method: string) => {
          if (method === 'crm.contact.get') return existingContact;
          if (method === 'crm.contact.update') return true;
          if (method === 'crm.requisite.list') return existingRequisites;
          if (method === 'crm.requisite.bankdetail.list') return existingBankDetails;
          if (method === 'crm.requisite.bankdetail.update') return true;
          return null;
        });

      const updateDto: UpdateContactDto = {
        name: 'Updated Name',
        phone: '0988888888',
        bankName: 'MB Bank',
        accountNumber: '99999999',
      };

      const result = await service.updateContact(10, updateDto);

      expect(result.statusCode).toBe(200);
      expect(result.id).toBe(10);
      expect(result.message).toBe('Cập nhật contact thành công');
      expect(result.bankingRequisites.bankName).toBe('MB Bank');
      expect(result.bankingRequisites.accountNumber).toBe('99999999');

      expect(bitrixService.callBitrixAPI).toHaveBeenCalledWith('crm.contact.update', {
        id: 10,
        fields: {
          NAME: 'Updated Name',
          PHONE: [{ VALUE: '0988888888', VALUE_TYPE: 'WORK' }],
        },
      });

      expect(bitrixService.callBitrixAPI).toHaveBeenCalledWith(
        'crm.requisite.bankdetail.update',
        {
          id: 1000,
          fields: {
            NAME: 'MB Bank',
            RQ_BANK_NAME: 'MB Bank',
            RQ_ACC_NUM: '99999999',
          },
        },
      );
    });

    it('TC-CONTACT-UPDATE-03: should create requisite & bank detail if contact exists but has no requisites yet', async () => {
      const existingContact = { ID: '15', NAME: 'Existing Contact' };

      jest
        .spyOn(bitrixService, 'callBitrixAPI')
        .mockImplementation(async (method: string) => {
          if (method === 'crm.contact.get') return existingContact;
          if (method === 'crm.contact.update') return true;
          if (method === 'crm.requisite.list') return [];
          if (method === 'crm.requisite.add') return 501;
          if (method === 'crm.requisite.bankdetail.add') return 601;
          return null;
        });

      const updateDto: UpdateContactDto = {
        bankName: 'VPBank',
        accountNumber: '123456789',
        accountHolder: 'NGUYEN VAN B',
      };

      const result = await service.updateContact(15, updateDto);

      expect(result.statusCode).toBe(200);
      expect(result.id).toBe(15);
      expect(result.bankingRequisites.requisiteId).toBe(501);
      expect(result.bankingRequisites.bankDetailId).toBe(601);
      expect(result.bankingRequisites.bankName).toBe('VPBank');
    });

    it('TC-CONTACT-UPDATE-04: update alias should invoke updateContact', async () => {
      jest.spyOn(service, 'updateContact').mockResolvedValueOnce({ id: 1 } as any);
      const dto = { name: 'B' };
      const result = await service.update(1, dto);
      expect(result.id).toBe(1);
      expect(service.updateContact).toHaveBeenCalledWith(1, dto);
    });
  });

  describe('deleteContact', () => {
    it('TC-CONTACT-DELETE-01: should throw NotFoundException when contact does not exist', async () => {
      jest
        .spyOn(bitrixService, 'callBitrixAPI')
        .mockRejectedValueOnce(new Error('NOT_FOUND'));

      await expect(service.deleteContact(999)).rejects.toThrow(NotFoundException);
      await expect(service.deleteContact(999)).rejects.toThrow('Contact không tồn tại');
    });

    it('TC-CONTACT-DELETE-02: should cascade delete bank details, requisites, and contact', async () => {
      const existingContact = { ID: '25', NAME: 'To Delete' };
      const existingRequisites = [{ ID: '200', ENTITY_ID: '25' }];
      const existingBankDetails = [{ ID: '2000', ENTITY_ID: '200' }];

      const callOrder: string[] = [];

      jest
        .spyOn(bitrixService, 'callBitrixAPI')
        .mockImplementation(async (method: string, payload?: any) => {
          callOrder.push(method);
          if (method === 'crm.contact.get') return existingContact;
          if (method === 'crm.requisite.list') return existingRequisites;
          if (method === 'crm.requisite.bankdetail.list') return existingBankDetails;
          if (method === 'crm.requisite.bankdetail.delete') return true;
          if (method === 'crm.requisite.delete') return true;
          if (method === 'crm.contact.delete') return true;
          return null;
        });

      const result = await service.deleteContact(25);

      expect(result).toEqual({
        statusCode: 200,
        message: 'Contact đã được xóa thành công',
        id: 25,
      });

      expect(bitrixService.callBitrixAPI).toHaveBeenCalledWith(
        'crm.requisite.bankdetail.delete',
        { id: '2000' },
      );
      expect(bitrixService.callBitrixAPI).toHaveBeenCalledWith('crm.requisite.delete', {
        id: '200',
      });
      expect(bitrixService.callBitrixAPI).toHaveBeenCalledWith('crm.contact.delete', {
        id: 25,
      });

      // Verify deletion ordering: bank detail -> requisite -> contact
      const bdDeleteIndex = callOrder.indexOf('crm.requisite.bankdetail.delete');
      const reqDeleteIndex = callOrder.indexOf('crm.requisite.delete');
      const contactDeleteIndex = callOrder.indexOf('crm.contact.delete');

      expect(bdDeleteIndex).toBeLessThan(reqDeleteIndex);
      expect(reqDeleteIndex).toBeLessThan(contactDeleteIndex);
    });

    it('TC-CONTACT-DELETE-03: delete alias should invoke deleteContact', async () => {
      jest.spyOn(service, 'deleteContact').mockResolvedValueOnce({ id: 1 } as any);
      const result = await service.delete(1);
      expect(result.id).toBe(1);
      expect(service.deleteContact).toHaveBeenCalledWith(1);
    });
  });
});
