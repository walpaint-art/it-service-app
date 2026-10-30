/**
 * Utilitários de documentos e endereço brasileiros (CPF, CNPJ, CEP, telefone).
 *
 * - Formatação/máscara: formatCpf, formatCnpj, formatCpfCnpj, formatCep, formatPhone
 * - Validação: isValidCpf, isValidCnpj, validateDocument
 * - Consultas externas: lookupCep (ViaCEP), lookupCnpj (BrasilAPI)
 */

export const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');

/* ------------------------------- Formatação ------------------------------- */

export function formatCpf(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCnpj(value) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Formata como CPF até 11 dígitos; a partir daí, como CNPJ. */
export function formatCpfCnpj(value) {
  return onlyDigits(value).length > 11 ? formatCnpj(value) : formatCpf(value);
}

export function formatCep(value) {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function formatPhone(value) {
  let d = onlyDigits(value);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/* -------------------------------- Validação ------------------------------- */

export function isValidCpf(value) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCnpj(value) {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len) => {
    const weights = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(d[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/**
 * Identifica e valida o documento.
 * @returns {{ type: 'cpf'|'cnpj'|null, valid: boolean, digits: string }}
 */
export function validateDocument(value) {
  const digits = onlyDigits(value);
  if (digits.length === 11 && isValidCpf(digits)) return { type: 'cpf', valid: true, digits };
  if (digits.length === 14 && isValidCnpj(digits)) return { type: 'cnpj', valid: true, digits };
  const type = digits.length === 14 ? 'cnpj' : digits.length === 11 ? 'cpf' : null;
  return { type, valid: false, digits };
}

/* ----------------------------- Consultas online --------------------------- */

/** Consulta o CEP no ViaCEP e devolve os campos do endereço. */
export async function lookupCep(cep) {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) throw new Error('Informe um CEP com 8 dígitos');

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) throw new Error('Não foi possível consultar o CEP agora');

  const data = await res.json();
  if (data.erro) throw new Error('CEP não encontrado');

  return {
    zip_code: formatCep(digits),
    street: data.logradouro || '',
    neighborhood: data.bairro || '',
    city: data.localidade || '',
    state: data.uf || '',
    complement: data.complemento || '',
  };
}

/** Junta os pedaços do endereço em uma linha só (como o campo `address` guarda). */
export function composeAddress({ street, number, neighborhood, complement }) {
  const line1 = [street, number].filter(Boolean).join(', ');
  const parts = [line1, complement, neighborhood].filter(Boolean);
  return parts.join(' - ');
}

/** Consulta o CNPJ (BrasilAPI → Receitaws → publica.cnpj.ws) e devolve os dados cadastrais. */
export async function lookupCnpj(cnpj) {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) throw new Error('Informe um CNPJ com 14 dígitos');

  const data = await fetchCnpjData(digits);
  if (!data || !(data.name || data.company)) {
    throw new Error('CNPJ não encontrado ou serviço de consulta indisponível');
  }

  return {
    cnpj: formatCnpj(digits),
    name: data.name || '',
    company: data.company || data.name || '',
    email: String(data.email || '').toLowerCase(),
    phone: formatPhone(data.phone || ''),
    address: composeAddress({
      street: [data.streetType, data.street].filter(Boolean).join(' '),
      number: data.number || '',
      neighborhood: data.neighborhood || '',
      complement: data.complement || '',
    }),
    city: data.city || '',
    state: data.state || '',
    zip_code: formatCep(data.zip_code || ''),
    status: data.status || '',
  };
}

async function fetchCnpjData(digits) {
  const providers = [
    {
      url: `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
      normalize: (d) => ({
        name: d.razao_social,
        company: d.nome_fantasia,
        email: d.email,
        phone: d.ddd_telefone_1,
        streetType: d.descricao_tipo_de_logradouro,
        street: d.logradouro,
        number: d.numero,
        neighborhood: d.bairro,
        complement: d.complemento,
        city: d.municipio,
        state: d.uf,
        zip_code: d.cep,
        status: d.descricao_situacao_cadastral,
      }),
    },
    {
      url: `https://receitaws.com.br/v1/cnpj/${digits}`,
      normalize: (d) => ({
        name: d.nome,
        company: d.fantasia,
        email: d.email,
        phone: d.telefone,
        street: d.logradouro,
        number: d.numero,
        neighborhood: d.bairro,
        complement: d.complemento,
        city: d.municipio,
        state: d.uf,
        zip_code: d.cep,
        status: d.situacao,
      }),
    },
    {
      url: `https://publica.cnpj.ws/cnpj/${digits}`,
      normalize: (d) => ({
        name: d.razao_social,
        company: d.estabelecimento?.nome_fantasia,
        email: d.estabelecimento?.email,
        phone: d.estabelecimento?.telefone1,
        streetType: d.estabelecimento?.tipo_logradouro,
        street: d.estabelecimento?.logradouro,
        number: d.estabelecimento?.numero,
        neighborhood: d.estabelecimento?.bairro,
        complement: d.estabelecimento?.complemento,
        city: d.estabelecimento?.cidade?.nome,
        state: d.estabelecimento?.estado?.sigla,
        zip_code: d.estabelecimento?.cep,
        status: d.estabelecimento?.situacao_cadastral,
      }),
    },
  ];

  let lastError = null;
  for (const provider of providers) {
    try {
      const res = await fetch(provider.url, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const json = await res.json();
      const data = provider.normalize(json);
      if (data && (data.name || data.company)) return data;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) throw lastError;
  return null;
}
