require('firebase-functions').config = jest.fn(() => {
  console.log('Jest firebase functions.config being called');
  return {
    firebase: {
      databaseURL: 'https://not-a-project.firebaseio.com',
      storageBucket: 'not-a-project.appspot.com'
    }
  };
});
const cpp = require('child-process-promise');
cpp.spawn = jest.fn((path, object) => {
  console.log('Inside child-process-promise.spawn', path);
  return Promise.resolve();
});
const myFunctions = require('../index');
let storageObjectEvent = null;
describe('convert_to_avatar checks', () => {
  beforeAll(() => {
    global.origConsole = global.console;
  });
  beforeEach(() => {
    global.console = {
      log: jest.fn(msg => {
        // global.origConsole.log(msg);
      }),
      warn: jest.fn(msg => {
        // global.origConsole.warn(msg);
      })
    };
    storageObjectEvent = {
      data: {
        contentType: 'image/jpeg',
        mediaLink: '',
        name: '/some/path/to/an/existingimage.jpg',
        resourceState: 'exists',
        metageneration: 1,
      }
    };
  });
  afterAll(() => {
    global.console = global.origConsole;
  });

  test('Don\'t try to convert non-images', () => {
    storageObjectEvent.data.contentType = 'someNonImageType';
    const convert_promise = myFunctions.convert_to_avatar(storageObjectEvent);
    return convert_promise.then(data => {
      expect(data).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith('This is not an image.');
    });
  });

  test('Don\'t try to convert a thumbnail', () => {
    storageObjectEvent.data.contentType = 'image/svg';
    storageObjectEvent.data.name = '/some/path/to/an/thumb_existingimage.svg';
    const convert_promise = myFunctions.convert_to_avatar(storageObjectEvent);
    return convert_promise.then(data => {
      expect(data).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith('Already an SVG');
    });
  });

  test('Don\'t convert for metadata changes', () => {
    storageObjectEvent.data.metageneration = 2;
    const convert_promise = myFunctions.convert_to_avatar(storageObjectEvent);
    return convert_promise.then(data => {
      expect(data).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith('This is a metadata change event.');
    });
  });
});
