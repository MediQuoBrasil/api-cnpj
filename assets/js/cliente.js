/**
 * @file cliente.js
 * Controlador da página "Novo Cliente" (simulação de id.mediquo.com.br/clientes/form/novo).
 * Regra: o Nome do cliente é imutável e segue "Razão Social - Porte (CNPJ)", gerado no servidor.
 */

import createCnpjLookup from './cnpj-lookup.js';
import {
  bindPhoneMask, clearFieldErrors, fillLockedFields, initPreviewDialog, isValidEmail,
  openPreview, setFieldError, showToast,
} from './ui.js';

/** @typedef {import('./api.js').EmpresaDto} EmpresaDto */

/**
 * Valida os campos editáveis.
 * @param {Object<string, HTMLInputElement>} f Campos do formulário.
 * @returns {?HTMLInputElement} Primeiro campo inválido ou null.
 */
const validateEditable = (f) => {
  /** @type {Array<[HTMLInputElement, string]>} */
  const errors = [];
  const phoneDigits = f.phoneNumber.value.replace(/\D/g, '');
  if (f.email.value && !isValidEmail(f.email.value.trim())) errors.push([f.email, 'Email inválido.']);
  if (phoneDigits && phoneDigits.length < 10) errors.push([f.phoneNumber, 'Informe o telefone com DDD.']);
  if (!f.userFullName.value.trim()) errors.push([f.userFullName, 'Informe o nome do administrador.']);
  if (!isValidEmail(f.userEmail.value.trim())) errors.push([f.userEmail, 'Informe um email válido.']);
  if (f.userPassword.value.length < 8) errors.push([f.userPassword, 'A senha precisa de no mínimo 8 caracteres.']);
  if (f.maxLicenses.value !== '') {
    const n = Number(f.maxLicenses.value);
    if (!Number.isInteger(n) || n < 0) errors.push([f.maxLicenses, 'Use um número inteiro a partir de 0.']);
  }
  errors.forEach(([input, msg]) => setFieldError(input, msg));
  return errors.length ? errors[0][0] : null;
};

/**
 * Monta o payload. O nome vem do estado da consulta (gerado no servidor), nunca do DOM.
 * @param {Readonly<EmpresaDto>} empresa Empresa consultada.
 * @param {Object<string, HTMLInputElement>} f Campos editáveis.
 * @returns {Object} Payload (senha omitida).
 */
const buildPayload = (empresa, f) => ({
  name: empresa.nomePadronizado,
  personType: 'JURIDICA',
  documentNumber: empresa.cnpj,
  email: f.email.value.trim(),
  phoneNumber: f.phoneNumber.value.replace(/\D/g, ''),
  user: {
    fullName: f.userFullName.value.trim(),
    email: f.userEmail.value.trim(),
    password: '[omitida na pré-visualização]',
    sendWelcomeEmail: f.sendWelcomeEmail.checked,
  },
  maxLicenses: f.maxLicenses.value === '' ? null : Number(f.maxLicenses.value),
  receitaInfo: {
    razaoSocialOficial: empresa.razaoSocialOficial,
    situacao: empresa.situacao.descricao,
    porte: empresa.porte,
    fonte: empresa.fonte,
  },
});

/**
 * Inicializa a página.
 * @returns {void}
 */
const init = () => {
  const form = /** @type {HTMLFormElement} */ (document.getElementById('cliente-form'));
  const ids = ['email', 'phoneNumber', 'userFullName', 'userEmail', 'userPassword', 'sendWelcomeEmail', 'maxLicenses'];
  /** @type {Object<string, HTMLInputElement>} */
  const f = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const cnpjInput = /** @type {HTMLInputElement} */ (document.getElementById('documentNumber'));

  const lookup = createCnpjLookup({
    input: cnpjInput,
    button: /** @type {HTMLButtonElement} */ (document.getElementById('btnBuscarCnpj')),
    statusEl: document.getElementById('cnpjStatus'),
    onResolved: (empresa) => fillLockedFields({ name: empresa.nomePadronizado }),
    onCleared: () => fillLockedFields({ name: '' }),
  });

  initPreviewDialog();
  bindPhoneMask(f.phoneNumber);

  const toggle = document.getElementById('togglePassword');
  toggle.addEventListener('click', () => {
    const show = f.userPassword.type === 'password';
    f.userPassword.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  });

  form.addEventListener('input', (e) => {
    if (e.target.classList.contains('is-invalid')) setFieldError(e.target, '');
  });

  document.getElementById('btnCancelar').addEventListener('click', () => {
    form.reset();
    clearFieldErrors(form);
    lookup.reset();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const empresa = lookup.getEmpresa();
    const firstInvalid = validateEditable(f);

    if (empresa === null) {
      showToast('Consulte um CNPJ válido antes de salvar o cliente.', 'error');
      cnpjInput.focus();
      return;
    }
    if (firstInvalid !== null) {
      showToast('Revise os campos destacados.', 'error');
      firstInvalid.focus();
      return;
    }
    openPreview('Cliente pronto para cadastro', buildPayload(empresa, f));
  });
};

init();
