import { useEffect, useState } from 'react';
import {
  Settings, Palette, User, Image as ImageIcon, Upload, Trash2, Save,
  MessageCircle, ShieldCheck, Building2, KeyRound, Search, Loader2,
} from 'lucide-react';
import { configAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { THEME_OPTIONS, applyAppearance } from '../lib/theme';
import {
  onlyDigits, formatCnpj, formatPhone, isValidCnpj, lookupCnpj,
} from '../lib/br';
import { toast } from 'react-hot-toast';

const EMPTY_CONFIG = {
  app_name: '',
  whatsapp_number: '',
  whatsapp_message: '',
  currency: 'BRL',
  language: 'pt-BR',
  date_format: 'dd/MM/yyyy',
  time_format: 'HH:mm',
  photo_max_size_mb: '10',
  video_max_size_mb: '50',
  allow_client_upload: '1',
  auto_send_status_update: '1',
  require_whatsapp_login: '0',
  enable_dark_theme: '1',
  enable_custom_logo: '1',
};

const EMPTY_PROFILE = {
  full_name: '', company_name: '', company_cnpj: '', email: '',
  phone: '', whatsapp_number: '', address: '',
};

const TABS = [
  { id: 'geral', label: 'Geral', icon: Settings },
  { id: 'aparencia', label: 'Aparência', icon: Palette },
  { id: 'empresa', label: 'Empresa', icon: Building2 },
  { id: 'marca', label: 'Marca e Logo', icon: ImageIcon },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'sistema', label: 'Sistema', icon: ShieldCheck },
];

