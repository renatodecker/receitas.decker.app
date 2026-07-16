import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
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
          {!pin && <p className="text-xs text-primary-500">Entre na área com o PIN para poder incluí-lo.</p>}
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

export default function AreaLayout() {
  const { codigo, pin, meta, sair } = useArea();

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-primary-100 bg-white px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-primary-500">{meta.nome ?? 'Área'}</p>
          <p className="font-mono text-sm font-bold text-primary-800">{codigo}</p>
        </div>
        <div className="flex items-center gap-2">
          <CompartilharArea codigo={codigo} pin={pin} />
          <button className="text-sm text-primary-500 underline" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

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
