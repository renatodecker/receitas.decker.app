import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useArea } from '../context/AreaContext';
import { gerarItensLista } from '../lib/gerarLista';
import { formatarQuantidadeComUnidade } from '../lib/unidades';

export default function ReceitaDetalhe() {
  const { codigo, pin, receitas, lista, somenteLeitura, atualizarReceitas, atualizarLista } = useArea();
  const { receitaId } = useParams<{ receitaId: string }>();
  const navigate = useNavigate();
  const receita = receitas.find((r) => r.receitaId === receitaId);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  if (!receita) {
    return (
      <div className="text-center text-primary-500">
        Receita não encontrada.
        <div className="mt-3">
          <Link to={`/area/${codigo}`} className="btn-secondary">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  async function excluir() {
    if (!window.confirm(`Excluir a receita "${receita!.nome}"? Essa ação não pode ser desfeita.`)) return;
    setProcessando(true);
    setErro(null);
    try {
      await api.excluirReceita(codigo, receita!.receitaId, pin);
      atualizarReceitas(receitas.filter((r) => r.receitaId !== receita!.receitaId));
      navigate(`/area/${codigo}`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível excluir a receita.');
      setProcessando(false);
    }
  }

  async function adicionarALista() {
    setProcessando(true);
    setErro(null);
    try {
      const novosItens = gerarItensLista([receita!], lista.itens);
      const listaAtualizada = await api.gerarLista(codigo, pin, novosItens);
      atualizarLista(listaAtualizada);
      navigate(`/area/${codigo}/lista`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível adicionar à lista.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-800">{receita.nome}</h1>

      <div className="card">
        <p className="mb-2 text-sm font-semibold text-primary-700">Ingredientes</p>
        <ul className="flex flex-col gap-1 text-primary-800">
          {receita.ingredientes.map((ing, i) => (
            <li key={i}>
              {ing.nome} — {formatarQuantidadeComUnidade(ing.quantidade, ing.unidade)}
            </li>
          ))}
        </ul>
      </div>

      {receita.modoPreparo && (
        <div className="card">
          <p className="mb-2 text-sm font-semibold text-primary-700">Modo de preparo</p>
          <p className="whitespace-pre-wrap text-primary-800">{receita.modoPreparo}</p>
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {!somenteLeitura && (
        <div className="flex flex-col gap-2">
          <button className="btn-accent" onClick={adicionarALista} disabled={processando}>
            Adicionar à lista de compras
          </button>
          <div className="flex gap-2">
            <Link to={`/area/${codigo}/receitas/${receita.receitaId}/editar`} className="btn-secondary flex-1">
              Editar
            </Link>
            <button className="btn-danger flex-1" onClick={excluir} disabled={processando}>
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
