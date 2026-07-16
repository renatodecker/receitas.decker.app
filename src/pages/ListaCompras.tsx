import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useArea } from '../context/AreaContext';
import { formatarQuantidadeComUnidade } from '../lib/unidades';
import { linkCompartilharLista } from '../lib/whatsapp';
import type { ItemLista } from '../types';

const ATRASO_DESFAZER_MS = 5000;

export default function ListaCompras() {
  const { codigo, pin, lista, somenteLeitura, atualizarLista } = useArea();
  const [pendentes, setPendentes] = useState<Record<string, true>>({});
  const [mostrarComprados, setMostrarComprados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, []);

  const itensAtivos = lista.itens.filter((item) => item.status === 'ativo');
  const itensComprados = [...lista.itens]
    .filter((item) => item.status === 'comprado')
    .sort((a, b) => new Date(b.compradoEm ?? 0).getTime() - new Date(a.compradoEm ?? 0).getTime());

  function marcarComoComprado(item: ItemLista) {
    if (pendentes[item.itemId]) return;
    const timeoutId = setTimeout(async () => {
      try {
        const listaAtualizada = await api.mudarStatusItem(codigo, pin, item.itemId, 'comprado');
        atualizarLista(listaAtualizada);
      } catch (e) {
        setErro(e instanceof ApiError ? e.message : 'Não foi possível atualizar o item.');
      } finally {
        setPendentes((atual) => {
          const resto = { ...atual };
          delete resto[item.itemId];
          return resto;
        });
        delete timeoutsRef.current[item.itemId];
      }
    }, ATRASO_DESFAZER_MS);

    timeoutsRef.current[item.itemId] = timeoutId;
    setPendentes((atual) => ({ ...atual, [item.itemId]: true }));
  }

  function desfazerRiscado(itemId: string) {
    const timeoutId = timeoutsRef.current[itemId];
    if (timeoutId) clearTimeout(timeoutId);
    delete timeoutsRef.current[itemId];
    setPendentes((atual) => {
      const resto = { ...atual };
      delete resto[itemId];
      return resto;
    });
  }

  async function desriscarComprado(itemId: string) {
    setErro(null);
    try {
      const listaAtualizada = await api.mudarStatusItem(codigo, pin, itemId, 'ativo');
      atualizarLista(listaAtualizada);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível atualizar o item.');
    }
  }

  async function limparComprados() {
    if (itensComprados.length === 0) return;
    if (!window.confirm(`Excluir ${itensComprados.length} itens comprados? Essa ação não pode ser desfeita.`)) return;
    setErro(null);
    try {
      const resultado = await api.limparComprados(codigo, pin);
      atualizarLista(resultado);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível limpar os itens comprados.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-800">{lista.nome}</h1>
        {itensAtivos.length > 0 && (
          <a
            className="btn-secondary !min-h-0 !px-3 !py-2 text-sm"
            href={linkCompartilharLista(itensAtivos)}
            target="_blank"
            rel="noreferrer"
          >
            Compartilhar
          </a>
        )}
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {itensAtivos.length === 0 && (
        <p className="text-center text-primary-500">
          {somenteLeitura ? (
            'Lista vazia.'
          ) : (
            <>
              Lista vazia. Adicione itens a partir de uma{' '}
              <Link to={`/area/${codigo}/lista/gerar`} className="underline">
                receita
              </Link>
              .
            </>
          )}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {itensAtivos.map((item) => {
          const riscado = Boolean(pendentes[item.itemId]);
          return (
            <li key={item.itemId} className="card flex min-h-[44px] items-center gap-3">
              <button
                type="button"
                className={`h-6 w-6 shrink-0 rounded-full border-2 ${riscado ? 'border-primary-600 bg-primary-600' : 'border-primary-300'}`}
                aria-label="Marcar como comprado"
                onClick={() => marcarComoComprado(item)}
                disabled={riscado || somenteLeitura}
              />
              <span className={`flex-1 ${riscado ? 'text-primary-400 line-through' : 'text-primary-800'}`}>
                {item.nome} — {formatarQuantidadeComUnidade(item.quantidade, item.unidade)}
              </span>
              {riscado && (
                <button
                  type="button"
                  className="text-sm font-semibold text-accent-600 underline"
                  onClick={() => desfazerRiscado(item.itemId)}
                >
                  Desfazer
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 border-t border-primary-100 pt-4">
        <button
          type="button"
          className="text-sm font-semibold text-primary-600 underline"
          onClick={() => setMostrarComprados((v) => !v)}
        >
          {mostrarComprados ? 'Ocultar comprados' : `Mostrar comprados (${itensComprados.length})`}
        </button>

        {mostrarComprados && (
          <>
            <ul className="flex flex-col gap-2">
              {itensComprados.map((item) => (
                <li key={item.itemId} className="card flex min-h-[44px] items-center gap-3 opacity-70">
                  <span className="flex-1 text-primary-500 line-through">
                    {item.nome} — {formatarQuantidadeComUnidade(item.quantidade, item.unidade)}
                  </span>
                  {!somenteLeitura && (
                    <button
                      type="button"
                      className="text-sm font-semibold text-primary-600 underline"
                      onClick={() => desriscarComprado(item.itemId)}
                    >
                      Desriscar
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!somenteLeitura && itensComprados.length > 0 && (
              <button type="button" className="btn-danger" onClick={limparComprados}>
                Limpar comprados
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
