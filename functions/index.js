
const functions = require('firebase-functions');
const {Storage} = require('@google-cloud/storage');
const storage = new Storage();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

// const fileBucket = image.bucket; // The Storage bucket that contains the file.
// const filePath = image.name; // File path in the bucket.
// const contentType = image.contentType; // File content type.
// const metageneration = image.metageneration; // Number of times metadata has been generated. New objects have a value of 1.
// const bucket = gcs.bucket('/people');
// const tempFilePath = path.join(os.tmpdir(), fileName);
// const metadata = {
//   contentType: image.contentType,
// };
// const fileName = path.basename(filePath);


/**
 * When an image is uploaded in the Storage bucket We generate a thumbnail automatically using
 * ImageMagick.
 */
exports.convert_to_avatar = functions.storage.object().onFinalize((image) => {
  if (!image.contentType.startsWith('image/')) {
    console.log('This is not an image.');
    return null;
  }
  const convert_to_avatar = new ConvertToAvatar(image)
  convert_to_avatar.download().convert().trace().upload().cleanup()
});

  // const working_image = path.join(os.tmpdir(), path.basename(image.name))
  // return storage.bucket('/people').file(image.name).download({
  //   destination: working_image
  // }).then(() => {
  //   image_as_file = working_image.replace(/\.[^/.]+$/, "")  // https://stackoverflow.com/questions/39007908/filename-without-extension-terminology
  //   return spawn('convert', [working_image, '-resize', '128x128>', `${image_as_file}.pnm`]);
  // }).then(() => {
  //   return storage.bucket('/people').upload(working_image, {
  //     destination: thumbFilePath,
  //     metadata:  {contentType: 'image/svg' }
  //   });
  //   // Once the thumbnail has been uploaded delete the local file to free up disk space.
  // })

  // Download file from bucket.
  // return bucket.file(filePath).download({
  //   destination: tempFilePath,
  // }).then(() => {
  //   console.log('Image downloaded locally to', tempFilePath);
  //   // Generate a thumbnail using ImageMagick.
  //   return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', tempFilePath]);
  // }).then(() => {
  //   console.log('Thumbnail created at', tempFilePath);
  //   // We add a 'thumb_' prefix to thumbnails file name. That's where we'll upload the thumbnail.
  //   const thumbFileName = `thumb_${fileName}`;
  //   const thumbFilePath = path.join(path.dirname(filePath), thumbFileName);
  //   // Uploading the thumbnail.
  //   return bucket.upload(tempFilePath, {
  //     destination: thumbFilePath,
  //     metadata: metadata,
  //   });
  //   // Once the thumbnail has been uploaded delete the local file to free up disk space.
  // }).then(() => fs.unlinkSync(tempFilePath));
