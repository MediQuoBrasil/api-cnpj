/* eslint no-param-reassign: ["error", { "props": false }] -- elementos DOM recebidos são mutados por design */
/**
 * @file parceiro.js
 * Controlador da página "Novo Parceiro" (simulação de id.mediquo.com.br/parceiros/form/novo).
 * Regra: Razão Social, Nome Fantasia e Endereço vêm só do CNPJ e não são editáveis.
 */

import createCnpjLookup from './cnpj-lookup.js';
import {
  bindPhoneMask, clearFieldErrors, fillLockedFields, initPreviewDialog, isValidEmail,
  openPreview, setFieldError, showToast,
} from './ui.js';

/** @typedef {import('./api.js').EmpresaDto} EmpresaDto */

/** Ids dos campos travados (preenchidos pela Receita). */
const LOCKED_IDS = Object.freeze([
  'name', 'nameFantasy', 'cepCode', 'street', 'streetNumber', 'complement', 'neighborhood', 'city', 'state',
]);

/** Categorias simuladas por modelo de negócio (as reais vêm do backend do ID). */
const CATEGORIES_BY_MODEL = Object.freeze({
  5: [{ id: '51', label: 'Corporativo (exemplo)' }],
  7: [{ id: '71', label: 'Varejo (exemplo)' }],
  6: [{ id: '61', label: 'Parceria SVA (exemplo)' }],
});

/**
 * Converte a empresa no mapa id → valor dos campos travados.
 * @param {?Readonly<EmpresaDto>} empresa Empresa ou null (limpa tudo).
 * @returns {Object<string, string>} Valores por id.
 */
const toLockedValues = (empresa) => {
  if (empresa === null) return Object.fromEntries(LOCKED_IDS.map((id) => [id, '']));
  const e = empresa.endereco;
  return {
    name: empresa.razaoSocial,
    nameFantasy: empresa.nomeFantasia,
    cepCode: e.cepFormatado,
    street: e.logradouro,
    streetNumber: e.numero,
    complement: e.complemento,
    neighborhood: e.bairro,
    city: e.cidade,
    state: e.uf,
  };
};

/**
 * Popula o select de categoria conforme o modelo de negócio.
 * @param {HTMLSelectElement} categorySelect Select de categoria.
 * @param {string} modelId Modelo escolhido.
 * @returns {void}
 */
const renderCategories = (categorySelect, modelId) => {
  const options = CATEGORIES_BY_MODEL[modelId] || [];
  const placeholder = new Option(modelId ? 'Selecione uma categoria' : 'Selecione um modelo primeiro', '');
  categorySelect.replaceChildren(placeholder, ...options.map((c) => new Option(c.label, c.id)));
  categorySelect.disabled = options.length === 0;
};

/**
 * Valida os campos editáveis. Retorna o primeiro campo inválido para foco.
 * @param {Object<string, HTMLInputElement|HTMLSelectElement>} f Campos do formulário.
 * @returns {?HTMLElement} Primeiro campo inválido ou null.
 */
const validateEditable = (f) => {
  /** @type {Array<[HTMLInputElement|HTMLSelectElement, string]>} */
  const errors = [];
  const phoneDigits = f.phoneNumber.value.replace(/\D/g, '');
  if (phoneDigits.length < 10) errors.push([f.phoneNumber, 'Informe um telefone com DDD.']);
  if (f.billingEmail.value && !isValidEmail(f.billingEmail.value.trim())) errors.push([f.billingEmail, 'Email inválido.']);
  if (!f.businessModelId.value) errors.push([f.businessModelId, 'Selecione o modelo de negócio.']);
  if (!f.categoryId.value) errors.push([f.categoryId, 'Selecione a categoria.']);
  if (!f.sellerId.value) errors.push([f.sellerId, 'Selecione o vendedor.']);
  if (!f.accountManagerId.value) errors.push([f.accountManagerId, 'Selecione o gerente de conta.']);
  if (!isValidEmail(f.userEmail.value.trim())) errors.push([f.userEmail, 'Informe um email válido.']);
  if (f.userPassword.value.length < 8) errors.push([f.userPassword, 'A senha precisa de no mínimo 8 caracteres.']);
  if (!f.userFullName.value.trim()) errors.push([f.userFullName, 'Informe o nome do administrador.']);
  errors.forEach(([input, msg]) => setFieldError(input, msg));
  return errors.length ? errors[0][0] : null;
};

