'use strict'
const fs = jest.genMockFromModule('fs')
const readFile_mock =  jest.fn((file, content_type, callback) => {
  // console.log(`file:${file}`, `content_type:${content_type}`)
  callback()
})
// fs.writeFileSync(locals.avatar, result.data)
const writeFileSync_mock = jest.fn((file, data) => {
  // console.log('inside writeFileSync_mock', file, data)
  return true
});
fs.readFile = readFile_mock
fs.writeFileSync = writeFileSync_mock
module.exports = fs
