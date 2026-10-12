/**
 * One HTTP request on a connection of its own. The game's calls are not safe to send twice,
 * so they must not go out on a connection that may be dead: a pooled, kept-alive connection
 * is closed by the server after a while, and a process that was busy for minutes (a scripted
 * policy planning, a long physics step) learns of that only when its next request fails.
 * A fresh connection per request has no such state.
 */

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

/** What came back. */
export interface OnceResponse {
  readonly status: number;
  readonly text: string;
}

/** Sends one request with an optional JSON body and resolves with the status and the body text. */
export function requestOnce(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  options: { readonly body?: unknown; readonly headers?: { readonly [name: string]: string } } = {},
): Promise<OnceResponse> {
  return new Promise<OnceResponse>((resolve, reject) => {
    const target = new URL(url);
    const payload =
      options.body === undefined ? undefined : Buffer.from(JSON.stringify(options.body));
    const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = send(
      target,
      {
        method,
        // No agent: the connection is made for this request and closed after it.
        agent: false,
        headers: {
          connection: 'close',
          ...(payload === undefined
            ? {}
            : { 'content-type': 'application/json', 'content-length': String(payload.length) }),
          ...options.headers,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    request.on('error', reject);
    request.end(payload);
  });
}
