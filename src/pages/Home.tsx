import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import HubIcon from '../components/HubIcon';
import { esquecerArea, lembrarArea, listarAreasConhecidas, type AreaConhecida } from '../lib/areasConhecidas';
import { isCodigoValido, normalizarCodigo } from '../lib/formatoCodigo';

type Modo = 'lista' | 'entrar' | 'criar' | 'criada';

export default function Home() {
  const navigate = useNavigate();
  const [areasConhecidas, setAreasConhecidas] = useState<AreaConhecida[]>([]);
  const [modo, setModo] = useState<Modo>('lista');
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [areaCriada, setAreaCriada] = useState<{ codigo: string; pin: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setAreasConhecidas(listarAreasConhecidas());
  }, []);

  function abrir(area: AreaConhecida) {
    navigate(`/area/${area.codigo}`);
  }

  function esquecer(codigoParaEsquecer: string) {
    esquecerArea(codigoParaEsquecer);
    setAreasConhecidas(listarAreasConhecidas());
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const codigoNormalizado = normalizarCodigo(codigo);
    if (!isCodigoValido(codigoNormalizado)) {
      setErro('Código inválido. Formato esperado: RCT-XXXXX.');
      return;
    }
    setCarregando(true);
    try {
      const area = await api.obterArea(codigoNormalizado);
      lembrarArea({ codigo: codigoNormalizado, pin: null, nome: area.meta.nome });
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
    lembrarArea({ codigo: areaCriada.codigo, pin: areaCriada.pin, nome: nome.trim() || null });
    navigate(`/area/${areaCriada.codigo}`);
  }

  async function copiarPin() {
    if (!areaCriada) return;
    await navigator.clipboard.writeText(areaCriada.pin);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 p-6 pt-8">
      <div className="w-full max-w-sm">
        <HubIcon />
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-primary-700">Receitas</h1>
        <p className="mt-1 text-primary-600">Receitas e lista de compras da família, sem login.</p>
      </div>

      {modo === 'lista' && (
        <div className="flex w-full max-w-sm flex-col gap-4">
          {areasConhecidas.length > 0 && (
            <div className="card flex flex-col gap-2">
              <p className="text-sm font-semibold text-primary-700">Minhas áreas</p>
              <ul className="flex flex-col gap-2">
                {areasConhecidas.map((area) => (
                  <li key={area.codigo} className="flex items-center gap-2 rounded-xl border border-primary-100 p-2">
                    <div className="flex-1">
                      <p className="font-semibold text-primary-800">{area.nome || area.codigo}</p>
                      <p className="flex items-center gap-2 text-xs text-primary-500">
                        <span className="font-mono">{area.codigo}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                            area.pin ? 'bg-accent-100 text-accent-700' : 'bg-primary-100 text-primary-600'
                          }`}
                        >
                          {area.pin ? 'Editor' : 'Leitor'}
                        </span>
                      </p>
                    </div>
                    <button className="btn-primary !min-h-0 !px-3 !py-2 text-sm" onClick={() => abrir(area)}>
                      Abrir
                    </button>
                    <button
                      className="px-1 text-primary-400"
                      aria-label="Esquecer área"
                      onClick={() => esquecer(area.codigo)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card flex flex-col gap-3">
            <p className="text-sm font-semibold text-primary-700">Acessar área</p>
            <form onSubmit={entrar} className="flex flex-col gap-3">
              <input
                className="input"
                placeholder="RCT-XXXXX"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <button className="btn-primary" type="submit" disabled={carregando}>
                {carregando ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
            <div className="flex items-center gap-2 text-xs text-primary-400">
              <div className="h-px flex-1 bg-primary-100" />
              ou
              <div className="h-px flex-1 bg-primary-100" />
            </div>
            <button className="btn-secondary" onClick={() => setModo('criar')}>
              + Criar nova área
            </button>
          </div>
        </div>
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
          <button type="button" className="text-sm text-primary-600 underline" onClick={() => setModo('lista')}>
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
