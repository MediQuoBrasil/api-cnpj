/**
 * @file cnpj.js
 * Utilitários de CNPJ no cliente (espelho do CnpjValidator.gs).
 * Servem só para UX (máscara e feedback imediato) — a validação que vale é a do servidor.
 * Suporta CNPJ alfanumérico: 12 posições [0-9A-Z] + 2 DVs numéricos.
 */

const CNPJ_PATTERN = /^[0-9A-Z]{12}[0-9]{2}$/;
const WEIGHTS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Remove máscara e coloca em maiúsculas, limitando a 14 caracteres.
 * @param {string} raw Valor digitado.
 * @returns {string} Somente [0-9A-Z], no máximo 14.
 */
export const sanitizeCnpj = (raw) => String(raw).toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14);

/**
 * Calcula um dígito verificador (valor do caractere = ASCII − 48).
 * @param {string} base Trecho base.
 * @param {number[]} weights Pesos.
 * @returns {number} DV de 0 a 9.
 */
const calcCheckDigit = (base, weights) => {
  const sum = weights.reduce((acc, w, i) => acc + (base.charCodeAt(i) - 48) * w, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
};

/**
 * Valida formato e DVs.
 * @param {string} cnpj CNPJ sanitizado.
 * @returns {boolean} true se válido.
 */
export const isValidCnpj = (cnpj) => {
  if (!CNPJ_PATTERN.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const dv1 = calcCheckDigit(cnpj.slice(0, 12), WEIGHTS_DV1);
  const dv2 = calcCheckDigit(cnpj.slice(0, 12) + dv1, WEIGHTS_DV2);
  return cnpj.slice(12) === `${dv1}${dv2}`;
};

/**
 * Aplica a máscara progressiva 00.000.000/0000-00 enquanto o usuário digita.
 * @param {string} raw Valor digitado.
 * @returns {string} Valor mascarado.
 */
export const maskCnpj = (raw) => {
  const v = sanitizeCnpj(raw);
  const parts = [v.slice(0, 2), v.slice(2, 5), v.slice(5, 8), v.slice(8, 12), v.slice(12, 14)];
  let out = parts[0];
  if (parts[1]) out += `.${parts[1]}`;
  if (parts[2]) out += `.${parts[2]}`;
  if (parts[3]) out += `/${parts[3]}`;
  if (parts[4]) out += `-${parts[4]}`;
  return out;
};
