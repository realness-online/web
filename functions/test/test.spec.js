const myFunctions = require('../index')
const {download} = require('../ConvertToAvatar')
// jest.mock("../ConvertToAvatar.js", )
describe('convert_to_avatar checks', () => {
  let storageObjectEvent = null
  beforeAll(() => {
    global.origConsole = global.console
  })
  beforeEach(() => {
    global.console = {
      log: jest.fn(msg => {
        // global.origConsole.log(msg)
      }),
      warn: jest.fn(msg => {
        // global.origConsole.warn(msg)
      })
    }
    storageObjectEvent = {
      data: {
        bucket: 'realness.app.firebase.com',
        contentType: 'image/jpeg',
        mediaLink: '',
        name: '/people/+16667778888/profile.jpg',
        resourceState: 'exists',
        metageneration: 1,
      }
    }
  })
  afterAll(() => {
    global.console = global.origConsole
  })
  test('Don\'t try to convert non-images', () => {
    storageObjectEvent.data.contentType = 'someNonImageType'
    const convert_promise = myFunctions.convert_to_avatar(storageObjectEvent)
    return convert_promise.then(data => {
      expect(data).toBeUndefined()
      expect(console.log).toHaveBeenCalledWith('This is not an image.')
    })
  })
  test('Don\'t try to convert a thumbnail', () => {
    storageObjectEvent.data.contentType = 'image/svg'
    storageObjectEvent.data.name = '/some/path/to/an/thumb_existingimage.svg'
    const convert_promise = myFunctions.convert_to_avatar(storageObjectEvent)
    return convert_promise.then(data => {
      expect(data).toBeUndefined()
      expect(console.log).toHaveBeenCalledWith('Already an SVG')
    })
  })
  test('Don\'t convert for metadata changes', () => {
    storageObjectEvent.data.metageneration = 2
    const convert_promise = myFunctions.convert_to_avatar(storageObjectEvent)
    return convert_promise.then(data => {
      expect(data).toBeUndefined()
      expect(console.log).toHaveBeenCalledWith('This is a metadata change event.')
    })
  })
  test('calls all the right methods', () => {
    const convert_promise = myFunctions.convert_to_avatar(storageObjectEvent)
    return convert_promise.then(data => {
      expect(data).toBeUndefined()
      // expect(download).toHaveBeenCalled()
      // expect(convert.resize).toHaveBeenCalled()
    })
  })
})
