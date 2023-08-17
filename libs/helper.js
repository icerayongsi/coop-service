import path from 'path'
import { fileURLToPath } from 'url'

export const getDirName = (moduleUrl) => {
    const filename = fileURLToPath(moduleUrl)
    return path.dirname(filename)
}