import { NavLink, Outlet } from 'react-router-dom';
import { useArea } from '../context/AreaContext';
import { linkCompartilharArea } from '../lib/whatsapp';

export default function AreaLayout() {
  const { codigo, meta, sair } = useArea();

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-primary-100 bg-white px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-primary-500">{meta.nome ?? 'Área'}</p>
          <p className="font-mono text-sm font-bold text-primary-800">{codigo}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            className="btn-secondary !min-h-0 !px-3 !py-2 text-sm"
            href={linkCompartilharArea(codigo)}
            target="_blank"
            rel="noreferrer"
          >
            Compartilhar
          </a>
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
