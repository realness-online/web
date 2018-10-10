const path = require('path')
const {
  create_locals, download, resize,
  trace, optimize, upload, cleanup } = require('../ConvertToAvatar')
const {download_mock, upload_mock, delete_mock} = require('@google-cloud/storage')()
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
  let locals
  beforeEach(() => {
    locals = create_locals(image)
  })
  afterEach(() => {
    download_mock.mockClear()
    spawn_mock.mockClear()
    trace_mock.mockClear()
  })
  it('#create_locals should contain a referenco to local files', () => {
    expect(locals.name).toBe('/people/+15556667777/profile.jpg')
    expect(path.basename(locals.image)).toBe('profile.jpg')
    expect(path.basename(locals.bitmap)).toBe('profile.pnm')
    expect(path.basename(locals.avatar)).toBe('profile.svg')
  })
  it('Should #download the image to a temporary directory', () => {
    expect.assertions(1)
    download(locals).then(locals => {
      expect(download_mock).toHaveBeenCalled()
    })
  })
  it('Should #resize the image to 128x128px', () => {
    expect.assertions(1)
    resize(locals).then(locals => {
      expect(spawn_mock).toHaveBeenCalled()
    })
  })
  it('Should #trace the imgage into an avatar', () => {
    expect.assertions(1)
    trace(locals).then(locals => {
      expect(trace_mock).toHaveBeenCalled()
    })
  })
  it('Should #optimize svg inside the avatar', () => {
    expect.assertions(1)
    optimize(locals).then(locals => {
      expect(spawn_mock).toHaveBeenCalled()
    })
  })
  it('Should #upload the file to /people/:mobile/profile.svg', () => {
    expect.assertions(1)
    upload(locals).then(locals => {
      expect(upload_mock).toHaveBeenCalled()
    })
  })
  it('should #cleanup any local files', () => {
    cleanup(locals).then(locals => {
      let fs = require('fs')
      expect(delete_mock).toHaveBeenCalled()
      expect(fs.unlinkSync).toBeCalledTimes(3)
    })
  })
  it.skip('Should #square the image', () => {})
})
