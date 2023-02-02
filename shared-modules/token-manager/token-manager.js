'use strict';

// Declare library dependencies);
const request = require('../../node_modules/request');
const async = require('../../node_modules/async');
const AWS = require('aws-sdk');
const jwtDecode = require('../../node_modules/jwt-decode');

//Configure Environment
const configModule = require('../config-helper/config.js');
var configuration = configModule.configure(process.env.NODE_ENV);

//Configure Logging
const winston = require('../../node_modules/winston');
winston.level = configuration.loglevel;

// TODO: replace temporary cache with real cache
var tokenCache = {};

/**
 * Extract an id token from a request, decode it and extract the tenant
 * id from the token.
 * @param req A request
 * @returns A tenant Id
 */
module.exports.getTenantId = function(req) {
    var tenantId = '';
    var bearerToken = '';
    if(req.headers.Authorization != undefined){
        bearerToken = req.headers.Authorization
    }else {
        bearerToken = req.get('Authorization');
    }
    if (bearerToken) {
        bearerToken = bearerToken.substring(bearerToken.indexOf(' ') + 1);
        var decodedIdToken = jwtDecode(bearerToken);
        if (decodedIdToken)
            tenantId = decodedIdToken['custom:tenant_id'];
    }
    return tenantId;
}

/**
 * Extract an id token from a request, decode it and extract the user role
 * id from the token.
 * @param req A request
 * @returns A role
 */
module.exports.getUserRole = function(req, callback) {
    var bearerToken = req.get('Authorization');
    if (bearerToken) {
        bearerToken = bearerToken.substring(bearerToken.indexOf(' ') + 1);
        var decodedIdToken = jwtDecode(bearerToken);
        if (decodedIdToken)
            callback(decodedIdToken['custom:role']);
        else
            callback('unkown');
    }
}


/**
 * Decode and token and extract the user's full name from
 * the token.
 * @param idToken A bearer token
 * @returns The user's full name
 */
module.exports.getUserFullName = function(idToken) {
    var userFullName = '';
    if (idToken) {
        var decodedIdToken = jwtDecode(idToken);
        if (decodedIdToken)
            userFullName = {'firstName': decodedIdToken.given_name, 'lastName': decodedIdToken.family_name};
    }
    return userFullName;
}

/**
 * Get the authorization token from a request
 * @param req The request with the authorization header
 * @returns The user's email address
 */
module.exports.getRequestAuthToken = function(req) {
    authToken = '';
    var authHeader = req.get('Authorization');
    if (authHeader)
        var authToken = authHeader.substring(authHeader.indexOf(' ') + 1);
    return authToken;
}


/**
 * Decode and token and extract the token
 * @param bearerToken A bearer token
 * @returns The user's full name
 */
 module.exports.decodeToken = function (bearerToken) {
    return new Promise((resolve, reject) => {
        try {
            if (bearerToken) {
                var decodedIdToken = jwtDecode(bearerToken);
                if (decodedIdToken){
                    let listUserURL = configuration.url.acm+'/v1/users?UserAccessControlUsername='+decodedIdToken.email;
                    request({
                        url: listUserURL,
                        method: "GET",
                        json: true,
                        headers: {
                            "content-type": "application/json",
                            "Authorization": bearerToken,
                        }
                    }, function (error, response, body) {
                        if (!error && response.statusCode === 200) {
                            if (typeof(body) === 'object' && body.length > 0) {
                                var resultToken = {};
                                let userLinkedEmployee = body[0].UserAccessControlLinkedEmployee;
                                resultToken =  Object.assign(decodedIdToken, userLinkedEmployee)
                                resolve(resultToken)
                            }
                        }
                        else {
                            reject("Promise decode token was rejected")
                        }
                    });
                }
            }
        } catch(err){
            reject(err)
        }
    })
}

/**
 * Decode token and validate access
 * @param bearerToken A bearer token
 * @returns The users access is provided
 */
module.exports.checkRole = function(bearerToken) {
    var resultToken = {};
    if (bearerToken) {
        var decodedIdToken = jwtDecode(bearerToken);
        if (decodedIdToken)
            var resultToken = decodedIdToken['custom:role'];
    }
    return resultToken;

}

/**
 * Decode and token and extract the token
 * @param bearerToken A bearer token
 * @returns The user's full name
 */
module.exports.decodeOpenID = function(bearerToken) {
    var resultToken = {};
    if (bearerToken) {
        var decodedIdToken = jwtDecode(bearerToken);
        if (decodedIdToken)
            resultToken = decodedIdToken;
    }
    return resultToken;
}

