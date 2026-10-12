/**
 * The WebGPU buffer usage flags (`GPUBufferUsage` of the WebGPU specification) as numbers, so
 * that simulation code which must also run under Node does not need the browser global
 * (docs/design/sim-core.md section M1).
 */
export const BUFFER_USAGE = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  INDIRECT: 0x0100,
  QUERY_RESOLVE: 0x0200,
} as const;
