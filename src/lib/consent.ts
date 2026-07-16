const CHAVE = 'receitas-decker:consentimento';

export interface Preferencias {
  /** lembrar código+PIN da área neste aparelho (localStorage) */
  lembrarArea: boolean;
  /** carregar analytics (GA4) */
  estatisticas: boolean;
}

interface ConsentimentoArmazenado extends Preferencias {
  decidido: true;
}

// A própria escolha de consentimento é armazenamento estritamente necessário
// (não dá pra respeitar uma preferência sem lembrar qual foi a escolha) —
// por isso essa gravação específica não passa pelo gate de `lembrarArea`.
export function obterPreferencias(): Preferencias | null {
  const bruto = localStorage.getItem(CHAVE);
  if (!bruto) return null;
  try {
    const dados = JSON.parse(bruto) as ConsentimentoArmazenado;
    if (!dados.decidido) return null;
    return { lembrarArea: Boolean(dados.lembrarArea), estatisticas: Boolean(dados.estatisticas) };
  } catch {
    return null;
  }
}

export function salvarPreferencias(preferencias: Preferencias): void {
  const dados: ConsentimentoArmazenado = { decidido: true, ...preferencias };
  localStorage.setItem(CHAVE, JSON.stringify(dados));
}
