export type ApiErrorBody = {
  message: string;
  code?: string;
  details?: unknown;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: ApiErrorBody;
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export type MeResponseData = {
  user: import("@/types").SessionUser;
};
