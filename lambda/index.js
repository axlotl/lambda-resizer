'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3();
const Sharp = require('sharp');

const BUCKET = process.env.BUCKET;

const URL = process.env.URL;
function iterate(obj) {
    for (var property in obj) {
        if (obj.hasOwnProperty(property)) {
            if (typeof obj[property] == "object"){
              console.log( 'ITERATING: ' + property );
                iterate(obj[property]);
            } else {
              console.log('***' + property + "   " + obj[property]);              
            }
                
        }
    }
}

exports.handler = function(event, context, callback) {

  // iterate( event );
  const key = event.queryStringParameters.key;
  console.log( 'KEY: ' + key);
  const match = key.match(/([a-z0-9\-]+)\/(\d+)?x(\d+)?(.*)/);
  const prefix = match[1];
  const width = match[2] ? parseInt(match[2], 10) : null;  
  const height = match[3] ? parseInt(match[3], 10) : null;
  const extension = match[4];
  const originalKey = prefix + '/full' + extension;
  console.log('bucket: ' + BUCKET);
  console.log( 'originalKey: ' + originalKey);



  const imageType = extension.split('.').pop();
  
  const newKey = prefix + '/' + ((width === null) ? '' : width) + 'x' + ((height === null) ? '' : height) + '.' + imageType;
  console.log( 'newKey ', newKey);

  S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
    .then(data => Sharp(data.Body)
      .resize(width, height)
      .toFormat(imageType)
      .toBuffer()
    )
    .then(buffer => S3.putObject({
        Body: buffer,
        Bucket: BUCKET,
        ContentType: 'image/' + imageType,
        Key: newKey,
      }).promise()
    )
    .then(() => callback(null, {
        statusCode: '301',
        headers: {'location': `${URL}/${newKey}`},
        body: '',
      })
    )
    .catch(err => callback(err))
}
