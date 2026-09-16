import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  function createMockHost() {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    const mockGetRequest = jest.fn().mockReturnValue({
      url: '/test-endpoint',
      method: 'GET',
    });

    const mockHost: any = {
      switchToHttp: () => ({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    };

    return { mockHost, mockStatus, mockJson };
  }

  it('should catch HttpException and format standardized JSON response', () => {
    const { mockHost, mockStatus, mockJson } = createMockHost();
    const exception = new HttpException('Forbidden Resource', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden Resource',
        path: '/test-endpoint',
        method: 'GET',
      }),
    );
  });

  it('should catch generic Error and return 500 status', () => {
    const { mockHost, mockStatus, mockJson } = createMockHost();
    const exception = new Error('Unexpected database error');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unexpected database error',
        error: 'Internal Server Error',
        path: '/test-endpoint',
        method: 'GET',
      }),
    );
  });
});
