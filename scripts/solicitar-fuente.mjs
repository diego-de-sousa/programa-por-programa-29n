import { lookup as dnsLookup } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { urlPublica } from '../src/data/validacion.js';

// Los literales numéricos no necesitan DNS y podrían eludir su comprobación.
export function destinoPermitido(value) {
  const url = value instanceof URL ? value : urlPublica(value);
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  return !isIP(hostname) && !url.port;
}

// Rangos IPv4 especiales/no globales (IANA); ante la duda no se conecta.
function ipGlobal(address) {
  if (isIP(address) !== 4) return false;
  const bytes = address.split('.').map(Number);
  const [a, b, c] = bytes;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && ((b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99) || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

// Sin proxy ni agente compartido: la dirección validada se entrega directamente al socket.
export function solicitarFuente(value, { signal } = {}, { lookup = dnsLookup, request } = {}) {
  const url = urlPublica(value);
  if (!destinoPermitido(url)) return Promise.reject(new Error('destino no permitido'));
  const send = request || (url.protocol === 'https:' ? httpsRequest : httpRequest);
  const checkedLookup = (hostname, options, done) => {
    lookup(hostname, { family: 4, all: false }, (error, address, family) => {
      if (error) return done(error);
      if (family !== 4 || !ipGlobal(address)) return done(new Error('dirección no pública'));
      if (options?.all) return done(null, [{ address, family: 4 }]);
      return done(null, address, 4);
    });
  };
  return new Promise((resolve, reject) => {
    const req = send(url, {
      method: 'GET', agent: false, family: 4, autoSelectFamily: false,
      servername: url.hostname, lookup: checkedLookup, signal,
      headers: { 'user-agent': 'ProgramaPorPrograma29N-LinkCheck/1.0', accept: '*/*' },
    }, response => {
      resolve({
        status: response.statusCode,
        headers: { get: name => response.headers[name.toLowerCase()] ?? null },
        body: { cancel: async () => response.destroy() },
      });
    });
    req.on('error', reject);
    req.end();
  });
}
