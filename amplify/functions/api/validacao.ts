import type { ErroApi, Ingrediente, Unidade } from './types';

export class ErroValidacao extends Error {
  body: ErroApi;
  constructor(body: ErroApi) {
    super(body.mensagem);
    this.body = body;
  }
}

const UNIDADES_VALIDAS: Unidade[] = [
  'g',
  'kg',
  'ml',
  'l',
  'xicara',
  'colher_sopa',
  'colher_cha',
  'unidade',
  'pitada',
];

export function validarPinFormato(pin: unknown): asserts pin is string {
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
    throw new ErroValidacao({ erro: 'pin_invalido_formato', mensagem: 'O PIN deve ter de 4 a 6 dígitos numéricos.' });
  }
}

export function validarNomeReceita(nome: unknown): asserts nome is string {
  if (typeof nome !== 'string' || nome.trim().length < 1 || nome.trim().length > 120) {
    throw new ErroValidacao({ erro: 'nome_invalido', mensagem: 'O nome da receita deve ter entre 1 e 120 caracteres.' });
  }
}

export function validarModoPreparo(modo: unknown): asserts modo is string {
  if (typeof modo !== 'string' || modo.trim().length > 5000) {
    throw new ErroValidacao({ erro: 'modo_preparo_invalido', mensagem: 'Modo de preparo inválido (máx. 5000 caracteres).' });
  }
}

export function validarIngredientes(ingredientes: unknown): asserts ingredientes is Ingrediente[] {
  if (!Array.isArray(ingredientes) || ingredientes.length === 0 || ingredientes.length > 100) {
    throw new ErroValidacao({ erro: 'ingredientes_invalidos', mensagem: 'Informe de 1 a 100 ingredientes.' });
  }
  for (const ing of ingredientes) {
    if (
      typeof ing !== 'object' ||
      ing === null ||
      typeof (ing as Ingrediente).nome !== 'string' ||
      (ing as Ingrediente).nome.trim().length < 1 ||
      (ing as Ingrediente).nome.trim().length > 80 ||
      typeof (ing as Ingrediente).quantidade !== 'number' ||
      !Number.isFinite((ing as Ingrediente).quantidade) ||
      (ing as Ingrediente).quantidade <= 0 ||
      (ing as Ingrediente).quantidade > 100000 ||
      !UNIDADES_VALIDAS.includes((ing as Ingrediente).unidade)
    ) {
      throw new ErroValidacao({
        erro: 'ingredientes_invalidos',
        mensagem: 'Cada ingrediente precisa de nome (1-80 caracteres), quantidade > 0 e unidade válida.',
      });
    }
  }
  // normaliza nome (lowercase + trim) ao persistir, conforme spec
  for (const ing of ingredientes) {
    ing.nome = ing.nome.trim().toLowerCase();
  }
}
