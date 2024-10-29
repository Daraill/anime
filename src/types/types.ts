export interface UsageResponse {
  error: string | null;
  status: number;
  format: { [key: string]: { type: string; description: string } };
  example: { url: string };
}
