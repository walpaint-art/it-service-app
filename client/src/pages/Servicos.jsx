import { useState, useEffect } from 'react';
import {
  Plus, Search, Edit2, Trash2, X, Clock, DollarSign,
} from 'lucide-react';
import { servicesAPI } from '../services/api';
import { toast } from 'react-hot-toast';

export const CATEGORY_LABELS = {
  rede: 'Rede',
  servidor: 'Servidor',
  computador: 'Computador',
  camera_ip: 'Câmera IP',
  nvr: 'NVR',
  sistema: 'Sistema',
  outro: 'Outro',
};

const EMPTY_FORM = {
  name: '', category: 'computador', description: '', price: '0',
  duration_minutes: '60', active: true,
};

const money = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Servicos() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await servicesAPI.list();
      setServices(res.data);
    } catch (err) {
      toast.error('Erro ao carregar serviços');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (sv) => {
    setEditing(sv.id);
    setForm({
      ...EMPTY_FORM,
      ...sv,
      price: String(sv.price || 0),
      duration_minutes: String(sv.duration_minutes || 60),
      active: sv.active === 1,
    });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        category: form.category,
        description: form.description,
        price: parseFloat(form.price) || 0,
        duration_minutes: parseInt(form.duration_minutes, 10) || 60,
        active: form.active ? 1 : 0,
      };
      if (editing) {
        await servicesAPI.update(editing, payload);
        toast.success('Serviço atualizado');
      } else {
        await servicesAPI.create(payload);
        toast.success('Serviço cadastrado');
      }
      setOpen(false);
      loadServices();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar serviço');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Excluir este serviço?')) return;
    try {
      await servicesAPI.delete(id);
      toast.success('Serviço excluído');
      loadServices();
    } catch (err) {
      toast.error('Erro ao excluir serviço');
    }
  };

  const toggleActive = async (sv) => {
    try {
      await servicesAPI.update(sv.id, {
        name: sv.name,
        category: sv.category,
        description: sv.description,
        price: sv.price,
        duration_minutes: sv.duration_minutes,
        active: sv.active === 1 ? 0 : 1,
      });
      loadServices();
    } catch (err) {
      toast.error('Erro ao alterar status');
    }
  };

  const filtered = services.filter((sv) =>
    !search || `${sv.name} ${sv.description || ''} ${CATEGORY_LABELS[sv.category] || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Serviços</h1>
          <p className="text-sm text-gray-500">
            Catálogo de serviços: manutenção, rede, câmeras, NVR, sistemas e suporte
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center justify-center gap-2">
          <Plus size={20} /> Novo Serviço
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 max-w-md">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Buscar serviço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Nenhum serviço cadastrado.</p>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-gray-200 lg:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th>Categoria</th>
                    <th>Descrição</th>
                    <th className="text-right">Preço</th>
                    <th className="text-center">Duração</th>
                    <th className="text-center">Ativo</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sv) => (
                    <tr key={sv.id} className={`tr-hover ${sv.active === 1 ? '' : 'opacity-60'}`}>
                      <td>
                        <div className={`font-medium text-gray-900 ${sv.active === 1 ? '' : 'line-through'}`}>{sv.name}</div>
                      </td>
                      <td className="text-gray-600">{CATEGORY_LABELS[sv.category] || sv.category}</td>
                      <td className="max-w-xs truncate text-gray-600">{sv.description || '—'}</td>
                      <td className="text-right font-medium text-gray-900">R$ {money(sv.price)}</td>
                      <td className="text-center text-xs text-gray-600">{sv.duration_minutes} min</td>
                      <td className="text-center">
                        <button
                          onClick={() => toggleActive(sv)}
                          className={`h-5 w-10 rounded-full p-0.5 transition-colors ${sv.active === 1 ? 'bg-green-500' : 'bg-gray-300'}`}
                          title={sv.active === 1 ? 'Desativar' : 'Ativar'}
                        >
                          <span className={`block h-4 w-4 transform rounded-full bg-white transition-transform ${sv.active === 1 ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(sv)} className="p-2 text-gray-400 hover:text-brand-600" title="Editar">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => remove(sv.id)} className="p-2 text-gray-400 hover:text-red-600" title="Excluir">
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
            <ul className="space-y-3 lg:hidden">
              {filtered.map((sv) => (
                <li key={sv.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate font-semibold text-gray-900 ${sv.active === 1 ? '' : 'line-through opacity-60'}`}>{sv.name}</p>
                      <p className="text-xs text-gray-500">{CATEGORY_LABELS[sv.category] || sv.category}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => openEdit(sv)} className="p-2 text-gray-400 hover:text-brand-600" title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => remove(sv.id)} className="p-2 text-gray-400 hover:text-red-600" title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  {sv.description && <p className="mt-2 text-xs text-gray-500">{sv.description}</p>}
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 font-semibold text-gray-900">
                      <DollarSign size={14} /> R$ {money(sv.price)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={13} /> {sv.duration_minutes} min
                    </span>
                    <button
                      onClick={() => toggleActive(sv)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${sv.active === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {sv.active === 1 ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-end justify-center sm:items-center">
              <div
                className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white text-left shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
                  <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Editar Serviço' : 'Novo Serviço'}</h3>
                  <button onClick={() => setOpen(false)} className="rounded-md p-1 text-gray-400 hover:text-gray-600" aria-label="Fechar">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={save} className="space-y-4 p-5">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Nome do Serviço *</label>
                    <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Categoria *</label>
                    <select className="select w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Descrição</label>
                    <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Preço (R$)</label>
                      <input className="input" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Duração (min)</label>
                      <input className="input" type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    Serviço ativo no catálogo
                  </label>
                  <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <button type="button" onClick={() => setOpen(false)} className="btn-outline">Cancelar</button>
                    <button type="submit" className="btn-primary">Salvar Serviço</button>
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
