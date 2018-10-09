const download_mock = jest.fn(config => {
  // console.log(`download() called with ${config}`);
  return Promise.resolve(name)
})

const upload_mock = jest.fn((tempFilePath, config) => {
  // console.log(`Jest @google-cloud/storage.bucket.upload called with ${tempFilePath} and config`, config);
  return Promise.resolve(config.destination)
})

const file_mock = jest.fn(name => {
  // console.log(`Jest @google-cloud/storage.bucket.file() called with ${name}`);
  return {
    download: download_mock
  }
})

function bucketFn(bucketName) {
  // console.log(`Jest @google-cloud/storage.bucket called with ${bucketName}`);
  return {
    upload: upload_mock,
    file: file_mock
  }
}
module.exports = options => {
  return {
    download_mock,
    upload_mock,
    file_mock,
    bucket: bucketFn
  }
}
