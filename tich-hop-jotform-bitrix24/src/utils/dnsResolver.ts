import dns from 'dns';
import https from 'https';
import net from 'net';
import { config } from '../config/env';
import { logger } from './logger';

export interface ResilientLookupOptions {
  dnsServers?: string[];
}

/**
 * Creates a custom DNS Resolver instance configured with fallback servers.
 */
export function createCustomResolver(servers: string[] = config.DNS_SERVERS): dns.Resolver {
  const resolver = new dns.Resolver();
  resolver.setServers(servers);
  return resolver;
}

/**
 * Custom DNS lookup function designed for https.Agent.
 * Tries system DNS first; on failure, falls back to custom DNS servers (e.g. 8.8.8.8, 1.1.1.1).
 * Properly supports `options.all` array responses required by Node's TLS stack.
 */
export function createResilientLookup(servers: string[] = config.DNS_SERVERS) {
  const resolver = createCustomResolver(servers);

  return function resilientLookup(
    hostname: string,
    options: any,
    callback: (err: NodeJS.ErrnoException | null, address?: any, family?: number) => void
  ): void {
    let cb = callback;
    let opts = options;

    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    } else if (typeof opts === 'number') {
      opts = { family: opts };
    } else if (!opts) {
      opts = {};
    }

    // If already an IP address, return directly
    if (net.isIP(hostname)) {
      const family = net.isIPv4(hostname) ? 4 : 6;
      if (opts.all) {
        return cb(null, [{ address: hostname, family }]);
      }
      return cb(null, hostname, family);
    }

    // Step 1: Try default system DNS resolution
    dns.lookup(hostname, opts, (err, address, family) => {
      if (!err && address) {
        return cb(null, address, family);
      }

      // Step 2: System DNS failed, attempt custom fallback resolver
      logger.warn(
        `[DNS Fallback] System lookup failed for ${hostname} (${err?.code || 'UNKNOWN'}). Trying custom resolver [${servers.join(', ')}]`
      );

      resolver.resolve4(hostname, (rErr, addrs) => {
        if (rErr || !addrs || addrs.length === 0) {
          logger.error(
            `[DNS Fallback] Custom resolver also failed for ${hostname}: ${rErr?.message || 'No A records'}`
          );
          return cb(err || rErr, opts?.all ? [] : '', 4);
        }

        logger.info(
          `[DNS Fallback] Resolved ${hostname} -> [${addrs.join(', ')}] via fallback DNS`
        );

        if (opts.all) {
          const formatted = addrs.map((addr) => ({ address: addr, family: 4 }));
          return cb(null, formatted);
        }

        return cb(null, addrs[0], 4);
      });
    });
  };
}

/**
 * Creates an https.Agent pre-configured with resilient DNS lookup.
 */
export function createResilientHttpsAgent(servers: string[] = config.DNS_SERVERS): https.Agent {
  return new https.Agent({
    lookup: createResilientLookup(servers),
    keepAlive: true,
    timeout: config.REQUEST_TIMEOUT_MS,
  });
}

/**
 * Standalone asynchronous resolver function for resolving hostnames.
 */
export async function resolveHostname(
  hostname: string,
  servers: string[] = config.DNS_SERVERS
): Promise<string[]> {
  if (net.isIP(hostname)) {
    return [hostname];
  }

  // Try standard dns.promises
  try {
    const addresses = await dns.promises.resolve4(hostname);
    if (addresses && addresses.length > 0) {
      return addresses;
    }
  } catch {
    // Ignore and fallback
  }

  // Fallback to custom resolver
  const resolver = createCustomResolver(servers);
  return new Promise((resolve, reject) => {
    resolver.resolve4(hostname, (err, addresses) => {
      if (err) {
        return reject(err);
      }
      resolve(addresses);
    });
  });
}
