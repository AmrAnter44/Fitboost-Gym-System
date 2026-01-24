// Global type definitions

interface Window {
  electron?: {
    isElectron?: boolean
    savePDF?: (buffer: ArrayBuffer, fileName: string) => Promise<{ filePath?: string }>
    shareWhatsApp?: (phoneNumber: string, buffer: Buffer, fileName: string) => Promise<void>
  }
}
