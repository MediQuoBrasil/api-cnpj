/* eslint no-param-reassign: ["error", { "props": false }] -- elementos DOM recebidos são mutados por design */
/**
 * @file ui.js
 * Helpers de interface: toast, erros de campo, máscara de telefone, modal de pré-visualização.
 * Toda escrita de dados no DOM usa textContent/value (sem innerHTML) — proteção contra XSS.
 */

/** @typedef {'info'|'success'|'error'} ToastType */

const ICON_PATHS = Object.freeze({
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  loading: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>'
    + '<line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
  error: '<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>',
});

/**
 * Cria um ícone SVG a partir de paths estáticos (constantes do código, nunca dado externo).
 * @param {keyof ICON_PATHS} name Nome do ícone.
 * @returns {SVGSVGElement} Elemento SVG.
 */
const createIcon = (name) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  if (name === 'loading') svg.classList.add('spin');
  svg.innerHTML = ICON_PATHS[name]; // conteúdo fixo, definido acima
  return svg;
};

/**
 * Atualiza a faixa de status da consulta de CNPJ.
 * @param {HTMLElement} el Elemento .cnpj-status.
 * @param {'idle'|'loading'|'success'|'warning'|'error'} state Estado visual.
 * @param {string} message Texto (dado pode vir da API — vai por textContent).
 * @returns {void}
 */
export const setStatus = (el, state, message) => {
  const iconName = state === 'idle' ? 'info' : state;
  const text = document.createElement('span');
  text.textContent = message;
  el.dataset.state = state;
  el.replaceChildren(createIcon(iconName), text);
};

/**
 * Exibe um toast temporário no canto superior direito.
 * @param {string} message Mensagem.
 * @param {ToastType} [type='info'] Tipo visual.
 * @returns {void}
 */
export const showToast = (message, type = 'info') => {
  const region = document.getElementById('toastRegion');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
};

/**
 * Marca/desmarca erro de um campo (borda + mensagem abaixo).
 * @param {HTMLInputElement|HTMLSelectElement} input Campo.
 * @param {string} message Mensagem; vazio limpa o erro.
 * @returns {void}
 */
export const setFieldError = (input, message) => {
  const errorEl = document.getElementById(`${input.id}-error`);
  input.classList.toggle('is-invalid', Boolean(message));
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (errorEl) errorEl.textContent = message;
};

/**
 * Limpa todos os erros de um formulário.
 * @param {HTMLFormElement} form Formulário.
 * @returns {void}
 */
export const clearFieldErrors = (form) => {
  form.querySelectorAll('.is-invalid').forEach((el) => setFieldError(/** @type {HTMLInputElement} */ (el), ''));
};

/**
 * Valida e-mail de forma pragmática (o backend real deve revalidar).
 * @param {string} value E-mail.
 * @returns {boolean} true se o formato é aceitável.
 */
export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;

/**
 * Máscara de telefone BR: (00) 0000-0000 ou (00) 00000-0000.
 * @param {string} raw Valor digitado.
 * @returns {string} Valor mascarado.
 */
export const maskPhone = (raw) => {
  const d = String(raw).replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/**
 * Liga a máscara de telefone a um input.
 * @param {HTMLInputElement} input Campo de telefone.
 * @returns {void}
 */
export const bindPhoneMask = (input) => {
  input.addEventListener('input', () => { input.value = maskPhone(input.value); });
};

/**
 * Formata data ISO (yyyy-mm-dd ou ISO completo) para dd/mm/aaaa.
 * @param {string} iso Data ISO.
 * @returns {string} Data em pt-BR ou string vazia.
 */
export const formatDateBr = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

/**
 * Liga o botão "Fechar" do modal de pré-visualização.
 * @returns {void}
 */
export const initPreviewDialog = () => {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('previewDialog'));
  document.getElementById('previewClose').addEventListener('click', () => dialog.close());
};

/**
 * Preenche inputs travados a partir de um mapa id → valor.
 * @param {Object<string, string>} valuesById Valores por id de input.
 * @returns {void}
 */
export const fillLockedFields = (valuesById) => {
  Object.entries(valuesById).forEach(([id, value]) => {
    const input = /** @type {HTMLInputElement} */ (document.getElementById(id));
    input.value = value;
    input.title = value;
  });
};

/**
 * Abre o modal de pré-visualização com o payload que seria enviado ao ID.
 * @param {string} title Título do modal.
 * @param {Object} payload Objeto a exibir como JSON.
 * @returns {void}
 */
export const openPreview = (title, payload) => {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('previewDialog'));
  document.getElementById('previewTitle').textContent = title;
  document.getElementById('previewJson').textContent = JSON.stringify(payload, null, 2);
  dialog.showModal();
};
