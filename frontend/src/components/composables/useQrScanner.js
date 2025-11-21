import { useQrFile } from './useQrFile.js'
import { useQrCamera } from './useQrCamera.js'

export function useQrScanner(emit) {
  const { startFileScan } = useQrFile(emit)
  const { startCameraScan, stopCameraScan } = useQrCamera(emit)

  const startScan = () => {
    const isMobile = JSON.parse(localStorage.getItem('device_isMobile') || 'false')
    const hasCamera = JSON.parse(localStorage.getItem('device_hasCamera') || 'false')
    
    if (isMobile && hasCamera) {
      startCameraScan()
    } else {
      startFileScan()
    }
  }

  return {
    startScan,
    stopScan: stopCameraScan
  }
}