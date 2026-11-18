/**
 * @file config.js
 * Configuração do frontend. Troque API_URL pela URL do Web App do Apps Script
 * (Implantar → Nova implantação → App da Web → copiar URL terminada em /exec).
 */

/** @type {string} */
export const API_URL = 'https://script.google.com/macros/s/AKfycbz7bbF61GI-496O_CQsOuM_tz-OTfYJeqhhVFGRpSePyXHjgVi0Yt3UGtt5PqmicgMp/exec';

/** Tempo máximo de espera por resposta do Apps Script (cold start pode passar de 5s). */
export const REQUEST_TIMEOUT_MS = 30000;

/** Tentativas do frontend em falha de rede/timeout (o backend já faz retry na CNPJá). */
export const MAX_NETWORK_ATTEMPTS = 2;

/**
 * Indica se a URL da API ainda é o placeholder.
 * @returns {boolean} true se não configurada.
 */
export const isApiConfigured = () => !API_URL.includes('COLE_AQUI');
