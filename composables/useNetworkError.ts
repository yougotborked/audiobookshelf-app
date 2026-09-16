export interface MaybeHttpError {
  status?: number
  response?: { status?: number }
  code?: string | number
  message?: string
}

/**
 * Whether a failed request never reached the server at all.
 *
 * The rule is simply whether an HTTP status came back. If the server answered - even with a 500 -
 * it is reachable. If there is no status, the request died in transport: DNS failure, connect
 * timeout, no route, TLS failure, captive portal black hole.
 *
 * This used to be decided by searching the error text for words like "network" and "timed out",
 * which misses most of what Android actually throws. "Unable to resolve host", "failed to connect
 * to ... after 6000ms" and "No route to host" all contain none of those words, so a phone on a
 * wifi network with no working internet - exactly what you get on a plane, or behind a captive
 * portal - was still treated as having a reachable server.
 */
export function isTransportFailure(error: MaybeHttpError | null | undefined): boolean {
  const status = error?.status ?? error?.response?.status
  return !(typeof status === 'number' && status > 0)
}
