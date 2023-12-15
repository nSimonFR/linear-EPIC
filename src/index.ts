import { LinearClient } from '@linear/sdk';
import { z } from 'zod';

import { updateParentState } from "./update-epic";

export interface Env {
  LINEAR_KEY: string;
}

const payloadValidator = z.object({
  id: z.string()
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "POST") {
      const json = await request.json();
      const payload = await payloadValidator.parseAsync(json);
      console.log(payload);

      const linearClient = new LinearClient({
        apiKey: env.LINEAR_KEY,
      });

      await updateParentState(linearClient)(payload.id, "EPIC");
    }

    return new Response('Ok');
  },
};
