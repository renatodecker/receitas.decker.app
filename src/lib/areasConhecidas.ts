/**
 * Lista de áreas conhecidas neste aparelho — mesmo padrão do "Meus Álbuns"
 * do álbum de figurinhas (decker.app.br/album): lembrar áreas já acessadas
 * é tratado como funcionalidade essencial (não passa pelo banner de
 * cookies, que aqui no hub cobre só analytics).
 */

export interface AreaConhecida {
  codigo: string;
  /** null = área conhecida só em modo leitura (nunca desbloqueada com PIN neste aparelho) */
  pin: string | null;
  nome: string | null;
}

const CHAVE = 'receitas-decker:areas';
const MAX_ITENS = 20;

function ler(): AreaConhecida[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as AreaConhecida[]) : [];
  } catch {
    return [];
  }
}

function escrever(lista: AreaConhecida[]): void {
  localStorage.setItem(CHAVE, JSON.stringify(lista));
}

function inserirNoTopo(lista: AreaConhecida[], area: AreaConhecida): AreaConhecida[] {
  return [area, ...lista.filter((a) => a.codigo !== area.codigo)].slice(0, MAX_ITENS);
}

/** Lista para exibir em "Minhas áreas", mais recente primeiro. */
export function listarAreasConhecidas(): AreaConhecida[] {
  return ler();
}

/** Registra ou atualiza uma área conhecida (ex.: ao abrir por código, criar, ou desbloquear com PIN). */
export function lembrarArea(area: AreaConhecida): void {
  escrever(inserirNoTopo(ler(), area));
}

export function obterAreaConhecida(codigo: string): AreaConhecida | null {
  return ler().find((a) => a.codigo === codigo) ?? null;
}

/** Esquece a área neste aparelho (não afeta a área em si, só a lista local). */
export function esquecerArea(codigo: string): void {
  escrever(ler().filter((a) => a.codigo !== codigo));
}
