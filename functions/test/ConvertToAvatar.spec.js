import ConvertToAvatar from '../ConvertToAvatar'
describe('../ConvertToAvatar', () => {
  let convert_to_avatar
  let image = {
    // https://firebase.google.com/docs/reference/functions/functions.storage.ObjectMetadata#name
    bucket: '/people',
    contentType: 'image/jpg',
    name: '/people/+15556667777'
  }
  beforeEach(() => {
     convert_to_avatar = new ConvertToAvatar(image)
  })
  it('Should #download the image to the temporary directory', () => {
    convert_to_avatar.download()
  })
  // it('Should #convert the image to a square ')
  // it('Should #resize the image to 128x128px')
  // it('Should #trace the imgae into an avatar')
  // it('Should #optimize svg inside the avatar')
  // it('Should #upload the file to /people/:mobile/profile.svg')
  // it('should #cleanup any local files')
})