/**
 * Get access credential from the passed in request
 * @param req A request
 * @returns The access credentials
 */
function getCredentialsFromToken(req, updateCredentials) {
    var bearerToken;
    if(req.headers.Authorization != undefined){
        bearerToken = req.headers.Authorization
    }else {
        bearerToken = req.get('Authorization');
    }
    // console.log(">>>>> getCredentialsFromToken: ", bearerToken);
    if (bearerToken) {
        var tokenValue = bearerToken.substring(bearerToken.indexOf(' ') + 1);
        var decodedIdToken = jwtDecode(tokenValue);
        var userName = decodedIdToken['cognito:username'];
        if (!(tokenValue in tokenCache)) {
            // console.log("Username: "+userName);
            async.waterfall([
                function(callback) {
                    getUserPoolWithParams(userName, callback)
                },
                function(userPool, callback) {
                    authenticateUserInPool(userPool, tokenValue, callback)
                }
            ], function(error, results) {
                if (error) {
                    winston.error('Error fetching credentials for user')
                    updateCredentials(null);
                }
                else {
                    tokenCache[tokenValue] = results;
                    updateCredentials(Object.assign(tokenCache[tokenValue], {'userId': userName}))
                }
            });
        }
        else if (tokenValue in tokenCache) {
            // winston.debug('Getting credentials from cache');
            updateCredentials(Object.assign(tokenCache[tokenValue], {'userId': userName}));
        }
    }
};
module.exports.getCredentialsFromToken = getCredentialsFromToken

/**
 * Lookup the user pool from a user name
 * @param user The username to lookup
 * @param callback Function called with found user pool
 */
module.exports.getUserPool = function(userName, callback) {
    // Create URL for user-manager request
    // var userURL = userURL + '/system/' + userName;
    var userURL   = configuration.url.user + '/pool/' + userName;
    // winston.debug(">>>>> configuration.url.user: " + configuration.url.user);
    // winston.debug(">>>>> userURL: " + userURL);
    request({
        url: userURL,
        method: "GET",
        json: true,
        headers: {
            "content-type": "application/json",
        }
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(null, body);
        }
        else {
            if (!error) {
                var lookupError = new Error("Failed looking up user pool: " + response.body.Error);
                callback(lookupError, response);
            }
            else {
                callback(error, response)
            }
        }
    });
}

/**
 * Lookup the user pool from a user name
 * @param user The username to lookup
 * @param idToken Identity token
 * @return params object with user pool and idToken
 */
function getUserPoolWithParams(userName, callback) {

    var userURL   = configuration.url.user + '/pool/' + userName;
    // var userURL   = 'http://127.0.0.1:3001/user' + '/pool/' + userName;
    // console.log(">>>>> token-manager.js, userURL: "+userURL);
    // fire the request
    request({
        url: userURL,
        method: "GET",
        json: true,
        headers: {
            "content-type": "application/json",
        }
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            // winston.debug(">>>>> token-manager.js, body: ", body);
            callback(null, body);
        }
        else {
            callback(null, "Error loading user: " + error);
        }
    });
}

/**
 * Lookup the user pool from a user name
 * @param user The username to lookup
 * @param callback Function called with found user pool
 */
module.exports.getInfra = function(input, callback) {
    // Create URL for user-manager request
    // var userURL = userURL + '/system/' + userName;
    var tenantsUrl   = configuration.url.tenant + 's/system/';
    // console.log(tenantsUrl);
    request({
        url: tenantsUrl,
        method: "GET",
        json: true,
        headers: {
            "content-type": "application/json",
        }
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(null, body);
        }
        else {
            if (!error) {
                var lookupError = new Error("Failed looking up infra: " + response.body.Error);
                callback(lookupError, response);
            }
            else {
                callback(error, response)
            }
        }
    });
}

/**
 * Perform an HTTP Request
 * @param protocol sring
 * @param domain string
 * @param path string
 * @param method string
 * @param headers json object
 * @param json true/false
 * @return Fire off request and return result
 */
module.exports.fireRequest = function(event, callback) {

    var protocol = event.protocol;
    var path = event.path;
    var delimiter = '://';
    var domain = event.domain;
    var url = protocol + delimiter + domain + path;
    // fire the request
    request({
        url: url,
        method: event.method,
        json: true,
        headers: {
            "content-type": "application/json",
        }
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body);
        }
        else {
            callback(null, 'Error making request. \nError: ' + error);
        }
    });
};



/**
 * Authenticate the user in the user pool
 * @param userPool The pool to use for authentication
 * @param idToken The id token for this session
 * @param callback The callback for completion
 */
