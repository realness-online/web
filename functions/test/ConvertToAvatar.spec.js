const {download} = require('../ConvertToAvatar')
const {download_mock} = require('@google-cloud/storage')()

describe('../ConvertToAvatar', () => {
  let image = {
    // https://firebase.google.com/docs/reference/functions/functions.storage.ObjectMetadata#name
    bucket: '/people',
    contentType: 'image/jpg',
    name: '/people/+15556667777/profile.jpg'
  }
  afterEach(() => {
    download_mock.mockClear()
  })
  it('Should #download the image to a temporary directory', () => {
    expect.assertions(1)
    download(image)
    expect(download_mock).toHaveBeenCalled()
  })
  // it('Should #square the image')
  // it('Should #resize the image to 128x128px')
  // it('Should #trace the imgage into an avatar')
  // it('Should #optimize svg inside the avatar')
  // it('Should #upload the file to /people/:mobile/profile.svg')
  // it('should #cleanup any local files')
})