export default function Configuracoes() {
  const { user, updateUser } = useAuth();
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [theme, setTheme] = useState('light');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#10b981');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [activeTab, setActiveTab] = useState('geral');
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' });
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);

  useEffect(() => {
    Promise.all([configAPI.list(), authAPI.me()])
      .then(([configRes, meRes]) => {
        const loaded = configRes.data || {};
        setConfig({ ...EMPTY_CONFIG, ...loaded });
        const me = meRes.data.user || meRes.data;
        setProfile({
          full_name: me.full_name || '',
          company_name: me.company_name || '',
          company_cnpj: formatCnpj(me.company_cnpj || ''),
          email: me.email || '',
          phone: me.phone || '',
          whatsapp_number: me.whatsapp_number || '',
          address: me.address || '',
        });
        setTheme(me.theme || 'light');
        setPrimaryColor(me.primary_color || '#2563eb');
        setSecondaryColor(me.secondary_color || '#10b981');
      })
      .catch(() => toast.error('Erro ao carregar configurações'))
      .finally(() => setLoading(false));
  }, []);

  const previewAppearance = (nextTheme, nextPrimary) => {
    applyAppearance({ theme: nextTheme, primary_color: nextPrimary });
  };

  const changeTheme = (id) => {
    setTheme(id);
    previewAppearance(id, primaryColor);
  };

  const changePrimary = (value) => {
    setPrimaryColor(value);
    previewAppearance(theme, value);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      delete payload.company_logo;
      delete payload.theme;
      delete payload.primary_color;
      delete payload.secondary_color;

      await Promise.all(
        Object.entries(payload).map(([key, value]) => configAPI.update(key, value === undefined ? '' : String(value)))
      );
      await authAPI.updateMe({
        ...profile,
        theme,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });
      updateUser({ ...profile, theme, primary_color: primaryColor, secondary_color: secondaryColor });
      applyAppearance({ theme, primary_color: primaryColor });
      toast.success('Configurações salvas');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const res = await configAPI.uploadLogo(formData);
      const me = await authAPI.me();
      const data = me.data.user || me.data;
      updateUser({ logo_path: res.data.logo_path, ...data });
      toast.success('Logo atualizada');
    } catch (err) {
      setLogoPreview(null);
      toast.error(err.response?.data?.error || 'Erro ao enviar logo');
    } finally {
      e.target.value = '';
    }
  };

  const removeLogo = async () => {
    if (!window.confirm('Remover a logo da empresa?')) return;
    try {
      await configAPI.deleteLogo();
      setLogoPreview(null);
      updateUser({ logo_path: null });
      toast.success('Logo removida');
    } catch (err) {
      toast.error('Erro ao remover logo');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwords.new_password.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (passwords.new_password !== passwords.confirm) {
      toast.error('As senhas não conferem');
      return;
    }
    try {
      await authAPI.changePassword({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords({ current_password: '', new_password: '', confirm: '' });
      toast.success('Senha alterada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar senha');
    }
  };

  const fillCompanyFromCnpj = async (force = false) => {
    const digits = onlyDigits(profile.company_cnpj);
    if (digits.length !== 14) {
      toast.error('Informe um CNPJ com 14 dígitos');
      return;
    }
    if (!isValidCnpj(digits)) {
      toast.error('CNPJ inválido — confira os dígitos');
      return;
    }
    setLookingUpCnpj(true);
    try {
      const data = await lookupCnpj(digits);
      setProfile((p) => ({
        ...p,
        company_cnpj: data.cnpj,
        company_name:
          force || !p.company_name || p.company_name === 'Sua Empresa TI'
            ? data.name || data.company || p.company_name
            : p.company_name,
        email: force || !p.email ? data.email || p.email : p.email,
        phone: force || !p.phone ? data.phone || p.phone : p.phone,
        whatsapp_number: force || !p.whatsapp_number ? data.phone || p.whatsapp_number : p.whatsapp_number,
        address: force || !p.address ? data.address || p.address : p.address,
      }));
      toast.success(`Dados de ${data.name || 'CNPJ'} preenchidos`);
    } catch (err) {
      toast.error(err.message || 'Erro ao consultar o CNPJ');
    } finally {
      setLookingUpCnpj(false);
    }
  };

  const boolField = (key, label, hint) => (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-200 p-3">
      <span>
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={config[key] === '1'}
        onChange={(e) => setConfig({ ...config, [key]: e.target.checked ? '1' : '0' })}
        className="h-5 w-5 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
      />
    </label>
  );

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Carregando configurações...</div>;
  }

  const logo = logoPreview || user?.logo_path;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-sm text-gray-500">Personalize o sistema: identidade, tema, WhatsApp e comportamento</p>
        </div>
        <button onClick={saveAll} disabled={saving} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
          <Save size={18} /> {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Abas */}
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm lg:col-span-3 xl:col-span-2">
          <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-brand-50 font-medium text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-9 xl:col-span-10">
          {activeTab === 'geral' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Configurações gerais</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Nome da aplicação</label>
                  <input className="input" value={config.app_name} onChange={(e) => setConfig({ ...config, app_name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Moeda</label>
                  <select className="select w-full" value={config.currency} onChange={(e) => setConfig({ ...config, currency: e.target.value })}>
                    <option value="BRL">Real brasileiro (R$)</option>
                    <option value="USD">Dólar americano (US$)</option>
                    <option value="EUR">Euro (€)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Idioma</label>
                  <select className="select w-full" value={config.language} onChange={(e) => setConfig({ ...config, language: e.target.value })}>
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Español</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Formato de data</label>
                  <input className="input" value={config.date_format} onChange={(e) => setConfig({ ...config, date_format: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Formato de hora</label>
                  <input className="input" value={config.time_format} onChange={(e) => setConfig({ ...config, time_format: e.target.value })} />
                </div>
              </div>

              <h4 className="mb-3 mt-6 text-xs font-semibold uppercase text-gray-500">Comportamento</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {boolField('allow_client_upload', 'Cliente pode enviar fotos/vídeos', 'Acompanhamento pelo link público')}
                {boolField('auto_send_status_update', 'Avisar mudanças de status', 'Mensagem automática de andamento')}
                {boolField('require_whatsapp_login', 'Exigir login via WhatsApp', 'Autenticação alternativa por telefone')}
                {boolField('enable_dark_theme', 'Permitir tema escuro', 'Libera a opção escura na aparência')}
                {boolField('enable_custom_logo', 'Permitir logo personalizada', 'Exibe a logo no menu e nos relatórios')}
              </div>
            </section>
          )}

          {activeTab === 'aparencia' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Aparência</h3>
              <p className="mb-3 text-xs font-medium text-gray-700">Tema do sistema</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => changeTheme(t.id)}
                    className={`rounded-xl border p-2 text-left transition-all ${
                      theme === t.id ? 'border-brand-500 ring-2 ring-brand-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`mb-2 h-12 w-full rounded-lg ${t.swatch}`}></div>
                    <span className="text-xs font-medium text-gray-700">{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Cor principal</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => changePrimary(e.target.value)}
                      className="h-11 w-20 cursor-pointer rounded-lg border border-gray-200 bg-transparent"
                    />
                    <input className="input" value={primaryColor} onChange={(e) => changePrimary(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Cor secundária</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-11 w-20 cursor-pointer rounded-lg border border-gray-200 bg-transparent"
                    />
                    <input className="input" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-500">
                As cores são aplicadas na hora como prévia. Clique em “Salvar alterações” para manter.
              </p>
            </section>
          )}

          {activeTab === 'empresa' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Dados da empresa</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Seu nome / responsável</label>
                  <input className="input" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Nome da empresa</label>
                  <input className="input" value={profile.company_name} onChange={(e) => setProfile({ ...profile, company_name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">CNPJ</label>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00"
                      value={profile.company_cnpj}
                      onChange={(e) => setProfile({ ...profile, company_cnpj: formatCnpj(e.target.value) })}
                      onBlur={() => {
                        if (onlyDigits(profile.company_cnpj).length === 14) fillCompanyFromCnpj();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fillCompanyFromCnpj(true)}
                      disabled={lookingUpCnpj}
                      className="btn-outline shrink-0 px-3 disabled:opacity-50"
                      title="Buscar dados na Receita Federal"
                    >
                      {lookingUpCnpj ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Preenche razão social, e-mail, telefone e endereço automaticamente.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">E-mail</label>
                  <input className="input" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Telefone</label>
                  <input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">WhatsApp comercial</label>
                  <input className="input" value={profile.whatsapp_number} onChange={(e) => setProfile({ ...profile, whatsapp_number: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-700">Endereço</label>
                  <input className="input" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-500">Esses dados aparecem no menu, nos orçamentos e na impressão da OS.</p>
            </section>
          )}

          {activeTab === 'marca' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Marca e logo</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6">
                    {logo ? (
                      <img src={logo} alt="Logo da empresa" className="max-h-32 max-w-[12rem] rounded-lg object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <ImageIcon size={32} className="opacity-50" />
                        <p className="text-sm">Nenhuma logo enviada</p>
                      </div>
                    )}
                    <label className="w-full">
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadLogo} className="sr-only" />
                      <span className="btn-primary flex w-full cursor-pointer items-center justify-center gap-2">
                        <Upload size={16} /> Enviar logo
                      </span>
                    </label>
                    {user?.logo_path && (
                      <button onClick={removeLogo} className="inline-flex items-center gap-1 text-xs text-red-600 underline hover:text-red-800">
                        <Trash2 size={13} /> Remover logo
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">PNG, JPG, WEBP ou GIF. Tamanho máximo: 10 MB.</p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="mb-3 text-xs font-semibold uppercase text-gray-500">Prévia da marca</h4>
                    <div className="flex items-center gap-3">
                      {logo ? (
                        <img src={logo} alt="Logo" className="h-10 max-w-[8rem] rounded object-contain" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
                          {(profile.company_name || 'TI').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-bold text-gray-900">{profile.company_name || config.app_name || 'Assistência Técnica TI'}</div>
                        <div className="text-xs text-gray-500">{profile.full_name || 'Atendimento personalizado'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4 text-xs text-gray-500">
                    A logo é usada no menu lateral, na tela de login e no link de acompanhamento enviado ao cliente.
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'whatsapp' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Integração WhatsApp</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Número do WhatsApp (com DDI)</label>
                  <input
                    className="input"
                    placeholder="+55 11 99999-9999"
                    value={config.whatsapp_number}
                    onChange={(e) => setConfig({ ...config, whatsapp_number: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-gray-500">Usado nos links wa.me e no rodapé das mensagens.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Mensagem padrão de atendimento</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={config.whatsapp_message}
                    onChange={(e) => setConfig({ ...config, whatsapp_message: e.target.value })}
                    placeholder="Olá! Este é o atendimento técnico da sua empresa de informática."
                  />
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-blue-700">Fluxo de atendimento</p>
                  <ol className="list-inside list-decimal space-y-1 text-sm text-blue-900">
                    <li>Cliente relata a pane pelo WhatsApp.</li>
                    <li>Você abre a OS e vincula cliente, itens e serviços.</li>
                    <li>Envia fotos e vídeos do andamento pela OS.</li>
                    <li>Você envia fotos, vídeos e o orçamento impresso em PDF pelo WhatsApp.</li>
                  </ol>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'sistema' && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Limites de arquivos</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Tamanho máximo de foto (MB)</label>
                    <input className="input" type="number" min="1" value={config.photo_max_size_mb} onChange={(e) => setConfig({ ...config, photo_max_size_mb: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Tamanho máximo de vídeo (MB)</label>
                    <input className="input" type="number" min="1" value={config.video_max_size_mb} onChange={(e) => setConfig({ ...config, video_max_size_mb: e.target.value })} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                  <KeyRound size={18} /> Alterar senha
                </h3>
                <form onSubmit={changePassword} className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Senha atual</label>
                    <input className="input" type="password" required value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Nova senha</label>
                    <input className="input" type="password" required minLength={6} value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Confirmar nova senha</label>
                    <input className="input" type="password" required value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
                  </div>
                  <div className="md:col-span-3">
                    <button type="submit" className="btn-secondary">Alterar senha</button>
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-gray-900">
                  <User size={18} /> Conta
                </h3>
                <p className="text-sm text-gray-600">
                  Usuário: <span className="font-medium">{user?.username}</span> · Perfil:{' '}
                  <span className="font-medium">{user?.role === 'admin' ? 'Administrador' : 'Técnico'}</span>
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
