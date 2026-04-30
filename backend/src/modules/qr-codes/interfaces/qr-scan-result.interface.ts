export interface QrScanResult {
  success: boolean;
  qrValue: string;
  objectId?: number;
  object?: {
    invNumber: string;
    buhName: string;
  };
  error?: string;
}