/**
 * Monta o payload de criação. Dados da empresa saem do estado da consulta (não do DOM).
 * @param {Readonly<EmpresaDto>} empresa Empresa consultada.
 * @param {Object<string, HTMLInputElement|HTMLSelectElement>} f Campos editáveis.
 * @returns {Object} Payload (senha omitida).
 */
const buildPayload = (empresa, f) => ({
  documentNumber: empresa.cnpj,
  name: empresa.razaoSocial,
  nameFantasy: empresa.nomeFantasia,
  address: {
    cepCode: empresa.endereco.cep,
    street: empresa.endereco.logradouro,
    streetNumber: empresa.endereco.numero,
    complement: empresa.endereco.complemento,
    neighborhood: empresa.endereco.bairro,
    city: empresa.endereco.cidade,
    state: empresa.endereco.uf,
  },
  contactName: f.contactName.value.trim(),
  phoneNumber: f.phoneNumber.value.replace(/\D/g, ''),
  billingEmail: f.billingEmail.value.trim(),
  businessModelId: Number(f.businessModelId.value),
  categoryId: Number(f.categoryId.value),
  sellerId: Number(f.sellerId.value),
  accountManagerId: Number(f.accountManagerId.value),
  representativeId: f.representativeId.value ? Number(f.representativeId.value) : null,
  user: {
    email: f.userEmail.value.trim(),
    fullName: f.userFullName.value.trim(),
    password: '[omitida na pré-visualização]',
    sendWelcomeEmail: /** @type {HTMLInputElement} */ (f.sendWelcomeEmail).checked,
  },
  receitaInfo: { situacao: empresa.situacao.descricao, porte: empresa.porte, fonte: empresa.fonte },
});

/**
 * Liga as abas Dados Gerais / Produtos.
 * @returns {void}
 */
const initTabs = () => {
  const tabs = document.querySelectorAll('[role="tab"]');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        const selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
      });
    });
  });
};

/**
 * Inicializa a página.
 * @returns {void}
 */
const init = () => {
  const form = /** @type {HTMLFormElement} */ (document.getElementById('parceiro-form'));
  const ids = ['contactName', 'phoneNumber', 'billingEmail', 'businessModelId', 'categoryId', 'sellerId',
    'accountManagerId', 'representativeId', 'userEmail', 'userPassword', 'userFullName', 'sendWelcomeEmail'];
  /** @type {Object<string, HTMLInputElement|HTMLSelectElement>} */
  const f = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const cnpjInput = /** @type {HTMLInputElement} */ (document.getElementById('documentNumber'));

  const lookup = createCnpjLookup({
    input: cnpjInput,
    button: /** @type {HTMLButtonElement} */ (document.getElementById('btnBuscarCnpj')),
    statusEl: document.getElementById('cnpjStatus'),
    onResolved: (empresa) => fillLockedFields(toLockedValues(empresa)),
    onCleared: () => fillLockedFields(toLockedValues(null)),
  });

  initTabs();
  initPreviewDialog();
  bindPhoneMask(/** @type {HTMLInputElement} */ (f.phoneNumber));
  f.businessModelId.addEventListener('change', () => renderCategories(
    /** @type {HTMLSelectElement} */ (f.categoryId),
    f.businessModelId.value,
  ));
  form.addEventListener('input', (e) => {
    if (e.target.classList.contains('is-invalid')) setFieldError(e.target, '');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const empresa = lookup.getEmpresa();
    const firstInvalid = validateEditable(f);

    if (empresa === null) {
      showToast('Consulte um CNPJ válido antes de criar o parceiro.', 'error');
      cnpjInput.focus();
      return;
    }
    if (firstInvalid !== null) {
      showToast('Revise os campos destacados.', 'error');
      firstInvalid.focus();
      return;
    }
    openPreview('Parceiro pronto para criação', buildPayload(empresa, f));
  });
};

init();
