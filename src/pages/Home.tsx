import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { obterPreferencias } from '../lib/consent';
import { definirSessaoArea, obterSessaoArea } from '../lib/storage';

type Modo = 'inicial' | 'entrar' | 'criar' | 'criada';

export default function Home() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>('inicial');
  const [codigo, setCodigo] = useState('');
  const [pin, setPin] = useState('');
  const [nome, setNome] = useState('');
  const [areaCriada, setAreaCriada] = useState<{ codigo: string; pin: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const sessao = obterSessaoArea();
    if (sessao) {
      navigate(`/area/${sessao.codigo}`, { replace: true });
    }
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const codigoNormalizado = codigo.trim().toUpperCase();
    if (!codigoNormalizado || !pin.trim()) {
      setErro('Informe o código da área e o PIN.');
      return;
    }
    setCarregando(true);
    try {
      await api.obterArea(codigoNormalizado);
      definirSessaoArea({ codigo: codigoNormalizado, pin: pin.trim() }, obterPreferencias()?.lembrarArea ?? false);
      navigate(`/area/${codigoNormalizado}`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível entrar na área.');
    } finally {
      setCarregando(false);
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const resultado = await api.criarArea(nome.trim() || undefined);
      setAreaCriada(resultado);
      setModo('criada');
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível criar a área.');
    } finally {
      setCarregando(false);
    }
  }

  function continuarAposCriar() {
    if (!areaCriada) return;
    definirSessaoArea(areaCriada, obterPreferencias()?.lembrarArea ?? false);
    navigate(`/area/${areaCriada.codigo}`);
  }

  async function copiarPin() {
    if (!areaCriada) return;
    await navigator.clipboard.writeText(areaCriada.pin);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-primary-700">Receitas</h1>
        <p className="mt-1 text-primary-600">Receitas e lista de compras da família, sem login.</p>
      </div>

      {modo === 'inicial' && (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <button className="btn-primary" onClick={() => setModo('entrar')}>
            Entrar em uma área
          </button>
          <button className="btn-secondary" onClick={() => setModo('criar')}>
            Criar nova área
          </button>
        </div>
      )}

      {modo === 'entrar' && (
        <form onSubmit={entrar} className="card flex w-full max-w-sm flex-col gap-3">
          <label className="text-sm font-semibold text-primary-800">
            Código da área
            <input
              className="input mt-1"
              placeholder="RCT-XXXXX"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoFocus
            />
          </label>
          <label className="text-sm font-semibold text-primary-800">
            PIN
            <input
              className="input mt-1"
              type="password"
              inputMode="numeric"
              placeholder="6 dígitos"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </label>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button className="btn-primary" type="submit" disabled={carregando}>
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
          <button type="button" className="text-sm text-primary-600 underline" onClick={() => setModo('inicial')}>
            Voltar
          </button>
        </form>
      )}

      {modo === 'criar' && (
        <form onSubmit={criar} className="card flex w-full max-w-sm flex-col gap-3">
          <label className="text-sm font-semibold text-primary-800">
            Nome da área (opcional)
            <input
              className="input mt-1"
              placeholder="Ex.: Casa da família"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
            />
          </label>
          <p className="text-xs text-primary-500">
            O código e o PIN de acesso são gerados automaticamente na próxima tela. O PIN é
            necessário para cadastrar receitas e mexer na lista. Não existe recuperação — se
            perder o PIN, a área fica só para leitura.
          </p>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button className="btn-primary" type="submit" disabled={carregando}>
            {carregando ? 'Criando…' : 'Criar área'}
          </button>
          <button type="button" className="text-sm text-primary-600 underline" onClick={() => setModo('inicial')}>
            Voltar
          </button>
        </form>
      )}

      {modo === 'criada' && areaCriada && (
        <div className="card flex w-full max-w-sm flex-col gap-4">
          <p className="text-primary-800">Área criada! Anote o código e o PIN — não tem como recuperar depois.</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">Código da área</p>
            <p className="font-mono text-2xl font-bold text-primary-800">{areaCriada.codigo}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">PIN</p>
            <div className="flex items-center gap-3">
              <p className="font-mono text-2xl font-bold text-primary-800">{areaCriada.pin}</p>
              <button type="button" className="text-sm font-semibold text-primary-600 underline" onClick={copiarPin}>
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
          <button className="btn-primary" onClick={continuarAposCriar}>
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
