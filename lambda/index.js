'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3();
const Sharp = require('sharp');
const BUCKET = process.env.BUCKET;
const URL = process.env.URL;
// const imagemin = require('imagemin');
// const imageminJpegtran = require('imagemin-jpegtran');
// const imageminPngquant = require('imagemin-pngquant');

exports.handler = function(event, context, callback) {

  const key = event.queryStringParameters.key;
  
  // const match = key.match(/[^/]+\/([a-z0-9\-]+)\/(\d+)?x(\d+)?(.*)/);

  let match;
  if( key.match(/\/direct-uploads\//) ) {
    match = key.match( /(\/direct-uploads\/)([a-z0-9\-]+)\/(\d+|full)?x?(\d+)?(.*)/ );
  } else {
    match = key.match(/[^/]+\/([a-z0-9\-]+)\/(\d+|full)?x?(\d+)?(.*)/);
  }
  console.log( 'MATCH: ' , match );
  
  let prefix;
  let extension;
  let originalKey;
  let newKey;
  let mediaType;
  let width = null;
  let height = null;

  if( match[1] === '/direct-uploads/' ){
    console.log( 'it\'s a direct upload');
    /*
    * here, prefix is the original uniqueid()-generated filename
    */
    prefix = match[2];
    width = match[3] === undefined ? null : parseInt( match[3] );
    height = match[4] === undefined ? null : parseInt( match[4] );
    extension = match[5];
    originalKey = 'direct-uploads/' + prefix + extension;
    if( width || height ){
      newKey = 'sized/direct-uploads/' + prefix + '/' + ((width === null) ? '' : width) + 'x' + ((height === null) ? '' : height)  + extension;    
    } else {
      width = null;
      newKey = 'sized/direct-uploads/' + prefix + '/full'  + extension;  
    }
    
    mediaType = extension.split('.').pop().toLowerCase();
  } else {

    /*
    * here, prefix is the s3 bucket's "sub-folder"
    */
    prefix = match[1];
    extension = match[4];
    originalKey = prefix + '/full' + extension;
    mediaType = extension.split('.').pop().toLowerCase();

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
  }


  
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

    console.log('bucket: ' + BUCKET);
    console.log( 'originalKey: ' + originalKey);
    console.log( 'newKey ', newKey);

    S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
      .then(data => Sharp(data.Body)
        .resize(width, height)
        .toFormat(mediaType)
        .toBuffer()
      )
      /*
      // image optimization
      .then( buffer => imagemin( [buffer], null, {
        plugins : [
          imageminJpegtran(),
          imageminPngquant({quality: '65-80'})
        ]
      })).then( files => {
        console.log( 'files: ', files )
      })*/


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
