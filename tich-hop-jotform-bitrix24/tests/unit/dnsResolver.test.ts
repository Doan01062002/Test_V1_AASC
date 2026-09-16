import dns from 'dns';
import https from 'https';
import {
  createCustomResolver,
  createResilientHttpsAgent,
  createResilientLookup,
} from '../../src/utils/dnsResolver';

describe('DNS Resolver Unit Tests', () => {
  describe('createCustomResolver', () => {
    it('should initialize a dns.Resolver with specified servers', () => {
      const resolver = createCustomResolver(['8.8.8.8', '1.1.1.1']);
      expect(resolver.getServers()).toEqual(['8.8.8.8', '1.1.1.1']);
    });
  });

  describe('createResilientLookup', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should immediately return IP when hostname is already an IPv4 address', (done) => {
      const lookup = createResilientLookup();
      lookup('192.168.1.1', {}, (err, address, family) => {
        expect(err).toBeNull();
        expect(address).toBe('192.168.1.1');
        expect(family).toBe(4);
        done();
      });
    });

    it('should return array format when hostname is an IP and options.all is true', (done) => {
      const lookup = createResilientLookup();
      lookup('127.0.0.1', { all: true }, (err, addresses) => {
        expect(err).toBeNull();
        expect(addresses).toEqual([{ address: '127.0.0.1', family: 4 }]);
        done();
      });
    });

    it('should return address from system DNS when lookup succeeds', (done) => {
      jest.spyOn(dns, 'lookup').mockImplementation(((
        hostname: string,
        options: any,
        callback: (err: any, addr: any, fam: any) => void
      ) => {
        callback(null, '93.184.216.34', 4);
      }) as any);

      const lookup = createResilientLookup();
      lookup('example.com', {}, (err, address, family) => {
        expect(err).toBeNull();
        expect(address).toBe('93.184.216.34');
        expect(family).toBe(4);
        done();
      });
    });

    it('should fallback to custom resolver when system DNS fails with ENOTFOUND', (done) => {
      jest.spyOn(dns, 'lookup').mockImplementation(((
        hostname: string,
        options: any,
        callback: (err: any, addr: any, fam: any) => void
      ) => {
        const notFoundErr = new Error('getaddrinfo ENOTFOUND api.jotform.com') as any;
        notFoundErr.code = 'ENOTFOUND';
        callback(notFoundErr, null, null);
      }) as any);

      const lookup = createResilientLookup(['8.8.8.8']);

      // Spy on Resolver.prototype.resolve4
      jest
        .spyOn(dns.Resolver.prototype, 'resolve4')
        .mockImplementation((hostname: string, callback: any) => {
          callback(null, ['34.102.158.113']);
        });

      lookup('api.jotform.com', {}, (err, address, family) => {
        expect(err).toBeNull();
        expect(address).toBe('34.102.158.113');
        expect(family).toBe(4);
        done();
      });
    });

    it('should return formatted array when options.all is true on fallback', (done) => {
      jest.spyOn(dns, 'lookup').mockImplementation(((
        hostname: string,
        options: any,
        callback: (err: any) => void
      ) => {
        const err = new Error('getaddrinfo ENOTFOUND') as any;
        err.code = 'ENOTFOUND';
        callback(err);
      }) as any);

      jest
        .spyOn(dns.Resolver.prototype, 'resolve4')
        .mockImplementation((hostname: string, callback: any) => {
          callback(null, ['34.102.158.113', '34.102.158.114']);
        });

      const lookup = createResilientLookup(['8.8.8.8']);
      lookup('api.jotform.com', { all: true }, (err, addresses) => {
        expect(err).toBeNull();
        expect(addresses).toEqual([
          { address: '34.102.158.113', family: 4 },
          { address: '34.102.158.114', family: 4 },
        ]);
        done();
      });
    });
  });

  describe('createResilientHttpsAgent', () => {
    it('should return an https.Agent configured with custom lookup', () => {
      const agent = createResilientHttpsAgent(['8.8.8.8', '1.1.1.1']);
      expect(agent).toBeInstanceOf(https.Agent);
      expect(typeof (agent as any).options.lookup).toBe('function');
    });
  });
});
