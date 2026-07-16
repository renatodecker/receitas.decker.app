import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useArea } from '../context/AreaContext';
import { gerarItensLista } from '../lib/gerarLista';

export default function GerarLista() {
  const { codigo, pin, receitas, lista, somenteLeitura, atualizarLista } = useArea();
  const navigate = useNavigate();
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  if (somenteLeitura) {
    return <Navigate to={`/area/${codigo}`} replace />;
  }

  function alternar(receitaId: string) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(receitaId)) novo.delete(receitaId);
      else novo.add(receitaId);
      return novo;
    });
  }

  async function gerar() {
    if (selecionadas.size === 0) {
      setErro('Selecione ao menos uma receita.');
      return;
    }
    setProcessando(true);
    setErro(null);
    try {
      const receitasSelecionadas = receitas.filter((r) => selecionadas.has(r.receitaId));
      const novosItens = gerarItensLista(receitasSelecionadas, lista.itens);
      const listaAtualizada = await api.gerarLista(codigo, pin, novosItens);
      atualizarLista(listaAtualizada);
      navigate(`/area/${codigo}/lista`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível gerar a lista.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-800">Gerar lista a partir de receitas</h1>
      <p className="text-sm text-primary-500">
        Escolha as receitas. Os ingredientes serão somados e adicionados como itens ativos na lista.
      </p>

      <ul className="flex flex-col gap-2">
        {receitas.map((receita) => (
          <li key={receita.receitaId}>
            <label className="card flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={selecionadas.has(receita.receitaId)}
                onChange={() => alternar(receita.receitaId)}
              />
              <span className="font-semibold text-primary-800">{receita.nome}</span>
            </label>
          </li>
        ))}
      </ul>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={gerar} disabled={processando}>
          {processando ? 'Gerando…' : 'Gerar lista'}
        </button>
        <button className="btn-secondary flex-1" onClick={() => navigate(-1)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
