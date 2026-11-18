/* eslint no-param-reassign: ["error", { "props": false }] -- elementos DOM recebidos são mutados por design */
/**
 * @file cnpj-lookup.js
 * Controlador compartilhado do campo CNPJ: máscara, validação imediata, consulta automática
 * ao completar 14 caracteres, descarte de respostas atrasadas e memo por sessão.
 */

import { consultarCnpj } from './api.js';
import { isValidCnpj, maskCnpj, sanitizeCnpj } from './cnpj.js';
import { formatDateBr, setStatus } from './ui.js';

/**
 * @typedef {import('./api.js').EmpresaDto} EmpresaDto
 */

/**
 * @typedef {Object} CnpjLookupOptions
 * @property {HTMLInputElement} input Campo CNPJ.
 * @property {HTMLButtonElement} button Botão "Buscar".
 * @property {HTMLElement} statusEl Faixa de status (.cnpj-status).
 * @property {function(Readonly<EmpresaDto>): void} onResolved Chamado com a empresa encontrada.
 * @property {function(): void} onCleared Chamado quando os dados precisam ser limpos.
 */

/**
 * @typedef {Object} CnpjLookup
 * @property {function(): ?Readonly<EmpresaDto>} getEmpresa Empresa atual (fonte da verdade do formulário).
 * @property {function(): void} reset Limpa campo, estado e status.
 */

const IDLE_MESSAGE = 'Digite o CNPJ: razão social, nome e endereço serão preenchidos pela Receita Federal.';
const DEBOUNCE_MS = 350;

/**
 * Monta a mensagem de sucesso a partir da empresa.
 * @param {Readonly<EmpresaDto>} empresa Empresa.
 * @returns {{state: ('success'|'warning'), message: string}} Estado e mensagem.
 */
const describeEmpresa = (empresa) => {
  const parts = [
    `Situação: ${empresa.situacao.descricao}`,
    empresa.porte ? `Porte: ${empresa.porte.sigla}` : null,
    empresa.matriz ? 'Matriz' : 'Filial',
    empresa.atualizadoEm ? `Receita atualizada em ${formatDateBr(empresa.atualizadoEm)}` : null,
  ].filter(Boolean);
  const isActive = empresa.situacao.codigo === 2;
  const prefix = isActive ? '' : 'Atenção — empresa não está ativa. ';
  return { state: isActive ? 'success' : 'warning', message: prefix + parts.join(' · ') };
};

/**
 * Liga o comportamento de consulta ao campo CNPJ.
 * @param {CnpjLookupOptions} options Elementos e callbacks.
 * @returns {CnpjLookup} API do controlador.
 */
const createCnpjLookup = ({
  input, button, statusEl, onResolved, onCleared,
}) => {
  /** @type {Map<string, Readonly<EmpresaDto>>} */
  const sessionMemo = new Map();
  /** @type {?Readonly<EmpresaDto>} */
  let current = null;
  let requestSeq = 0;
  let debounceTimer = 0;

  const clearCurrent = () => {
    if (current === null) return;
    current = null;
    onCleared();
  };

  /**
   * Executa a consulta para o valor atual do campo.
   * @returns {Promise<void>}
   */
  const lookup = async () => {
    clearTimeout(debounceTimer);
    const cnpj = sanitizeCnpj(input.value);

    if (cnpj.length < 14) {
      setStatus(statusEl, 'error', 'CNPJ incompleto: são 14 caracteres.');
      return;
    }
    if (!isValidCnpj(cnpj)) {
      setStatus(statusEl, 'error', 'CNPJ inválido. Confira os números digitados.');
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    if (current !== null && current.cnpj === cnpj) return;

    input.setAttribute('aria-invalid', 'false');
    requestSeq += 1;
    const mySeq = requestSeq;

    const memo = sessionMemo.get(cnpj);
    if (memo) {
      current = memo;
      onResolved(memo);
      const { state, message } = describeEmpresa(memo);
      setStatus(statusEl, state, message);
      return;
    }

    setStatus(statusEl, 'loading', 'Consultando a Receita Federal…');
    button.disabled = true;
    try {
      const empresa = await consultarCnpj(cnpj);
      if (mySeq !== requestSeq) return; // usuário mudou o CNPJ no meio da consulta
      sessionMemo.set(cnpj, empresa);
      current = empresa;
      onResolved(empresa);
      const { state, message } = describeEmpresa(empresa);
      setStatus(statusEl, state, message);
    } catch (err) {
      if (mySeq !== requestSeq) return;
      clearCurrent();
      setStatus(statusEl, 'error', err.message || 'Não foi possível consultar o CNPJ.');
    } finally {
      if (mySeq === requestSeq) button.disabled = false;
    }
  };

  input.addEventListener('input', () => {
    const masked = maskCnpj(input.value);
    if (input.value !== masked) input.value = masked;
    const cnpj = sanitizeCnpj(masked);

    if (current !== null && current.cnpj !== cnpj) clearCurrent();
    requestSeq += 1; // invalida qualquer resposta em voo
    button.disabled = false;
    clearTimeout(debounceTimer);

    if (cnpj.length === 0) {
      setStatus(statusEl, 'idle', IDLE_MESSAGE);
    } else if (cnpj.length < 14) {
      setStatus(statusEl, 'idle', `Faltam ${14 - cnpj.length} caracteres.`);
    } else {
      debounceTimer = setTimeout(lookup, DEBOUNCE_MS);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // não submete o formulário
      lookup();
    }
  });

  button.addEventListener('click', lookup);
  setStatus(statusEl, 'idle', IDLE_MESSAGE);

  return {
    getEmpresa: () => current,
    reset: () => {
      input.value = '';
      requestSeq += 1;
      clearCurrent();
      setStatus(statusEl, 'idle', IDLE_MESSAGE);
    },
  };
};

export default createCnpjLookup;
