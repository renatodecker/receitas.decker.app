import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const TABLE_NAME = process.env.TABLE_NAME ?? '';

export async function getItem<T>(areaCodigo: string, sk: string): Promise<T | undefined> {
  const res = await client.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { areaCodigo, sk } }),
  );
  return res.Item as T | undefined;
}

export async function queryArea<T>(areaCodigo: string): Promise<T[]> {
  const res = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'areaCodigo = :codigo',
      ExpressionAttributeValues: { ':codigo': areaCodigo },
    }),
  );
  return (res.Items ?? []) as T[];
}

export async function queryByPrefix<T>(areaCodigo: string, prefix: string): Promise<T[]> {
  const res = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'areaCodigo = :codigo AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':codigo': areaCodigo, ':prefix': prefix },
    }),
  );
  return (res.Items ?? []) as T[];
}

export async function putItem(item: object, condicaoNaoExiste = false): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item as Record<string, unknown>,
      ...(condicaoNaoExiste ? { ConditionExpression: 'attribute_not_exists(areaCodigo)' } : {}),
    }),
  );
}

export async function updateItem(
  areaCodigo: string,
  sk: string,
  updateExpression: string,
  expressionAttributeValues: Record<string, unknown>,
  expressionAttributeNames?: Record<string, string>,
): Promise<void> {
  await client.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { areaCodigo, sk },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
    }),
  );
}

export async function deleteItem(areaCodigo: string, sk: string): Promise<void> {
  await client.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { areaCodigo, sk } }));
}
