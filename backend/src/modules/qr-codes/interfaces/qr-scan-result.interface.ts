export interface QrScanResult {
  success: boolean;
  qr_value: string;
  object_id?: number;
  error?: string;
}