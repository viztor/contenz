export interface ContentOpResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  diagnostics?: Array<{ field?: string; message: string }>;
}
