const myFunctions = require('../index')
const {download} = require('../ConvertToAvatar')
jest.mock("fs")
describe('convert_to_avatar checks', () => {
  let storageObjectEvent = null
  let image_data = null
  beforeAll(() => {
    global.origConsole = global.console
  })
  beforeEach(() => {
    image_data = {
      bucket: 'realness.app.firebase.com',
      contentType: 'image/jpeg',
      mediaLink: '',
      name: '/people/+16667778888/profile.jpg',
      resourceState: 'exists',
      metageneration: 1,
    }
    global.console = {
      log: jest.fn(msg => {
        // global.origConsole.log(msg)
      }),
      warn: jest.fn(msg => {
        // global.origConsole.warn(msg)
      })
    }
    storageObjectEvent = {
      data: image_data
    }
  })
  afterAll(() => {
    global.console = global.origConsole
  })
  test('Don\'t try to convert non-images', () => {
    storageObjectEvent.data.contentType = 'someNonImageType'
    const convert_promise = myFunctions.convert_to_avatar(storageObjectEvent)
    return convert_promise.then(data => {
      expect(data).toBe(false)
    })
  })
  test('Don\'t try to convert a thumbnail', () => {
    storageObjectEvent.data.contentType = 'image/svg'
    storageObjectEvent.data.name = '/some/path/to/an/thumb_existingimage.svg'
    const convert_promise = myFunctions.convert_to_avatar(storageObjectEvent)
    return convert_promise.then(data => {
      expect(data).toBe(false)
    })
  })
  test('Don\'t convert for metadata changes', () => {
    storageObjectEvent.data.metageneration = 2
    const convert_promise = myFunctions.convert_to_avatar(storageObjectEvent)
    return convert_promise.then(data => {
      expect(data).toBe(false)
    })
  })
  test('calls all the right methods', () => {
    const convert_promise = myFunctions.convert_to_avatar(storageObjectEvent)
    return convert_promise.then(data => {
      expect(data.name).toBe(image_data.name)
    })
  })
})
