/**
 * Request metadata utilities using WeakMap to avoid memory leaks.
 *
 * WeakMap allows us to associate metadata with Request objects without
 * preventing garbage collection. When a Request is GC'd, its metadata
 * is automatically cleaned up.
 */

/** Metadata associated with a request. */
export interface RequestMetadata {
  /** Unique identifier for this request. */
  requestId: string
  /** Timestamp when the request started processing (performance.now()). */
  startTime: number
}

/**
 * WeakMap storing request metadata.
 *
 * Using WeakMap ensures that when a Request object is garbage collected,
 * its metadata is automatically removed, preventing memory leaks.
 */
const REQUEST_METADATA = new WeakMap<Request, RequestMetadata>()

/**
 * Get or create metadata for a request.
 *
 * If metadata doesn't exist, it's created with a new requestId and startTime.
 * Subsequent calls for the same request return the same metadata.
 *
 * @param req - The Request object to get metadata for
 * @returns Request metadata (requestId, startTime)
 */
export function getRequestMetadata(req: Request): RequestMetadata {
  let meta = REQUEST_METADATA.get(req)
  if (!meta) {
    meta = {
      requestId: crypto.randomUUID(),
      startTime: performance.now(),
    }
    REQUEST_METADATA.set(req, meta)
  }
  return meta
}

/**
 * Get existing metadata for a request without creating it.
 *
 * @param req - The Request object
 * @returns Request metadata if it exists, undefined otherwise
 */
export function getRequestMetadataIfExists(req: Request): RequestMetadata | undefined {
  return REQUEST_METADATA.get(req)
}
