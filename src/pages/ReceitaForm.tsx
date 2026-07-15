import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useArea } from '../context/AreaContext';
import { parseQuantidade } from '../lib/numero';
import { UNIDADES } from '../lib/unidades';
import type { Ingrediente, Unidade } from '../types';

interface LinhaIngrediente {
  nome: string;
  quantidade: string;
  unidade: Unidade;
}

function linhaVazia(): LinhaIngrediente {
  return { nome: '', quantidade: '', unidade: 'g' };
}

export default function ReceitaForm() {
  const { codigo, pin, receitas, atualizarReceitas } = useArea();
  const { receitaId } = useParams<{ receitaId: string }>();
  const navigate = useNavigate();
  const receitaExistente = receitaId ? receitas.find((r) => r.receitaId === receitaId) : undefined;
  const editando = Boolean(receitaExistente);

  const [nome, setNome] = useState(receitaExistente?.nome ?? '');
  const [modoPreparo, setModoPreparo] = useState(receitaExistente?.modoPreparo ?? '');
  const [ingredientes, setIngredientes] = useState<LinhaIngrediente[]>(
    receitaExistente
      ? receitaExistente.ingredientes.map((i) => ({ nome: i.nome, quantidade: String(i.quantidade), unidade: i.unidade }))
      : [linhaVazia()],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function atualizarLinha(indice: number, campo: keyof LinhaIngrediente, valor: string) {
    setIngredientes((atual) =>
      atual.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)),
    );
  }

  function adicionarLinha() {
    setIngredientes((atual) => [...atual, linhaVazia()]);
  }

  function removerLinha(indice: number) {
    setIngredientes((atual) => atual.filter((_, i) => i !== indice));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('Informe o nome da receita.');
      return;
    }

    const ingredientesValidos: Ingrediente[] = [];
    for (const linha of ingredientes) {
      if (!linha.nome.trim()) continue;
      const quantidade = parseQuantidade(linha.quantidade);
      if (quantidade === null) {
        setErro(`Quantidade inválida para "${linha.nome}".`);
        return;
      }
      ingredientesValidos.push({ nome: linha.nome.trim(), quantidade, unidade: linha.unidade });
    }
    if (ingredientesValidos.length === 0) {
      setErro('Adicione pelo menos um ingrediente.');
      return;
    }

    setSalvando(true);
    try {
      const dados = { nome: nome.trim(), modoPreparo: modoPreparo.trim(), ingredientes: ingredientesValidos };
      if (editando && receitaExistente) {
        const atualizada = await api.editarReceita(codigo, receitaExistente.receitaId, pin, dados);
        atualizarReceitas(receitas.map((r) => (r.receitaId === atualizada.receitaId ? atualizada : r)));
        navigate(`/area/${codigo}/receitas/${atualizada.receitaId}`);
      } else {
        const criada = await api.criarReceita(codigo, pin, dados);
        atualizarReceitas([...receitas, criada]);
        navigate(`/area/${codigo}/receitas/${criada.receitaId}`);
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar a receita.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-800">{editando ? 'Editar receita' : 'Nova receita'}</h1>

      <label className="text-sm font-semibold text-primary-800">
        Nome
        <input className="input mt-1" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      </label>

      <div>
        <p className="mb-2 text-sm font-semibold text-primary-800">Ingredientes</p>
        <div className="flex flex-col gap-2">
          {ingredientes.map((linha, indice) => (
            <div key={indice} className="flex gap-2">
              <input
                className="input flex-[2]"
                placeholder="Ingrediente"
                value={linha.nome}
                onChange={(e) => atualizarLinha(indice, 'nome', e.target.value)}
              />
              <input
                className="input w-20"
                placeholder="Qtd."
                inputMode="decimal"
                value={linha.quantidade}
                onChange={(e) => atualizarLinha(indice, 'quantidade', e.target.value)}
              />
              <select
                className="input flex-1"
                value={linha.unidade}
                onChange={(e) => atualizarLinha(indice, 'unidade', e.target.value)}
              >
                {UNIDADES.map((u) => (
                  <option key={u.valor} value={u.valor}>
                    {u.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="px-2 text-primary-400"
                onClick={() => removerLinha(indice)}
                aria-label="Remover ingrediente"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary mt-2 !py-2 text-sm" onClick={adicionarLinha}>
          + Ingrediente
        </button>
      </div>

      <label className="text-sm font-semibold text-primary-800">
        Modo de preparo
        <textarea
          className="input mt-1 min-h-[140px]"
          value={modoPreparo}
          onChange={(e) => setModoPreparo(e.target.value)}
        />
      </label>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button className="btn-primary flex-1" type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="btn-secondary flex-1" onClick={() => navigate(-1)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
