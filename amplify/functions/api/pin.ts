import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { getItem, updateItem } from './db';
import type { ErroApi, MetaItem } from './types';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const DIGITOS_PIN = 6;

export interface ResultadoPin {
  ok: boolean;
  status?: 401 | 403 | 404;
  body?: ErroApi;
}

/** Gera um PIN numérico de 6 dígitos — o sistema decide, o usuário não digita um PIN próprio. */
export function gerarPin(): string {
  return String(randomInt(0, 10 ** DIGITOS_PIN)).padStart(DIGITOS_PIN, '0');
}

export async function gerarHashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/** Valida o PIN enviado contra o hash da área, aplicando o rate limit de 5 erros -> 15 min de bloqueio. */
export async function verificarPin(areaCodigo: string, pinFornecido: string | undefined): Promise<ResultadoPin> {
  const meta = await getItem<MetaItem>(areaCodigo, 'META');
  if (!meta) {
    return { ok: false, status: 404, body: { erro: 'area_nao_encontrada', mensagem: 'Área não encontrada.' } };
  }

  if (meta.pinLockedUntil && new Date(meta.pinLockedUntil).getTime() > Date.now()) {
    const minutosRestantes = Math.ceil((new Date(meta.pinLockedUntil).getTime() - Date.now()) / 60000);
    return {
      ok: false,
      status: 403,
      body: {
        erro: 'bloqueado',
        mensagem: `Muitas tentativas de PIN incorretas. Tente novamente em ${minutosRestantes} min.`,
      },
    };
  }

  if (!pinFornecido) {
    return { ok: false, status: 401, body: { erro: 'pin_ausente', mensagem: 'Informe o PIN da área.' } };
  }

  const valido = await bcrypt.compare(pinFornecido, meta.pinHash);

  if (valido) {
    if (meta.pinFailCount > 0) {
      await updateItem(areaCodigo, 'META', 'SET pinFailCount = :zero, pinLockedUntil = :null', {
        ':zero': 0,
        ':null': null,
      });
    }
    return { ok: true };
  }

  const novaContagem = meta.pinFailCount + 1;
  if (novaContagem >= MAX_TENTATIVAS) {
    await updateItem(areaCodigo, 'META', 'SET pinFailCount = :zero, pinLockedUntil = :ate', {
      ':zero': 0,
      ':ate': new Date(Date.now() + BLOQUEIO_MS).toISOString(),
    });
    return {
      ok: false,
      status: 403,
      body: { erro: 'bloqueado', mensagem: 'Muitas tentativas de PIN incorretas. Tente novamente em 15 min.' },
    };
  }

  await updateItem(areaCodigo, 'META', 'SET pinFailCount = :n', { ':n': novaContagem });
  return { ok: false, status: 401, body: { erro: 'pin_invalido', mensagem: 'PIN incorreto.' } };
}
