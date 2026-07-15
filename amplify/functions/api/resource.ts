import { defineFunction } from '@aws-amplify/backend';

export const apiFunction = defineFunction({
  name: 'api',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 15,
});
