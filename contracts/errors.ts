// 前后端共享的错误码与类型
export const ERR = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  BAD_REQUEST: "BAD_REQUEST",
  CONFLICT: "CONFLICT",
} as const;

export type ErrCode = (typeof ERR)[keyof typeof ERR];
