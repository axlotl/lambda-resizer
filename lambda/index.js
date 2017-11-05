'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3();
const Sharp = require('sharp');

const BUCKET = process.env.BUCKET;

const URL = process.env.URL;

exports.handler = function(event, context, callback) {
  const key = event.queryStringParameters.key;
  const match = key.match(/([^\/]+)\/(\d+)x(\d+)\/(.*)/);
  const prefix = match[1];
  const width = parseInt(match[2], 10);
  const height = parseInt(match[3], 10);
  const originalKey = prefix + '/' + match[4];
  console.log('bucket: ' + BUCKET);
  console.log( 'originalKey: ' + originalKey);



  const imageType = match[4].split('.').pop();
  const newKey = prefix + '/' + width + 'x' + height + '.' + imageType;
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
