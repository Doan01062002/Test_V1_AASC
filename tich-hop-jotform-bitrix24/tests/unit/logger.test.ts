import { Logger } from '../../src/utils/logger';

describe('Logger Utility Unit Tests', () => {
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should include valid ISO 8601 timestamp in log message', () => {
    const logger = new Logger('info');
    logger.info('Test timestamp logging');

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    const loggedStr = consoleInfoSpy.mock.calls[0][0];

    // Check ISO 8601 regex pattern: [YYYY-MM-DDTHH:mm:ss.sssZ]
    const isoRegex = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
    expect(loggedStr).toMatch(isoRegex);
    expect(loggedStr).toContain('[INFO]');
    expect(loggedStr).toContain('Test timestamp logging');
  });

  it('should format WARN and ERROR messages with appropriate level tags', () => {
    const logger = new Logger('debug');
    logger.warn('Warning event');
    logger.error('Error event');

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('[WARN] Warning event');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR] Error event');
  });

  it('should serialize metadata objects into structured JSON', () => {
    const logger = new Logger('info');
    const meta = { contactId: 1042, email: 'test@example.com' };
    logger.info('Contact created', meta);

    const loggedStr = consoleInfoSpy.mock.calls[0][0];
    expect(loggedStr).toContain('"contactId": 1042');
    expect(loggedStr).toContain('"email": "test@example.com"');
  });

  it('should safely handle circular references without throwing', () => {
    const logger = new Logger('info');
    const circularObj: any = { name: 'Root' };
    circularObj.self = circularObj;

    expect(() => {
      logger.info('Circular logging', circularObj);
    }).not.toThrow();

    const loggedStr = consoleInfoSpy.mock.calls[0][0];
    expect(loggedStr).toContain('[Circular]');
  });

  it('should respect minimum log level configuration', () => {
    const logger = new Logger('error'); // Only log ERROR
    logger.debug('Hidden debug');
    logger.info('Hidden info');
    logger.warn('Hidden warn');
    logger.error('Visible error');

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
