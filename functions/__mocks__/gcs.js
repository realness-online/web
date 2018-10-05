const download_mock = jest.fn(config => {
  // console.log(`download() called with ${config}`);
  return Promise.resolve(name);
})
// @google-cloud/storage mock needs to be in a separate file because of https://github.com/facebook/jest/issues/553
function bucketFn(bucketName) {
  // console.log(`Jest @google-cloud/storage.bucket called with ${bucketName}`);
  return {
    upload: jest.fn((tempFilePath, config) => {
      // console.log(`Jest @google-cloud/storage.bucket.upload called with ${tempFilePath} and config`, config);
      return config.destination;
    }),
    file: jest.fn(name => {
      // console.log(`Jest @google-cloud/storage.bucket.file() called with ${name}`);
      return {
        download: download_mock
      };
    })
  };
}

module.exports = options => {
  return {
    download_mock,
    bucket: bucketFn
  };
};

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
