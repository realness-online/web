exports.config = jest.fn(() => {
  console.log('Jest firebase functions.config being called');
  return {
    firebase: {
      databaseURL: 'https://not-a-project.firebaseio.com',
      storageBucket: 'not-a-project.appspot.com'
    }
  }
})

const functions = require('firebase-functions');
//
// functions.config = jest.fn(() => ({
//   firebase: {
//     credential: admin.credential.applicationDefault(),
//     databaseURL: 'https://not-a-project.firebaseio.com',
//     storageBucket: 'not-a-project.appspot.com'
//   }
// }));


// exports.storage = {
//   bucket: () => {
//     return {
//       object: () => {
//         return {
//           onFinalize: (object) => {}
//         }
//       }
//     }
//   }
// }

module.exports = functions
