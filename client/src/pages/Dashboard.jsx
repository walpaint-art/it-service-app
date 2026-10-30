import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Users, HardHat, Video, TrendingUp, Clock, CreditCard, AlertCircle, CheckCircle2, Plus, Printer, Wallet, PiggyBank } from 'lucide-react';
import { ordersAPI } from '../services/api';
import { toast } from 'react-hot-toast';

const money = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statCards = [
  { title: 'Total de OS', icon: HardHat, color: 'text-brand-600', bg: 'bg-brand-50', value: (s) => s.totalOrders },
  { title: 'Pendentes', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', value: (s) => s.pendentes },
  { title: 'Em Andamento', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', value: (s) => s.byStatus.find((x) => x.status === 'em_andamento')?.c || 0 },
  { title: 'Receita', icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50', money: true, value: (s) => s.totalValue },
  { title: 'Custos + Despesas', icon: Wallet, color: 'text-red-600', bg: 'bg-red-50', money: true, value: (s) => Number(s.totalCost || 0) + Number(s.totalExpense || 0) },
  { title: 'Lucro', icon: PiggyBank, color: 'text-emerald-600', bg: 'bg-emerald-50', money: true, value: (s) => s.totalProfit },
];

export default function Dashboard() {
  const [stats, setStats] = useState({ totalOrders: 0, byStatus: [], byPriority: [], totalValue: 0, totalCost: 0, totalExpense: 0, totalProfit: 0, pendentes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersAPI.stats().then((res) => {
      setStats(res.data);
    }).catch(() => {
      toast.error('Erro ao carregar estatísticas');
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">Visão geral das ordens de serviço e atendimentos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="btn-outline flex items-center justify-center gap-2">
            <Printer size={18} /> Exportar PDF
          </button>
          <Link to="/ordens/nova" className="btn-primary flex items-center justify-center gap-2">
            <Plus size={18} /> Nova OS
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => {
          const raw = card.value(stats);
          const value = loading ? '—' : `${card.money ? 'R$ ' : ''}${card.money ? money(raw) : raw}`;
          const isProfit = card.title === 'Lucro';
          const negative = isProfit && !loading && Number(raw) < 0;
          return (
            <div key={card.title} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className={`w-10 h-10 shrink-0 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <card.icon size={20} className={card.color} />
                </div>
                <span className="text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">{card.title}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${isProfit ? (negative ? 'text-red-600' : 'text-emerald-600') : 'text-gray-900'}`}>{value}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ordens por status */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock size={20} className="text-brand-600" /> Ordens por Status
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Orçamento', key: 'orcamento', color: 'text-orange-600', bg: 'bg-orange-100' },
              { label: 'Aprovado', key: 'aprovado', color: 'text-blue-600', bg: 'bg-blue-100' },
              { label: 'Em Andamento', key: 'em_andamento', color: 'text-indigo-600', bg: 'bg-indigo-100' },
              { label: 'Aguardando Peças', key: 'aguardando_pecas', color: 'text-yellow-600', bg: 'bg-yellow-100' },
              { label: 'Concluído', key: 'concluido', color: 'text-green-600', bg: 'bg-green-100' },
              { label: 'Cancelado', key: 'cancelado', color: 'text-red-600', bg: 'bg-red-100' },
            ].map((s) => {
              const item = stats.byStatus.find(x => x.status === s.key) || { c: 0 };
              const percent = stats.totalOrders > 0 ? Math.round((item.c / stats.totalOrders) * 100) : 0;
              return (
                <div key={s.label} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.bg}`}></span>
                    <span className="text-sm font-medium text-gray-700">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${s.color}`}>{item.c}</span>
                    <span className="text-xs text-gray-400">{percent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prioridade e pagamentos */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm h-full">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-600" /> Atenção
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
              <div className="flex items-center gap-3">
                <CreditCard size={20} className="text-amber-600" />
                <span className="text-sm font-medium text-gray-700">Pagamentos pendentes</span>
              </div>
              <span className="text-lg font-bold text-amber-700">{stats.pendentes}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Receita total</span>
              </div>
              <span className="text-lg font-bold text-blue-700">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Últimas atualizações</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>OS-20261029-0001 concluída com sucesso</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
