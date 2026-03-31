import {
  LINEAR_WEBHOOK_SIGNATURE_HEADER,
  LINEAR_WEBHOOK_TS_FIELD,
  LinearClient,
  LinearWebhooks,
} from "@linear/sdk";
import { Router } from "itty-router";
import { z } from "zod";

import { updateParentState } from "./update-epic";

const router = Router();

export interface Env {
  LINEAR_CLIENT_ID: string;
  LINEAR_CLIENT_SECRET: string;
  LINEAR_REDIRECT_URI: string;
  LINEAR_WEBHOOK_SECRET: string;
  LABEL_TO_CHECK: string;
  sessions: KVNamespace;
}

const payloadValidator = z.object({
  organizationId: z.string(),
  data: z.object({
    id: z.string(),
  }),
});

const verifyLinearSignature = async (
  webhookSecret: string,
  request: Request,
  json: any
) => {
  const arrayBuffer = await request.arrayBuffer();
  const requestBuffer = Buffer.from(arrayBuffer);

  const webhook = new LinearWebhooks(webhookSecret);
  return webhook.verify(
    requestBuffer,
    request.headers.get(LINEAR_WEBHOOK_SIGNATURE_HEADER)!,
    json[LINEAR_WEBHOOK_TS_FIELD]
  );
};

router.post(
  "/webhook",
  async (request: Request, env: Env, ctx: ExecutionContext) => {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const json = await request.clone().json();
    if (!json) {
      return new Response("Bad request", { status: 400 });
    }

    // const isLinear = await verifyLinearSignature(env.LINEAR_WEBHOOK_SECRET, request, json);
    // if (!isLinear) {
    //   return new Response('Unauthorized', { status: 401 });
    // };

    const payload = await payloadValidator.parseAsync(json);

    const organizationId = payload.organizationId;
    if (!organizationId) {
      return new Response("Bad request", { status: 400 });
    }

    const stored = await env.sessions.get(organizationId);
    if (!stored) {
      return new Response("Unauthorized", { status: 401 });
    }

    let session: StoredSession;
    try {
      session = JSON.parse(stored) as StoredSession;
    } catch {
      // Legacy: plain access token stored before refresh token support
      session = { access_token: stored, refresh_token: "", expires_at: Infinity };
    }

    // Refresh if expired or expiring within 5 minutes
    if (session.refresh_token && Date.now() >= session.expires_at - 5 * 60 * 1000) {
      session = await refreshAccessToken(env, session);
      await env.sessions.put(organizationId, JSON.stringify(session));
    }

    try {
      await updateParentState(new LinearClient({ accessToken: session.access_token }))(
        payload.data.id,
        env.LABEL_TO_CHECK || "EPIC"
      );
    } catch (err) {
      const error = err as Error;
      console.error(error.stack);
    }

    return new Response("Ok");
  }
);

router.get("/authorize", (request: Request, env: Env) => {
  const authURL = new URL("https://linear.app/oauth/authorize");

  authURL.searchParams.append("actor", "application");
  authURL.searchParams.append("scope", "read,write");
  authURL.searchParams.append("response_type", "code");
  authURL.searchParams.append("client_id", env.LINEAR_CLIENT_ID);
  authURL.searchParams.append("redirect_uri", env.LINEAR_REDIRECT_URI);
  authURL.searchParams.append("state", "abcd1234"); // TODO

  const redirectUrl = authURL.href;
  console.log("Redirecting to", redirectUrl);

  return Response.redirect(redirectUrl, 301);
});

type tokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix timestamp ms
};

const refreshAccessToken = async (
  env: Env,
  session: StoredSession
): Promise<StoredSession> => {
  const response = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refresh_token,
      client_id: env.LINEAR_CLIENT_ID,
      client_secret: env.LINEAR_CLIENT_SECRET,
    }),
  });
  const json: tokenResponse = await response.json();
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
  };
};

router.get("/redirect", async (request: Request, env: Env) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")!;

  const response = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
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

  const session: StoredSession = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
  };

  const linearClient = new LinearClient({ accessToken: session.access_token });
  const organization = await linearClient.organization;

  console.log("New organization !", organization.id);

  await env.sessions.put(organization.id, JSON.stringify(session));

  return new Response("Done !");
});

// One-time migration: exchange the stored long-lived token for a short-lived
// access token + refresh token without requiring re-authorization.
// Usage: GET /migrate?organizationId=<id>
router.get("/migrate", async (request: Request, env: Env) => {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  if (!organizationId) {
    return new Response("Missing organizationId", { status: 400 });
  }

  const stored = await env.sessions.get(organizationId);
  if (!stored) {
    return new Response("No session found for this organization", { status: 404 });
  }

  let oldAccessToken: string;
  try {
    const existing = JSON.parse(stored) as StoredSession;
    if (existing.refresh_token) {
      return new Response("Session already has a refresh token — no migration needed", { status: 200 });
    }
    oldAccessToken = existing.access_token;
  } catch {
    oldAccessToken = stored;
  }

  const response = await fetch("https://api.linear.app/oauth/migrate_old_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${oldAccessToken}`,
    },
    body: new URLSearchParams({
      client_id: env.LINEAR_CLIENT_ID,
      client_secret: env.LINEAR_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Migration failed:", response.status, text);
    return new Response(`Migration failed: ${response.status} ${text}`, { status: 502 });
  }

  const json: tokenResponse = await response.json();
  const session: StoredSession = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
  };

  await env.sessions.put(organizationId, JSON.stringify(session));

  console.log("Migrated token for organization", organizationId);
  return new Response("Migration successful");
});

router.all("*", () => new Response("404, not found!", { status: 404 }));

export default {
  fetch: router.handle,
};
