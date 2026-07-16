import { useState } from 'react';
import { obterPreferencias, salvarPreferencias, type Preferencias } from '../lib/consent';
import { persistirSessaoEmMemoria } from '../lib/storage';

export default function ConsentBanner({ onDecidir }: { onDecidir: (preferencias: Preferencias) => void }) {
  const [visivel, setVisivel] = useState(() => obterPreferencias() === null);
  const [personalizando, setPersonalizando] = useState(false);
  const [lembrarArea, setLembrarArea] = useState(false);
  const [estatisticas, setEstatisticas] = useState(false);

  if (!visivel) return null;

  function decidir(preferencias: Preferencias) {
    salvarPreferencias(preferencias);
    if (preferencias.lembrarArea) persistirSessaoEmMemoria();
    onDecidir(preferencias);
    setVisivel(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-primary-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <p className="text-sm text-primary-800">
          Usamos armazenamento local no seu navegador. O necessário para o site funcionar nesta
          visita não pede permissão. Para <strong>lembrar sua área neste aparelho</strong> (não
          digitar código/PIN de novo) e para <strong>estatísticas de uso anônimas</strong>,
          pedimos sua autorização — de acordo com a LGPD.
        </p>

        {!personalizando ? (
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary"
              onClick={() => decidir({ lembrarArea: true, estatisticas: true })}
            >
              Aceitar tudo
            </button>
            <button
              className="btn-secondary"
              onClick={() => decidir({ lembrarArea: false, estatisticas: false })}
            >
              Rejeitar tudo
            </button>
            <button
              className="text-sm font-semibold text-primary-600 underline"
              onClick={() => setPersonalizando(true)}
            >
              Personalizar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm text-primary-800">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={lembrarArea}
                onChange={(e) => setLembrarArea(e.target.checked)}
              />
              Lembrar minha área neste aparelho (código + PIN)
            </label>
            <label className="flex items-center gap-2 text-sm text-primary-800">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={estatisticas}
                onChange={(e) => setEstatisticas(e.target.checked)}
              />
              Estatísticas de uso anônimas
            </label>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => decidir({ lembrarArea, estatisticas })}>
                Salvar preferências
              </button>
              <button className="btn-secondary" onClick={() => setPersonalizando(false)}>
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
