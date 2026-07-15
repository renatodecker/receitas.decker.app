import { Link } from 'react-router-dom';
import { useArea } from '../context/AreaContext';

export default function ReceitasLista() {
  const { receitas, codigo } = useArea();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Link to="receitas/nova" className="btn-primary flex-1">
          + Nova receita
        </Link>
        {receitas.length > 0 && (
          <Link to="lista/gerar" className="btn-accent flex-1">
            Gerar lista
          </Link>
        )}
      </div>

      {receitas.length === 0 && (
        <p className="mt-8 text-center text-primary-500">
          Nenhuma receita cadastrada ainda. Toque em "Nova receita" para começar.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {receitas.map((receita) => (
          <li key={receita.receitaId}>
            <Link
              to={`/area/${codigo}/receitas/${receita.receitaId}`}
              className="card block hover:border-primary-300"
            >
              <p className="font-bold text-primary-800">{receita.nome}</p>
              <p className="text-sm text-primary-500">
                {receita.ingredientes.length} ingrediente{receita.ingredientes.length === 1 ? '' : 's'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
