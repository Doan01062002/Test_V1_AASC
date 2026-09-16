import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Bitrix24Service } from '../bitrix24/bitrix24.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly bitrixService: Bitrix24Service) {}

  /**
   * Retrieves all contacts merged with their banking requisites
   */
  async getContacts() {
    let contacts: any[] = [];
    try {
      contacts = await this.bitrixService.callBitrixAPI<any[]>('crm.contact.list', {
        order: { ID: 'ASC' },
        select: [
          'ID',
          'NAME',
          'LAST_NAME',
          'PHONE',
          'EMAIL',
          'WEB',
          'ADDRESS',
          'ADDRESS_2',
          'ADDRESS_CITY',
          'ADDRESS_PROVINCE',
          'ADDRESS_REGION',
        ],
      });
    } catch (err: any) {
      this.logger.error(`Lỗi khi lấy danh sách contact từ Bitrix24: ${err.message}`);
      throw err;
    }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return [];
    }

    // Fetch all requisites linked to contacts (ENTITY_TYPE_ID = 3 for Contact)
    let requisites: any[] = [];
    try {
      requisites = await this.bitrixService.callBitrixAPI<any[]>('crm.requisite.list', {
        filter: { ENTITY_TYPE_ID: 3 },
        select: ['ID', 'ENTITY_ID', 'NAME', 'PRESET_ID', 'ACTIVE'],
      });
    } catch (err: any) {
      this.logger.warn(`Lỗi khi lấy danh sách requisite: ${err.message}`);
      requisites = [];
    }

    // Fetch all bank details
    let bankDetails: any[] = [];
    try {
      bankDetails = await this.bitrixService.callBitrixAPI<any[]>(
        'crm.requisite.bankdetail.list',
        {
          select: [
            'ID',
            'ENTITY_ID',
            'NAME',
            'RQ_BANK_NAME',
            'RQ_ACC_NUM',
            'RQ_COR_ACC_NUM',
            'RQ_BANK_ADDR',
          ],
        },
      );
    } catch (err: any) {
      this.logger.warn(`Lỗi khi lấy danh sách bank detail: ${err.message}`);
      bankDetails = [];
    }

    // Map bank details by ENTITY_ID (which points to Requisite ID)
    const bankDetailMap = new Map<number, any>();
    if (bankDetails && Array.isArray(bankDetails)) {
      for (const bd of bankDetails) {
        bankDetailMap.set(Number(bd.ENTITY_ID), bd);
      }
    }

    // Map requisites by ENTITY_ID (which points to Contact ID)
    const contactRequisiteMap = new Map<number, any>();
    if (requisites && Array.isArray(requisites)) {
      for (const req of requisites) {
        const contactId = Number(req.ENTITY_ID);
        const bd = bankDetailMap.get(Number(req.ID));
        contactRequisiteMap.set(contactId, {
          requisiteId: Number(req.ID),
          name: req.NAME,
          bankName: bd?.RQ_BANK_NAME || null,
          accountNumber: bd?.RQ_ACC_NUM || null,
          accountHolder: bd?.RQ_COR_ACC_NUM || null,
          accountName: bd?.RQ_COR_ACC_NUM || null,
          bankBranch: bd?.RQ_BANK_ADDR || null,
        });
      }
    }

    // Merge contacts with requisites
    return contacts.map((c) => {
      const contactId = Number(c.ID);
      const phone = Array.isArray(c.PHONE)
        ? c.PHONE[0]?.VALUE
        : typeof c.PHONE === 'string'
          ? c.PHONE
          : null;
      const email = Array.isArray(c.EMAIL)
        ? c.EMAIL[0]?.VALUE
        : typeof c.EMAIL === 'string'
          ? c.EMAIL
          : null;
      const website = Array.isArray(c.WEB)
        ? c.WEB[0]?.VALUE
        : typeof c.WEB === 'string'
          ? c.WEB
          : null;

      return {
        id: contactId,
        name: c.NAME,
        lastName: c.LAST_NAME || '',
        phone,
        email,
        website,
        address: {
          street: c.ADDRESS || null,
          ward: c.ADDRESS_2 || null,
          district: c.ADDRESS_CITY || null,
          city: c.ADDRESS_PROVINCE || c.ADDRESS_REGION || null,
        },
        bankingRequisites: contactRequisiteMap.get(contactId) || null,
      };
    });
  }

  /**
   * Alias for getContacts()
   */
  async findAll() {
    return this.getContacts();
  }

  /**
   * Retrieves single contact by ID merged with banking requisites
   */
  async getContactById(id: number) {
    let contact: any = null;
    try {
      contact = await this.bitrixService.callBitrixAPI('crm.contact.get', { id });
    } catch (err: any) {
      throw new NotFoundException('Contact không tồn tại');
    }

    if (!contact || contact.error || !contact.ID) {
      throw new NotFoundException('Contact không tồn tại');
    }

    // Fetch requisites for contact
    let bankingRequisites: any = null;
    try {
      const requisites = await this.bitrixService.callBitrixAPI<any[]>('crm.requisite.list', {
        filter: { ENTITY_TYPE_ID: 3, ENTITY_ID: id },
        select: ['ID', 'ENTITY_ID', 'NAME', 'PRESET_ID'],
      });

      if (requisites && Array.isArray(requisites) && requisites.length > 0) {
        const req = requisites[0];
        const bankDetails = await this.bitrixService.callBitrixAPI<any[]>(
          'crm.requisite.bankdetail.list',
          {
            filter: { ENTITY_ID: req.ID },
            select: [
              'ID',
              'ENTITY_ID',
              'NAME',
              'RQ_BANK_NAME',
              'RQ_ACC_NUM',
              'RQ_COR_ACC_NUM',
              'RQ_BANK_ADDR',
            ],
          },
        );

        const bd = bankDetails && Array.isArray(bankDetails) && bankDetails.length > 0
          ? bankDetails[0]
          : null;

        bankingRequisites = {
          requisiteId: Number(req.ID),
          name: req.NAME,
          bankName: bd?.RQ_BANK_NAME || null,
          accountNumber: bd?.RQ_ACC_NUM || null,
          accountHolder: bd?.RQ_COR_ACC_NUM || null,
          accountName: bd?.RQ_COR_ACC_NUM || null,
          bankBranch: bd?.RQ_BANK_ADDR || null,
        };
      }
    } catch (err: any) {
      this.logger.warn(`Lỗi khi lấy requisite cho contact ${id}: ${err.message}`);
    }

    const phone = Array.isArray(contact.PHONE)
      ? contact.PHONE[0]?.VALUE
      : typeof contact.PHONE === 'string'
        ? contact.PHONE
        : null;
    const email = Array.isArray(contact.EMAIL)
      ? contact.EMAIL[0]?.VALUE
      : typeof contact.EMAIL === 'string'
        ? contact.EMAIL
        : null;
    const website = Array.isArray(contact.WEB)
      ? contact.WEB[0]?.VALUE
      : typeof contact.WEB === 'string'
        ? contact.WEB
        : null;

    return {
      id: Number(contact.ID),
      name: contact.NAME,
      lastName: contact.LAST_NAME || '',
      phone,
      email,
      website,
      address: {
        street: contact.ADDRESS || null,
        ward: contact.ADDRESS_2 || null,
        district: contact.ADDRESS_CITY || null,
        city: contact.ADDRESS_PROVINCE || contact.ADDRESS_REGION || null,
      },
      bankingRequisites,
    };
  }

  /**
   * Alias for getContactById(id)
   */
  async findOne(id: number) {
    return this.getContactById(id);
  }

  /**
   * Creates contact and associated requisite & bank detail
   */
  async createContact(dto: CreateContactDto) {
    const contactFields: Record<string, any> = {
      NAME: dto.name,
      PHONE: [{ VALUE: dto.phone, VALUE_TYPE: 'WORK' }],
      EMAIL: [{ VALUE: dto.email, VALUE_TYPE: 'WORK' }],
    };

    if (dto.website) {
      contactFields.WEB = [{ VALUE: dto.website, VALUE_TYPE: 'WORK' }];
    }
    if (dto.street) contactFields.ADDRESS = dto.street;
    if (dto.ward) contactFields.ADDRESS_2 = dto.ward;
    if (dto.district) contactFields.ADDRESS_CITY = dto.district;
    if (dto.city) {
      contactFields.ADDRESS_PROVINCE = dto.city;
      contactFields.ADDRESS_REGION = dto.city;
    }

    const contactId = await this.bitrixService.callBitrixAPI<number>('crm.contact.add', {
      fields: contactFields,
      params: { REGISTER_SONET_EVENT: 'N' },
    });

    let requisiteInfo: any = null;

    // If banking info provided, create requisite and bank detail
    const hasBankInfo =
      dto.bankName ||
      dto.accountNumber ||
      dto.bankBranch ||
      dto.accountHolder ||
      dto.accountName;

    if (hasBankInfo) {
      try {
        const requisiteId = await this.bitrixService.callBitrixAPI<number>(
          'crm.requisite.add',
          {
            fields: {
              ENTITY_TYPE_ID: 3, // Contact
              ENTITY_ID: contactId,
              PRESET_ID: 1, // Default person/org preset
              NAME: `Thông tin ngân hàng - ${dto.name}`,
              ACTIVE: 'Y',
            },
          },
        );

        const accountHolderName =
          dto.accountHolder || dto.accountName || dto.name;

        const bankDetailId = await this.bitrixService.callBitrixAPI<number>(
          'crm.requisite.bankdetail.add',
          {
            fields: {
              ENTITY_ID: requisiteId,
              NAME: dto.bankName || 'Tài khoản chính',
              RQ_BANK_NAME: dto.bankName || '',
              RQ_ACC_NUM: dto.accountNumber || '',
              RQ_COR_ACC_NUM: accountHolderName,
              RQ_BANK_ADDR: dto.bankBranch || '',
              COUNTRY_ID: 1,
            },
          },
        );

        requisiteInfo = {
          requisiteId: Number(requisiteId),
          bankDetailId: Number(bankDetailId),
          bankName: dto.bankName || null,
          accountNumber: dto.accountNumber || null,
          accountHolder: accountHolderName,
          accountName: accountHolderName,
          bankBranch: dto.bankBranch || null,
        };
      } catch (err: any) {
        this.logger.error(
          `Lỗi khi tạo requisite ngân hàng cho contact ${contactId}: ${err.message}`,
        );
      }
    }

    return {
      id: Number(contactId),
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      website: dto.website || null,
      address: {
        street: dto.street || null,
        ward: dto.ward || null,
        district: dto.district || null,
        city: dto.city || null,
      },
      bankingRequisites: requisiteInfo,
    };
  }

  /**
   * Alias for createContact(dto)
   */
  async create(dto: CreateContactDto) {
    return this.createContact(dto);
  }

  /**
   * Updates contact and associated banking details
   */
  async updateContact(id: number, dto: UpdateContactDto) {
    // 1. Verify contact existence
    try {
      const existing = await this.bitrixService.callBitrixAPI('crm.contact.get', { id });
      if (!existing || existing.error || !existing.ID) {
        throw new NotFoundException('Contact không tồn tại');
      }
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException('Contact không tồn tại');
    }

    // 2. Update contact fields if provided
    const fields: Record<string, any> = {};
    if (dto.name !== undefined) fields.NAME = dto.name;
    if (dto.phone !== undefined) fields.PHONE = [{ VALUE: dto.phone, VALUE_TYPE: 'WORK' }];
    if (dto.email !== undefined) fields.EMAIL = [{ VALUE: dto.email, VALUE_TYPE: 'WORK' }];
    if (dto.website !== undefined) fields.WEB = [{ VALUE: dto.website, VALUE_TYPE: 'WORK' }];
    if (dto.street !== undefined) fields.ADDRESS = dto.street;
    if (dto.ward !== undefined) fields.ADDRESS_2 = dto.ward;
    if (dto.district !== undefined) fields.ADDRESS_CITY = dto.district;
    if (dto.city !== undefined) {
      fields.ADDRESS_PROVINCE = dto.city;
      fields.ADDRESS_REGION = dto.city;
    }

    if (Object.keys(fields).length > 0) {
      await this.bitrixService.callBitrixAPI('crm.contact.update', { id, fields });
    }

    // 3. Update or create requisite and bank detail if banking info provided
    const hasBankInfo =
      dto.bankName !== undefined ||
      dto.accountNumber !== undefined ||
      dto.bankBranch !== undefined ||
      dto.accountHolder !== undefined ||
      dto.accountName !== undefined;

    let requisiteInfo: any = null;

    if (hasBankInfo) {
      try {
        const requisites = await this.bitrixService.callBitrixAPI<any[]>('crm.requisite.list', {
          filter: { ENTITY_TYPE_ID: 3, ENTITY_ID: id },
          select: ['ID', 'NAME'],
        });

        if (requisites && Array.isArray(requisites) && requisites.length > 0) {
          const reqId = Number(requisites[0].ID);
          const bankDetails = await this.bitrixService.callBitrixAPI<any[]>(
            'crm.requisite.bankdetail.list',
            { filter: { ENTITY_ID: reqId } },
          );

          const accountHolderName = dto.accountHolder || dto.accountName;

          if (bankDetails && Array.isArray(bankDetails) && bankDetails.length > 0) {
            const bdId = Number(bankDetails[0].ID);
            const bdFields: Record<string, any> = {};
            if (dto.bankName !== undefined) {
              bdFields.NAME = dto.bankName;
              bdFields.RQ_BANK_NAME = dto.bankName;
            }
            if (dto.accountNumber !== undefined) bdFields.RQ_ACC_NUM = dto.accountNumber;
            if (accountHolderName !== undefined) bdFields.RQ_COR_ACC_NUM = accountHolderName;
            if (dto.bankBranch !== undefined) bdFields.RQ_BANK_ADDR = dto.bankBranch;

            if (Object.keys(bdFields).length > 0) {
              await this.bitrixService.callBitrixAPI('crm.requisite.bankdetail.update', {
                id: bdId,
                fields: bdFields,
              });
            }

            requisiteInfo = {
              requisiteId: reqId,
              bankDetailId: bdId,
              bankName: dto.bankName ?? bankDetails[0].RQ_BANK_NAME,
              accountNumber: dto.accountNumber ?? bankDetails[0].RQ_ACC_NUM,
              accountHolder: accountHolderName ?? bankDetails[0].RQ_COR_ACC_NUM,
              accountName: accountHolderName ?? bankDetails[0].RQ_COR_ACC_NUM,
              bankBranch: dto.bankBranch ?? bankDetails[0].RQ_BANK_ADDR,
            };
          } else {
            // Add new bank detail to existing requisite
            const newBdId = await this.bitrixService.callBitrixAPI<number>(
              'crm.requisite.bankdetail.add',
              {
                fields: {
                  ENTITY_ID: reqId,
                  NAME: dto.bankName || 'Tài khoản chính',
                  RQ_BANK_NAME: dto.bankName || '',
                  RQ_ACC_NUM: dto.accountNumber || '',
                  RQ_COR_ACC_NUM: accountHolderName || '',
                  RQ_BANK_ADDR: dto.bankBranch || '',
                  COUNTRY_ID: 1,
                },
              },
            );

            requisiteInfo = {
              requisiteId: reqId,
              bankDetailId: Number(newBdId),
              bankName: dto.bankName || null,
              accountNumber: dto.accountNumber || null,
              accountHolder: accountHolderName || null,
              accountName: accountHolderName || null,
              bankBranch: dto.bankBranch || null,
            };
          }
        } else {
          // Requisite does not exist yet -> create both requisite and bank detail
          const newReqId = await this.bitrixService.callBitrixAPI<number>('crm.requisite.add', {
            fields: {
              ENTITY_TYPE_ID: 3,
              ENTITY_ID: id,
              PRESET_ID: 1,
              NAME: `Thông tin ngân hàng - ${dto.name || 'Contact ' + id}`,
              ACTIVE: 'Y',
            },
          });

          const accountHolderName = dto.accountHolder || dto.accountName || dto.name || '';
          const newBdId = await this.bitrixService.callBitrixAPI<number>(
            'crm.requisite.bankdetail.add',
            {
              fields: {
                ENTITY_ID: newReqId,
                NAME: dto.bankName || 'Tài khoản chính',
                RQ_BANK_NAME: dto.bankName || '',
                RQ_ACC_NUM: dto.accountNumber || '',
                RQ_COR_ACC_NUM: accountHolderName,
                RQ_BANK_ADDR: dto.bankBranch || '',
                COUNTRY_ID: 1,
              },
            },
          );

          requisiteInfo = {
            requisiteId: Number(newReqId),
            bankDetailId: Number(newBdId),
            bankName: dto.bankName || null,
            accountNumber: dto.accountNumber || null,
            accountHolder: accountHolderName || null,
            accountName: accountHolderName || null,
            bankBranch: dto.bankBranch || null,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi cập nhật requisite cho contact ${id}: ${err.message}`);
      }
    }

    return {
      statusCode: 200,
      message: 'Cập nhật contact thành công',
      id: Number(id),
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      website: dto.website,
      address: {
        street: dto.street,
        ward: dto.ward,
        district: dto.district,
        city: dto.city,
      },
      bankingRequisites: requisiteInfo,
    };
  }

  /**
   * Alias for updateContact(id, dto)
   */
  async update(id: number, dto: UpdateContactDto) {
    return this.updateContact(id, dto);
  }

  /**
   * Cascades deletion of requisites and bank details, then deletes contact
   */
  async deleteContact(id: number) {
    // 1. Verify existence
    try {
      const existing = await this.bitrixService.callBitrixAPI('crm.contact.get', { id });
      if (!existing || existing.error || !existing.ID) {
        throw new NotFoundException('Contact không tồn tại');
      }
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException('Contact không tồn tại');
    }

    // 2. Cascade delete requisites and bank details
    try {
      const requisites = await this.bitrixService.callBitrixAPI<any[]>('crm.requisite.list', {
        filter: { ENTITY_TYPE_ID: 3, ENTITY_ID: id },
        select: ['ID'],
      });

      if (requisites && Array.isArray(requisites)) {
        for (const req of requisites) {
          try {
            const bankDetails = await this.bitrixService.callBitrixAPI<any[]>(
              'crm.requisite.bankdetail.list',
              { filter: { ENTITY_ID: req.ID }, select: ['ID'] },
            );
            if (bankDetails && Array.isArray(bankDetails)) {
              for (const bd of bankDetails) {
                await this.bitrixService.callBitrixAPI('crm.requisite.bankdetail.delete', {
                  id: bd.ID,
                });
              }
            }
          } catch (bdErr: any) {
            this.logger.warn(
              `Lỗi khi xóa bank detail của requisite ${req.ID}: ${bdErr.message}`,
            );
          }

          await this.bitrixService.callBitrixAPI('crm.requisite.delete', { id: req.ID });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Lỗi khi dọn dẹp requisites của contact ${id}: ${err.message}`);
    }

    // 3. Delete contact
    await this.bitrixService.callBitrixAPI('crm.contact.delete', { id });

    return {
      statusCode: 200,
      message: 'Contact đã được xóa thành công',
      id: Number(id),
    };
  }

  /**
   * Alias for deleteContact(id)
   */
  async delete(id: number) {
    return this.deleteContact(id);
  }
}
