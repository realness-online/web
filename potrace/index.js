import '@/potrace/types/Point'
import Posterizer from '@/potrace/Posterizer'
export const as_paths = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    var posterizer = new Posterizer(options)
    posterizer.loadImage(file, error => {
      if (error) reject(error)
      const width = posterizer._potrace._luminanceData.width
      const height = posterizer._potrace._luminanceData.height
      const dark = !posterizer._params.blackOnWhite
      const paths = posterizer.as_curves()
      resolve({ width, height, dark, paths })
    })
  })
}
export default {
  as_paths: as_paths
}
