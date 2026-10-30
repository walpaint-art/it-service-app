import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, X, Bell, User, Cpu, MonitorSmartphone, HardHat, Wrench, Settings, LogOut, MessageCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Cpu },
  { path: '/clientes', label: 'Clientes', icon: User },
  { path: '/itens', label: 'Itens / Equipamentos', icon: MonitorSmartphone },
  { path: '/servicos', label: 'Serviços', icon: Wrench },
  { path: '/ordens', label: 'Ordens de Serviço', icon: HardHat },
  { path: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];

function CompanyLogo({ className = 'h-9 w-9' }) {
  const { user } = useAuth();
  const logo = user?.logo_path;
  if (logo) {
    return (
      <img
        src={logo}
        alt="Logo da empresa"
        className={`${className} rounded-lg object-contain bg-white border border-gray-100`}
      />
    );
  }
  return (
    <div className={`${className} rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm`}>
      {(user?.company_name || 'TI').slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const isActive = (path) =>
    location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(`${path}/`));

  return (
    <>
      {/* Barra superior (mobile/tablet) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <CompanyLogo className="h-8 w-8" />
          <span className="truncate font-semibold text-gray-900">
            {user?.company_name || 'Assistência TI'}
          </span>
        </div>
        <Link to="/configuracoes" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-bold shrink-0">
          {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
        </Link>
      </header>

      {/* Overlay do menu mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-gray-200 bg-white transition-transform duration-300 lg:w-72 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
          <div className="flex min-w-0 items-center gap-2">
            <CompanyLogo />
            <div className="min-w-0">
              <p className="truncate font-bold leading-tight text-gray-900">
                {user?.company_name || 'Assistência TI'}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Central de serviços</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 text-gray-500 hover:text-gray-700 lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand-700 border-r-2 border-brand-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon size={18} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
              <User size={20} className="text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-gray-900">
                {user?.full_name || 'Usuário'}
              </p>
              <p className="text-xs text-gray-500">
                {user?.role === 'admin' ? 'Administrador' : 'Técnico'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>
    </>
  );
}
