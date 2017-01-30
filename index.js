// ==========================================================
// MongoMigrator - index.js
// Retrieve files from mongoDB and pipe to S3
// ==========================================================

'use strict';

// Utilities
var fs = require('fs'); // File system library
var moment = require('moment'); // Time/Date library
var _ = require("underscore");
var request = require("request");
var q = require("q"); // Q
var aws = require('aws-sdk');
var stream = require('stream');
var mongoose = require('mongoose');
var chalk = require('chalk');
var ProgressBar = require('progress');

// Config
var config = require(__dirname+'/config.json');

// S3
aws.config.update({accessKeyId: config.aws.accessKey, secretAccessKey: config.aws.secretKey});
var s3 = new aws.S3({signatureVersion: 'v4'});

// Defaults
var bar;
var i = 0;
var successes = 0;
var test = false;

// Collections
var collections = _.keys(config.collections);
if (collections.length == 0)
    return console.error(chalk.red('Did not find any collections in config.json.'));
else
    var collectionName = collections[0];

// Init Function
var init = function() {

    var options = {
        server: {
            socketOptions: {
                keepAlive: 300000,
                connectTimeoutMS: 30000
            },
            auto_reconnect: true
        },
        replset: {
            socketOptions: {
                keepAlive: 300000,
                connectTimeoutMS : 30000
            }
        }
    };

    var connection = mongoose.connection;

    connection.on('connecting', function() {
        console.log(chalk.grey('Connecting to MongoDB...'));
    });

    connection.on('error', function(error) {
        console.error(chalk.red('Error in MongoDb connection: ' + error));
        mongoose.disconnect();
        console.error(chalk.red('Did you check config.json?'));
    });

    connection.on('connected', function() {
        console.log(chalk.grey('MongoDB connected!'));
    });

    connection.once('open', function() {

        console.log(chalk.grey('MongoDB connection opened!'));

        if (_.keys(config.collections).length == 0)
            return console.error(chalk.red('Did not find any collections in config.json.'));

        console.log('\nMigrator Ready.'+
            chalk.grey('\n*Note*: Your MongoDB documents are not modified, only files found upload to your S3 bucket.')+
            '\nCollections in config.json: '+chalk.blue(_.keys(config.collections))+
            '\nRun with '+chalk.inverse('(y)')+' or test with '+chalk.inverse('(t)')+' (Testing skips S3 uploading)');

        process.stdin.setEncoding('utf8');
        process.stdin.on('data', function (text) {

            if ((text.toLowerCase() === 'y\n') || (text.toLowerCase() === 'yes\n')) {
                queryCollection(collectionName);
            }
            else if ((text.toLowerCase() === 'test\n') || (text.toLowerCase() === 't\n')) {
                test = true;
                queryCollection(collectionName);
            }
            else {
                console.log("Exiting...");
                process.exit();
            }
        });

    });

    mongoose.connect(config.mongoDB.uri, options);

    connection.on('error', function(err) {
        console.error(chalk.red('Error: Could not connect to MongoDB.') + err);
    });

    // Piping Function
    var pipeMedia = function(item, element, contentType) {

        var deferred = q.defer();

        i++;

        if (!item) {
            bar.tick({
                message : '*************** NOT FOUND *****************'
            });
            return deferred.resolve();
        }

        if (!item[element]) {
            bar.tick({
                message : item._id+' skipping ['+i+']'
            });
            return deferred.resolve();
        }

        if (test) {
            bar.tick({
                message : item._id+' testing ['+i+']'
            });
            return deferred.resolve();
        }

        var passThrough = function() {

            var pass = new stream.PassThrough();
            var buf = new Buffer('');

            pass.on('data', function(data) {
                buf = Buffer.concat([buf, data]);
            });

            pass.on('error', function(error) {
                console.error('Stream Error', JSON.stringify(error));
                deferred.resolve();
            });

            pass.on('finish', function(data) {

                var filename = item[element];

                var s3_params = {
                    Bucket: config.aws.s3_bucket,
                    Key: filename,
                    ContentType: contentType,
                    ACL: "public-read",
                    Body: buf
                };

                s3.putObject(s3_params, function (err, data) {

                    if (err)
                        console.log(err);

                    bar.tick({
                        message : item._id+' success ['+i+']'
                    });

                    buf = null;
                    pass = null;
                    s3_params = null;
                    item = null;
                    element = null;
                    contentType = null;
                    successes++;

                    deferred.resolve();
                });

            });

            return pass;
        };

        request({url: config.fileBaseUrl+item[element]}).on('error', function(error) {
            console.error('Pipe Error', JSON.stringify(error));
            deferred.resolve();
        }).pipe(passThrough());

        return deferred.promise;
    };

    // Query Function
    var queryCollection = function(collectionName) {

        connection.db.collection(collectionName, function(err, collection){

            console.log(chalk.cyan('\nQuerying '+collectionName+'...'));

            var projection = config.projection;

            collection.find({}, projection).toArray(function(err, data){

                console.log(chalk.cyan('Done. Obtained '+data.length+' Documents'));

                if (err)
                    console.log(err);

                // Add multiplier for items
                var total = data.length * _.keys(config.collections[collectionName]).length;

                bar = new ProgressBar(' Processing '+data.length+': [:bar] :percent :etas :message', {
                    complete: '!',
                    incomplete: ' ',
                    width: 50,
                    total: total
                });

                function process(data) {

                    var p = q(); // Promise.resolve() without Q

                    data.forEach(function(item) {
                        p = p.then(function() {

                            return q.allSettled(_.map(_.keys(config.collections[collectionName]), function(element) {
                                return pipeMedia(item, element, config.collections[collectionName][element].mimeType);
                            }));

                        });
                    });

                    return p;
                }

                process(data).then(function() {

                    console.log(chalk.cyan('Done. Processed '+collectionName+' and found:\n   ')
                        +chalk.blue(data.length)+' Documents\n   '
                        +chalk.blue(total)+' Files\n   '
                        +chalk.blue(successes)+' Successful Saves');

                    successes = 0;
                    i = 0;

                    if ((collections.indexOf(collectionName)+1) < (collections.length)) {
                        collectionName = collections[collections.indexOf(collectionName)+1];
                        queryCollection(collectionName);
                    }
                    else {
                        console.log('\n\nAll Done. Press CTRL+C to Exit.');
                    }

                });

            })
        });

    };

};

init(collectionName);

// EOF