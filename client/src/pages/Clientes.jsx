import { useState, useEffect } from 'react';
import {
  Search, Edit2, Trash2, Phone, Mail, MapPin, MessageCircle, Building2, UserPlus, X,
  Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { customersAPI } from '../services/api';
import {
  onlyDigits, formatCpfCnpj, formatCep, formatPhone, validateDocument,
  isValidCnpj, lookupCep, lookupCnpj, composeAddress,
} from '../lib/br';
import { toast } from 'react-hot-toast';

const EMPTY_FORM = {
  name: '', contact_name: '', phone: '', whatsapp: '', email: '',
  company: '', cnpj: '', address: '', city: '', state: '', zip_code: '', notes: '',
};

export default function Clientes() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lookingUp, setLookingUp] = useState(null); // 'cnpj' | 'cep'
  const [docInfo, setDocInfo] = useState(null); // { type, valid, digits }

  useEffect(() => {
    const timer = setTimeout(loadCustomers, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await customersAPI.list(search ? { q: search } : undefined);
      setCustomers(res.data);
    } catch (err) {
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDocInfo(null);
    setOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c.id);
    setForm({
      ...EMPTY_FORM,
      ...c,
      cnpj: formatCpfCnpj(c.cnpj || ''),
      zip_code: formatCep(c.zip_code || ''),
      phone: formatPhone(c.phone || ''),
      whatsapp: formatPhone(c.whatsapp || ''),
    });
    setDocInfo(c.cnpj ? validateDocument(c.cnpj) : null);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setLookingUp(null);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await customersAPI.update(editing, form);
        toast.success('Cliente atualizado');
      } else {
        await customersAPI.create(form);
        toast.success('Cliente cadastrado');
      }
      setOpen(false);
      setLookingUp(null);
      loadCustomers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar cliente');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Excluir este cliente? Os equipamentos vinculados também serão removidos.')) return;
    try {
      await customersAPI.delete(id);
      toast.success('Cliente excluído');
      loadCustomers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao excluir cliente');
    }
  };

  const waLink = (value) => `https://wa.me/${String(value || '').replace(/\D/g, '')}`;

  const handleDocumentChange = (value) => {
    const masked = formatCpfCnpj(value);
    setForm((f) => ({ ...f, cnpj: masked }));
    setDocInfo(masked ? validateDocument(masked) : null);
  };

  const fillFromCnpj = async (raw, { force = false } = {}) => {
    const digits = onlyDigits(raw);
    if (digits.length !== 14) return;
    if (!isValidCnpj(digits)) {
      toast.error('CNPJ inválido — confira os dígitos');
      return;
    }
    setLookingUp('cnpj');
    try {
      const data = await lookupCnpj(digits);
      setForm((f) => ({
        ...f,
        cnpj: data.cnpj,
        name: force || !f.name ? data.name || f.name : f.name,
        company: force || !f.company ? data.company || f.company : f.company,
        email: force || !f.email ? data.email || f.email : f.email,
        phone: force || !f.phone ? data.phone || f.phone : f.phone,
        whatsapp: force || !f.whatsapp ? data.phone || f.whatsapp : f.whatsapp,
        address: force || !f.address ? data.address || f.address : f.address,
        city: force || !f.city ? data.city || f.city : f.city,
        state: force || !f.state ? data.state || f.state : f.state,
        zip_code: force || !f.zip_code ? data.zip_code || f.zip_code : f.zip_code,
      }));
      toast.success(`Dados de ${data.name || 'CNPJ'} preenchidos`);
    } catch (err) {
      toast.error(err.message || 'Erro ao consultar o CNPJ');
    } finally {
      setLookingUp(null);
    }
  };

  const fillFromCep = async (raw) => {
    const digits = onlyDigits(raw);
    if (digits.length !== 8) {
      if (digits.length > 0) toast.error('CEP deve ter 8 dígitos');
      return;
    }
    setLookingUp('cep');
    try {
      const data = await lookupCep(digits);
      setForm((f) => ({
        ...f,
        zip_code: data.zip_code,
        city: data.city || f.city,
        state: data.state || f.state,
        address:
          f.address ||
          composeAddress({
            street: data.street,
            neighborhood: data.neighborhood,
            complement: data.complement,
          }),
      }));
      toast.success('Endereço preenchido pelo CEP');
    } catch (err) {
      toast.error(err.message || 'Erro ao consultar o CEP');
    } finally {
      setLookingUp(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">Cadastro de clientes para atendimento personalizado</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center justify-center gap-2">
          <UserPlus size={20} /> Novo Cliente
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5">
          <div className="relative max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Buscar por nome, telefone, whatsapp ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">Carregando...</p>
        ) : customers.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Nenhum cliente encontrado.</p>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-200 md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contato</th>
                    <th>Telefone / WhatsApp</th>
                    <th>Empresa</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="tr-hover">
                      <td>
                        <div className="font-medium text-gray-900">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.address || 'Sem endereço cadastrado'}</div>
                      </td>
                      <td className="text-gray-600">
                        <div>{c.contact_name || '—'}</div>
                        {c.email && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Mail size={12} /> {c.email}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Phone size={14} className="text-gray-400" />
                          {c.phone || '—'}
                        </div>
                        {c.whatsapp && (
                          <a
                            href={waLink(c.whatsapp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700"
                          >
                            <MessageCircle size={13} /> WhatsApp
                          </a>
                        )}
                      </td>
                      <td className="text-gray-600">
                        <div className="flex items-center gap-2">
                          {c.company && <Building2 size={14} className="text-gray-400" />}
                          {c.company || '—'}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(c)} className="p-2 text-gray-400 hover:text-brand-600" title="Editar">
                            <Edit2 size={18} />
                          </button>
                          <a
                            href={waLink(c.whatsapp || c.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-green-600 hover:text-green-700"
                            title="Abrir WhatsApp"
                          >
                            <MessageCircle size={18} />
                          </a>
                          <button onClick={() => remove(c.id)} className="p-2 text-gray-400 hover:text-red-600" title="Excluir">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <ul className="space-y-3 md:hidden">
              {customers.map((c) => (
                <li key={c.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.company || c.contact_name || 'Cliente'}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => openEdit(c)} className="p-2 text-gray-400 hover:text-brand-600" title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => remove(c.id)} className="p-2 text-gray-400 hover:text-red-600" title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <a href={`tel:${c.phone || ''}`} className="flex items-center gap-2">
                      <Phone size={14} className="text-gray-400" /> {c.phone || '—'}
                    </a>
                    {(c.whatsapp || c.phone) && (
                      <a
                        href={waLink(c.whatsapp || c.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-green-600"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    )}
                    {c.address && (
                      <p className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin size={14} className="text-gray-400" /> {c.address}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Modal cadastro/edição */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="absolute inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-end justify-center sm:items-center">
              <div
                className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white text-left shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editing ? 'Editar Cliente' : 'Novo Cliente'}
                  </h3>
                  <button onClick={closeModal} className="rounded-md p-1 text-gray-400 hover:text-gray-600" aria-label="Fechar">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={save} className="space-y-4 p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Nome *</label>
                      <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Contato</label>
                      <input className="input" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Telefone *</label>
                      <input
                        className="input"
                        required
                        inputMode="tel"
                        placeholder="(62) 99273-3000"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        onBlur={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">WhatsApp</label>
                      <input
                        className="input"
                        inputMode="tel"
                        placeholder="(62) 99273-3000"
                        value={form.whatsapp}
                        onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                        onBlur={(e) => setForm({ ...form, whatsapp: formatPhone(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">E-mail</label>
                      <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">CPF / CNPJ</label>
                      <div className="flex gap-2">
                        <input
                          className={`input flex-1 ${
                            docInfo && docInfo.digits.length >= 11
                              ? docInfo.valid
                                ? 'border-green-400 focus:border-green-500 focus:ring-green-500'
                                : 'border-red-300 focus:border-red-500 focus:ring-red-500'
                              : ''
                          }`}
                          inputMode="numeric"
                          placeholder="000.000.000-00 ou 00.000.000/0000-00"
                          value={form.cnpj}
                          onChange={(e) => handleDocumentChange(e.target.value)}
                          onBlur={(e) => fillFromCnpj(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => fillFromCnpj(form.cnpj, { force: true })}
                          disabled={lookingUp === 'cnpj'}
                          className="btn-outline shrink-0 px-3 disabled:opacity-50"
                          title="Buscar dados na Receita Federal"
                        >
                          {lookingUp === 'cnpj' ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        </button>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs">
                        {docInfo && docInfo.digits.length >= 11 ? (
                          docInfo.valid ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 size={12} /> {docInfo.type === 'cnpj' ? 'CNPJ válido' : 'CPF válido'} — dados serão buscados ao sair do campo
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600">
                              <AlertCircle size={12} /> Documento inválido
                            </span>
                          )
                        ) : (
                          <span className="text-gray-500">CNPJ preenche empresa, e-mail, telefone e endereço automaticamente.</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Empresa</label>
                    <input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">CEP</label>
                      <div className="flex gap-2">
                        <input
                          className="input flex-1"
                          inputMode="numeric"
                          placeholder="00000-000"
                          value={form.zip_code}
                          onChange={(e) => setForm({ ...form, zip_code: formatCep(e.target.value) })}
                          onBlur={(e) => fillFromCep(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => fillFromCep(form.zip_code)}
                          disabled={lookingUp === 'cep'}
                          className="btn-outline shrink-0 px-3 disabled:opacity-50"
                          title="Buscar endereço pelo CEP"
                        >
                          {lookingUp === 'cep' ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Busca o endereço no ViaCEP automaticamente.</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Endereço</label>
                      <input
                        className="input"
                        placeholder="Rua, número - bairro"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Cidade</label>
                      <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">UF</label>
                      <input
                        className="input uppercase"
                        maxLength={2}
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Observações</label>
                    <textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <button type="button" onClick={closeModal} className="btn-outline">Cancelar</button>
                    <button type="submit" className="btn-primary">Salvar Cliente</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
