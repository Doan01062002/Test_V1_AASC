import { JotformService, JotformError } from '../../src/services/jotformService';
import { JotformSubmissionItem } from '../../src/types/jotform.types';

describe('JotformService Unit Tests', () => {
  const mockApiKey = 'mock_jotform_api_key_123';
  const mockFormId = '262582117734055';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRawSubmissions', () => {
    it('should successfully fetch submissions with API Key and formId', async () => {
      const mockSubmissions: JotformSubmissionItem[] = [
        {
          id: 'sub_1',
          form_id: mockFormId,
          created_at: '2026-09-16',
          status: 'ACTIVE',
          answers: {
            '3': { answer: { first: 'Minh', last: 'Tran' } },
            '4': { answer: 'minh@example.com' },
            '5': { answer: '0901234567' },
          },
        },
      ];

      const mockGet = jest.fn().mockResolvedValue({
        data: {
          responseCode: 200,
          message: 'success',
          content: mockSubmissions,
        },
      });

      const service = new JotformService(mockApiKey, mockFormId, { get: mockGet } as any);
      const results = await service.getRawSubmissions();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('sub_1');
      expect(mockGet).toHaveBeenCalledWith(
        `/form/${mockFormId}/submissions`,
        expect.objectContaining({
          headers: expect.objectContaining({ APIKEY: mockApiKey }),
        })
      );
    });

    it('should throw JotformError when responseCode is not 200', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        data: {
          responseCode: 401,
          message: "You're not authorized to use (/form-id-submissions) ",
        },
      });

      const service = new JotformService('', mockFormId, { get: mockGet } as any);
      await expect(service.getRawSubmissions()).rejects.toThrow(JotformError);
    });

    it('should handle HTTP error status from server', async () => {
      const mockGet = jest.fn().mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 404,
          data: { responseCode: 404, message: 'Form not found' },
        },
      });

      const service = new JotformService(mockApiKey, 'invalid_form_id', { get: mockGet } as any);
      await expect(service.getRawSubmissions('invalid_form_id')).rejects.toMatchObject({
        name: 'JotformError',
        statusCode: 404,
      });
    });

    it('should handle request timeout gracefully', async () => {
      const mockGet = jest.fn().mockRejectedValue({
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      });

      const service = new JotformService(mockApiKey, mockFormId, { get: mockGet } as any);
      await expect(service.getRawSubmissions()).rejects.toMatchObject({
        name: 'JotformError',
        statusCode: 504,
      });
    });
  });

  describe('getNormalizedSubmissions', () => {
    it('should fetch and normalize submission entries', async () => {
      const mockSubmissions: JotformSubmissionItem[] = [
        {
          id: 'sub_alpha',
          form_id: mockFormId,
          created_at: '2026-09-16',
          status: 'ACTIVE',
          answers: {
            '3': { answer: { first: 'Alpha', last: 'Tester' } },
            '4': { answer: 'alpha@test.com' },
            '5': { answer: '+84909000111' },
          },
        },
      ];

      const mockGet = jest.fn().mockResolvedValue({
        data: {
          responseCode: 200,
          message: 'success',
          content: mockSubmissions,
        },
      });

      const service = new JotformService(mockApiKey, mockFormId, { get: mockGet } as any);
      const normalized = await service.getNormalizedSubmissions();

      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toEqual({
        name: 'Alpha',
        lastName: 'Tester',
        email: 'alpha@test.com',
        phone: '+84909000111',
        submissionId: 'sub_alpha',
        formId: mockFormId,
      });
    });
  });
});
