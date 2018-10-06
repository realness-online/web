const path = require('path')
const {download, resize, trace, optimize} = require('../ConvertToAvatar')
const {download_mock} = require('@google-cloud/storage')()
const {spawn_mock} = require('child-process-promise')
const {trace_mock} = require('potrace')
jest.mock("fs")

describe('../ConvertToAvatar', () => {
  let image = {
    // https://firebase.google.com/docs/reference/functions/functions.storage.ObjectMetadata#name
    bucket: '/people',
    contentType: 'image/jpg',
    name: '/people/+15556667777/profile.jpg'
  }
  afterEach(() => {
    download_mock.mockClear()
    spawn_mock.mockClear()
    trace_mock.mockClear()
  })
  it('Should #download the image to a temporary directory', () => {
    expect.assertions(2)
    download(image).then(file_location => {
      const file_name = path.basename(file_location)
      expect(file_name).toBe('profile.jpg')
    })
    expect(download_mock).toHaveBeenCalled()
  })
  // it('Should #square the image')

  it('Should #resize the image to 128x128px', () => {
    expect.assertions(2)
    resize('/path/to/local/profile.jpg').then(file_location => {
      expect(file_location).toBe('/path/to/local/profile.jpg')
    })
    expect(spawn_mock).toHaveBeenCalled()
  })
  it('Should #trace the imgage into an avatar', () => {
    expect.assertions(2)
    trace('/path/to/local/profile.jpg').then(file_location => {
      expect(file_location).toBe('/path/to/local/profile.svg')
    })
    expect(trace_mock).toHaveBeenCalled()
  })
  it('Should #optimize svg inside the avatar', () => {
    expect.assertions(2)
    optimize('/path/to/local/profile.svg').then(file_location => {
      expect(file_location).toBe('/path/to/local/profile.svg')
    })
    expect(spawn_mock).toHaveBeenCalled()
  })
  // it('Should #upload the file to /people/:mobile/profile.svg')
  // it('should #cleanup any local files')
})
