import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { whatsappAPI } from '../services/api';
import { CheckCircle2, Clock, Phone, Video, Image, AlertCircle, HardHat } from 'lucide-react';

const STATUS_LABELS = {
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  em_andamento: 'Em Andamento',
  aguardando_pecas: 'Aguardando Peças',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const STATUS_BADGE_CLASS = {
  concluido: 'bg-green-100 text-green-800 border-green-200',
  em_andamento: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  aprovado: 'bg-blue-100 text-blue-800 border-blue-200',
  orcamento: 'bg-orange-100 text-orange-800 border-orange-200',
  aguardando_pecas: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
};

export default function Rastreamento() {
  const { orderNumber } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    whatsappAPI.tracking(orderNumber).then((res) => {
      setData(res.data);
    }).catch(() => {
      setLoading(false);
    }).finally(() => setLoading(false));
  }, [orderNumber]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando rastreamento...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold text-gray-900">OS não encontrada</h2>
          <p className="text-gray-500">Não foi possível localizar a ordem de serviço informada.</p>
        </div>
      </div>
    );
  }

  const { order, items = [], services = [], media = [], company = {} } = data;
  const totalItems = items.reduce((s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 1), 0);
  const totalServices = services.reduce((s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 1), 0);
  const companyName = company.name || 'Assistência Técnica TI';
  const contactPhone = String(company.whatsapp || '');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            {company.logo ? (
              <img src={company.logo} alt={companyName} className="h-10 w-10 rounded-lg border border-gray-100 bg-white object-contain" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
                <HardHat size={22} />
              </div>
            )}
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">{companyName}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Acompanhamento da OS</h1>
          <p className="text-gray-500 text-sm">Ordem de Serviço #{order.order_number.split('-').pop()}</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-6">
        {/* Status */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className={`badge border ${STATUS_BADGE_CLASS[order.status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Data de abertura</div>
              <div className="text-sm font-medium text-gray-900">{new Date(order.created_at).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>
          <div className="text-gray-700">{order.title}</div>
          {order.problem_report && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} className="text-amber-600" />
                <span className="text-xs font-semibold text-amber-800 uppercase">Relato do cliente:</span>
              </div>
              <div className="text-sm text-gray-700">{order.problem_report}</div>
            </div>
          )}
        </div>

        {/* Itens e Serviços */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <HardHat size={20} className="text-brand-600" /> Itens / Equipamentos
            </h3>
            {items?.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">Nenhum item cadastrado</p>
            ) : (
              <div className="space-y-3">
                {items.map((i) => {
                  const struck = i.authorized === 0 || i.installed === 1 || i.executed === 1;
                  return (
                  <div key={i.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {i.authorized === 0 && <span className="text-[10px] font-bold text-red-600 border border-red-200 px-2 py-0.5 rounded">Não autorizado</span>}
                      {i.installed === 1 && <span className="text-[10px] font-bold text-green-600 border border-green-200 px-2 py-0.5 rounded">Já instalado</span>}
                      {i.executed === 1 && <span className="text-[10px] font-bold text-blue-600 border border-blue-200 px-2 py-0.5 rounded">Já executado</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${struck ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{i.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{i.serial_number ? `SN: ${i.serial_number} · ` : ''}{i.quantity}x</div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Phone size={20} className="text-blue-600" /> Serviços
            </h3>
            {services?.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">Nenhum serviço cadastrado</p>
            ) : (
              <div className="space-y-3">
                {services.map((s) => {
                  const struck = s.authorized === 0 || s.executed === 1;
                  return (
                  <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {s.authorized === 0 && <span className="text-[10px] font-bold text-red-600 border border-red-200 px-2 py-0.5 rounded">Não autorizado</span>}
                      {s.executed === 1 && <span className="text-[10px] font-bold text-blue-600 border border-blue-200 px-2 py-0.5 rounded">Já executado</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${struck ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{s.name}</div>
                      {s.description && <div className="text-xs text-gray-500 mt-1">{s.description}</div>}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Fotos e vídeos */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Image size={20} className="text-purple-600" /> Fotos e Vídeos do Andamento
          </h3>
          {media?.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Video size={32} className="mx-auto mb-3 opacity-50" />
              <p>Nenhuma mídia enviada ainda. O técnico compartilhará fotos e vídeos aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {media.map((m) => {
                const isVideo = m.type === 'video';
                return (
                  <div key={m.id} className="relative rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-100">
                    {isVideo ? (
                      <video className="w-full h-full object-cover" controls playsInline preload="metadata">
                        <source src={m.file_path} />
                      </video>
                    ) : (
                      <a href={m.file_path} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                        <img src={m.file_path} alt={m.caption || 'Foto do andamento'} className="w-full h-full object-cover" />
                      </a>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      {isVideo ? 'VÍDEO' : 'FOTO'}
                    </div>
                    <div className="absolute top-2 right-2 bg-black/40 text-white text-xs px-2 py-1 rounded">
                      {new Date(m.uploaded_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Contato */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Phone size={20} className="text-green-600" /> Fale com o Técnico
          </h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <Phone size={24} />
            </div>
            <div>
              <div className="font-medium text-gray-900">{companyName}</div>
              {contactPhone ? (
                <a
                  href={`https://wa.me/${contactPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 font-medium hover:underline"
                >
                  {contactPhone}
                </a>
              ) : (
                <span className="text-sm text-gray-500">Responda pelo WhatsApp em que você recebeu este link.</span>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {contactPhone ? 'Clique para abrir no WhatsApp' : 'Atendimento personalizado'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
