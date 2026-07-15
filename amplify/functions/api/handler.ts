import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { rotear } from './router';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  let body: unknown = undefined;
  if (event.body) {
    const bruto = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
    try {
      body = JSON.parse(bruto);
    } catch {
      return {
        statusCode: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ erro: 'json_invalido', mensagem: 'Corpo da requisição não é um JSON válido.' }),
      };
    }
  }

  const headers = event.headers ?? {};
  const pin = headers['x-area-pin'] ?? headers['X-Area-Pin'];

  const resposta = await rotear({ method, path, body, pin });

  return {
    statusCode: resposta.status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(resposta.body),
  };
};
