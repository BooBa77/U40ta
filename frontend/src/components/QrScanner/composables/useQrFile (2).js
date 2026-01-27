import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export function useQrFile(emit) {
  let html5QrcodeInstance = null

  const scanWithHtml5Qrcode = async (file) => {
    if (html5QrcodeInstance) {
      try {
        await html5QrcodeInstance.clear()
      } catch (e) {
        console.warn("Error clearing previous instance:", e)
      }
    }

    const tempElement = document.createElement('div')
    tempElement.id = 'temp-qr-scanner'
    tempElement.style.display = 'none'
    document.body.appendChild(tempElement)

    html5QrcodeInstance = new Html5Qrcode('temp-qr-scanner')

    const allSupportedFormats = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.CODABAR,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.QR_CODE
    ]

    try {
      const result = await html5QrcodeInstance.scanFile(file, false, {
        formats: allSupportedFormats
      })
      return result
    } finally {
      document.body.removeChild(tempElement)
    }
  }

  const processFile = async (file) => {
    try {
      console.log('Файл:', file.name)
      const result = await scanWithHtml5Qrcode(file)
      console.log('Результат:', result)
      emit('scan', result)
    } catch (error) {
      console.log('Ошибка:', error)
      emit('error', error.message)
    }
  }

  const startFileScan = () => {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.style.display = 'none'
    
    fileInput.onchange = (event) => {
      const file = event.target.files[0]
      if (file) {
        processFile(file)
      }
      document.body.removeChild(fileInput)
    }
    
    document.body.appendChild(fileInput)
    fileInput.click()
  }

  return {
    startFileScan
  }
}