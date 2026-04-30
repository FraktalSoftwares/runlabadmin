import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminGuard } from "@/components/AdminGuard";
import Parceiros from "./pages/Parceiros";
import ParceiroDetalhes from "./pages/ParceiroDetalhes";
import Financeiro from "./pages/Financeiro";
import Corredores from "./pages/Corredores";
import CorredorDetalhes from "./pages/CorredorDetalhes";
import GestaoCompeticoes from "./pages/GestaoCompeticoes";
import CompeticaoDetalhes from "./pages/CompeticaoDetalhes";
import EditarCompeticao from "./pages/EditarCompeticao";
import CadastrarCampeonato from "./pages/CadastrarCampeonato";
import CadastrarCampeonatoForm from "./pages/CadastrarCampeonatoForm";
import Login from "./pages/Login";
import PasswordRecovery from "./pages/PasswordRecovery";
import DefinarSenha from "./pages/DefinarSenha";
import MinhaConta from "./pages/MinhaConta";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/recuperacao-senha" element={<PasswordRecovery />} />
          <Route path="/definir-senha" element={<DefinarSenha />} />
          {/* Rotas do admin */}
          <Route element={<AdminGuard />}>
            <Route path="/parceiros" element={<Parceiros />} />
            <Route path="/parceiros/:id" element={<ParceiroDetalhes />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/corredores" element={<Corredores />} />
            <Route path="/corredores/:id" element={<CorredorDetalhes />} />
            <Route path="/gestao-competicoes" element={<GestaoCompeticoes />} />
            <Route path="/gestao-competicoes/cadastrar-competicao" element={<CadastrarCampeonato />} />
            <Route path="/gestao-competicoes/cadastrar-campeonato" element={<CadastrarCampeonatoForm />} />
            <Route path="/gestao-competicoes/:id" element={<CompeticaoDetalhes />} />
            <Route path="/gestao-competicoes/:id/editar" element={<EditarCompeticao />} />
            <Route path="/minha-conta" element={<MinhaConta />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
