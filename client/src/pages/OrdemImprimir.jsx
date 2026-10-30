import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { ordersAPI, brandingAPI } from '../services/api';
import { computeOrderTotals, isItemStruck, isServiceStruck } from '../lib/orderTotals';
import { toast } from 'react-hot-toast';

const STATUS_LABELS = {
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  em_andamento: 'Em andamento',
  aguardando_pecas: 'Aguardando peças',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const PAYMENT_LABELS = {
  pendente: 'Pendente',
  parcial: 'Parcial',
  pago: 'Pago',
};

const money = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

const formatDate = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleDateString('pt-BR') : '—';
};

const formatDateTime = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleString('pt-BR') : '—';
};

export default function OrdemImprimir() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [branding, setBranding] = useState({});
  const [loading, setLoading] = useState(true);
  const [includeCosts, setIncludeCosts] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([ordersAPI.get(id), brandingAPI.get()])
      .then(([orderRes, brandingRes]) => {
        if (!active) return;
        setOrder(orderRes.data);
        setBranding(brandingRes.data || {});
      })
      .catch(() => {
        toast.error('Erro ao carregar a OS para impressão');
        navigate('/ordens');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, navigate]);

  const totals = useMemo(() => {
    const base = computeOrderTotals(order);
    const cost = Number(order?.cost || 0);
    const expense = Number(order?.expense || 0);
    return {
      // Linhas já pagas, instaladas, executadas ou não autorizadas não entram no subtotal
      items: base.itemsGross - base.itemsDiscount,
      services: base.servicesGross - base.servicesDiscount,
      discount: base.discount,
      finalTotal: base.total,
      cost,
      expense,
      profit: base.total - cost - expense,
    };
  }, [order]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!order) return null;

  const isBudget = order.status === 'orcamento' || order.status === 'aprovado';
  const documentTitle = isBudget ? 'Orçamento' : 'Ordem de Serviço';
  const companyName = branding.company_name || branding.app_name || 'Assistência Técnica TI';
  const initials = companyName.slice(0, 2).toUpperCase();

  const clientLines = [
    order.customer_address,
    [order.customer_city, order.customer_state].filter(Boolean).join(' - '),
    order.customer_zip ? `CEP ${order.customer_zip}` : '',
  ].filter(Boolean);

  const renderItemRows = (rows, type) =>
    rows.map((row, index) => {
      const unauthorized = Number(row.authorized) === 0;
      const struck = type === 'item' ? isItemStruck(row) : isServiceStruck(row);
      const details = [row.brand, row.model, row.serial_number ? `SN ${row.serial_number}` : '']
        .filter(Boolean)
        .join(' · ');
      return (
        <tr key={`${type}-${row.id}`} className={struck ? 'doc-row-struck' : ''}>
          <td className="doc-center">{String(index + 1).padStart(3, '0')}</td>
          <td>
            <div className={struck ? 'doc-strike' : ''}>{row.name}</div>
            {details && <div className="doc-muted">{details}</div>}
            {row.description && <div className="doc-muted">{row.description}</div>}
            {unauthorized && <div className="doc-muted">Não autorizado pelo cliente</div>}
            {type === 'item' && Number(row.installed) === 1 && (
              <div className="doc-muted">Já instalado — não cobrado</div>
            )}
            {Number(row.executed) === 1 && <div className="doc-muted">Já executado — não cobrado</div>}
            {Number(row.paid) === 1 && <div className="doc-muted">Já pago — não cobrado</div>}
          </td>
          <td className="doc-center">{row.quantity}</td>
          <td className="doc-center">{type === 'item' ? 'UN' : 'SV'}</td>
          <td className="doc-num">R$ {money(row.unit_price)}</td>
          <td className={`doc-num ${struck ? 'doc-strike' : ''}`}>
            R$ {money(Number(row.unit_price || 0) * Number(row.quantity || 1))}
          </td>
        </tr>
      );
    });

  return (
    <div className="print-area space-y-4">
      {/* Barra de ações (não sai na impressão) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate(`/ordens/${order.id}`)}
          className="btn-outline flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Voltar para a OS
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeCosts}
              onChange={(e) => setIncludeCosts(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            Incluir custos internos
          </label>
          <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
            <Printer size={16} /> Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      <article className="doc">
        {/* Cabeçalho */}
        <header className="doc-header doc-section">
          <div className="doc-emitente">
            {branding.logo ? (
              <img src={branding.logo} alt={companyName} />
            ) : (
              <div className="doc-logo-fallback">{initials}</div>
            )}
            <div>
              <div className="doc-company-name">{companyName}</div>
              <div className="doc-company-line">
                {branding.company_cnpj ? `CNPJ: ${branding.company_cnpj}` : 'CNPJ não informado'}
              </div>
              {branding.address && <div className="doc-company-line">{branding.address}</div>}
              <div className="doc-company-line">
                {[branding.phone, branding.whatsapp && `WhatsApp ${branding.whatsapp}`, branding.email]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>
          <div className="doc-title-box">
            <div className="doc-title">{documentTitle}</div>
            <div className="doc-value">Nº {order.order_number}</div>
            <div className="doc-subtitle">Série 1 · Folha 1/1</div>
            <div className="doc-subtitle">Emitido em {formatDateTime(order.created_at)}</div>
          </div>
        </header>

        <div className="doc-meta doc-section">
          <div>
            <span className="doc-label">Status</span>
            <span className="doc-value">{STATUS_LABELS[order.status] || order.status}</span>
          </div>
          <div>
            <span className="doc-label">Pagamento</span>
            <span className="doc-value">{PAYMENT_LABELS[order.payment_status] || order.payment_status}</span>
          </div>
          <div>
            <span className="doc-label">Data de entrada</span>
            <span className="doc-value">{formatDate(order.created_at)}</span>
          </div>
          <div>
            <span className="doc-label">Previsão de entrega</span>
            <span className="doc-value">{formatDate(order.scheduled_date)}</span>
          </div>
        </div>

        {/* Destinatário */}
        <div className="doc-section">
          <div className="doc-section-title">Destinatário / Cliente</div>
          <div className="doc-box">
            <div className="doc-box-grid">
              <div className="md:col-span-2" style={{ gridColumn: 'span 2' }}>
                <span className="doc-label">Nome / Razão social</span>
                <span className="doc-value">{order.customer_name || '—'}</span>
              </div>
              <div>
                <span className="doc-label">CPF / CNPJ</span>
                <span className="doc-value">{order.customer_cnpj || '—'}</span>
              </div>
              <div>
                <span className="doc-label">Telefone / WhatsApp</span>
                <span className="doc-value">{order.customer_whatsapp || order.customer_phone || '—'}</span>
              </div>
            </div>
            <div className="mt-1 grid gap-x-2 gap-y-1 sm:grid-cols-2">
              <div>
                <span className="doc-label">Endereço</span>
                <span className="doc-value">{clientLines[0] || '—'}</span>
              </div>
              <div>
                <span className="doc-label">Cidade / UF · CEP</span>
                <span className="doc-value">
                  {[order.customer_city, order.customer_state].filter(Boolean).join(' / ') || '—'}
                  {order.customer_zip ? ` · CEP ${order.customer_zip}` : ''}
                </span>
              </div>
              <div>
                <span className="doc-label">Contato</span>
                <span className="doc-value">{order.customer_contact || '—'}</span>
              </div>
              <div>
                <span className="doc-label">E-mail</span>
                <span className="doc-value">{order.customer_email || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dados do serviço */}
        <div className="doc-section">
          <div className="doc-section-title">Dados do equipamento e do serviço</div>
          <div className="doc-box">
            <div className="doc-box-grid">
              <div style={{ gridColumn: 'span 2' }}>
                <span className="doc-label">Serviço / objeto</span>
                <span className="doc-value">{order.title}</span>
              </div>
              <div>
                <span className="doc-label">Técnico responsável</span>
                <span className="doc-value">{order.technician_name || '—'}</span>
              </div>
              <div>
                <span className="doc-label">Prioridade</span>
                <span className="doc-value">{order.priority || '—'}</span>
              </div>
            </div>
            {order.problem_report && (
              <div className="mt-1">
                <span className="doc-label">Defeito relatado / solicitação</span>
                <div>{order.problem_report}</div>
              </div>
            )}
            {order.description && (
              <div className="mt-1">
                <span className="doc-label">Descrição</span>
                <div>{order.description}</div>
              </div>
            )}
          </div>
        </div>

        {/* Produtos / peças */}
        <div className="doc-section">
          <div className="doc-section-title">Peças e produtos</div>
          <table>
            <thead>
              <tr>
                <th style={{ width: '10mm' }}>Cód.</th>
                <th>Descrição</th>
                <th style={{ width: '12mm' }}>Qtd.</th>
                <th style={{ width: '12mm' }}>Un.</th>
                <th style={{ width: '26mm' }}>Vlr. unit.</th>
                <th style={{ width: '28mm' }}>Vlr. total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.length ? (
                renderItemRows(order.items, 'item')
              ) : (
                <tr>
                  <td colSpan={6} className="doc-center doc-muted">
                    Nenhuma peça ou produto nesta OS
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Serviços */}
        <div className="doc-section">
          <div className="doc-section-title">Serviços executados</div>
          <table>
            <thead>
              <tr>
                <th style={{ width: '10mm' }}>Cód.</th>
                <th>Descrição</th>
                <th style={{ width: '12mm' }}>Qtd.</th>
                <th style={{ width: '12mm' }}>Un.</th>
                <th style={{ width: '26mm' }}>Vlr. unit.</th>
                <th style={{ width: '28mm' }}>Vlr. total</th>
              </tr>
            </thead>
            <tbody>
              {order.services?.length ? (
                renderItemRows(order.services, 'service')
              ) : (
                <tr>
                  <td colSpan={6} className="doc-center doc-muted">
                    Nenhum serviço nesta OS
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totais */}
        <div className="doc-section doc-totals">
          <table>
            <tbody>
              <tr>
                <td>Subtotal peças / produtos</td>
                <td className="doc-num">R$ {money(totals.items)}</td>
              </tr>
              <tr>
                <td>Subtotal serviços</td>
                <td className="doc-num">R$ {money(totals.services)}</td>
              </tr>
              {totals.discount > 0 && (
                <tr>
                  <td>Desconto</td>
                  <td className="doc-num">− R$ {money(totals.discount)}</td>
                </tr>
              )}
              <tr className="doc-total-row">
                <td>Valor total</td>
                <td className="doc-num">R$ {money(totals.finalTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {includeCosts && (
          <div className="doc-section doc-internal mt-2">
            <strong>USO INTERNO — CUSTOS E DESPESAS</strong>
            <div className="mt-1 flex flex-wrap gap-x-8 gap-y-1">
              <span>Custo (peças/materiais): <strong>R$ {money(totals.cost)}</strong></span>
              <span>Despesas (deslocamento/terceiros): <strong>R$ {money(totals.expense)}</strong></span>
              <span>
                Lucro estimado:{' '}
                <strong style={{ color: totals.profit >= 0 ? '#047857' : '#b91c1c' }}>
                  R$ {money(totals.profit)}
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* Informações complementares */}
        <div className="doc-section">
          <div className="doc-section-title">Informações complementares</div>
          <div className="doc-box doc-notes">
            <div>
              Documento gerado pelo sistema de gestão técnica de {companyName}.
            </div>
            <div className="mt-1">
              Garantia de 90 dias sobre os serviços executados, conforme o Código de Defesa do
              Consumidor. Peças e equipamentos seguem a garantia do fabricante.
            </div>
          </div>
        </div>

        {/* Assinaturas */}
        <div className="doc-signatures doc-section">
          <div className="doc-sign">{companyName} — Emitente</div>
          <div className="doc-sign">{order.customer_name || 'Cliente'} — Recebi o serviço</div>
        </div>

        <footer className="doc-footer">
          <span>
            {documentTitle} nº {order.order_number} · Emitido em {formatDateTime(order.created_at)}
          </span>
          <span>{companyName}</span>
        </footer>
      </article>
    </div>
  );
}
