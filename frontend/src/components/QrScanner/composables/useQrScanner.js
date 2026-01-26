import { useQrFile } from './useQrFile.js'
import { useQrCamera } from './useQrCamera.js'

export function useQrScanner(options = {}) {
  const { onScan, onError, itemInfo } = options
  
  const { startFileScan } = useQrFile({ onScan, onError })
  const { startCameraScan, stopCameraScan } = useQrCamera({ onScan, onError, itemInfo })

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