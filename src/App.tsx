import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import ConsentBanner from './components/ConsentBanner';
import { AreaProvider } from './context/AreaContext';
import { iniciarAnalytics } from './lib/analytics';
import { obterPreferencias } from './lib/consent';
import AreaLayout from './pages/AreaLayout';
import GerarLista from './pages/GerarLista';
import Home from './pages/Home';
import ListaCompras from './pages/ListaCompras';
import ReceitaDetalhe from './pages/ReceitaDetalhe';
import ReceitaForm from './pages/ReceitaForm';
import ReceitasLista from './pages/ReceitasLista';

export default function App() {
  useEffect(() => {
    if (obterPreferencias()?.estatisticas) {
      iniciarAnalytics(import.meta.env.VITE_GA_MEASUREMENT_ID);
    }
  }, []);

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
      <ConsentBanner
        onDecidir={(preferencias) => {
          if (preferencias.estatisticas) {
            iniciarAnalytics(import.meta.env.VITE_GA_MEASUREMENT_ID);
          }
        }}
      />
    </HashRouter>
  );
}
