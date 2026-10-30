import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Itens from './pages/Itens';
import Servicos from './pages/Servicos';
import Ordens from './pages/Ordens';
import OrdemNova from './pages/OrdemNova';
import OrdemDetalhe from './pages/OrdemDetalhe';
import OrdemImprimir from './pages/OrdemImprimir';
import Whatsapp from './pages/Whatsapp';
import Configuracoes from './pages/Configuracoes';
import Rastreamento from './pages/Rastreamento';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="bottom-right" richColors />
      <Routes>
        {/* Rotas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/rastreamento/:orderNumber" element={<Rastreamento />} />

        {/* Rotas protegidas (require auth) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/itens" element={<Itens />} />
            <Route path="/servicos" element={<Servicos />} />
            <Route path="/ordens" element={<Ordens />} />
            <Route path="/ordens/nova" element={<OrdemNova />} />
            <Route path="/ordens/:id" element={<OrdemDetalhe />} />
            <Route path="/ordens/:id/imprimir" element={<OrdemImprimir />} />
            <Route path="/whatsapp" element={<Whatsapp />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
