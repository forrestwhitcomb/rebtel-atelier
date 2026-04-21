// Atelier PartyKit server — Yjs-backed collaborative canvas state.
// Scaffolded in session 1; not wired to apps/web until session 4.
//
// One room per canvas id. Document state lives here; the web app's
// document slice will sync with this via y-partykit client.

import { routePartykitRequest } from "partyserver";
import { YServer } from "y-partyserver";

export class Canvas extends YServer {
  static override options = {
    // Hibernate idle connections — saves Durable Object cost
    hibernate: true,
  };

  override async onStart(): Promise<void> {
    console.log(`[atelier-party] canvas room up: ${this.name}`);
  }
}

export default {
  async fetch(request: Request, env: unknown): Promise<Response> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await routePartykitRequest(request, env as any);
    return response ?? new Response("atelier-party: not found", { status: 404 });
  },
};
