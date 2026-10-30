import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorCog, Mail, Lock, ArrowRight, Cpu, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { brandingAPI } from '../services/api';
import { toast } from 'react-hot-toast';

export default function Login() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState({ company_name: 'Assistência Técnica TI', logo: '' });
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    brandingAPI.get()
      .then((res) => setBranding((prev) => ({ ...prev, ...res.data })))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(credentials);
      navigate('/dashboard', { replace: true });
      toast.success('Bem-vindo de volta!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-4 mb-8">
          {branding.logo ? (
            <img
              src={branding.logo}
              alt={branding.company_name}
              className="h-20 w-20 rounded-2xl border border-gray-200 bg-white object-contain p-2 shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/30">
              <MonitorCog size={32} />
            </div>
          )}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">{branding.company_name || 'Assistência Técnica TI'}</h1>
            <p className="text-sm text-gray-500">Sistema de atendimento para técnicos em informática</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Usuário</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="pl-10 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="admin"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Senha</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  className="pl-10 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="••••••••"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <ArrowRight size={20} /> Entrar
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center mb-3">
              Credenciais padrão: <br />
              <span className="text-brand-600 font-medium">Usuário:</span> admin &nbsp;|&nbsp;
              <span className="text-brand-600 font-medium">Senha:</span> admin123
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">
                <div className="w-8 h-8 mx-auto mb-2 bg-brand-100 text-brand-600 rounded-lg flex items-center justify-center">
                  <Cpu size={18} />
                </div>
                Redes &amp; Servidores
              </div>
              <div className="text-center py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">
                <div className="w-8 h-8 mx-auto mb-2 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <Wrench size={18} />
                </div>
                Câmeras IP &amp; NVRs
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Desenvolvido para atendimento personalizado a PMEs sem setor de TI
        </p>
      </div>
    </div>
  );
}
