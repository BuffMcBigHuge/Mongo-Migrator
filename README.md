```

  __  __  ___  _   _  ____  ___                 
 |  \/  |/ _ \| \ | |/ ___|/ _ \                
 | |\/| | | | |  \| | |  _| | | |               
 | |  | | |_| | |\  | |_| | |_| |               
 |_|  |_|\___/|_| \_|\____|\___/____ ___  ____  
 |  \/  |_ _/ ___|  _ \    / \|_   _/ _ \|  _ \ 
 | |\/| || | |  _| |_) |  / _ \ | || | | | |_) |
 | |  | || | |_| |  _ <  / ___ \| || |_| |  _ < 
 |_|  |_|___\____|_| \_\/_/   \_\_| \___/|_| \_\
                                                
    VERSION 1.0
    
    Marco Tundo MASc., BASc.
    marco@bymar.co
    
```

## Introduction

This node application pulls collections from an existing mongoDB, and pulls file urls found in denoted fields (config.json). It then pipes the files into an S3 bucket. The mongoDB is not modified.
 
This project's original purpose was to migrate ParseFiles from the Parse.com S3 bucket to a self-hosted S3 bucket.

## Requirements

+ [Node.js](https://nodejs.org/en/)
+ [MongoDB](https://www.mongodb.com/)
+ [Amazon Web Services](https://aws.amazon.com)

## Start

Create an S3 bucket in AWS, and retrieve IAM details to upload to the bucket.



Download and extract Mongo Migrator. Modify config.json by inputting your AWS credentials, desired database collections, fields, and mimetype.

Open terminal and run:

```
npm install
node index
```

## Notes
You can easily modify the url path in Mongo by saving the document before calling `deferred.resolve()` in `s3.putObject`. 

Make sure the filename you set in S3 matches the one stored in the document.

```
var pid = '10000' + parseInt(Math.random() * 10000000);
var s3_params = {
    Bucket: config.aws.s3_bucket,
    Key: pid,
    ContentType: contentType,
    ACL: "public-read",
    Body: buf
};
```

```
item[element] = pid;
// or you can store the absolute url
// item[element] = "https://" + config.aws.s3_bucket + ".s3.amazonaws.com/" + pid;
item.save().then(function(err, item) {
    deferred.resolve();
};
```

## Resources
+ [Mongoose](http://mongoosejs.com/)
+ [Underscore.js](http://underscorejs.org/)
+ [Q](https://github.com/kriskowal/q)

## Licence
[MIT](LICENSE)

EOF