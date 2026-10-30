import { useState, useEffect } from 'react';
import {
  Plus, Search, Edit2, Trash2, HardHat, Clock, CheckCircle2, AlertCircle,
  Video, Image, MonitorSmartphone, Cpu, Server, Wifi, HardDrive, Tag,
  Smartphone, Wallet, ChevronRight, Copy, Download, Send, Maximize,
  Wrench, Bot, Barcode, Printer,
} from 'lucide-react';
import { ordersAPI, customersAPI, itemsAPI, servicesAPI, whatsappAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';

const STATUS_LABELS = {
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  em_andamento: 'Em Andamento',
  aguardando_pecas: 'Aguardando Peças',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};
const STATUS_COLORS = {
  orcamento: 'badge-orcamento',
  aprovado: 'badge-aprovado',
  em_andamento: 'badge-em_andamento',
  aguardando_pecas: 'badge-aguardando_pecas',
  concluido: 'badge-concluido',
  cancelado: 'badge-cancelado',
};
const PRIORITY_LABELS = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };

export default function Ordens() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [customers, setCustomers] = useState([]);
  const [itemsCat, setItemsCat] = useState([]);
  const [servicesCat, setServicesCat] = useState([]);

  useEffect(() => {
    loadOrders();
    loadCustomers();
    loadCatalog();
  }, [search, statusFilter, customerFilter]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await ordersAPI.list({
        q: search || undefined,
        status: statusFilter || undefined,
        customer_id: customerFilter || undefined,
      });
      setOrders(res.data);
    } catch (err) {
      toast.error('Erro ao carregar OS');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await customersAPI.list();
      setCustomers(res.data);
    } catch (err) {}
  };

  const loadCatalog = async () => {
    try {
      const [iRes, sRes] = await Promise.all([itemsAPI.list(), servicesAPI.list()]);
      setItemsCat(iRes.data);
      setServicesCat(sRes.data);
    } catch (err) {}
  };

  const toggleStatus = async (id, status) => {
    try {
      await ordersAPI.changeStatus(id, status);
      toast.success('Status atualizado');
      loadOrders();
    } catch (err) {
      toast.error('Erro ao atualizar status');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Excluir esta OS?')) return;
    try {
      await ordersAPI.delete(id);
      toast.success('OS excluída');
      loadOrders();
    } catch (err) {
      toast.error('Erro ao excluir OS');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ordens de Serviço</h1>
          <p className="text-gray-500 text-sm">Gerenciamento completo de atendimentos: redes, servidores, computadores, câmeras IP, NVRs e sistemas</p>
        </div>
        <Link to="/ordens/nova" className="btn-primary flex items-center gap-2">
          <Plus size={20} /> Nova OS
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="pl-10 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Buscar OS, cliente ou título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm"
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="select w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm"
          >
            <option value="">Todos os clientes</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase text-xs">Nº OS</th>
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase text-xs">Cliente</th>
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase text-xs">Título</th>
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase text-xs">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase text-xs text-right">Valor</th>
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase text-xs text-center">Pagamento</th>
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase text-xs text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">Carregando...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">Nenhuma ordem de serviço encontrada.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="tr-hover group">
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900 text-xs font-mono">{o.order_number}</div>
                      <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString('pt-BR')}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{o.customer_name}</div>
                      <div className="text-xs text-gray-500">{o.customer_phone || '—'}</div>
                    </td>
                    <td className="px-4 py-4 text-gray-700 line-clamp-1">{o.title}</td>
                    <td className="px-4 py-4">
                      <span className={`badge ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-800'}`}>{STATUS_LABELS[o.status]}</span>
                    </td>
                    <td className="px-4 py-4 text-right text-gray-900 font-medium">
                      R$ {Number(o.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`badge ${o.payment_status === 'pago' ? 'bg-green-100 text-green-800' : o.payment_status === 'parcial' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                        {o.payment_status === 'pago' ? 'Pago' : o.payment_status === 'parcial' ? 'Parcial' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleStatus(o.id, o.status === 'concluido' ? 'orcamento' : 'concluido')}
                          className="p-2 text-gray-400 hover:text-brand-600" title="Alterar status"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => window.open(`/ordens/${o.id}/imprimir`, '_blank', 'noopener')}
                          className="p-2 text-gray-400 hover:text-brand-600"
                          title={o.status === 'orcamento' ? 'Imprimir orçamento' : 'Imprimir OS'}
                        >
                          <Printer size={18} />
                        </button>
                        <Link to={`/ordens/${o.id}`} className="p-2 text-gray-400 hover:text-brand-600" title="Detalhes">
                          <ChevronRight size={18} />
                        </Link>
                        <button onClick={() => remove(o.id)} className="p-2 text-gray-400 hover:text-red-600" title="Excluir">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
