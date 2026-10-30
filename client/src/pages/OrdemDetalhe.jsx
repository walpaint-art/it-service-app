import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Phone, Video, Image as ImageIcon,
  Plus, Trash2, HardHat, Send, Maximize, MonitorSmartphone, Cpu, Server,
  Wifi, HardDrive, Tag, Wrench, Bot, Ban, Wallet, Printer, Pencil, BadgeCheck,
} from 'lucide-react';
import { ordersAPI, whatsappAPI, itemsAPI, servicesAPI } from '../services/api';
import { computeOrderTotals, isItemStruck, isServiceStruck } from '../lib/orderTotals';
import { toast } from 'react-hot-toast';

const STATUS_LABELS = {
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  em_andamento: 'Em Andamento',
  aguardando_pecas: 'Aguardando Peças',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const STATUS_COLORS = {
  orcamento: 'bg-orange-100 text-orange-800 border-orange-200',
  aprovado: 'bg-blue-100 text-blue-800 border-blue-200',
  em_andamento: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  aguardando_pecas: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  concluido: 'bg-green-100 text-green-800 border-green-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
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

const CATEGORY_ICONS = {
  rede: Wifi,
  servidor: Server,
  computador: MonitorSmartphone,
  camera_ip: Video,
  nvr: HardDrive,
  sistema: Cpu,
  outro: Tag,
};

const money = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EMPTY_ITEM = {
  item_id: null, name: '', category: 'computador', brand: '', model: '', serial_number: '',
  quantity: '1', unit_price: '0', authorized: true, installed: false, executed: false, notes: '',
};

const EMPTY_SERVICE = {
  service_id: null, name: '', category: 'computador', description: '', quantity: '1', unit_price: '0',
  authorized: true, executed: false, notes: '',
};

export default function OrdemDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [newService, setNewService] = useState(EMPTY_SERVICE);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [costs, setCosts] = useState({ cost: '0', expense: '0' });
  const [savingCosts, setSavingCosts] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [savingLine, setSavingLine] = useState(false);
  const [discountDraft, setDiscountDraft] = useState('0');
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      const res = await ordersAPI.get(id);
      setOrder(res.data);
      setCosts({
        cost: String(res.data.cost ?? 0),
        expense: String(res.data.expense ?? 0),
      });
      setDiscountDraft(String(res.data.discount ?? 0));

      const [itemsRes, servicesRes] = await Promise.all([
        itemsAPI.list({ customer_id: res.data.customer_id }),
        servicesAPI.list(),
      ]);
      setCatalogItems(itemsRes.data || []);
      setCatalogServices(servicesRes.data || []);
    } catch (err) {
      toast.error('Erro ao carregar OS');
      navigate('/ordens');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (itemId, field) => {
    try {
      await ordersAPI.toggleItem(itemId, field);
      loadOrder();
    } catch (err) {
      toast.error('Erro ao atualizar item');
    }
  };

  const toggleService = async (svId, field) => {
    try {
      await ordersAPI.toggleService(svId, field);
      loadOrder();
    } catch (err) {
      toast.error('Erro ao atualizar serviço');
    }
  };

  const changeStatus = async (status) => {
    try {
      await ordersAPI.changeStatus(id, status);
      toast.success(`Status: ${STATUS_LABELS[status]}`);
      loadOrder();
    } catch (err) {
      toast.error('Erro ao alterar status');
    }
  };

  const saveCosts = async () => {
    setSavingCosts(true);
    try {
      await ordersAPI.updateFinancial(id, {
        cost: parseFloat(costs.cost) || 0,
        expense: parseFloat(costs.expense) || 0,
      });
      toast.success('Custos e despesas salvos');
      await loadOrder();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar custos');
    } finally {
      setSavingCosts(false);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    try {
      await ordersAPI.addItem(id, {
        ...newItem,
        quantity: parseInt(newItem.quantity, 10) || 1,
        unit_price: parseFloat(newItem.unit_price) || 0,
        authorized: newItem.authorized ? 1 : 0,
        installed: newItem.installed ? 1 : 0,
        executed: newItem.executed ? 1 : 0,
      });
      setNewItem(EMPTY_ITEM);
      setShowItemForm(false);
      loadOrder();
      toast.success('Item adicionado');
    } catch (err) {
      toast.error('Erro ao adicionar item');
    }
  };

  const addService = async (e) => {
    e.preventDefault();
    try {
      await ordersAPI.addService(id, {
        ...newService,
        quantity: parseInt(newService.quantity, 10) || 1,
        unit_price: parseFloat(newService.unit_price) || 0,
        authorized: newService.authorized ? 1 : 0,
        executed: newService.executed ? 1 : 0,
      });
      setNewService(EMPTY_SERVICE);
      setShowServiceForm(false);
      loadOrder();
      toast.success('Serviço adicionado');
    } catch (err) {
      toast.error('Erro ao adicionar serviço');
    }
  };

  const removeItem = async (itemId) => {
    if (!window.confirm('Remover este item da OS?')) return;
    try {
      await ordersAPI.removeItem(itemId);
      loadOrder();
    } catch (err) {
      toast.error('Erro ao remover item');
    }
  };

  const removeService = async (svId) => {
    if (!window.confirm('Remover este serviço da OS?')) return;
    try {
      await ordersAPI.removeService(svId);
      loadOrder();
    } catch (err) {
      toast.error('Erro ao remover serviço');
    }
  };

  const startEditItem = (item) => {
    setEditingService(null);
    setEditingItem({
      id: item.id,
      item_id: item.item_id || null,
      name: item.name || '',
      category: item.category || 'outro',
      brand: item.brand || '',
      model: item.model || '',
      serial_number: item.serial_number || '',
      quantity: String(item.quantity ?? 1),
      unit_price: String(item.unit_price ?? 0),
      notes: item.notes || '',
      authorized: item.authorized === 1,
      installed: item.installed === 1,
      executed: item.executed === 1,
      paid: item.paid === 1,
    });
  };

  const saveItem = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingLine(true);
    try {
      await ordersAPI.updateItem(editingItem.id, {
        item_id: editingItem.item_id || null,
        name: editingItem.name,
        category: editingItem.category,
        brand: editingItem.brand,
        model: editingItem.model,
        serial_number: editingItem.serial_number,
        quantity: parseInt(editingItem.quantity, 10) || 1,
        unit_price: parseFloat(editingItem.unit_price) || 0,
        notes: editingItem.notes,
        authorized: editingItem.authorized ? 1 : 0,
        installed: editingItem.installed ? 1 : 0,
        executed: editingItem.executed ? 1 : 0,
        paid: editingItem.paid ? 1 : 0,
      });
      setEditingItem(null);
      await loadOrder();
      toast.success('Item atualizado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar item');
    } finally {
      setSavingLine(false);
    }
  };

  const startEditService = (sv) => {
    setEditingItem(null);
    setEditingService({
      id: sv.id,
      service_id: sv.service_id || null,
      name: sv.name || '',
      category: sv.category || 'outro',
      description: sv.description || '',
      quantity: String(sv.quantity ?? 1),
      unit_price: String(sv.unit_price ?? 0),
      notes: sv.notes || '',
      authorized: sv.authorized === 1,
      executed: sv.executed === 1,
      paid: sv.paid === 1,
    });
  };

  const saveService = async (e) => {
    e.preventDefault();
    if (!editingService) return;
    setSavingLine(true);
    try {
      await ordersAPI.updateService(editingService.id, {
        service_id: editingService.service_id || null,
        name: editingService.name,
        category: editingService.category,
        description: editingService.description,
        quantity: parseInt(editingService.quantity, 10) || 1,
        unit_price: parseFloat(editingService.unit_price) || 0,
        notes: editingService.notes,
        authorized: editingService.authorized ? 1 : 0,
        executed: editingService.executed ? 1 : 0,
        paid: editingService.paid ? 1 : 0,
      });
      setEditingService(null);
      await loadOrder();
      toast.success('Serviço atualizado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar serviço');
    } finally {
      setSavingLine(false);
    }
  };

  const saveDiscount = async () => {
    const value = Math.max(parseFloat(discountDraft) || 0, 0);
    if (value === Number(order.discount || 0)) return;
    try {
      await ordersAPI.updateFinancial(id, { discount: value });
      await loadOrder();
      toast.success('Desconto atualizado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar desconto');
      loadOrder();
    }
  };

  const applyCatalogItem = (catalogId, target = 'new') => {
    const found = catalogItems.find((it) => String(it.id) === String(catalogId));
    const patch = found
      ? {
          item_id: found.id,
          name: found.name || '',
          category: found.category || 'outro',
          brand: found.brand || '',
          model: found.model || '',
          serial_number: found.serial_number || '',
        }
      : { item_id: null };

    if (target === 'edit') setEditingItem((prev) => (prev ? { ...prev, ...patch } : prev));
    else setNewItem((prev) => ({ ...prev, ...patch }));
  };

  const applyCatalogService = (catalogId, target = 'new') => {
    const found = catalogServices.find((sv) => String(sv.id) === String(catalogId));
    const patch = found
      ? {
          service_id: found.id,
          name: found.name || '',
          category: found.category || 'outro',
          description: found.description || '',
          unit_price: String(found.price ?? 0),
        }
      : { service_id: null };

    if (target === 'edit') setEditingService((prev) => (prev ? { ...prev, ...patch } : prev));
    else setNewService((prev) => ({ ...prev, ...patch }));
  };

  const uploadMedia = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (const f of files) formData.append('files', f);
    try {
      await ordersAPI.uploadMedia(id, formData);
      e.target.value = '';
      loadOrder();
      toast.success(`${files.length} mídia(s) enviada(s)`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar mídia');
    }
  };

  const deleteMedia = async (mediaId) => {
    if (!window.confirm('Excluir esta mídia?')) return;
    try {
      await ordersAPI.deleteMedia(mediaId);
      loadOrder();
      toast.success('Mídia excluída');
    } catch (err) {
      toast.error('Erro ao excluir mídia');
    }
  };

  const sendWhatsApp = async () => {
    if (!whatsappMsg.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }
    setSending(true);
    try {
      const res = await whatsappAPI.send({
        order_id: order.id,
        customer_id: order.customer_id,
        message: whatsappMsg,
      });
      setWhatsappMsg('');
      loadOrder();
      if (res.data.wa_link) window.open(res.data.wa_link, '_blank', 'noopener');
      toast.success('Abrindo WhatsApp com a mensagem');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!order) return null;

  const totals = computeOrderTotals(order);
  // Itens/serviços já pagos, instalados, executados ou não autorizados não entram no valor
  const totalItems = totals.itemsGross - totals.itemsDiscount;
  const totalServices = totals.servicesGross - totals.servicesDiscount;
  const finalTotal = totals.total;
  const profit = finalTotal - (Number(costs.cost || 0) + Number(costs.expense || 0));

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button onClick={() => navigate('/ordens')} className="mb-2 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600">
            <ArrowLeft size={16} /> Voltar para as OS
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">OS #{order.order_number.split('-').pop()}</h1>
            <span className={`badge border ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">{order.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={order.status}
            onChange={(e) => changeStatus(e.target.value)}
            className="select w-auto min-w-[180px]"
          >
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => window.open(`/ordens/${order.id}/imprimir`, '_blank', 'noopener')}
            className="btn-secondary flex items-center gap-2"
          >
            <Printer size={16} /> Imprimir OS
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Cliente</h3>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <MonitorSmartphone size={20} />
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-gray-900">{order.customer_name}</div>
              <div className="text-xs text-gray-500">{order.customer_phone || '—'}</div>
            </div>
          </div>
          {order.customer_whatsapp && (
            <a
              href={`https://wa.me/${String(order.customer_whatsapp).replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700"
            >
              <Phone size={13} /> Abrir conversa no WhatsApp
            </a>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Resumo financeiro</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between" title="Não inclui itens já pagos, instalados, executados ou não autorizados">
              <span className="text-gray-500">Itens</span><span>R$ {money(totalItems)}</span>
            </div>
            <div className="flex justify-between" title="Não inclui serviços já pagos, executados ou não autorizados">
              <span className="text-gray-500">Serviços</span><span>R$ {money(totalServices)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500">Desconto</span>
              <span className="flex items-center gap-1 text-green-700">
                <span className="text-xs">− R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountDraft}
                  onChange={(e) => setDiscountDraft(e.target.value)}
                  onBlur={saveDiscount}
                  className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1 font-bold text-gray-900">
              <span>Total</span><span>R$ {money(finalTotal)}</span>
            </div>
            <div className="flex justify-between pt-1 text-xs">
              <span className="text-gray-500">Pagamento</span>
              <span className={`badge ${order.payment_status === 'pago' ? 'bg-green-100 text-green-800' : order.payment_status === 'parcial' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                {order.payment_status === 'pago' ? 'Pago' : order.payment_status === 'parcial' ? 'Parcial' : 'Pendente'}
              </span>
            </div>

            <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Custos e despesas (uso interno)</p>
              <label className="flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-500">Custo (peças)</span>
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costs.cost}
                    onChange={(e) => setCosts({ ...costs, cost: e.target.value })}
                    className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-xs text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </span>
              </label>
              <label className="flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-500">Despesas</span>
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costs.expense}
                    onChange={(e) => setCosts({ ...costs, expense: e.target.value })}
                    className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-xs text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </span>
              </label>
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-500">Lucro</span>
                <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>R$ {money(profit)}</span>
              </div>
              <button
                type="button"
                onClick={saveCosts}
                disabled={savingCosts}
                className="btn-outline w-full py-1.5 text-xs disabled:opacity-50"
              >
                {savingCosts ? 'Salvando...' : 'Salvar custos'}
              </button>
              <p className="text-[10px] leading-tight text-gray-400">
                Uso interno — não aparece no documento impresso (a menos que você marque a opção).
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Relato do cliente</h3>
          <p className="text-sm text-gray-700">{order.problem_report || 'Nenhum relato registrado.'}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <Clock size={13} /> Aberta em {new Date(order.created_at).toLocaleString('pt-BR')}
          </div>
        </div>
      </div>

      {/* Itens */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            <HardHat size={18} className="text-brand-600" /> Itens / Equipamentos
            <span className="text-xs font-normal text-gray-500">({order.items?.length || 0})</span>
          </h3>
          <button type="button" onClick={() => setShowItemForm((v) => !v)} className="btn-outline px-2 py-1.5 text-xs">
            <Plus size={14} /> Adicionar item
          </button>
        </div>

        <div className="space-y-2 p-4">
          {order.items?.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">Nenhum item adicionado</p>
          )}
          {order.items?.map((item) => {
            const Icon = CATEGORY_ICONS[item.category] || Tag;
            const struck = isItemStruck(item);
            if (editingItem?.id === item.id) {
              return (
                <form
                  key={item.id}
                  onSubmit={saveItem}
                  className="space-y-3 rounded-xl border border-brand-300 bg-white p-3"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Equipamento cadastrado (vínculo)</label>
                    <select
                      className="select w-full"
                      value={editingItem.item_id || ''}
                      onChange={(e) => applyCatalogItem(e.target.value, 'edit')}
                    >
                      <option value="">Sem vínculo com o cadastro</option>
                      {catalogItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} — {CATEGORY_LABELS[it.category] || it.category}{it.serial_number ? ` (${it.serial_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <input className="input" required placeholder="Nome do item *" value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} />
                    <select className="select" value={editingItem.category} onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input className="input" placeholder="Marca" value={editingItem.brand} onChange={(e) => setEditingItem({ ...editingItem, brand: e.target.value })} />
                    <input className="input" placeholder="Modelo" value={editingItem.model} onChange={(e) => setEditingItem({ ...editingItem, model: e.target.value })} />
                    <input className="input" placeholder="Nº Série" value={editingItem.serial_number} onChange={(e) => setEditingItem({ ...editingItem, serial_number: e.target.value })} />
                    <input className="input" type="number" min="1" placeholder="Qtd" value={editingItem.quantity} onChange={(e) => setEditingItem({ ...editingItem, quantity: e.target.value })} />
                    <input className="input" type="number" min="0" step="0.01" placeholder="Preço unit." value={editingItem.unit_price} onChange={(e) => setEditingItem({ ...editingItem, unit_price: e.target.value })} />
                    <input className="input" placeholder="Observações" value={editingItem.notes} onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-700">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={editingItem.authorized} onChange={(e) => setEditingItem({ ...editingItem, authorized: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                      Autorizado
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={editingItem.installed} onChange={(e) => setEditingItem({ ...editingItem, installed: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                      Já instalado
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={editingItem.executed} onChange={(e) => setEditingItem({ ...editingItem, executed: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                      Já executado
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={editingItem.paid} onChange={(e) => setEditingItem({ ...editingItem, paid: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-emerald-600" />
                      Pago
                    </label>
                    <span className="text-gray-500">
                      Total: <strong className="text-gray-900">R$ {money((parseFloat(editingItem.unit_price) || 0) * (parseInt(editingItem.quantity, 10) || 0))}</strong>
                    </span>
                    <div className="ml-auto flex gap-2">
                      <button type="button" onClick={() => setEditingItem(null)} className="btn-outline px-3 py-1.5 text-xs">Cancelar</button>
                      <button type="submit" disabled={savingLine} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
                        {savingLine ? 'Salvando...' : 'Salvar item'}
                      </button>
                    </div>
                  </div>
                </form>
              );
            }
            return (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium ${struck ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {[CATEGORY_LABELS[item.category], item.brand, item.model, item.serial_number ? `SN ${item.serial_number}` : '']
                          .filter(Boolean)
                          .join(' · ') || '—'}
                        {item.item_id ? (
                          <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">vinculado ao cadastro</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {item.quantity}x · <span className="font-medium">R$ {money(Number(item.unit_price) * Number(item.quantity))}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id, 'authorized')}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.authorized === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {item.authorized === 1 ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                      {item.authorized === 1 ? 'Autorizado' : 'Não autorizado'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id, 'installed')}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.installed === 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}
                    >
                      {item.installed === 1 ? 'Já instalado' : 'Não instalado'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id, 'executed')}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.executed === 1 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}
                    >
                      {item.executed === 1 ? 'Já executado' : 'Não executado'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id, 'paid')}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.paid === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}
                      title="Valor já pago — sai do orçamento"
                    >
                      {item.paid === 1 ? <BadgeCheck size={12} /> : null}
                      {item.paid === 1 ? 'Pago' : 'Não pago'}
                    </button>
                    <button type="button" onClick={() => startEditItem(item)} className="p-1.5 text-gray-400 hover:text-brand-600" title="Editar item">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => removeItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-600" title="Remover item">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showItemForm && (
          <form onSubmit={addItem} className="space-y-3 border-t border-gray-200 bg-white p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Do cadastro de equipamentos do cliente</label>
              <select
                className="select w-full"
                value={newItem.item_id || ''}
                onChange={(e) => applyCatalogItem(e.target.value, 'new')}
              >
                <option value="">Item manual (sem vínculo)</option>
                {catalogItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} — {CATEGORY_LABELS[it.category] || it.category}{it.serial_number ? ` (${it.serial_number})` : ''}
                  </option>
                ))}
              </select>
              {catalogItems.length === 0 && (
                <p className="mt-1 text-[11px] text-gray-400">Nenhum equipamento cadastrado para este cliente.</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <input className="input" required placeholder="Nome do item *" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              <select className="select" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className="input" placeholder="Marca" value={newItem.brand} onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })} />
              <input className="input" placeholder="Modelo" value={newItem.model} onChange={(e) => setNewItem({ ...newItem, model: e.target.value })} />
              <input className="input" placeholder="Nº Série" value={newItem.serial_number} onChange={(e) => setNewItem({ ...newItem, serial_number: e.target.value })} />
              <input className="input" type="number" min="1" placeholder="Qtd" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} />
              <input className="input" type="number" step="0.01" placeholder="Preço unit." value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} />
              <button type="submit" className="btn-primary py-2 text-sm">Adicionar</button>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newItem.authorized} onChange={(e) => setNewItem({ ...newItem, authorized: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                Autorizado
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newItem.installed} onChange={(e) => setNewItem({ ...newItem, installed: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                Já instalado
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newItem.executed} onChange={(e) => setNewItem({ ...newItem, executed: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                Já executado
              </label>
            </div>
          </form>
        )}
      </section>

      {/* Serviços */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            <Wrench size={18} className="text-blue-600" /> Serviços
            <span className="text-xs font-normal text-gray-500">({order.services?.length || 0})</span>
          </h3>
          <button type="button" onClick={() => setShowServiceForm((v) => !v)} className="btn-outline px-2 py-1.5 text-xs">
            <Plus size={14} /> Adicionar serviço
          </button>
        </div>

        <div className="space-y-2 p-4">
          {order.services?.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">Nenhum serviço adicionado</p>
          )}
          {order.services?.map((sv) => {
            const struck = isServiceStruck(sv);
            if (editingService?.id === sv.id) {
              return (
                <form
                  key={sv.id}
                  onSubmit={saveService}
                  className="space-y-3 rounded-xl border border-brand-300 bg-white p-3"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Serviço cadastrado (vínculo)</label>
                    <select
                      className="select w-full"
                      value={editingService.service_id || ''}
                      onChange={(e) => applyCatalogService(e.target.value, 'edit')}
                    >
                      <option value="">Sem vínculo com o cadastro</option>
                      {catalogServices.filter((sv) => sv.active === 1).map((sv) => (
                        <option key={sv.id} value={sv.id}>
                          {sv.name} — R$ {money(sv.price)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <input className="input" required placeholder="Nome do serviço *" value={editingService.name} onChange={(e) => setEditingService({ ...editingService, name: e.target.value })} />
                    <select className="select" value={editingService.category} onChange={(e) => setEditingService({ ...editingService, category: e.target.value })}>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input className="input" type="number" min="1" placeholder="Qtd" value={editingService.quantity} onChange={(e) => setEditingService({ ...editingService, quantity: e.target.value })} />
                    <input className="input" type="number" min="0" step="0.01" placeholder="Preço unit." value={editingService.unit_price} onChange={(e) => setEditingService({ ...editingService, unit_price: e.target.value })} />
                    <input className="input sm:col-span-2" placeholder="Descrição" value={editingService.description} onChange={(e) => setEditingService({ ...editingService, description: e.target.value })} />
                    <input className="input sm:col-span-2" placeholder="Observações" value={editingService.notes} onChange={(e) => setEditingService({ ...editingService, notes: e.target.value })} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-700">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={editingService.authorized} onChange={(e) => setEditingService({ ...editingService, authorized: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                      Autorizado
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={editingService.executed} onChange={(e) => setEditingService({ ...editingService, executed: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                      Já executado
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={editingService.paid} onChange={(e) => setEditingService({ ...editingService, paid: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-emerald-600" />
                      Pago
                    </label>
                    <span className="text-gray-500">
                      Total: <strong className="text-gray-900">R$ {money((parseFloat(editingService.unit_price) || 0) * (parseInt(editingService.quantity, 10) || 0))}</strong>
                    </span>
                    <div className="ml-auto flex gap-2">
                      <button type="button" onClick={() => setEditingService(null)} className="btn-outline px-3 py-1.5 text-xs">Cancelar</button>
                      <button type="submit" disabled={savingLine} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
                        {savingLine ? 'Salvando...' : 'Salvar serviço'}
                      </button>
                    </div>
                  </div>
                </form>
              );
            }
            return (
              <div key={sv.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500">
                      <Wallet size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium ${struck ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{sv.name}</p>
                      <p className="text-xs text-gray-500">
                        {[CATEGORY_LABELS[sv.category], sv.description].filter(Boolean).join(' · ') || '—'}
                        {sv.service_id ? (
                          <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">vinculado ao cadastro</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {sv.quantity}x · <span className="font-medium">R$ {money(Number(sv.unit_price) * Number(sv.quantity))}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleService(sv.id, 'authorized')}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${sv.authorized === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {sv.authorized === 1 ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                      {sv.authorized === 1 ? 'Autorizado' : 'Não autorizado'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleService(sv.id, 'executed')}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${sv.executed === 1 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}
                    >
                      {sv.executed === 1 ? 'Já executado' : 'Não executado'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleService(sv.id, 'paid')}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${sv.paid === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}
                      title="Valor já pago — sai do orçamento"
                    >
                      {sv.paid === 1 ? <BadgeCheck size={12} /> : null}
                      {sv.paid === 1 ? 'Pago' : 'Não pago'}
                    </button>
                    <button type="button" onClick={() => startEditService(sv)} className="p-1.5 text-gray-400 hover:text-brand-600" title="Editar serviço">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => removeService(sv.id)} className="p-1.5 text-gray-400 hover:text-red-600" title="Remover serviço">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showServiceForm && (
          <form onSubmit={addService} className="space-y-3 border-t border-gray-200 bg-white p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Do catálogo de serviços</label>
              <select
                className="select w-full"
                value={newService.service_id || ''}
                onChange={(e) => applyCatalogService(e.target.value, 'new')}
              >
                <option value="">Serviço manual (sem vínculo)</option>
                {catalogServices.filter((sv) => sv.active === 1).map((sv) => (
                  <option key={sv.id} value={sv.id}>
                    {sv.name} — R$ {money(sv.price)}
                  </option>
                ))}
              </select>
              {catalogServices.length === 0 && (
                <p className="mt-1 text-[11px] text-gray-400">Nenhum serviço cadastrado.</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <input className="input" required placeholder="Nome do serviço *" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
              <select className="select" value={newService.category} onChange={(e) => setNewService({ ...newService, category: e.target.value })}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className="input" type="number" min="1" placeholder="Qtd" value={newService.quantity} onChange={(e) => setNewService({ ...newService, quantity: e.target.value })} />
              <input className="input" type="number" step="0.01" placeholder="Preço unit." value={newService.unit_price} onChange={(e) => setNewService({ ...newService, unit_price: e.target.value })} />
              <input className="input md:col-span-3" placeholder="Descrição" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} />
              <button type="submit" className="btn-primary py-2 text-sm">Adicionar</button>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newService.authorized} onChange={(e) => setNewService({ ...newService, authorized: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                Autorizado
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newService.executed} onChange={(e) => setNewService({ ...newService, executed: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                Já executado
              </label>
            </div>
          </form>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mídia */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900">
              <ImageIcon size={18} className="text-purple-600" /> Acompanhamento
              <span className="text-xs font-normal text-gray-500">({order.media?.length || 0})</span>
            </h3>
          </div>
          <div className="p-4">
            <label className="mb-2 block text-xs font-medium text-gray-700">Enviar fotos ou vídeos do serviço</label>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={uploadMedia}
              className="block w-full cursor-pointer text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
            />
            {order.media?.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {order.media.map((m) => (
                  <div key={m.id} className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                    {m.type === 'video' ? (
                      <video className="h-full w-full object-cover" muted playsInline controls>
                        <source src={m.file_path} />
                      </video>
                    ) : (
                      <a href={m.file_path} target="_blank" rel="noopener noreferrer">
                        <img src={m.file_path} alt={m.caption || 'Foto da OS'} className="h-full w-full object-cover" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteMedia(m.id)}
                      className="absolute right-1.5 top-1.5 rounded bg-red-600/90 p-1 text-white hover:bg-red-600"
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {m.type === 'video' ? 'VÍDEO' : 'FOTO'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 py-6 text-center text-sm text-gray-400">
                Nenhuma mídia enviada ainda.<br />Acompanhe o serviço por fotos e vídeos.
              </p>
            )}
          </div>
        </section>

        {/* WhatsApp */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900">
              <Bot size={18} className="text-green-600" /> WhatsApp do cliente
            </h3>
            <a
              href={`https://wa.me/${String(order.customer_whatsapp || order.customer_phone || '').replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-green-600 hover:text-green-700"
            >
              Abrir conversa
            </a>
          </div>
          <div className="p-4">
            <textarea
              className="input min-h-[100px]"
              placeholder="Digite a mensagem: andamento, autorização de peças, conclusão..."
              value={whatsappMsg}
              onChange={(e) => setWhatsappMsg(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'Olá! Seu atendimento foi aberto. Em breve enviaremos novidades.',
                'Precisamos de autorização para seguir com o serviço.',
                'Serviço concluído! Obrigado pela confiança.',
              ].map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setWhatsappMsg(tpl)}
                  className="rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-600 hover:bg-gray-200"
                >
                  {tpl.split(' ').slice(0, 3).join(' ')}...
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={sendWhatsApp}
              disabled={sending}
              className="btn-success mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-50 sm:w-auto"
            >
              <Send size={18} /> {sending ? 'Abrindo...' : 'Enviar pelo WhatsApp'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
