import { HashRouter, Route, Routes } from 'react-router-dom';
import { AreaProvider } from './context/AreaContext';
import AreaLayout from './pages/AreaLayout';
import GerarLista from './pages/GerarLista';
import Home from './pages/Home';
import ListaCompras from './pages/ListaCompras';
import ReceitaDetalhe from './pages/ReceitaDetalhe';
import ReceitaForm from './pages/ReceitaForm';
import ReceitasLista from './pages/ReceitasLista';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/area/:codigo"
          element={
            <AreaProvider>
              <AreaLayout />
            </AreaProvider>
          }
        >
          <Route index element={<ReceitasLista />} />
          <Route path="receitas/nova" element={<ReceitaForm />} />
          <Route path="receitas/:receitaId" element={<ReceitaDetalhe />} />
          <Route path="receitas/:receitaId/editar" element={<ReceitaForm />} />
          <Route path="lista" element={<ListaCompras />} />
          <Route path="lista/gerar" element={<GerarLista />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
