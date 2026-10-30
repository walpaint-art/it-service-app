import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, HardHat, Plus, Wrench, Trash2, Ban, CheckCircle2, PackagePlus,
} from 'lucide-react';
import { ordersAPI, customersAPI, itemsAPI, servicesAPI } from '../services/api';
import { computeOrderTotals } from '../lib/orderTotals';
import { toast } from 'react-hot-toast';

const CATEGORY_LABELS = {
  rede: 'Rede',
  servidor: 'Servidor',
  computador: 'Computador',
  camera_ip: 'Câmera IP',
  nvr: 'NVR',
  sistema: 'Sistema',
  outro: 'Outro',
};

const money = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EMPTY_ITEM = {
  name: '', category: 'computador', brand: '', model: '', serial_number: '',
  quantity: '1', unit_price: '0', authorized: 1, installed: 0, executed: 0, notes: '',
};

const EMPTY_SERVICE = {
  name: '', category: 'computador', description: '', quantity: '1', unit_price: '0',
  authorized: 1, executed: 0, notes: '',
};

export default function OrdemNova() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [itemsCat, setItemsCat] = useState([]);
  const [servicesCat, setServicesCat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [problemReport, setProblemReport] = useState('');
  const [priority, setPriority] = useState('media');
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [newService, setNewService] = useState(EMPTY_SERVICE);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);

  useEffect(() => {
    Promise.all([customersAPI.list(), itemsAPI.list(), servicesAPI.list()])
      .then(([cRes, iRes, sRes]) => {
        setCustomers(cRes.data);
        setItemsCat(iRes.data);
        setServicesCat(sRes.data);
      })
      .catch(() => toast.error('Erro ao carregar dados iniciais'));
  }, []);

  const customerItems = useMemo(
    () => itemsCat.filter((it) => String(it.customer_id) === String(selectedCustomer?.id)),
    [itemsCat, selectedCustomer]
  );

  const addCatalogItem = (itemId) => {
    const found = itemsCat.find((it) => String(it.id) === String(itemId));
    if (!found) return;
    setItems((prev) => [
      ...prev,
      {
        item_id: found.id,
        name: found.name,
        category: found.category,
        brand: found.brand || '',
        model: found.model || '',
        serial_number: found.serial_number || '',
        quantity: 1,
        unit_price: 0,
        authorized: 1,
        installed: 0,
        executed: 0,
        notes: '',
      },
    ]);
  };

  const addCatalogService = (serviceId) => {
    const found = servicesCat.find((sv) => String(sv.id) === String(serviceId));
    if (!found) return;
    setServices((prev) => [
      ...prev,
      {
        service_id: found.id,
        name: found.name,
        category: found.category,
        description: found.description || '',
        quantity: 1,
        unit_price: found.price || 0,
        authorized: 1,
        executed: 0,
        notes: '',
      },
    ]);
  };

  const addItem = () => {
    if (!newItem.name.trim()) {
      toast.error('Informe o nome do item');
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        ...newItem,
        quantity: parseInt(newItem.quantity, 10) || 1,
        unit_price: parseFloat(newItem.unit_price) || 0,
      },
    ]);
    setNewItem(EMPTY_ITEM);
    setShowItemForm(false);
  };

  const addService = () => {
    if (!newService.name.trim()) {
      toast.error('Informe o nome do serviço');
      return;
    }
    setServices((prev) => [
      ...prev,
      {
        ...newService,
        quantity: parseInt(newService.quantity, 10) || 1,
        unit_price: parseFloat(newService.unit_price) || 0,
      },
    ]);
    setNewService(EMPTY_SERVICE);
    setShowServiceForm(false);
  };

  const toggle = (list, setList, idx, field) => {
    setList(list.map((entry, i) => (i === idx ? { ...entry, [field]: entry[field] === 1 ? 0 : 1 } : entry)));
  };

  const updateItem = (idx, patch) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));

  const updateService = (idx, patch) =>
    setServices((prev) => prev.map((sv, i) => (i === idx ? { ...sv, ...patch } : sv)));

  const totalsPreview = computeOrderTotals({ items, services, discount: 0 });
  const total = totalsPreview.total;

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      toast.error('Selecione o cliente');
      return;
    }
    setLoading(true);
    try {
      await ordersAPI.create({
        customer_id: selectedCustomer.id,
        title,
        description,
        problem_report: problemReport,
        status: 'orcamento',
        priority,
        items: items.map((item) => ({
          ...item,
          quantity: Math.max(parseInt(item.quantity, 10) || 1, 1),
          unit_price: Math.max(parseFloat(item.unit_price) || 0, 0),
        })),
        services: services.map((sv) => ({
          ...sv,
          quantity: Math.max(parseInt(sv.quantity, 10) || 1, 1),
          unit_price: Math.max(parseFloat(sv.unit_price) || 0, 0),
        })),
      });
      toast.success('OS criada com sucesso!');
      navigate('/ordens');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar OS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/ordens')} className="p-2 text-gray-500 hover:text-gray-700" aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Ordem de Serviço</h1>
          <p className="text-sm text-gray-500">Abra o atendimento, registre o relato e monte o orçamento</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase text-gray-500">Cliente *</label>
            <select
              className="select w-full"
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const sel = customers.find((c) => String(c.id) === e.target.value);
                setSelectedCustomer(sel || null);
              }}
            >
              <option value="">Selecionar cliente</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
              ))}
            </select>
            {selectedCustomer && (
              <div className="space-y-1 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                <div className="font-medium">{selectedCustomer.name}</div>
                <div>{selectedCustomer.phone}</div>
                {selectedCustomer.whatsapp && (
                  <div className="flex items-center gap-1 text-green-600">
                    <span className="h-3 w-3 rounded-full bg-green-500"></span> WhatsApp disponível
                  </div>
                )}
                <div className="text-blue-600">{customerItems.length} equipamento(s) cadastrado(s)</div>
              </div>
            )}
          </div>

          <div className="space-y-3 lg:col-span-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Título da OS *</label>
              <input
                className="input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Manutenção de servidor e rede"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Relato do problema (WhatsApp)</label>
              <textarea
                className="textarea"
                value={problemReport}
                onChange={(e) => setProblemReport(e.target.value)}
                placeholder="Cliente relatou pane na rede, câmeras offline..."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Prioridade</label>
                <select className="select w-full" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Descrição interna</label>
                <input
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Observações para o técnico"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Itens */}
        <div className="rounded-xl border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900">
              <HardHat size={18} className="text-brand-600" /> Itens / Equipamentos
            </h3>
            <button
              type="button"
              onClick={() => setShowItemForm((v) => !v)}
              className="btn-outline px-2 py-1.5 text-xs"
            >
              <Plus size={14} /> Item manual
            </button>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Adicionar equipamento do cadastro do cliente
              </label>
              <select
                className="select w-full"
                value=""
                disabled={!selectedCustomer || customerItems.length === 0}
                onChange={(e) => addCatalogItem(e.target.value)}
              >
                <option value="">
                  {!selectedCustomer
                    ? 'Selecione um cliente primeiro'
                    : customerItems.length === 0
                      ? 'Nenhum equipamento cadastrado para este cliente'
                      : 'Selecione um equipamento...'}
                </option>
                {customerItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} — {CATEGORY_LABELS[it.category] || it.category}{it.serial_number ? ` (${it.serial_number})` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-400">
                O equipamento vem do cadastro do cliente; informe quantidade e valor na linha adicionada.
              </p>
            </div>

            {showItemForm && (
              <div className="space-y-3 rounded-lg border border-dashed border-gray-300 p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <input className="input" placeholder="Nome *" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
                  <select className="select" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input className="input" placeholder="Marca" value={newItem.brand} onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })} />
                  <input className="input" placeholder="Modelo" value={newItem.model} onChange={(e) => setNewItem({ ...newItem, model: e.target.value })} />
                  <input className="input" placeholder="Nº Série" value={newItem.serial_number} onChange={(e) => setNewItem({ ...newItem, serial_number: e.target.value })} />
                  <input className="input" type="number" min="1" placeholder="Qtd" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} />
                  <input className="input" type="number" step="0.01" placeholder="Preço unit." value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} />
                  <button type="button" onClick={addItem} className="btn-primary py-2 text-xs">
                    <PackagePlus size={16} /> Adicionar
                  </button>
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <p className="py-3 text-center text-xs text-gray-400">Nenhum item adicionado</p>
            ) : (
              <ul className="space-y-2">
                {items.map((item, idx) => {
                  const struck = item.authorized === 0 || item.installed === 1 || item.executed === 1;
                  return (
                    <li key={`${item.item_id || 'm'}-${idx}`} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${struck ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {CATEGORY_LABELS[item.category] || item.category}
                            {item.brand ? ` · ${item.brand}` : ''}
                            {item.model ? ` · ${item.model}` : ''}
                            {item.serial_number ? ` · ${item.serial_number}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-center text-xs text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            title="Quantidade"
                          />
                          <span className="text-gray-400">×</span>
                          <span className="flex items-center gap-1">
                            <span className="text-gray-400">R$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateItem(idx, { unit_price: e.target.value })}
                              className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-xs text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                              title="Preço unitário"
                            />
                          </span>
                          <span className="font-medium text-gray-900">= R$ {money(Number(item.unit_price) * Number(item.quantity))}</span>
                          <button
                            type="button"
                            onClick={() => setItems(items.filter((_, i) => i !== idx))}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Remover"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggle(items, setItems, idx, 'authorized')}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.authorized === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {item.authorized === 1 ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                          {item.authorized === 1 ? 'Autorizado' : 'Não autorizado'}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggle(items, setItems, idx, 'installed')}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.installed === 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.installed === 1 ? 'Instalado' : 'Não instalado'}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggle(items, setItems, idx, 'executed')}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.executed === 1 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.executed === 1 ? 'Executado' : 'Não executado'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Serviços */}
        <div className="rounded-xl border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900">
              <Wrench size={18} className="text-blue-600" /> Serviços
            </h3>
            <button
              type="button"
              onClick={() => setShowServiceForm((v) => !v)}
              className="btn-outline px-2 py-1.5 text-xs"
            >
              <Plus size={14} /> Serviço manual
            </button>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Adicionar do catálogo de serviços</label>
              <select className="select w-full" value="" onChange={(e) => addCatalogService(e.target.value)}>
                <option value="">Selecione um serviço...</option>
                {servicesCat.filter((sv) => sv.active === 1).map((sv) => (
                  <option key={sv.id} value={sv.id}>
                    {sv.name} — R$ {money(sv.price)}
                  </option>
                ))}
              </select>
            </div>

            {showServiceForm && (
              <div className="space-y-3 rounded-lg border border-dashed border-gray-300 p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <input className="input" placeholder="Nome do serviço *" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
                  <select className="select" value={newService.category} onChange={(e) => setNewService({ ...newService, category: e.target.value })}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input className="input" type="number" min="1" placeholder="Qtd" value={newService.quantity} onChange={(e) => setNewService({ ...newService, quantity: e.target.value })} />
                  <input className="input" type="number" step="0.01" placeholder="Preço unit." value={newService.unit_price} onChange={(e) => setNewService({ ...newService, unit_price: e.target.value })} />
                  <input className="input md:col-span-3" placeholder="Descrição" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} />
                  <button type="button" onClick={addService} className="btn-primary py-2 text-xs">
                    <PackagePlus size={16} /> Adicionar
                  </button>
                </div>
              </div>
            )}

            {services.length === 0 ? (
              <p className="py-3 text-center text-xs text-gray-400">Nenhum serviço adicionado</p>
            ) : (
              <ul className="space-y-2">
                {services.map((sv, idx) => {
                  const struck = sv.authorized === 0 || sv.executed === 1;
                  return (
                    <li key={`${sv.service_id || 'm'}-${idx}`} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${struck ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{sv.name}</p>
                          <p className="text-xs text-gray-500">
                            {CATEGORY_LABELS[sv.category] || sv.category}
                            {sv.description ? ` · ${sv.description}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <input
                            type="number"
                            min="1"
                            value={sv.quantity}
                            onChange={(e) => updateService(idx, { quantity: e.target.value })}
                            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-center text-xs text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            title="Quantidade"
                          />
                          <span className="text-gray-400">×</span>
                          <span className="flex items-center gap-1">
                            <span className="text-gray-400">R$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={sv.unit_price}
                              onChange={(e) => updateService(idx, { unit_price: e.target.value })}
                              className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-xs text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                              title="Preço unitário"
                            />
                          </span>
                          <span className="font-medium text-gray-900">= R$ {money(Number(sv.unit_price) * Number(sv.quantity))}</span>
                          <button
                            type="button"
                            onClick={() => setServices(services.filter((_, i) => i !== idx))}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Remover"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggle(services, setServices, idx, 'authorized')}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            sv.authorized === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {sv.authorized === 1 ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                          {sv.authorized === 1 ? 'Autorizado' : 'Não autorizado'}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggle(services, setServices, idx, 'executed')}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            sv.executed === 1 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {sv.executed === 1 ? 'Executado' : 'Não executado'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-gray-500">Valor total estimado</div>
            <div className="text-lg font-bold text-gray-900">R$ {money(total)}</div>
          </div>
          <button
            type="submit"
            disabled={loading || !selectedCustomer || !title}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              <><HardHat size={20} /> Criar OS</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
