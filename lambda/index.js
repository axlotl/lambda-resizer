'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3();
const Sharp = require('sharp');
const BUCKET = process.env.BUCKET;
const URL = process.env.URL;

exports.handler = function(event, context, callback) {

  const key = event.queryStringParameters.key;
  // const match = key.match(/[^/]+\/([a-z0-9\-]+)\/(\d+)?x(\d+)?(.*)/);
  const match = key.match(/[^/]+\/([a-z0-9\-]+)\/(\d+|full)?x?(\d+)?(.*)/);
  console.log( match );
  const prefix = match[1];
  const extension = match[4];  
  const mediaType = extension.split('.').pop().toLowerCase();
  let newKey = null;
  const originalKey = prefix + '/full' + extension;
  let contentType = null;
  let isImage = false;

  switch(mediaType) {
    case 'jpeg':
    case 'jpg':
    case 'png':
      contentType = 'image/' + mediaType;
      isImage = true;
      break;

    case 'mp4':
    case 'webm':
    case 'ogg':
      contentType = 'video/' + mediaType;
      isImage = false;
      break;

    default:
      //BARF LATER
      break;
  }

  if(!isImage) {
    newKey = 'sized/' + prefix + '/full.' + mediaType;  
    console.log('inside "video" match', originalKey, newKey);
    S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
    .then(data => S3.putObject({
        Body: data.Body,
        Bucket: BUCKET,
        ContentType: contentType,
        Key: newKey,
        // ACL : 'public-read',
        CacheControl : 'public,max-age=31536000,immutable'
      }).promise()
    )
    .then(() => callback(null, {
        statusCode: '301',
        headers: {
          'Cache-Control': 'private, max-age=0, no-cache, no-store',
          'location': `${URL}/${newKey}`
        },
        body: ''
      })
    )
    .catch(err => callback(err))

  } else {

    let newKey = null;
    let width = null;
    let height = null;

    //WIDTH NEEDS TO HANDLE 'full' STRING AND NOT RESIZE JUST RESAVE
    if( match[2] === 'full' ){
      console.log('inside "full" match');
      width = null;
      newKey = 'sized/' + prefix + '/full.' + mediaType;  
    } else {
      console.log( 'we got dimension(s)');
      width = match[2] ? parseInt(match[2], 10) : null;  
      height = match[3] ? parseInt(match[3], 10) : null;
      newKey = 'sized/' + prefix + '/' + ((width === null) ? '' : width) + 'x' + ((height === null) ? '' : height) + '.' + mediaType;  
    }

    
    console.log('bucket: ' + BUCKET);
    console.log( 'originalKey: ' + originalKey);
    
    console.log( 'newKey ', newKey);

    S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
      .then(data => Sharp(data.Body)
        .resize(width, height)
        .toFormat(mediaType)
        .toBuffer()
      )
      .then(buffer => S3.putObject({
          Body: buffer,
          Bucket: BUCKET,
          ContentType: 'image/' + mediaType,
          Key: newKey,
          // ACL : 'public-read',
          CacheControl : 'public,max-age=31536000,immutable'
        }).promise()
      )
      .then(() => callback(null, {
          statusCode: '301',
          headers: {
            'Cache-Control': 'private, max-age=0, no-cache, no-store',
            'location': `${URL}/${newKey}`
          },
          body: ''
        })
      )
      .catch(err => callback(err))

    }
}
