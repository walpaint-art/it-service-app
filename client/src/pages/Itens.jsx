import { useState, useEffect } from 'react';
import {
  Plus, Search, Edit2, Trash2, MonitorSmartphone, Cpu, Wifi, Video, HardDrive,
  Server, Tag, X, MapPin,
} from 'lucide-react';
import { itemsAPI, customersAPI } from '../services/api';
import { toast } from 'react-hot-toast';

const CATEGORY_ICONS = {
  rede: Wifi,
  servidor: Server,
  computador: MonitorSmartphone,
  camera_ip: Video,
  nvr: HardDrive,
  sistema: Cpu,
  outro: Tag,
};

const CATEGORY_LABELS = {
  rede: 'Rede',
  servidor: 'Servidor',
  computador: 'Computador',
  camera_ip: 'Câmera IP',
  nvr: 'NVR',
  sistema: 'Sistema',
  outro: 'Outro',
};

const EMPTY_FORM = {
  customer_id: '', name: '', category: 'computador', brand: '', model: '',
  serial_number: '', ip_address: '', mac_address: '', purchase_date: '',
  warranty: '', location: '', notes: '', status: 'ativo',
};

export default function Itens() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    customersAPI.list().then((res) => setCustomers(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadItems, 300);
    return () => clearTimeout(timer);
  }, [search, categoryFilter, customerFilter]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await itemsAPI.list({
        q: search || undefined,
        category: categoryFilter || undefined,
        customer_id: customerFilter || undefined,
      });
      setItems(res.data);
    } catch (err) {
      toast.error('Erro ao carregar itens');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item.id);
    setForm({ ...EMPTY_FORM, ...item, customer_id: String(item.customer_id) });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.customer_id) {
      toast.error('Selecione o cliente do equipamento');
      return;
    }
    try {
      if (editing) {
        await itemsAPI.update(editing, form);
        toast.success('Item atualizado');
      } else {
        await itemsAPI.create(form);
        toast.success('Item cadastrado');
      }
      setOpen(false);
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar item');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Excluir este item?')) return;
    try {
      await itemsAPI.delete(id);
      toast.success('Item excluído');
      loadItems();
    } catch (err) {
      toast.error('Erro ao excluir item');
    }
  };

  const customerName = (item) => item.customer_name || customers.find((c) => c.id === item.customer_id)?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Itens / Equipamentos</h1>
          <p className="text-sm text-gray-500">
            Patrimônio do cliente: redes, servidores, computadores, câmeras IP, NVRs e sistemas
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center justify-center gap-2">
          <Plus size={20} /> Novo Item
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Buscar nome, marca, modelo, número de série..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="select w-full rounded-xl border border-gray-300 bg-white py-2.5 text-sm"
          >
            <option value="">Todas as categorias</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="select w-full rounded-xl border border-gray-300 bg-white py-2.5 text-sm md:col-span-3 md:max-w-xs"
          >
            <option value="">Todos os clientes</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Nenhum item encontrado.</p>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-gray-200 lg:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Categoria</th>
                    <th>Marca / Modelo</th>
                    <th>Nº Série</th>
                    <th className="text-center">IP</th>
                    <th className="text-right">Status</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const Icon = CATEGORY_ICONS[item.category] || Tag;
                    return (
                      <tr key={item.id} className="tr-hover">
                        <td>
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-500">{customerName(item) || item.location || 'Sem local definido'}</div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
                              <Icon size={12} className="text-gray-500" />
                            </div>
                            <span className="text-sm text-gray-700">{CATEGORY_LABELS[item.category] || item.category}</span>
                          </div>
                        </td>
                        <td className="text-gray-600">{item.brand || '—'} / {item.model || '—'}</td>
                        <td className="font-mono text-xs text-gray-600">{item.serial_number || '—'}</td>
                        <td className="text-center text-xs text-gray-600">{item.ip_address || '—'}</td>
                        <td className="text-right">
                          <span className={`badge ${item.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(item)} className="p-2 text-gray-400 hover:text-brand-600" title="Editar">
                              <Edit2 size={18} />
                            </button>
                            <button onClick={() => remove(item.id)} className="p-2 text-gray-400 hover:text-red-600" title="Excluir">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <ul className="space-y-3 lg:hidden">
              {items.map((item) => {
                const Icon = CATEGORY_ICONS[item.category] || Tag;
                return (
                  <li key={item.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                          <Icon size={16} className="text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">{item.name}</p>
                          <p className="truncate text-xs text-gray-500">{customerName(item) || CATEGORY_LABELS[item.category]}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => openEdit(item)} className="p-2 text-gray-400 hover:text-brand-600" title="Editar">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => remove(item.id)} className="p-2 text-gray-400 hover:text-red-600" title="Excluir">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-gray-600">
                      <span>Marca: {item.brand || '—'}</span>
                      <span>Modelo: {item.model || '—'}</span>
                      <span>IP: {item.ip_address || '—'}</span>
                      <span className="truncate">Série: {item.serial_number || '—'}</span>
                      {item.location && (
                        <span className="col-span-2 flex items-center gap-1">
                          <MapPin size={12} /> {item.location}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
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
                className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white text-left shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
                  <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Editar Item' : 'Novo Item'}</h3>
                  <button onClick={() => setOpen(false)} className="rounded-md p-1 text-gray-400 hover:text-gray-600" aria-label="Fechar">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={save} className="space-y-4 p-5">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Cliente *</label>
                    <select
                      className="select w-full"
                      required
                      value={form.customer_id}
                      onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    >
                      <option value="">Selecione o cliente</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Nome *</label>
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
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Marca</label>
                      <input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Modelo</label>
                      <input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Nº de Série</label>
                      <input className="input" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Endereço IP</label>
                      <input className="input" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Endereço MAC</label>
                      <input className="input" value={form.mac_address} onChange={(e) => setForm({ ...form, mac_address: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Data da Compra</label>
                      <input className="input" type="date" value={form.purchase_date || ''} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Garantia</label>
                      <input className="input" value={form.warranty} onChange={(e) => setForm({ ...form, warranty: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
                      <select className="select w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        <option value="ativo">Ativo</option>
                        <option value="manutencao">Em manutenção</option>
                        <option value="inativo">Inativo</option>
                        <option value="descartado">Descartado</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Local / Setor</label>
                    <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Observações</label>
                    <textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <button type="button" onClick={() => setOpen(false)} className="btn-outline">Cancelar</button>
                    <button type="submit" className="btn-primary">Salvar Item</button>
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
