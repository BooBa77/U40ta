export interface QrScanResult {
  success: boolean;
  qrValue: string;
  objectId?: number;
  error?: string;
}