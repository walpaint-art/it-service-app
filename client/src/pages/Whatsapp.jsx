import { useEffect, useState } from 'react';
import { Send, Phone, CheckCircle2, Bot, FileText, Smartphone, MessageCircle } from 'lucide-react';
import { whatsappAPI, customersAPI, ordersAPI } from '../services/api';
import { toast } from 'react-hot-toast';

const QUICK_MESSAGES = [
  { label: 'Andamento da OS', text: 'Olá! Segue o andamento da sua ordem de serviço.' },
  { label: 'OS concluída', text: 'Olá! Seu atendimento foi concluído. Obrigado pela confiança.' },
  { label: 'Solicitar autorização', text: 'Olá! Precisamos de autorização para seguir com a próxima etapa do serviço. Pode confirmar?' },
  { label: 'Visita agendada', text: 'Olá! Sua visita técnica está agendada. Em breve o técnico chegará ao local.' },
];

export default function Whatsapp() {
  const [messages, setMessages] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [newMsg, setNewMsg] = useState({ order_id: '', customer_id: '', phone: '', message: '' });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([customersAPI.list(), ordersAPI.list()])
      .then(([cRes, oRes]) => {
        setCustomers(cRes.data);
        setOrders(oRes.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadMessages();
  }, [orderFilter, customerFilter]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await whatsappAPI.list({
        order_id: orderFilter || undefined,
        customer_id: customerFilter || undefined,
      });
      setMessages(res.data);
    } catch (err) {
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoading(false);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!newMsg.message.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }
    if (!newMsg.customer_id && !newMsg.phone) {
      toast.error('Informe o cliente ou telefone');
      return;
    }
    setSending(true);
    try {
      const res = await whatsappAPI.send({
        order_id: newMsg.order_id || null,
        customer_id: newMsg.customer_id || null,
        phone: newMsg.phone || undefined,
        message: newMsg.message,
      });
      setNewMsg({ order_id: '', customer_id: '', phone: '', message: '' });
      loadMessages();
      if (res.data.wa_link) window.open(res.data.wa_link, '_blank', 'noopener');
      toast.success('Abrindo WhatsApp com a mensagem');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
        <p className="text-sm text-gray-500">
          Envie mensagens de andamento e acompanhe o contato com cada cliente
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Enviar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Enviar mensagem</h3>
            <form onSubmit={send} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Cliente</label>
                <select
                  className="select w-full"
                  value={newMsg.customer_id}
                  onChange={(e) => setNewMsg({ ...newMsg, customer_id: e.target.value, phone: '' })}
                >
                  <option value="">Selecionar cliente</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.whatsapp ? '' : ' (sem WhatsApp)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Telefone (opcional)</label>
                <input
                  className="input"
                  placeholder="+55 11 99999-9999"
                  value={newMsg.phone}
                  onChange={(e) => setNewMsg({ ...newMsg, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Ordem de Serviço (opcional)</label>
                <select
                  className="select w-full"
                  value={newMsg.order_id}
                  onChange={(e) => setNewMsg({ ...newMsg, order_id: e.target.value })}
                >
                  <option value="">Vincular a uma OS</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.customer_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Mensagem</label>
                <textarea
                  className="textarea"
                  value={newMsg.message}
                  onChange={(e) => setNewMsg({ ...newMsg, message: e.target.value })}
                  placeholder="Olá! Segue o andamento do seu atendimento..."
                />
              </div>
              <button type="submit" disabled={sending} className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50">
                <Send size={18} /> {sending ? 'Abrindo...' : 'Enviar WhatsApp'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Mensagens rápidas</h3>
            <div className="space-y-2">
              {QUICK_MESSAGES.map((q, i) => {
                const Icon = [FileText, CheckCircle2, Bot, MessageCircle][i] || FileText;
                return (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => setNewMsg({ ...newMsg, message: q.text })}
                    className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Icon size={16} className="shrink-0 text-gray-400" /> {q.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Histórico */}
        <div className="flex h-[600px] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900">
              <Smartphone size={18} className="text-green-600" /> Histórico de mensagens
            </h3>
            <div className="flex flex-wrap gap-2">
              <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} className="select w-40 py-2 text-xs">
                <option value="">Todas as OS</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.order_number}</option>
                ))}
              </select>
              <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="select w-40 py-2 text-xs">
                <option value="">Todos os clientes</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {loading ? (
              <div className="py-10 text-center text-gray-400">Carregando...</div>
            ) : messages.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <Phone size={32} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhuma mensagem enviada ainda.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl border p-4 ${
                    m.direction === 'outbound' ? 'border-blue-100 bg-blue-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">
                      {m.direction === 'outbound' ? 'Enviada' : 'Recebida'}
                      {m.customer_name ? ` · ${m.customer_name}` : ''}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(m.sent_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-gray-800">{m.message}</div>
                  <div className="mt-2 text-xs font-semibold text-gray-400">
                    {m.status === 'read' ? 'Lida' : m.status === 'delivered' ? 'Entregue' : 'Registrada'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