function authenticateUserInPool(userPool, idToken, callback) {
    // winston.debug('userPool: ', userPool);
    // winston.debug('idToken: ', idToken);
    var decodedIdToken = jwtDecode(idToken);
    var provider = decodedIdToken.iss;
    provider = provider.replace('https://', '');
    var params = {
        token: idToken,
        provider: provider,
        IdentityPoolId: userPool.IdentityPoolId
    }
    // winston.debug('>>>>> token-manager.js, params: ', params);
    var getIdentity = getId(params, function (ret, data) {
        if (ret) {
            var params = {
                token: idToken,
                IdentityId: ret.IdentityId,
                provider: provider
            }
            var returnedIdentity = ret;
            var getCredentials = getCredentialsForIdentity(params, function (ret, data) {
                if (ret) {
                    var returnedCredentials = ret;
                    // put claim and user full name into one response
                    // console.log('Credentials: ', {"claim": returnedCredentials.Credentials})
                    callback(null, {"claim": returnedCredentials.Credentials});
                }
                else {
                    winston.error('ret');
                }
            })
        }
        else {
            winston.error('ret');
        }
    })
}

/**
 * Get AWS Credentials with Cognito Federated Identity and ID Token
 * @param IdentityPoolId The Identity Pool ID
 * @param idToken The id token for this session
 * @param callback The callback for completion
 */
function getCredentialsForIdentity(event, callback) {
    var cognitoidentity = new AWS.CognitoIdentity({apiVersion: '2014-06-30',region: configuration.aws_region});
    var params = {
        IdentityId: event.IdentityId, /* required */
        //CustomRoleArn: 'STRING_VALUE',
        Logins: {
            [event.provider]: event.token,
            /* '<IdentityProviderName>': ... */
        }
    };
    cognitoidentity.getCredentialsForIdentity(params, function (err, data) {
        if (err) {
            // winston.debug(err, err.stack);
            callback(err);
        }
        else {
            callback(data);
        }
    });
};

/**
 * Get Cognito Federated identity
 * @param IdentityPoolId The Identity Pool ID
 * @param AccountId The AWS Account Number
 * @param Logins Provider Map Provider : ID Token
 */
function getId (event, callback) {
    // winston.debug("event: ", event);
    var cognitoidentity = new AWS.CognitoIdentity({apiVersion: '2014-06-30',region: configuration.aws_region});
    var params = {
        IdentityPoolId: event.IdentityPoolId, /* required */
        AccountId: configuration.aws_account,
        Logins: {
            [event.provider]: event.token,
            /* '<IdentityProviderName>': ... */
        }
    };
    // winston.debug('params: ', params);
    cognitoidentity.getId(params, function (err, data) {
        if (err) {
            // winston.debug(err, err.stack);
            callback(err);
        }
        else {
            callback(data);
        }
    });
};

/**
 * Perform an HTTP Request
 * @param protocol sring
 * @param domain string
 * @param path string
 * @param method string
 * @param headers json object
 * @param json true/false
 * @return Fire off request and return result
 */
function fireRequest(event, callback) {

    var protocol = event.protocol;
    var path = event.path;
    var delimiter = '://';
    var domain = event.domain;
    var url = protocol + delimiter + domain + path;
    // fire the request
    request({
        url: url,
        method: event.method,
        json: true,
        headers: {
            "content-type": "application/json",
        }
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body);
        }
        else {
            callback(null, 'Error making request. \nError: ' + error);
        }
    });
};

module.exports.getSystemCredentials = function(callback) {
        var sysCreds = '';
        var sysConfig = new AWS.Config();
        // winston.debug('sysConfig object: ', sysConfig);
        // Loads credentials from the configuration object. This is used internally by the SDK
        sysConfig.getCredentials(function(err) {
            if (err) {
                callback(err.stack);
                // winston.debug('Unable to Obtain Credentials');
            } // credentials not loaded
            else{
                var tempCreds = sysConfig.credentials;
                if (tempCreds.metadata == undefined || tempCreds.metadata == null){
                    var credentials = {"claim": tempCreds};
                    // console.log(">>>>> token-manager.js, tempCreds: ", credentials);
                    callback(credentials);
                }
                else {
                    sysCreds = {
                        SessionToken: tempCreds.metadata.Token,
                        AccessKeyId: tempCreds.metadata.AccessKeyId,
                        SecretKey: tempCreds.metadata.SecretAccessKey,
                        Expiration: tempCreds.metadata.Expiration,
                    }
                    var credentials = {"claim": sysCreds};
                    // console.log(">>>>> token-manager.js, sysCreds: ", credentials);
                    callback(credentials);
                }

            }
        })

}
