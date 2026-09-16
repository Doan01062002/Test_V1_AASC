import axios from 'axios';
import { Bitrix24Service, Bitrix24Error } from '../../src/services/bitrix24Service';
import { NormalizedContact } from '../../src/types/common.types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Bitrix24Service Unit Tests', () => {
  let service: Bitrix24Service;
  const mockBaseUrl = 'https://b24-test.bitrix24.vn/rest/1/secret_token/';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new Bitrix24Service(mockBaseUrl);
  });

  describe('getMethodUrl', () => {
    it('should normalize URL properly regardless of trailing slash in base', () => {
      const s1 = new Bitrix24Service('https://example.com/rest/1/abc/');
      const s2 = new Bitrix24Service('https://example.com/rest/1/abc');

      expect(s1.getMethodUrl('crm.contact.add.json')).toBe(
        'https://example.com/rest/1/abc/crm.contact.add.json'
      );
      expect(s2.getMethodUrl('crm.contact.add.json')).toBe(
        'https://example.com/rest/1/abc/crm.contact.add.json'
      );
    });
  });

  describe('buildContactPayload', () => {
    it('should structure fields with multifield arrays and WORK value type', () => {
      const contact: NormalizedContact = {
        name: 'Minh',
        lastName: 'Tran',
        email: 'minh@example.com',
        phone: '0901234567',
      };

      const payload = service.buildContactPayload(contact);
      expect(payload.fields.NAME).toBe('Minh');
      expect(payload.fields.LAST_NAME).toBe('Tran');
      expect(payload.fields.PHONE).toEqual([{ VALUE: '0901234567', VALUE_TYPE: 'WORK' }]);
      expect(payload.fields.EMAIL).toEqual([{ VALUE: 'minh@example.com', VALUE_TYPE: 'WORK' }]);
      expect(payload.params?.REGISTER_SONET_EVENT).toBe('N');
    });

    it('should omit LAST_NAME when not provided', () => {
      const contact: NormalizedContact = {
        name: 'SingleName',
        email: 'single@example.com',
        phone: '+84912345678',
      };

      const payload = service.buildContactPayload(contact);
      expect(payload.fields.NAME).toBe('SingleName');
      expect(payload.fields.LAST_NAME).toBeUndefined();
    });
  });

  describe('createContact', () => {
    it('should call crm.contact.add.json and return integer contact ID on success', () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          result: 1042,
          time: { duration: 0.15 },
        },
      });

      const customService = new Bitrix24Service(mockBaseUrl, { post: mockPost } as any);

      const contact: NormalizedContact = {
        name: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '0901234567',
      };

      return customService.createContact(contact).then((contactId) => {
        expect(contactId).toBe(1042);
        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost).toHaveBeenCalledWith(
          'https://b24-test.bitrix24.vn/rest/1/secret_token/crm.contact.add.json',
          expect.objectContaining({
            fields: expect.objectContaining({
              NAME: 'John',
              LAST_NAME: 'Doe',
            }),
          })
        );
      });
    });

    it('should throw Bitrix24Error when response has no result ID', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: { result: null },
      });
      const customService = new Bitrix24Service(mockBaseUrl, { post: mockPost } as any);

      const contact: NormalizedContact = {
        name: 'Fail',
        email: 'fail@example.com',
        phone: '0901234567',
      };

      await expect(customService.createContact(contact)).rejects.toThrow(Bitrix24Error);
    });

    it('should handle Bitrix24 HTTP 401 Unauthorized error response', async () => {
      const mockPost = jest.fn().mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 401,
          data: {
            error: 'INVALID_CREDENTIALS',
            error_description: 'Invalid request credentials',
          },
        },
      });
      const customService = new Bitrix24Service(mockBaseUrl, { post: mockPost } as any);

      const contact: NormalizedContact = {
        name: 'Unauthorized',
        email: 'unauth@example.com',
        phone: '0901234567',
      };

      await expect(customService.createContact(contact)).rejects.toMatchObject({
        name: 'Bitrix24Error',
        errorCode: 'INVALID_CREDENTIALS',
      });
    });

    it('should handle network timeout (ECONNABORTED) with 504 error', async () => {
      const mockPost = jest.fn().mockRejectedValue({
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      });
      const customService = new Bitrix24Service(mockBaseUrl, { post: mockPost } as any);

      const contact: NormalizedContact = {
        name: 'Timeout',
        email: 'timeout@example.com',
        phone: '0901234567',
      };

      await expect(customService.createContact(contact)).rejects.toMatchObject({
        name: 'Bitrix24Error',
        statusCode: 504,
        errorCode: 'TIMEOUT',
      });
    });

    it('should handle general connection refused network error', async () => {
      const mockPost = jest.fn().mockRejectedValue({
        isAxiosError: true,
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1',
      });
      const customService = new Bitrix24Service(mockBaseUrl, { post: mockPost } as any);

      const contact: NormalizedContact = {
        name: 'Refused',
        email: 'refused@example.com',
        phone: '0901234567',
      };

      await expect(customService.createContact(contact)).rejects.toMatchObject({
        name: 'Bitrix24Error',
        statusCode: 502,
        errorCode: 'ECONNREFUSED',
      });
    });
  });
});
