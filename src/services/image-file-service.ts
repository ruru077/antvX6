const IMAGE_FILE_MAX_SIZE = 5 * 1024 * 1024

function selectImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.hidden = true
    document.body.appendChild(input)

    const finish = (file: File | null) => {
      input.remove()
      resolve(file)
    }

    input.addEventListener('change', () => finish(input.files?.[0] ?? null), {
      once: true,
    })
    input.addEventListener('cancel', () => finish(null), { once: true })
    input.click()
  })
}

function readImageFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('图片读取结果不是 data URL'))
        return
      }
      resolve(reader.result)
    })
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('图片读取失败'))
    })
    reader.readAsDataURL(file)
  })
}

export { IMAGE_FILE_MAX_SIZE, readImageFileAsDataURL, selectImageFile }
