const functions = require('firebase-functions');
const gcs = require('@google-cloud/storage')();

// on file upload to google cloud storage
exports.fileUploaded = functions.storage.object().onChange(event => {

  const object = event.data; // the object that was just uploaded
  const bucket = gcs.bucket(object.bucket);
  const signedUrlConfig = { action: 'read', expires: '03-17-2025' }; // this is a signed url configuration object

  var fileURLs = []; // array to hold all file urls

  // just for example. ideally you should get this from the object that is uploaded for this to be a better function :)
  // so that you can calculate the size of the folder it's uploaded to, and do something with it etc.
  const folderPath = "people/";

  bucket.getFiles({ prefix: folderPath }, function(err, files) {
    // files = array of file objects
    // not the contents of these files, we're not downloading the files.

    files.forEach(function(file) {
      file.getSignedUrl(signedUrlConfig, function(err, fileURL) {
        console.log(fileURL);
        fileURLs.push(fileURL);
      });
    });

  });

});
