import { LinearClient } from '@linear/sdk';
import { Router } from 'itty-router';
import { z } from 'zod';

import { updateParentState } from "./update-epic";

const router = Router();

export interface Env {
  LINEAR_KEY: string;
}

const payloadValidator = z.object({
  data: z.object({
    id: z.string()
  }),
});

router.post('/webhook', async (request: Request, env: Env, ctx: ExecutionContext) => {
  if (request.method === "POST") {
    const json = await request.json();
    const payload = await payloadValidator.parseAsync(json);
    console.log(payload);

    const linearClient = new LinearClient({
      apiKey: env.LINEAR_KEY,
    });

    await updateParentState(linearClient)(payload.data.id, "EPIC");
  };

  return new Response('Ok');
});

router.all('*', () => new Response('404, not found!', { status: 404 }));

export default {
  fetch: router.handle,
};
