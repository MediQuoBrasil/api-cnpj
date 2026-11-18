/**
 * @file api.js
 * Cliente HTTP do backend Apps Script.
 * POST com Content-Type text/plain + redirect: 'follow' → sem preflight CORS (exigência do Apps Script).
 */

import {
  API_URL, REQUEST_TIMEOUT_MS, MAX_NETWORK_ATTEMPTS, isApiConfigured,
} from './config.js';

/**
 * @typedef {Object} EmpresaDto
 * @property {string} cnpj
 * @property {string} cnpjFormatado
 * @property {string} razaoSocialOficial
 * @property {string} razaoSocial
 * @property {string} nomeFantasia
 * @property {string} nomePadronizado
 * @property {?{sigla: string, descricao: string}} porte
 * @property {{codigo: number, descricao: string, data: string}} situacao
 * @property {boolean} matriz
 * @property {{cep: string, cepFormatado: string, logradouro: string, numero: string,
 *   complemento: string, bairro: string, cidade: string, uf: string,
 *   codigoMunicipioIbge: ?number}} endereco
 * @property {string} atualizadoEm
 * @property {('cache'|'cnpja')} fonte
 */

/** Erro de API com código vindo do backend (ou gerado no cliente). */
export class ApiError extends Error {
  /**
   * @param {string} code Código do erro (ex.: INVALID_CNPJ, NETWORK_ERROR).
   * @param {string} message Mensagem segura para exibir.
   */
  constructor(code, message) {
    super(message);
    this.name = 'ApiError';
    /** @type {string} */
    this.code = code;
  }
}

/**
 * Pausa assíncrona.
 * @param {number} ms Milissegundos.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Executa um único POST com timeout.
 * @param {Object} body Corpo da requisição.
 * @returns {Promise<Object>} JSON da resposta.
 * @throws {ApiError} Em timeout, falha de rede ou resposta não-JSON.
 */
const postOnce = async (body) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError('HTTP_ERROR', `Servidor respondeu ${response.status}.`);
    try {
      return await response.json();
    } catch {
      throw new ApiError('BAD_RESPONSE', 'Resposta inesperada do servidor.');
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') throw new ApiError('TIMEOUT', 'O servidor demorou para responder.');
    throw new ApiError('NETWORK_ERROR', 'Falha de conexão com o servidor.');
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Chama uma action do backend com retry apenas para falhas transitórias do lado cliente.
 * @param {string} action Nome da action (allowlist no backend).
 * @param {Object} payload Parâmetros da action.
 * @returns {Promise<Object>} Campo `data` da resposta.
 * @throws {ApiError} Erro de negócio do backend ou de rede após as tentativas.
 */
const callAction = async (action, payload) => {
  if (!isApiConfigured()) {
    throw new ApiError('NOT_CONFIGURED', 'API não configurada: defina API_URL em assets/js/config.js.');
  }

  const transient = ['TIMEOUT', 'NETWORK_ERROR', 'HTTP_ERROR'];
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_NETWORK_ATTEMPTS; attempt += 1) {
    const startedAt = performance.now();
    try {
      // eslint-disable-next-line no-await-in-loop -- retry é sequencial por definição
      const json = await postOnce({ action, ...payload });
      const elapsed = Math.round(performance.now() - startedAt);
      console.info(`[api] ${action} tentativa ${attempt} em ${elapsed}ms ok=${json && json.ok}`);
      if (json && json.ok === true && json.data && typeof json.data === 'object') return json.data;
      if (json && json.ok === false && json.error) {
        throw new ApiError(String(json.error.code), String(json.error.message));
      }
      throw new ApiError('BAD_RESPONSE', 'Resposta inesperada do servidor.');
    } catch (err) {
      lastError = err instanceof ApiError ? err : new ApiError('UNKNOWN', 'Erro inesperado.');
      console.warn(`[api] ${action} tentativa ${attempt} falhou: ${lastError.code}`);
      if (!transient.includes(lastError.code) || attempt === MAX_NETWORK_ATTEMPTS) break;
      // eslint-disable-next-line no-await-in-loop -- backoff entre tentativas
      await sleep(800 * attempt);
    }
  }
  throw lastError;
};

/**
 * Garante que o objeto recebido tem o formato mínimo esperado (dado externo não é confiável).
 * @param {*} data Dado recebido.
 * @returns {data is EmpresaDto} true se o formato bate.
 */
const isEmpresaDto = (data) => Boolean(data)
  && typeof data.cnpj === 'string'
  && typeof data.cnpjFormatado === 'string'
  && typeof data.razaoSocial === 'string'
  && typeof data.nomeFantasia === 'string'
  && typeof data.nomePadronizado === 'string'
  && Boolean(data.situacao) && typeof data.situacao.descricao === 'string'
  && Boolean(data.endereco) && typeof data.endereco.cidade === 'string';

/**
 * Consulta a empresa pelo CNPJ no backend.
 * @param {string} cnpj CNPJ sanitizado.
 * @returns {Promise<Readonly<EmpresaDto>>} Empresa (congelada para não ser alterada no cliente).
 * @throws {ApiError} Em qualquer falha.
 */
export const consultarCnpj = async (cnpj) => {
  const data = await callAction('consultarCnpj', { cnpj });
  if (!isEmpresaDto(data)) throw new ApiError('BAD_RESPONSE', 'Resposta inesperada do servidor.');
  return Object.freeze({ ...data, endereco: Object.freeze({ ...data.endereco }) });
};
