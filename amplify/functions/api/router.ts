import { criarArea, obterArea, verificarPinArea } from './handlers/area';
import { criarReceita, editarReceita, excluirReceita } from './handlers/receita';
import { gerarItensLista, limparComprados, mudarStatusItem } from './handlers/lista';
import { ErroValidacao } from './validacao';

export interface RequisicaoRota {
  method: string;
  path: string;
  body: unknown;
  pin: string | undefined;
}

export interface RespostaRota {
  status: number;
  body: unknown;
}

export async function rotear(req: RequisicaoRota): Promise<RespostaRota> {
  const segmentos = req.path.split('/').filter(Boolean);

  try {
    // POST /area
    if (req.method === 'POST' && segmentos.length === 1 && segmentos[0] === 'area') {
      return await criarArea(req.body);
    }

    // GET /area/{codigo}
    if (req.method === 'GET' && segmentos.length === 2 && segmentos[0] === 'area') {
      return await obterArea(segmentos[1]);
    }

    // POST /area/{codigo}/verificar-pin
    if (
      req.method === 'POST' &&
      segmentos.length === 3 &&
      segmentos[0] === 'area' &&
      segmentos[2] === 'verificar-pin'
    ) {
      return await verificarPinArea(segmentos[1], req.pin);
    }

    // POST /area/{codigo}/receita
    if (req.method === 'POST' && segmentos.length === 3 && segmentos[0] === 'area' && segmentos[2] === 'receita') {
      return await criarReceita(segmentos[1], req.body, req.pin);
    }

    // PUT /area/{codigo}/receita/{id}
    if (req.method === 'PUT' && segmentos.length === 4 && segmentos[0] === 'area' && segmentos[2] === 'receita') {
      return await editarReceita(segmentos[1], segmentos[3], req.body, req.pin);
    }

    // DELETE /area/{codigo}/receita/{id}
    if (req.method === 'DELETE' && segmentos.length === 4 && segmentos[0] === 'area' && segmentos[2] === 'receita') {
      return await excluirReceita(segmentos[1], segmentos[3], req.pin);
    }

    // POST /area/{codigo}/lista/gerar
    if (
      req.method === 'POST' &&
      segmentos.length === 4 &&
      segmentos[0] === 'area' &&
      segmentos[2] === 'lista' &&
      segmentos[3] === 'gerar'
    ) {
      return await gerarItensLista(segmentos[1], req.body, req.pin);
    }

    // PUT /area/{codigo}/lista/item/{id}
    if (
      req.method === 'PUT' &&
      segmentos.length === 5 &&
      segmentos[0] === 'area' &&
      segmentos[2] === 'lista' &&
      segmentos[3] === 'item'
    ) {
      return await mudarStatusItem(segmentos[1], segmentos[4], req.body, req.pin);
    }

    // POST /area/{codigo}/lista/limpar
    if (
      req.method === 'POST' &&
      segmentos.length === 4 &&
      segmentos[0] === 'area' &&
      segmentos[2] === 'lista' &&
      segmentos[3] === 'limpar'
    ) {
      return await limparComprados(segmentos[1], req.pin);
    }

    return { status: 404, body: { erro: 'rota_nao_encontrada', mensagem: 'Rota não encontrada.' } };
  } catch (erro) {
    if (erro instanceof ErroValidacao) {
      return { status: 400, body: erro.body };
    }
    console.error(erro);
    return { status: 500, body: { erro: 'erro_interno', mensagem: 'Erro interno. Tente novamente.' } };
  }
}
