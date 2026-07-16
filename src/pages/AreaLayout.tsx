import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import HubIcon from '../components/HubIcon';
import { useArea } from '../context/AreaContext';
import { linkCompartilharArea } from '../lib/whatsapp';

function CompartilharArea({ codigo, pin }: { codigo: string; pin: string }) {
  const [aberto, setAberto] = useState(false);
  const [incluirPin, setIncluirPin] = useState(false);

  return (
    <div className="relative">
      <button className="btn-secondary !min-h-0 !px-3 !py-2 text-sm" onClick={() => setAberto((v) => !v)}>
        Compartilhar
      </button>
      {aberto && (
        <div className="card absolute right-0 top-full z-10 mt-2 w-64 flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-primary-800">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={incluirPin}
              onChange={(e) => setIncluirPin(e.target.checked)}
              disabled={!pin}
            />
            Incluir PIN no link
          </label>
          {!pin && <p className="text-xs text-primary-500">Desbloqueie a edição para poder incluir o PIN.</p>}
          <a
            className="btn-primary mt-2 block text-center"
            href={linkCompartilharArea(codigo, incluirPin ? pin : undefined)}
            target="_blank"
            rel="noreferrer"
            onClick={() => setAberto(false)}
          >
            Abrir WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

function DesbloquearEdicao() {
  const { desbloquear } = useArea();
  const [aberto, setAberto] = useState(false);
  const [pinDigitado, setPinDigitado] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setVerificando(true);
    const resultado = await desbloquear(pinDigitado.trim());
    setVerificando(false);
    if (resultado.ok) {
      setAberto(false);
      setPinDigitado('');
    } else {
      setErro(resultado.mensagem);
    }
  }

  if (!aberto) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-primary-100 px-4 py-2 text-sm text-primary-800">
        <span>
          <span className="mr-1 rounded-full bg-primary-200 px-2 py-0.5 text-xs font-bold uppercase">Leitor</span>
          Modo leitura
        </span>
        <button className="font-semibold text-primary-700 underline" onClick={() => setAberto(true)}>
          Desbloquear edição
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={confirmar} className="card flex flex-col gap-2">
      <label className="text-sm font-semibold text-primary-800">
        Digite o PIN para editar
        <input
          className="input mt-1"
          type="password"
          inputMode="numeric"
          value={pinDigitado}
          onChange={(e) => setPinDigitado(e.target.value)}
          autoFocus
        />
      </label>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" type="submit" disabled={verificando}>
          {verificando ? 'Verificando…' : 'Desbloquear'}
        </button>
        <button type="button" className="btn-secondary flex-1" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function AreaLayout() {
  const { codigo, pin, somenteLeitura, meta, voltarInicio } = useArea();

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-primary-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <HubIcon />
          <div>
            <p className="text-xs uppercase tracking-wide text-primary-500">{meta.nome ?? 'Área'}</p>
            <p className="font-mono text-sm font-bold text-primary-800">{codigo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CompartilharArea codigo={codigo} pin={pin} />
          <button className="text-sm text-primary-500 underline" onClick={voltarInicio}>
            Minhas áreas
          </button>
        </div>
      </header>

      {somenteLeitura && (
        <div className="px-4 pt-3">
          <DesbloquearEdicao />
        </div>
      )}

      <nav className="flex border-b border-primary-100 bg-white">
        <NavLink
          to=""
          end
          className={({ isActive }) =>
            `flex-1 py-3 text-center font-semibold ${isActive ? 'border-b-2 border-primary-600 text-primary-700' : 'text-primary-400'}`
          }
        >
          Receitas
        </NavLink>
        <NavLink
          to="lista"
          className={({ isActive }) =>
            `flex-1 py-3 text-center font-semibold ${isActive ? 'border-b-2 border-primary-600 text-primary-700' : 'text-primary-400'}`
          }
        >
          Lista de compras
        </NavLink>
      </nav>

      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
