import ConvertToAvatar from '../ConvertToAvatar'
// const storage_mock = jest.spyOn(firebase, 'storage').mockImplementation(() => {
//   return {
//     ref: jest.fn(() => {
//       return {
//         child: jest.fn(path => {
//           let reference_path = path
//           return {
//             put: jest.fn(path => Promise.resolve(reference_path)),
//             getDownloadURL: jest.fn(path => {
//               // console.log('reference_path', reference_path)
//               return Promise.resolve(`https://download_url${reference_path}`)
//             })
//           }
//         })
//       }
//     })
//   }
// })
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
