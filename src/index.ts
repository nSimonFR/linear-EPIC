import { LINEAR_WEBHOOK_SIGNATURE_HEADER, LINEAR_WEBHOOK_TS_FIELD, LinearClient, LinearWebhooks } from '@linear/sdk';
import { Router } from 'itty-router';
import { z } from 'zod';

import { updateParentState } from "./update-epic";

const router = Router();

export interface Env {
  LINEAR_CLIENT_ID: string;
  LINEAR_CLIENT_SECRET: string;
  LINEAR_REDIRECT_URI: string;
  LINEAR_WEBHOOK_SECRET: string
  sessions: KVNamespace;
};

const payloadValidator = z.object({
  organizationId: z.string(),
  data: z.object({
    id: z.string()
  }),
});

const verifyLinearSignature = async (webhookSecret: string, request: Request, json: any) => {
  const arrayBuffer = await request.arrayBuffer();
  const requestBuffer = Buffer.from(arrayBuffer);

  const webhook = new LinearWebhooks(webhookSecret);
  return webhook.verify(
    requestBuffer,
    request.headers.get(LINEAR_WEBHOOK_SIGNATURE_HEADER)!,
    json[LINEAR_WEBHOOK_TS_FIELD]
  );
};

router.post('/webhook', async (request: Request, env: Env, ctx: ExecutionContext) => {
  if (request.method !== "POST") {
    return new Response('Method not allowed', { status: 405 });
  };

  const json = await request.clone().json();
  if (!json) {
    return new Response('Bad request', { status: 400 });
  };

  // const isLinear = await verifyLinearSignature(env.LINEAR_WEBHOOK_SECRET, request, json);
  // if (!isLinear) {
  //   return new Response('Unauthorized', { status: 401 });
  // };

  const payload = await payloadValidator.parseAsync(json);

  const organizationId = payload.organizationId;
  if (!organizationId) {
    return new Response('Bad request', { status: 400 });
  };

  const accessToken = await env.sessions.get(organizationId);
  if (!accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await updateParentState(new LinearClient({ accessToken }))(payload.data.id, "EPIC");
  } catch (err) {
    const error = err as Error;
    console.error(error.stack);
  }

  return new Response('Ok');
});

router.get('/authorize', (request: Request, env: Env) => {
  const authURL = new URL('https://linear.app/oauth/authorize');

  authURL.searchParams.append('actor', 'application');
  authURL.searchParams.append('scope', 'read,write');
  authURL.searchParams.append('response_type', 'code');
  authURL.searchParams.append('client_id', env.LINEAR_CLIENT_ID);
  authURL.searchParams.append('redirect_uri', env.LINEAR_REDIRECT_URI);
  authURL.searchParams.append('state', 'abcd1234'); // TODO

  const redirectUrl = authURL.href;
  console.log('Redirecting to', redirectUrl);

  return Response.redirect(redirectUrl, 301);
});

type tokenResponse = {
  access_token: string;
};

router.get('/redirect', async (request: Request, env: Env) => {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')!;

  const response = await fetch('https://api.linear.app/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      redirect_uri: env.LINEAR_REDIRECT_URI,
      client_id: env.LINEAR_CLIENT_ID,
      client_secret: env.LINEAR_CLIENT_SECRET,
      grant_type: "authorization_code",
    }),
  });
  const json: tokenResponse = await response.json();

  const accessToken = json.access_token;
  const linearClient = new LinearClient({ accessToken });
  const organization = await linearClient.organization;

  console.log('New organization !', organization.id);

  await env.sessions.put(organization.id, accessToken);

  return new Response('Done !');
});

router.all('*', () => new Response('404, not found!', { status: 404 }));

export default {
  fetch: router.handle,
};
