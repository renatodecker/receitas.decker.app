import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { lembrarArea, obterAreaConhecida } from '../lib/areasConhecidas';
import type { AreaMeta, Lista, Receita } from '../types';

interface AreaContextValue {
  codigo: string;
  pin: string;
  somenteLeitura: boolean;
  meta: AreaMeta;
  receitas: Receita[];
  lista: Lista;
  recarregar: () => Promise<void>;
  atualizarLista: (novaLista: Lista) => void;
  atualizarReceitas: (novasReceitas: Receita[]) => void;
  /** Tenta desbloquear edição verificando o PIN contra o backend. Retorna true se o PIN estava correto. */
  desbloquear: (pin: string) => Promise<{ ok: true } | { ok: false; mensagem: string }>;
  voltarInicio: () => void;
}

const AreaContext = createContext<AreaContextValue | null>(null);

export function useArea(): AreaContextValue {
  const contexto = useContext(AreaContext);
  if (!contexto) throw new Error('useArea deve ser usado dentro de <AreaProvider>');
  return contexto;
}

export function AreaProvider({ children }: { children: ReactNode }) {
  const { codigo = '' } = useParams<{ codigo: string }>();
  const navigate = useNavigate();

  const [meta, setMeta] = useState<AreaMeta | null>(null);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [lista, setLista] = useState<Lista | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pin, setPin] = useState('');

  useEffect(() => {
    setPin(obterAreaConhecida(codigo)?.pin ?? '');
  }, [codigo]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const area = await api.obterArea(codigo);
      setMeta(area.meta);
      setReceitas(area.receitas);
      setLista(area.lista);
      lembrarArea({ codigo, pin: obterAreaConhecida(codigo)?.pin ?? null, nome: area.meta.nome });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar a área.');
    } finally {
      setCarregando(false);
    }
  }, [codigo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const desbloquear = useCallback(
    async (pinDigitado: string): Promise<{ ok: true } | { ok: false; mensagem: string }> => {
      try {
        await api.verificarPin(codigo, pinDigitado);
        setPin(pinDigitado);
        lembrarArea({ codigo, pin: pinDigitado, nome: meta?.nome ?? null });
        return { ok: true };
      } catch (e) {
        return { ok: false, mensagem: e instanceof ApiError ? e.message : 'Não foi possível verificar o PIN.' };
      }
    },
    [codigo, meta],
  );

  const voltarInicio = useCallback(() => {
    navigate('/');
  }, [navigate]);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-primary-600">
        Carregando área…
      </div>
    );
  }

  if (erro || !meta || !lista) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-primary-800">{erro ?? 'Área não encontrada.'}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <AreaContext.Provider
      value={{
        codigo,
        pin,
        somenteLeitura: !pin,
        meta,
        receitas,
        lista,
        recarregar: carregar,
        atualizarLista: setLista,
        atualizarReceitas: setReceitas,
        desbloquear,
        voltarInicio,
      }}
    >
      {children}
    </AreaContext.Provider>
  );
}
