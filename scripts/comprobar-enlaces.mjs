import { pathToFileURL } from 'node:url';
import roster from '../src/data/candidaturas.js';
import programs from '../src/data/programas.js';
import { validarDatos, recogerEnlaces, urlPublica } from '../src/data/validacion.js';
import { destinoPermitido, solicitarFuente } from './solicitar-fuente.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Una sola petición simultánea, con pausa entre peticiones y máximo tres redirecciones.
export async function comprobarEnlaces(urls, { fetch = solicitarFuente, timeoutMs = 8000, delayMs = 250 } = {}) {
  const results = [];
  let requested = false;
  for (const url of urls) {
    const controller = new AbortController();
    let timer;
    let estado = 'inconcluso';
    let detalle = 'error de red';
    try {
      let current = urlPublica(url);
      if (!current) throw new Error('URL inválida');
      timer = setTimeout(() => controller.abort(), timeoutMs);
      for (let redirects = 0; ; redirects++) {
        if (!destinoPermitido(current)) { detalle = 'destino no permitido'; break; }
        if (requested && delayMs) await sleep(delayMs);
        requested = true;
        const response = await fetch(current.href, {
          method: 'GET', redirect: 'manual', credentials: 'omit', signal: controller.signal,
          headers: { 'user-agent': 'ProgramaPorPrograma29N-LinkCheck/1.0', accept: '*/*' },
        });
        // No se descargan los documentos: basta la respuesta de cabecera.
        void response.body?.cancel().catch(() => {});
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (redirects >= 3) { detalle = 'demasiadas redirecciones'; break; }
          const location = response.headers.get('location');
          current = location && urlPublica(location, current);
          if (!current) { detalle = 'redirección inválida'; break; }
          continue;
        }
        detalle = `HTTP ${response.status}`;
        estado = response.status >= 200 && response.status < 300 ? 'correcto'
          : [404, 410].includes(response.status) ? 'ausente' : 'inconcluso';
        break;
      }
    } catch {
      detalle = controller.signal.aborted ? 'tiempo de espera agotado' : 'error de red';
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
    results.push({ url, estado, detalle });
  }
  return results;
}

export function formatearInforme(results) {
  const labels = { correcto: 'Correcto', ausente: 'Ausente confirmado', inconcluso: 'Inconcluso' };
  const count = estado => results.filter(result => result.estado === estado).length;
  return [...results.map(({ url, estado, detalle }) => `${labels[estado]} (${detalle}): ${url}`),
    `Resumen: ${count('correcto')} correctos, ${count('ausente')} ausentes confirmados, ${count('inconcluso')} inconclusos.`].join('\n');
}

export async function main(args, { candidaturas = roster, programas = programs, salida = console, ...options } = {}) {
  if (args.length === 1 && args[0] === '--help') {
    salida.log('Uso: node scripts/comprobar-enlaces.mjs [--enlaces|--help]\nSin opciones valida los datos sin conexión; --enlaces también comprueba las fuentes públicas.');
    return 0;
  }
  if (args.length > 1 || (args.length && args[0] !== '--enlaces')) {
    salida.error('Opción inválida. Usa --help.');
    return 2;
  }
  const errors = validarDatos(candidaturas, programas);
  if (errors.length) {
    salida.error(`Validación offline: ${errors.length} errores.\n${errors.join('\n')}`);
    return 1;
  }
  salida.log('Validación offline: sin errores.');
  if (!args.length) return 0;
  const results = await comprobarEnlaces(recogerEnlaces(candidaturas, programas), options);
  salida.log(formatearInforme(results));
  return results.some(result => result.estado === 'ausente') ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
