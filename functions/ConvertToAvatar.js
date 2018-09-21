const path = require('path')
const os = require('os')
const storage = require('@google-cloud/storage')()
class ConvertToAvatar {

  constructor(image) {
    this.local_image = path.join(os.tmpdir(), path.basename(image.name))
    this.as_file = this.local_image.replace(/\.[^/.]+$/, "")
    this.server_image  = image.name
  }
  download() {
    return storage.bucket('/people').file(this.server_image).download({
      destination: this.local_image
    })
  }
}
export default ConvertToAvatar
// reference links:
// for croping to a square
//  https://www.imagemagick.org/discourse-server/viewtopic.php?t=28283
// removing file extension
//  https://stackoverflow.com/questions/39007908/filename-without-extension-terminology
