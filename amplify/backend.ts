import { defineBackend } from '@aws-amplify/backend';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Function as LambdaFunction, FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda';
import { apiFunction } from './functions/api/resource';

const backend = defineBackend({
  apiFunction,
});

const apiStack = backend.createStack('ReceitasApiStack');

// DynamoDB single-table: PK=areaCodigo, SK="META" | "RECEITA#<uuid>" | "LISTA#<uuid>"
const table = new Table(apiStack, 'ReceitasTable', {
  tableName: 'receitas-app',
  partitionKey: { name: 'areaCodigo', type: AttributeType.STRING },
  sortKey: { name: 'sk', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
});

// resources.lambda é tipado como IFunction (interface), mas o construct
// subjacente do defineFunction é sempre um aws_lambda.Function concreto —
// o cast é necessário para chamar addEnvironment.
const lambda = backend.apiFunction.resources.lambda as LambdaFunction;
table.grantReadWriteData(lambda);
lambda.addEnvironment('TABLE_NAME', table.tableName);

const functionUrl = lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.ALL],
    allowedHeaders: ['content-type', 'x-area-pin'],
  },
});

backend.addOutput({
  custom: {
    apiUrl: functionUrl.url,
  },
});
