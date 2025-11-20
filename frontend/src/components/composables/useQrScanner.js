import { useQrFile } from './useQrFile.js'

export function useQrScanner(emit) {
  const { startFileScan } = useQrFile(emit)

  const startScan = () => {
    console.log('Запуск сканирования...')
    startFileScan()
  }

  return {
    startScan
  }
}