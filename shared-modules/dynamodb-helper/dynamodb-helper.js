'use strict';

// Declare library dependencies
const AWS = require('../../node_modules/aws-sdk');
const { v4: uuidv4 } = require('../../node_modules/uuid');
const path = require('path')
var s3Client = new AWS.S3();
// Declare shared modules
const tokenManager = require('../token-manager/token-manager.js');

//Configure Environment
const configModule = require('../config-helper/config.js');
var configuration = configModule.configure(process.env.NODE_ENV);

//Configure Logging
const winston = require('../../node_modules/winston');
winston.level = configuration.loglevel;

const SYSTEM_ADMIN_TENANT_ID = process.env["SYSTEM_ADMIN_TENANT_ID"];
const SYSTEM_RESOURCE_TABLE_PREFIX = process.env["SRM_TABLE"];

var tableSchema;

/**
 * Constructor function
 * @param tableDefinition The defintion of the table being used
 * @param configSettings Configuration settings
 * @constructor
 */
function DynamoDBHelper(tableDefinition, credentials, configSettings, callback) {
    tableSchema = tableDefinition;
    this.credentials = credentials
    this.tableDefinition = tableDefinition;
    this.tableExists = true;
    // console.log('Credentail in contructor Dynamodb helper: ', this.credentials)
    // console.log(">>>>> From DynamoDBHelper constructor:");
    // console.log(">>>>> tableDefinition: ", this.tableDefinition);
}

/**
 * If the request is to retrieve SaaS system resources, override the current tenant Id by System Admin tenant
 * @return boolval
 */
function isSystemResourceData(){
    // console.log('Env. variable NODE_ENV: ', process.env["NODE_ENV"]);
    // console.log('Env. variable SYSTEM_ADMIN_TENANT_ID: ', process.env["SYSTEM_ADMIN_TENANT_ID"]);
    // console.log('Env. variable TENANT_TABLE: ', process.env["TENANT_TABLE"]);
    // console.log('Env. variable SRM_TABLE: ', process.env["SRM_TABLE"]);
    // If the request is to retrieve SaaS system resources, override the current tenant Id by System Admin tenant
    let systemResource = (tableSchema.TableName) === (SYSTEM_RESOURCE_TABLE_PREFIX);
    return systemResource || systemResource === 0;
}

/**
 * Get a full key for a new S3 object to be created under a tenant
 * @return String
 */
function getS3ObjectKey(req, prefix){
    prefix = getS3ObjectPrefix(req, prefix);
    let key = uuidv4();
    return prefix+key;
}

/**
 * Get the prefix for S3 objects under a tenant
 * @return String prefix
 */
function getS3ObjectPrefix(req, prefix){
    let tenantId = tokenManager.getTenantId(req);
    return tenantId+'/'+process.env.SERVICE_NAME+'/'+prefix+'/';
}

/**
 * Get entityItemId
 * @param entityName The entity name
 * return entityItemId  
 */
function getEntityItemId(entityName){
    var entityItemId = entityName + ":" + uuidv4();
    entityItemId = entityItemId.split('-').join('');
    return entityItemId;
}

/**
 * Create another variant of a give attribute value with 1st letter's case opposite to each other
 * @param String: Given data
 * @param Integer: Param order
 * @return list of $placeholderUppercase, $placeholderLowercase, $attValueUppercase, $attValueLowercase
 */
function getFirstCharUppercaseLowercase(paramOrder, attributeValue){
    var result = [];
    result.placeholderUppercase = ':placeholderUppercase' + paramOrder;
    result.placeholderLowercase = ':placeholderLowercase' + paramOrder;
    result.attValueUppercase = attributeValue.toUpperCase();
    result.attValueLowercase = getFirstCharLowercase(attributeValue);
    return result;
}

/**
 * Make a string's first character lowercase
 * @param String: $word
 * @return String with first character lowercase
 */
 function getFirstCharLowercase(attributeValue){    
    var attValueArr = attributeValue.split('-').join('');
    attValueArr = attributeValue.split(' ');
    var attValueLowercase = [];
    attValueArr.forEach(word => {
        attValueLowercase.push(word.toLowerCase());
    });
    attValueLowercase = attValueLowercase.join(' ');
    return attValueLowercase;
}

/**
 * To transform data
 * @param {*} req obj
 * @param {*} dataToTransform array
 * @param {*} keyToTransform string
 * @param {*} idToTransform string
 * @param {*} keyName string
 * @param {*} filter obj
 * return data tramsformed
 */
DynamoDBHelper.prototype.transform = async function (req, dataToTransform, keyToTransforms){
    let tramsformed = {};

    for (let n = 0; n < keyToTransforms.length; n++) {
        // Retrieve key to transform
        let keyToTransform = keyToTransforms[n];
        let idToTransform = dataToTransform[keyToTransform];
        // Delete key to transform
        delete dataToTransform[keyToTransform];
        // get object for keyToTransform
        if(idToTransform){
            let obj = await this.aimlSvcRetrieveItemV2(req, idToTransform);
            if(obj && obj.hasOwnProperty('EntityItemId')){
                obj.Id = obj.EntityItemId;
                // get EntityPrefix
                let entityPrefix = obj.EntityItemId.split(":");
                let keyName = entityPrefix[0];
                // Delete some attributes
                delete obj.CreatedAt;
                delete obj.CreatedBy;
                delete obj.UpdatedAt;
                delete obj.UpdatedBy;
                delete obj.TenantId;
                delete obj.TenantResourceId;
                delete obj.Resource;
                delete obj.EntityItemId;
                tramsformed[keyName] = obj;
            }
            Object.assign(dataToTransform, tramsformed);
        }
    }
    return dataToTransform;
}

/**
 * Filter key in object
 * @param {*} dataToTransform array
 * @param {*} filter object
 * @returns array
 */
function filterAfterTransform(dataToTransform, filter){
    let dataFilteredArr = [];
    if(filter && Object.keys(filter).length > 0){
        let keys = Object.keys(filter);
        for (let j = 0; j < keys.length; j++) {
            let path = keys[j];
            let values = filter[path];
            let splitAttNames = path.split('.');
            if(Array.isArray(values)){
                for (let k = 0; k < values.length; k++) {
                    let value = values[k];
                    for (let l = 0; l < dataToTransform.length; l++) {
                        let item = dataToTransform[l];
                        if(splitAttNames.length == 2){
                            if(item[splitAttNames[0]]){
                                if(item[splitAttNames[0]][splitAttNames[1]] == value){
                                    dataFilteredArr.push(item)
                                }
                            }
                        }
                    }
                }
            }else {
                for (let m = 0; m < dataToTransform.length; m++) {
                    let item = dataToTransform[m];
                    if(splitAttNames.length == 2){
                        if(item[splitAttNames[0]]){
                            if(item[splitAttNames[0]][splitAttNames[1]] == values){
                                dataFilteredArr.push(item)
                            }
                        }
                    }
                }
            }
        }
    }
    return dataFilteredArr;
}

/**
 * Get all the Item
 * @param req object
 * @param entityPrefix string
 * @param credentials object
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.aimlSvcGetItems = function(req, params = [], entityPrefix, credentials, parentEntity = [], tenantId = ''){
    
    return new Promise(async (resolve, reject) => {
        if(credentials.claim === undefined){
            reject({message: "Credentials could not be retrieved. Something went wrong with your request."});
        }
        else {
            tenantId = tenantId == '' ? tokenManager.getTenantId(req) : tenantId;
            var filterExpression = "";
            var filterdataExpression = "";
            var queryParamAfterTransform = {};
            // Check if query param has (_), excluded from query
            if(Object.keys(req.query).length > 0){
                for(let attName in req.query){
                    if(attName.charAt(0) == "_"){
                        let newAttName = attName.replace('_', '');
                        queryParamAfterTransform[newAttName] = req.query[attName]
                        delete req.query[attName];
                    }
                }
            }

            var input = req.query;
            if(typeof(input) == 'object' && 'TenantId' in input) {
                req.body = input
                input = {};
            }
            
            var i = 1;
            var logicalOperators = input.LOGICAL_OPERATOR === undefined ? 'AND' : input.LOGICAL_OPERATOR;
            var projectionExpression = [];

            if(isSystemResourceData()){
                tenantId = SYSTEM_ADMIN_TENANT_ID;
            }

            if('Projection' in input){
                projectionExpression  = input['Projection']
            }

            let searchParams = {
                TableName: this.tableDefinition.TableName,
                KeyConditionExpression: "TenantId = :tenantId and begins_with(EntityItemId, :entityPrefix)",
                ExpressionAttributeValues: {
                    ':tenantId' : tenantId,
                    ':entityPrefix' : entityPrefix + ':',
                },
                Select : 'ALL_ATTRIBUTES',
                ScanIndexForward : true
            };

            let projectionExpressionParam = {
                TableName: this.tableDefinition.TableName,
                KeyConditionExpression: "TenantId = :tenantId and begins_with(EntityItemId, :entityPrefix)",
                ExpressionAttributeValues: {
                    ':tenantId' : tenantId,
                    ':entityPrefix' : entityPrefix + ':',
                },
                ProjectionExpression:projectionExpression,
                ScanIndexForward : true
            }
            
            if(Array.isArray(logicalOperators)){
                logicalOperators = logicalOperators.reverse();
            }else {
                logicalOperators = [logicalOperators];
            }
            var k = logicalOperators.length;
            
            delete input.LOGICAL_OPERATOR;
            delete input.Projection;
            if( Object.keys(input).length > 0){
                searchParams['ExpressionAttributeNames'] = {};
                projectionExpressionParam['ExpressionAttributeNames'] = {};
                
                for(var attName in input){
                    i = i + 1
                    var attNamePlaceholder = '';
                    var keyAttName = '';
                    var attValue = input[attName];
                    var valuePlaceholder = ':attValue' + i;
                    let splitStr = attName.split('.');

                    for (let j = 0; j < splitStr.length; j++) {
                        let increaseNum = j + i
                        if(j > 0){
                            keyAttName = '#subAttName' + increaseNum;
                            attNamePlaceholder += '.#subAttName' + increaseNum;
                        }else {
                            keyAttName = '#attName' + increaseNum;
                            attNamePlaceholder += '#attName' + increaseNum;
                        }
                        searchParams['ExpressionAttributeNames'][keyAttName] = splitStr[j];
                        projectionExpressionParam['ExpressionAttributeNames'][keyAttName] = splitStr[j];

                    }

                    // if attValue empty
                    if(attValue == ''){
                        filterExpression += filterExpression === ""? `${attNamePlaceholder} = ${valuePlaceholder}`:` AND ${attNamePlaceholder} = ${valuePlaceholder}`;
                        searchParams['ExpressionAttributeValues'][valuePlaceholder] = attValue;
                    }else if(
                        typeof(attValue) === 'object' &&
                        attValue !== null
                    ){
                        // for (let l = 0; l < attValue.length; l++) {
                        //     let valuePlaceholders = ':attValue' + i++;
                        //     logicalOperators !== undefined ? logicalOperators[l] : logicalOperators[0];
                        //     console.log("logicalOperators: ", logicalOperators)
                        //     filterExpression += filterExpression === ""? `contains(${attNamePlaceholder}, ${valuePlaceholders})`:` ${logicalOperators} contains(${attNamePlaceholder}, ${valuePlaceholders})`;
                        //     searchParams['ExpressionAttributeValues'][valuePlaceholders] = attValue[l];
                        // }
                        let logicalOperator = '';
                        for (let l = 0; l < attValue.length; l++) {
                            let valuePlaceholders = ':attValue' + i++;
                            logicalOperator = logicalOperators[l] !== undefined ? logicalOperators[l] : logicalOperators[0];
                            filterExpression += filterExpression === ""? `contains(${attNamePlaceholder}, ${valuePlaceholders})`:` ${logicalOperator} contains(${attNamePlaceholder}, ${valuePlaceholders})`;
                            searchParams['ExpressionAttributeValues'][valuePlaceholders] = attValue[l];
                            projectionExpressionParam['ExpressionAttributeValues'][valuePlaceholders] = attValue[l];
                        }
                    }else {
                        filterExpression += filterExpression === ""? `contains(${attNamePlaceholder}, ${valuePlaceholder})`:` ${logicalOperators[k]} contains(${attNamePlaceholder}, ${valuePlaceholder})`;
                        searchParams['ExpressionAttributeValues'][valuePlaceholder] = attValue;
                        projectionExpressionParam['ExpressionAttributeValues'][valuePlaceholder] = attValue;
                    }
                    
                    k--;
                }

            }

            // Filter by parent entity attribute if specified
            if(Object.keys(parentEntity).length > 0 ){         
                let parentAttributeName = Object.keys(parentEntity)[0];
                let parentAttValuePlaceholder = ':parentAttValue';
                if(filterExpression !== "" || filterdataExpression !== "")
                    filterExpression = "(" + filterExpression + ") AND ";
                filterExpression += `${parentAttributeName} = ${parentAttValuePlaceholder}`;
                filterdataExpression += `${parentAttributeName} = ${parentAttValuePlaceholder}`;
                searchParams['ExpressionAttributeValues'][parentAttValuePlaceholder] = parentEntity[parentAttributeName];
                projectionExpressionParam['ExpressionAttributeValues'][parentAttValuePlaceholder] = parentEntity[parentAttributeName];
            }

            if(filterExpression !== ""){
                searchParams['FilterExpression'] = filterExpression;
                projectionExpressionParam['FilterExpression'] = filterExpression;
            }
            if(Object.keys(params).length === 0){
                params = searchParams;
            }
            if(projectionExpression.length > 0){
                params = projectionExpressionParam;
            }
            let paginationItems = await this.getPaginatedItems(req, params, queryParamAfterTransform);
            resolve(paginationItems);
            
        }
    });
}

/**
 * To list all data
 * Step1: List from Dynamodb aimlSvcGetItems
 * Step2: Check if need to transform data, call transform()
 * Step3: Check if need to filters data, call filterAfterTransform()
 * @param {*} req 
 * @param {*} params 
 * @param {*} entityPrefix
 * @param {*} parentEntity 
 * @returns list all data type array
 */
DynamoDBHelper.prototype.aimlSvcGetItemsV2 = function(req, params = [], entityPrefix, parentEntity = []){
    
    return new Promise(async (resolve, reject) => {
        if(this.credentials.claim === undefined){
            reject("Credentials could not be retrieved. Something went wrong with your request.");
        }
        else {
            // Step1: List data
            var tenantId     = tokenManager.getTenantId(req);
            var filterExpression = "";
            var filterdataExpression = "";
            var queryParamAfterTransform = {};
            var queryParams = {};

            // Check if query param has (_), excluded from query
            if(Object.keys(req.query).length > 0){
                for(let attName in req.query){
                    if(attName.charAt(0) == "_"){
                        let newAttName = attName.replace('_', '');
                        queryParamAfterTransform[newAttName] = req.query[attName]
                        queryParams[attName] = req.query[attName]
                        delete req.query[attName];
                    }
                }
            }
            var input = req.query;
            if('TenantId' in input) {
                req.body = input
                input = {};
            }
            
            var i = 1;
            var logicalOperators = input.LOGICAL_OPERATOR === undefined ? 'AND' : input.LOGICAL_OPERATOR;
            var projectionExpression = [];

            if(isSystemResourceData()){
                tenantId = SYSTEM_ADMIN_TENANT_ID;
            }

            if('Projection' in input){
                projectionExpression  = input['Projection']
            }

            let searchParams = {
                TableName: this.tableDefinition.TableName,
                KeyConditionExpression: "TenantId = :tenantId and begins_with(EntityItemId, :entityPrefix)",
                ExpressionAttributeValues: {
                    ':tenantId' : tenantId,
                    ':entityPrefix' : entityPrefix + ':',
                },
                Select : 'ALL_ATTRIBUTES',
                ScanIndexForward : true
            };

            let projectionExpressionParam = {
                TableName: this.tableDefinition.TableName,
                KeyConditionExpression: "TenantId = :tenantId and begins_with(EntityItemId, :entityPrefix)",
                ExpressionAttributeValues: {
                    ':tenantId' : tenantId,
                    ':entityPrefix' : entityPrefix + ':',
                },
                ProjectionExpression:projectionExpression,
                ScanIndexForward : true
            }
            
            if(Array.isArray(logicalOperators)){
                logicalOperators = logicalOperators.reverse();
            }else {
                logicalOperators = [logicalOperators];
            }
            var k = logicalOperators.length;
            
            delete input.LOGICAL_OPERATOR;
            delete input.Projection;
            if( Object.keys(input).length > 0){
                searchParams['ExpressionAttributeNames'] = {};
                projectionExpressionParam['ExpressionAttributeNames'] = {};
                
                for(var attName in input){
                    i = i + 1
                    var attNamePlaceholder = '';
                    var keyAttName = '';
                    var attValue = input[attName];
                    var valuePlaceholder = ':attValue' + i;
                    let splitStr = attName.split('.');

                    for (let j = 0; j < splitStr.length; j++) {
                        let increaseNum = j + i
                        if(j > 0){
                            keyAttName = '#subAttName' + increaseNum;
                            attNamePlaceholder += '.#subAttName' + increaseNum;
                        }else {
                            keyAttName = '#attName' + increaseNum;
                            attNamePlaceholder += '#attName' + increaseNum;
                        }
                        searchParams['ExpressionAttributeNames'][keyAttName] = splitStr[j];
                        projectionExpressionParam['ExpressionAttributeNames'][keyAttName] = splitStr[j];

                    }

                    // if attValue empty
                    if(attValue == ''){
                        filterExpression += filterExpression === ""? `${attNamePlaceholder} = ${valuePlaceholder}`:` AND ${attNamePlaceholder} = ${valuePlaceholder}`;
                        searchParams['ExpressionAttributeValues'][valuePlaceholder] = attValue;
                    }else if(typeof(attValue) === 'object' && attValue !== null){
                        let logicalOperator = '';
                        for (let l = 0; l < attValue.length; l++) {
                            let valuePlaceholders = ':attValue' + i++;
                            logicalOperator = logicalOperators[l] !== undefined ? logicalOperators[l] : logicalOperators[0];
                            filterExpression += filterExpression === ""? `${attNamePlaceholder} = ${valuePlaceholders}`:` ${logicalOperator} ${attNamePlaceholder} = ${valuePlaceholders}`;
                            searchParams['ExpressionAttributeValues'][valuePlaceholders] = attValue[l];
                            projectionExpressionParam['ExpressionAttributeValues'][valuePlaceholders] = attValue[l];
                        }
                    }else {
                        filterExpression += filterExpression === ""? `${attNamePlaceholder} = ${valuePlaceholder}`:` ${logicalOperators[k]} ${attNamePlaceholder} = ${valuePlaceholder}`;
                        searchParams['ExpressionAttributeValues'][valuePlaceholder] = attValue;
                        projectionExpressionParam['ExpressionAttributeValues'][valuePlaceholder] = attValue;
                    }
                    
                    k--;
                }

            }

            // Filter by parent entity attribute if specified
            if(Object.keys(parentEntity).length > 0 ){         
                let parentAttributeName = Object.keys(parentEntity)[0];
                let parentAttValuePlaceholder = ':parentAttValue';
                if(filterExpression !== "" || filterdataExpression !== "")
                    filterExpression = "(" + filterExpression + ") AND ";
                filterExpression += `${parentAttributeName} = ${parentAttValuePlaceholder}`;
                filterdataExpression += `${parentAttributeName} = ${parentAttValuePlaceholder}`;
                searchParams['ExpressionAttributeValues'][parentAttValuePlaceholder] = parentEntity[parentAttributeName];
                projectionExpressionParam['ExpressionAttributeValues'][parentAttValuePlaceholder] = parentEntity[parentAttributeName];
            }

            if(filterExpression !== ""){
                searchParams['FilterExpression'] = filterExpression;
                projectionExpressionParam['FilterExpression'] = filterExpression;
            }

            // Call to getPaginatedItems(params, queryParamAfterTransform)
            if(Object.keys(params).length === 0){
                params = searchParams;
            }
            if(projectionExpression.length > 0){
                params = projectionExpressionParam;
            }
            let paginationItems = await this.getPaginatedItems(req, params, queryParamAfterTransform);
            resolve(paginationItems);
        }
    });
}

/**
 * Get query results with pagination
 * @param req Object
 * @param param Object
 * @param query Object
 * @param allData Array
 * @returns finalResult, items found and filtered
 */
DynamoDBHelper.prototype.getPaginatedItems = function(req, params, queryParams, allData = []){
    return new Promise((resolve, reject) => {
        let thisDynamodb = this;
        this.getDynamoDBDocumentClient(this.credentials,async function(error, docClient){
            if(error){
                reject("Promise retreive all items were rejected");
            }else {
                let data = await docClient.query(params).promise();
                if(data["Items"] && data["Items"].length > 0) {
                    allData = [...allData, ...data["Items"]];
                }
                if(data.LastEvaluatedKey){
                    params['ExclusiveStartKey'] = data.LastEvaluatedKey;
                    resolve(await thisDynamodb.getPaginatedItems(req, params, queryParams, allData));
                }else{
                    let result = [];
                    // Check if need to transform, call transform() function
                    for (let m = 0; m < allData.length; m++) {
                        let obj = allData[m];
                        if(obj.hasOwnProperty('GetAndTransform')){
                            // Call transform
                            result.push(await thisDynamodb.transform(req, obj, obj.GetAndTransform));
                        }else {
                            result.push(obj);
                        }
                    }
            
                    // filter attribute after transform
                    if(Object.keys(queryParams).length > 0){
                        result = filterAfterTransform(result, queryParams)
                    }
                    resolve(result);
                }
            }
        })
    })
}

/**
 * Create Batch items
 * @param req object
 * @param entityPrefix string
 * @param credentials object
 * return data that have type of value array object.
 */
DynamoDBHelper.prototype.aimlSvcCreateBatchItems = function(req, entityPrefix = '', credentials, userName = '', tenantId = ''){
    return new Promise((resolve, reject) => {
        if(credentials.claim === undefined){
            return ({message: "Credentials could not be retrieved. Something went wrong with your request."});
        }
        else {
            var items = req.body;
            var data  = [];
            if(items.length > 0){
                items.forEach(item => {
                    var entityItemId = entityPrefix != '' ? getEntityItemId(entityPrefix) : item.EntityItemId;
                    delete item['EntityItemId'];
                    delete item['TenantId'];
                    delete item['CreatedAt'];
                    item.TenantId = tenantId != '' ? tenantId : tokenManager.getTenantId(req)
                    item.CreatedAt = req.headers.requestedat == undefined?new Date().toISOString():req.headers.requestedat;
                    item.CreatedBy = userName != '' ? userName : credentials.userId
                    item.EntityItemId = entityItemId;
                    // item.CreatedBy = credentials.userId
                    item.UpdatedAt = '';
                    item.UpdatedBy = '';
                    this.putItem(item, credentials, function (err, createdItem) {
                        if (err) {
                            reject ("Promise create batch items were rejected");
                        }else {
                            data.push(item);
                        }
                    }.bind(this));
                    data.push(item);
                });
            }
            resolve (data);
        }
    })
}

DynamoDBHelper.prototype.aimlSvcCreateBatchItemsV2 = function(req, entityPrefix){
    return new Promise((resolve, reject) => {
        if(this.credentials.claim === undefined){
            return ({message: "Credentials could not be retrieved. Something went wrong with your request."});
        }
        else {
            var items = req.body;
            var data  = [];
            if(items.length > 0){
                items.forEach(item => {
                    delete item['EntityItemId'];
                    delete item['TenantId'];
                    delete item['CreatedAt'];
                    var entityItemId = getEntityItemId(entityPrefix);
                    var tenantId = tokenManager.getTenantId(req);
                    item.TenantId = tenantId;
                    item.EntityItemId = entityItemId;
                    item.CreatedAt = req.headers.requestedat == undefined?new Date().toISOString():req.headers.requestedat;
                    item.CreatedBy = this.credentials.userId
                    item.UpdatedAt = '';
                    item.UpdatedBy = '';
                    this.putItem(item, this.credentials, function (err, createdItem) {
                        if (err) {
                            reject ("Promise create batch items were rejected");
                        }else {
                            data.push(item);
                        }
                    }.bind(this));
                    data.push(item);
                });
            }
            resolve (data);
        }
    })
}


/**
 * Create item by specified entityItemId
 * @param req object
 * @param entityPrefix string
 * @param credentials object
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.aimlSvcCreateItem = function(req, entityPrefix, credentials, userName = '', tenantId = ''){
    return new Promise((resolve, reject) => {
        if(credentials.claim === undefined){
            resolve({message: "Credentials could not be retrieved. Something went wrong with your request."});
        }
        else {
            var data = req.body;
            var entityItemId    = getEntityItemId(entityPrefix);
            tenantId            = tenantId == '' ? tokenManager.getTenantId(req) : tenantId;
            data.CreatedAt      = req.headers.requestedat == undefined?new Date().toISOString():req.headers.requestedat;
            data.CreatedBy      = userName == '' ? credentials.userId : userName
            data.UpdatedAt      = '';
            data.UpdatedBy      = '';
            
            // Primary key
            let keySchemas = this.tableDefinition.KeySchema
            if(keySchemas.length == 2){
                data[`${keySchemas[0].AttributeName}`] = tenantId
                data[`${keySchemas[1].AttributeName}`] = entityItemId
            }else if(keySchemas.length == 1){
                data[`${keySchemas[0].AttributeName}`] = entityItemId
            }
            this.putItem(data, credentials, function (err, createdItem) {
                if (err) {
                    reject(err.message);
                }
                else {
                    resolve(data);
                }
            }.bind(this));
        }
    })
}

DynamoDBHelper.prototype.aimlSvcCreateItemV2 = function(req, entityPrefix = ''){
    return new Promise((resolve, reject) => {
        if(this.credentials.claim === undefined){
            resolve({message: "Credentials could not be retrieved. Something went wrong with your request."});
        }
        else {
            var data = req.body;
            var entityItemId = entityPrefix != '' ? getEntityItemId(entityPrefix) : data.EntityItemId;
            var tenantId = tokenManager.getTenantId(req);
            data.TenantId = tenantId;
            data.EntityItemId = entityItemId;
            data.CreatedAt = req.headers.requestedat == undefined?new Date().toISOString():req.headers.requestedat;
            data.CreatedBy = this.credentials.userId
            data.UpdatedAt = '';
            data.UpdatedBy = '';
            this.putItem(data, this.credentials, function (err, createdItem) {
                if (err) {
                    reject("Promise create a new item was rejected");
                }
                else {
                    resolve(data);
                }
            }.bind(this));
        }
    })
}

/**
 * Create item by specified entityItemId
 * @param req object
 * @param tenantId string
 * @param entityPrefix string
 * @param credentials object
 * @param callback Callback with results
 */
 DynamoDBHelper.prototype.aimlSvcPutItem = function(req, tenantId, entityPrefix, credentials, callback){
    if(credentials.claim === undefined){
        callback({message: "Credentials could not be retrieved. Something went wrong with your request."});
    }
    else {
        var data = req.body;
        var entityItemId = getEntityItemId(entityPrefix);
        data.TenantId = tenantId;
        data.EntityItemId = entityItemId;
        data.CreatedAt = req.headers.requestedat == undefined?new Date().toISOString():req.headers.requestedat;

        this.putItem(data, credentials, function (err, createdItem) {
            if (err) {
                callback(err);
            }
            else {
                callback(null, data);
            }
        }.bind(this));
    }
}

/**
 * Get item by specified entityItemId
 * @param req object
 * @param entityItemId string
 * @param credentials object
 * @param callback Callback with results
 */

DynamoDBHelper.prototype.aimlSvcGetItem = function (req, entityItemId, credentials, callback){
    if(credentials.claim === undefined){
        callback({message: "Credentials could not be retrieved. Something went wrong with your request."});
    }else {
        var tenantId = tokenManager.getTenantId(req);
        if(isSystemResourceData()){
            tenantId = SYSTEM_ADMIN_TENANT_ID;
        }
        var searchParams = {
            TenantId : tenantId,
            EntityItemId : entityItemId
        };
        
        this.getItem(searchParams, credentials, function (err, item){
            if (err) {
                callback(err);
            }
            else {
                callback(null, item);
            }
        }.bind(this));
    }
}

DynamoDBHelper.prototype.aimlSvcRetrieveItem = function (req, entityItemId, credentials){
    return new Promise((resolve, reject) => {
        if(credentials.claim === undefined){
            resolve({message: "Credentials could not be retrieved. Something went wrong with your request."});
        }else {
            var tenantId = tokenManager.getTenantId(req);
            let key = {}
            let keySchemas = this.tableDefinition.KeySchema
            if(keySchemas.length == 2){
                key[`${keySchemas[0].AttributeName}`] = tenantId
                key[`${keySchemas[1].AttributeName}`] = entityItemId
            }else if(keySchemas.length == 1){
                key[`${keySchemas[0].AttributeName}`] = entityItemId
            }

            var searchParams = key;
            this.getItem(searchParams, credentials, function (err, item){
                if (err) {
                    reject ("Promise retrieve a item was rejected")
                }
                else {
                    resolve (item);
                }
            }.bind(this));
        }
    });
}

DynamoDBHelper.prototype.aimlSvcRetrieveItemV2 = function (req, entityItemId){
    return new Promise((resolve, reject) => {
        if(this.credentials.claim === undefined){
            resolve({message: "Credentials could not be retrieved. Something went wrong with your request."});
        }else {
            var tenantId = tokenManager.getTenantId(req);
            var searchParams = {
                TenantId : tenantId,
                EntityItemId : entityItemId
            };

            this.getItem(searchParams, this.credentials, function (err, item){
                if (err) {
                    reject ("Promise retrieve a item was rejected")
                }
                else {
                    resolve (item);
                }
            }.bind(this));
        }
    });
}

/**
 * Update item by specified entityItemId
 * @param req object
 * @param entityItemId string
 * @param credentials object
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.aimlSvcUpdateItem = function(req, entityItemId, credentials, userName = '', tenantId = ''){
    return new Promise((resolve, reject) => {
        if(credentials.claim === undefined){
            resolve({message: "Credentials could not be retrieved. Something went wrong with your request."});
        }else {
            tenantId                        = tenantId == '' ? tokenManager.getTenantId(req) : tenantId;
            var bodyRequest                 = req.body;
            var updateCmd                   = 'set ';
            var updateExpression            = '';
            var expressionAttributeValues   = {};
            var expressionAttributeNames    = {};
            bodyRequest['UpdatedAt']        = req.headers.requestedat == undefined?new Date().toISOString():req.headers.requestedat;
            bodyRequest['UpdatedBy']        = userName == '' ? credentials.userId : userName
            delete bodyRequest.EntityItemId;
            delete bodyRequest.TenantId;

            for (var attribute in bodyRequest) {
                var nameToken = '#' + attribute;
                var valueToken = ':' + attribute;

                // Inject those name-value tokens in the UpdateExpression
                updateExpression += updateExpression === ''? nameToken + ' = ' + valueToken : ', ' + nameToken + ' = ' + valueToken;
                expressionAttributeValues[valueToken] = bodyRequest[attribute];
                expressionAttributeNames[nameToken] = attribute;
            }

            // Get key from keySchema
            let key = {}
            let keySchemas = this.tableDefinition.KeySchema
            if(keySchemas.length == 2){
                key[`${keySchemas[0].AttributeName}`] = tenantId
                key[`${keySchemas[1].AttributeName}`] = entityItemId
            }else if(keySchemas.length == 1){
                key[`${keySchemas[0].AttributeName}`] = entityItemId
            }
            updateExpression = updateCmd + updateExpression;

            var searchParams = {
                TableName: this.tableDefinition.TableName,
                Key: key,
                UpdateExpression: updateExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ExpressionAttributeNames: expressionAttributeNames,
                ReturnValues:"UPDATED_NEW"
            };
            this.updateItem(searchParams, credentials, async function (err, updatedItem) {
                if (err){
                    reject(err.message);
                }else {
                    let retrieveItem = await this.aimlSvcRetrieveItem(req, entityItemId, credentials);
                    resolve(retrieveItem);
                }
            }.bind(this));
        }
    })
}

DynamoDBHelper.prototype.aimlSvcUpdateItemV2 = function(req, entityItemId){
    return new Promise((resolve, reject) => {
        if(this.credentials.claim === undefined){
            resolve({message: "Credentials could not be retrieved. Something went wrong with your request."});
        }else {
            var tenantId                    = tokenManager.getTenantId(req);
            var bodyRequest                 = req.body;
            var updateCmd                   = 'set ';
            var updateExpression            = '';
            var expressionAttributeValues   = {};
            var expressionAttributeNames    = {};
            bodyRequest['UpdatedAt']        = req.headers.requestedat == undefined?new Date().toISOString():req.headers.requestedat;
            bodyRequest['UpdatedBy']        = this.credentials.userId
            delete bodyRequest.EntityItemId;
            delete bodyRequest.TenantId;

            for (var attribute in bodyRequest) {
                var nameToken = '#' + attribute;
                var valueToken = ':' + attribute;

                // Inject those name-value tokens in the UpdateExpression
                updateExpression += updateExpression === ''? nameToken + ' = ' + valueToken : ', ' + nameToken + ' = ' + valueToken;
                expressionAttributeValues[valueToken] = bodyRequest[attribute];
                expressionAttributeNames[nameToken] = attribute;
            }

            updateExpression = updateCmd + updateExpression;

            var searchParams = {
                TableName: this.tableDefinition.TableName,
                Key: {
                    EntityItemId : entityItemId,
                    TenantId : tenantId
                },
                UpdateExpression: updateExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ExpressionAttributeNames: expressionAttributeNames,
                ReturnValues:"UPDATED_NEW"
            };
            // console.log('searchParams: ', searchParams)
            this.updateItem(searchParams, this.credentials, async function (err, updatedItem) {
                if (err){
                    reject("Promise update a item was rejected");
                }else {
                    let retrieveItem = await this.aimlSvcRetrieveItem(req, entityItemId, this.credentials);
                    resolve(retrieveItem);
                }
            }.bind(this));
        }
    })
}

/**
 * Update Batch items
 * @param req object
 * @param credentials object
 * return data that have type of value array object.
 */
DynamoDBHelper.prototype.aimlSvcUpdateBatchItems = function(req, credentials){
    return new Promise(async (resolve, reject) => {
        if(credentials.claim === undefined){
            resolve ({message: "Credentials could not be retrieved. Something went wrong with your request."});
        }
        else {
            var items = req.body;
            var data  = [];
            if(items.length > 0){
                for (let i = 0; i < items.length; i++) {
                    var tenantId                    = tokenManager.getTenantId(req);
                    var updateCmd                   = 'set ';
                    var updateExpression            = '';
                    var expressionAttributeValues   = {};
                    var expressionAttributeNames    = {};
                    var bodyRequest                 = items[i]
                    bodyRequest['UpdatedAt']        = req.headers.requestedat == undefined?new Date().toISOString():req.headers.requestedat;
                    bodyRequest['UpdatedBy']        = this.credentials.userId
                    var entityItemId                = items[i].EntityItemId;
                    delete bodyRequest.EntityItemId;
                    delete bodyRequest.TenantId;
    
                    for (var attribute in bodyRequest) {
                        var nameToken = '#' + attribute;
                        var valueToken = ':' + attribute;
    
                        // Inject those name-value tokens in the UpdateExpression
                        updateExpression += updateExpression === ''? nameToken + ' = ' + valueToken : ', ' + nameToken + ' = ' + valueToken;
                        expressionAttributeValues[valueToken] = bodyRequest[attribute];
                        expressionAttributeNames[nameToken] = attribute;
                    }
    
                    updateExpression = updateCmd + updateExpression;
    
                    var searchParams = {
                        TableName: this.tableDefinition.TableName,
                        Key: {
                            EntityItemId : entityItemId,
                            TenantId : tenantId
                        },
                        UpdateExpression: updateExpression,
                        ExpressionAttributeValues: expressionAttributeValues,
                        ExpressionAttributeNames: expressionAttributeNames,
                        ReturnValues:"UPDATED_NEW"
                    };
                    bodyRequest.EntityItemId = entityItemId;
                    bodyRequest.TenantId = tenantId;
                    data.push(bodyRequest)
                    this.updateItem(searchParams, credentials, function (err, updatedItem) {
                        if (err)
                            reject("Promise update batch items were rejected");
                    }.bind(this));
                }
            }
            resolve(data);
        }
    })
}

DynamoDBHelper.prototype.aimlSvcUpdateBatchItemsV2 = function(req){
    return new Promise(async (resolve, reject) => {
        if(this.credentials.claim === undefined){
            resolve ({message: "Credentials could not be retrieved. Something went wrong with your request."});
        }
        else {
            var items = req.body;
            var data  = [];
            if(items.length > 0){
                for (let i = 0; i < items.length; i++) {
                    var tenantId                    = tokenManager.getTenantId(req);
                    var updateCmd                   = 'set ';
                    var updateExpression            = '';
                    var expressionAttributeValues   = {};
                    var expressionAttributeNames    = {};
                    var bodyRequest                 = items[i]
                    bodyRequest['UpdatedAt']        = req.headers.requestedat == undefined?new Date().toISOString():req.headers.requestedat;
                    bodyRequest['UpdatedBy']        = this.credentials.userId
                    var entityItemId                = items[i].EntityItemId;
                    delete bodyRequest.EntityItemId;
                    delete bodyRequest.TenantId;
    
                    for (var attribute in bodyRequest) {
                        var nameToken = '#' + attribute;
                        var valueToken = ':' + attribute;
    
                        // Inject those name-value tokens in the UpdateExpression
                        updateExpression += updateExpression === ''? nameToken + ' = ' + valueToken : ', ' + nameToken + ' = ' + valueToken;
                        expressionAttributeValues[valueToken] = bodyRequest[attribute];
                        expressionAttributeNames[nameToken] = attribute;
                    }
    
                    updateExpression = updateCmd + updateExpression;
                    if(entityItemId != undefined){
                        var searchParams = {
                            TableName: this.tableDefinition.TableName,
                            Key: {
                                EntityItemId : entityItemId,
                                TenantId : tenantId
                            },
                            UpdateExpression: updateExpression,
                            ExpressionAttributeValues: expressionAttributeValues,
                            ExpressionAttributeNames: expressionAttributeNames,
                            ReturnValues:"UPDATED_NEW"
                        };
                        bodyRequest.EntityItemId = entityItemId;
                        bodyRequest.TenantId = tenantId;
                        data.push(bodyRequest)
                        this.updateItem(searchParams, this.credentials, function (err, updatedItem) {
                            if (err)
                                reject("Promise update batch items were rejected");
                        }.bind(this));
                    }else {
                        resolve({message: "Id not found for update"})
                    }
                }
            }
            resolve(data);
        }
    })
}

/**
 * Delete item by specified entityItemId
 * @param req object
 * @param entityItemId string
 * @param credentials object
 * @param callback Callback with statusCode and message
 */
DynamoDBHelper.prototype.aimlSvcDeleteItem = async function(req, entityItemId, credentials, callback){

    if(credentials.claim === undefined){
        callback({statusCode: 400, message: "Credentials could not be retrieved. Something went wrong with your request."});
    }
    else {

        // Declare variable
        let foreignKey          = {}
        let listReferencedBy    = []
        var tenantId            = tokenManager.getTenantId(req);

        // Filter name(EntityPrefix) in list all EntityConstraint 
        let entityPrefix = entityItemId.split(':')
        entityPrefix = entityPrefix[0]
        req.query = {Name: entityPrefix}
        let entityConstraint = await this.aimlSvcGetItemsV2(req, [], "EntityConstraint")
        // Check if this entity have children item
            // It will show the message with status code 400
            // Else if delete this entity
        if(typeof(entityConstraint) == 'object' && entityConstraint.length > 0){
            let referencedBy = entityConstraint[0].ReferencedBy
            if(referencedBy.length > 0){
                let children = ''
                for (let i = 0; i < referencedBy.length; i++) {
                    let entityPrefix = referencedBy[i].Name;
                    children += children == '' ? entityPrefix : ', ' + entityPrefix
                    foreignKey[referencedBy[i].ForeignKey] = entityItemId
    
                    req.query = {}
                    let items = await this.aimlSvcGetItemsV2(req, [], entityPrefix, foreignKey)
                    listReferencedBy.push(...items)
                }
            }
        }

        if(listReferencedBy.length > 0){
            callback(null, {statusCode: 400, message: `You cannot delete this ${entityPrefix} because it has child records. Please delete those records (${children}) first.`})
        }else {
            let deleteUserParams = {
                TableName: this.tableDefinition.TableName,
                Key: {
                    EntityItemId: entityItemId,
                    TenantId: tenantId
                }
            };

            this.deleteItem(deleteUserParams, credentials, function (err, deletedUser) {
                if (err) {
                    callback("Error deleting DynamoDB user");
                }else {
                    callback(null, {statusCode: 200, message: 'Deleted Successfully.'});
                }
            }.bind(this));
        }
    }
}

DynamoDBHelper.prototype.aimlSvcDeleteItemV2 = function(req, entityItemId, callback){

    if(this.credentials.claim === undefined){
        callback({message: "Credentials could not be retrieved. Something went wrong with your request."});
    }
    else {
        var tenantId                    = tokenManager.getTenantId(req);
        var deleteUserParams            = {
            TableName: this.tableDefinition.TableName,
            Key: {
                EntityItemId: entityItemId,
                TenantId: tenantId
            }
        };
        this.deleteItem(deleteUserParams, this.credentials, function (err, deletedUser) {
            if (err) {
                callback("Error deleting DynamoDB user");
            }else {
                callback(null, {message: 'Deleted Successfully.'});
            }
        }.bind(this));
    }
}

/**
 * Retrive rule-based items (all attributes)
 * @param req object
 * @param entityPrefix string
 * @param credentials object
 * @param callback Callback with results
 */
 DynamoDBHelper.prototype.aimlSvcGetRuleItems = function(req, entityPrefix, credentials, callback){
    if(credentials.claim === undefined){
        callback({message: "Credentials could not be retrieved. Something went wrong with your request."});
    }
    else {
        var tenantId     = tokenManager.getTenantId(req);
        if(isSystemResourceData()){
            tenantId = SYSTEM_ADMIN_TENANT_ID;
        }
        var searchParams = {
            TableName: this.tableDefinition.TableName,
            KeyConditionExpression: "TenantId = :tenantId and begins_with(EntityItemId, :entityPrefix)",
            ExpressionAttributeValues: {
                ':tenantId' : tenantId,
                ':entityPrefix' : entityPrefix,
            },
            Select : 'ALL_ATTRIBUTES',
            ScanIndexForward : true
        };
        
        var filterExpression = "";
        var input = req.query;
        var i = 0;

        if( Object.keys(input).length > 0){
            searchParams['ExpressionAttributeNames'] = {};
            for(let attName in input){
                if(attName.includes('.')){
                    let attNames = attName.split('.');
                    let attValue = input[attName];
                    var valuePlaceholder = ':attValue' + ++i;
                    var namePlaceholder = '#' + attName;
                    let parentAttName = '#' + attNames[0];
                    filterExpression += filterExpression === ""? `${namePlaceholder} = ${valuePlaceholder}`:` AND ${namePlaceholder} = ${valuePlaceholder}`;
                    searchParams['ExpressionAttributeValues'][valuePlaceholder] = attValue;
                    searchParams['ExpressionAttributeNames'][parentAttName] = attNames[0];
                }else {
                    let attValue = input[attName];
                    var valuePlaceholder = ':attValue' + ++i;
                    var namePlaceholder = '#attName' + i;
                    filterExpression += filterExpression === ""? `${namePlaceholder} = ${valuePlaceholder}`:` AND ${namePlaceholder} = ${valuePlaceholder}`;
                    searchParams['ExpressionAttributeValues'][valuePlaceholder] = attValue;
                    searchParams['ExpressionAttributeNames'][namePlaceholder] = attName;
                }
            }
        }
        
        if(filterExpression !== ""){
            searchParams['FilterExpression'] = filterExpression;
        }

        this.query(searchParams, credentials, function (err, item){
            if (err) {
                callback({message: err.message});
            }
            else {
                callback(item);
            }
        }.bind(this));
    }
}

/**
 * Get an object from Amazon S3 bucket for a tenant
 * @param Request object
 * @return Amazon S3 response object
 */
//  DynamoDBHelper.prototype.aimlSvcS3GetObject = function (objectKey = {}, credentials){
//     return new Promise(resolve => {
//         if(credentials.claim === undefined){
//             callback({message: "Credentials could not be retrieved. Something went wrong with your request."});
//         }
//         else {
//             let s3Client = new AWS.S3();
    
//             // Get the previous object specified the $objectKey
//             result = s3Client.getObject([{
//                 'Bucket': env('AWS_BUCKET'),
//                 'Key': objectKey,
//                 // 'SaveAs' => '/Users/nimeth/Downloads/downloaded-logo.jpeg', // The path to a file on disk to save the object data.
//             }]);
//             resolve(result);
//         }
//     })
// }

/**
 * Put an object in Amazon S3 bucket for a tenant
 * @param Request object
 * @return Amazon S3 response object
 */
DynamoDBHelper.prototype.aimlSvcS3PutObject = function(req, obj, resourceName = 'others', credentials){
    if(credentials.claim === undefined){
        return ({message: "Credentials could not be retrieved. Something went wrong with your request."});
    }
    else {
        let prefix = resourceName; // E.g. payroll, default: others
        let key = getS3ObjectKey(req, prefix)+path.extname(obj);

        const params = {
            Bucket: process.env.AWS_BUCKET,
            Key: key,
            Body: obj
          };
          
        s3Client.upload(params, function(err, data){
            if(err)
                console.log(err)
            console.log("DATA::", data);
        });
        let objectUrl = this.aimlSvcS3ObjectGetPresignedUrl(key, credentials);
        return {'objectKey': key, 'objectUrl': objectUrl};
    }
}

/**
 * Get Pre-signed URL for an Amazon S3 object
 * @param Request object
 * @return String actual pre-signed URL
 */
 DynamoDBHelper.prototype.aimlSvcS3ObjectGetPresignedUrl = function(objectKey, credentials){
    if(credentials.claim === undefined){
        callback({message: "Credentials could not be retrieved. Something went wrong with your request."});
    }else {
        // AWS.config.update({
        //     'accessKeyId': process.env.AWS_ACCESS_KEY_ID,
        //     'accessKeyId': process.env.AWS_SECRET_ACCESS_KEY,
        //     'region': process.env.AWS_REGION,
        //     'signatureVersion': 'v4',
        // })

        // Create a pre-signed URL for the given S3 command object using the command
        let signedUrlExpireSeconds = 60 * 5;

        // Creating the Aws\CommandInterface object for the GetObject operation
        let cmd = s3Client.getCommand('GetObject', [{
                'Bucket': process.env.AWS_BUCKET,
                'Key': objectKey,
            }
        ]);
        console.log('cmd: ', cmd)
        // Create a pre-signed URL for the given S3 command object using the command
        let presignedUrlObj = s3Client.createPresignedRequest(cmd, signedUrlExpireSeconds);
        // const url = s3Client.getSignedUrl(client, command, { expiresIn: 3600 });
        console.log('presignedUrlObj: ', presignedUrlObj)
        let presignedUrl = presignedUrlObj.getUri();
        console.log('presignedUrl: ', presignedUrl)
        // Creating the Aws\CommandInterface object for the GetObject operation
        // let presignedUrl = s3Client.getSignedUrl ('getObject', {
        //     Bucket: process.env.AWS_BUCKET,
        //     Key: objectKey,
        //     Expires: signedUrlExpireSeconds
        // });

        return presignedUrl;
    }
}

/**
 * Query for items using the supplied parameters
 * @param searchParameters The search parameters
 * @param credentials The user creds
 * @param callback Callback function for results
 */
DynamoDBHelper.prototype.query = function(searchParameters, credentials, callback) {
    this.getDynamoDBDocumentClient(credentials, function (error, docClient) {
        // console.log(">>>>> dynamodb-helper.js, searchParameters: ", searchParameters);
        if(!error){
            docClient.query(searchParameters, function(err, data) {
                if (err) {
                    winston.error("Unable to query. Error:", JSON.stringify(err, null, 2));
                    callback(err);
                } else {
                    // console.log(">>>>> dynamodb-helper.js, data.Items: ", data.Items);
                    callback(null, data.Items);
                }
            });
        }
        else{
            winston.error(error);
            callback(error);
        }

    }.bind(this));
}

/**
 * Put an item into a table
 * @param item The item to be created
 * @param tableName The table to put it in
 * @param credentials User credentials
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.putItem = function(item, credentials, callback) {
    this.getDynamoDBDocumentClient(credentials, function (error, docClient) {
        var itemParams = {
            TableName: this.tableDefinition.TableName,
            Item: item
        }
        docClient.put(itemParams, function(err, data) {
            if (err)
                callback(err);
            else {
                callback(null, item);
            }
        });
    }.bind(this));
}

/**
 * Update and item in a table
 * @param productUpdateParams The parameters for the update
 * @param credentials User credentials
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.updateItem = function(productUpdateParams, credentials, callback) {
    this.getDynamoDBDocumentClient(credentials, function (error, docClient) {
        docClient.update(productUpdateParams, function(err, data) {
            if (err){
                callback(err);
            }else{
                callback(null, data.Attributes);
            }
        });
    }.bind(this));
}

/**
 * Get an item from a table
 * @param keyParams Parameters for the GET
 * @param tableName Table to get from
 * @param credentials User credentials
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.getItem = function(keyParams, credentials, callback) {
    this.getDynamoDBDocumentClient(credentials, function (error, docClient) {
        if(error){
            callback(error)
        }else {
            var fetchParams = {
                TableName: this.tableDefinition.TableName,
                Key: keyParams
            }
    
            docClient.get(fetchParams, function(err, data) {
                if (err)
                    callback(err);
                else
                    callback(null, data.Item);
            });
        }
    }.bind(this));
}

/**
 * Delete and item from a table
 * @param deleteItemParams Parameter for the delete
 * @param credentials User credentials
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.deleteItem = function(deleteItemParams, credentials, callback) {
    this.getDynamoDBDocumentClient(credentials, function (error, docClient) {
        docClient.delete(deleteItemParams, function(err, data) {
            if (err)
                callback(err);
            else
                callback(null, data);
        });
    }.bind(this));
}

/**
 * Get all items from a table, using params to filter where necessary
 * @param scanParams Parameter for the scan
 * @param credentials User credentials
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.scan = function(scanParams, credentials, callback) {
    this.getDynamoDBDocumentClient(credentials, function (error, docClient) {
        docClient.scan(scanParams, function(err, data) {
            if (err)
                callback(err);
            else
                callback(null, data.Items);
        });
    }.bind(this));
}

/**
 * Get all items matching the specified parameters
 * @param batchGetParams Parameter for the get
 * @param credentials User credentials
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.batchGetItem = function(batchGetParams, credentials, callback) {
    this.getDynamoDBDocumentClient(credentials, function (error, docClient) {
        docClient.batchGet(batchGetParams, function(err, data) {
            if (err)
                callback(err);
            else
                callback(null, data);
        });
    }.bind(this));
}

/**
 * Create a new table
 * @param tableDefinition Structure of the table
 * @param credentials User credentials
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.createTable = function(dynamodb, callback) {
   var newTable = {
       TableName: this.tableDefinition.TableName,
   };
   dynamodb.describeTable(newTable, function (error, data) {
       if (!error) {
           winston.debug("Table already exists: " + this.tableDefinition.TableName);
           callback(null);
       }
       else {
           dynamodb.createTable(this.tableDefinition, function (err, data) {
               if (err) {
                   winston.error("Unable to create table: " + this.tableDefinition.TableName);
                   callback(err);
               } else {
                   var tableName = {TableName: this.tableDefinition.TableName};
                   dynamodb.waitFor('tableExists', tableName, function (err, data) {
                       if (err)
                           callback(err);
                       else {
                           winston.debug("Created table. Table description JSON:", JSON.stringify(data, null, 2));
                           callback(null);
                       }
                   });
               }
           }.bind(this));
       }
   }.bind(this));
}

/**
 * Determine if a table exists
 * @param tableName Name of the table to evaluate
 * @param credentials User credentials
 * @returns {Promise} Promise with results
 */
DynamoDBHelper.prototype.tableExists = function(tableName, credentials) {
    var promise = new Promise(function (reject, resolve) {
        getDynamoDB(credentials)
            .then(function (dynamodb) {
                var newTable = {
                    TableName: tableName,
                };
                dynamodb.describeTable(newTable, function (error, data) {
                    if (error) {
                        winston.error("Error describing table: ", error)
                    }
                    else {
                        resolve(true);
                    }
                });
            })
            .catch(function (error) {
                winston.error("Error describing table: ", error);
                reject(error);
            });
    });
    return promise;
}

/**
 * Get an instance of DynamoDB object intialized with user credentials
 * @param credentials User credentials
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.getDynamoDB = function(credentials, callback) {
    try {
        var creds = {
            accessKeyId: credentials.claim.AccessKeyId,
            secretAccessKey: credentials.claim.SecretKey,
            sessionToken: credentials.claim.SessionToken,
            region: configuration.aws_region
        }

        var ddb = new AWS.DynamoDB(creds);
        if (!this.tableExists) {
            this.createTable(ddb, function (error) {
                if (error)
                    callback(error);
                else {
                    this.tableExists = true;
                    callback(null, ddb);
                }
            }.bind(this));
        }
        else
            callback(null, ddb);
    }
    catch (error) {
        callback(error);
    }
}

/**
 * Get an instance of DynamoDB DocumentClient object intialized with user credentials
 * @param credentials User credentials
 * @param callback Callback with results
 */
DynamoDBHelper.prototype.getDynamoDBDocumentClient = function(credentials, callback) {
    try {
        var creds = {
            accessKeyId: credentials.claim.AccessKeyId,
            secretAccessKey: credentials.claim.SecretKey,
            sessionToken: credentials.claim.SessionToken,
            region: configuration.aws_region
        }
        
        var docClient = new AWS.DynamoDB.DocumentClient(creds);
        var ddb = new AWS.DynamoDB(creds)

        if (!this.tableExists) {
            this.createTable(ddb, function (error) {
                if (error)
                    callback(error);
                else {
                    this.tableExists = true;
                    callback(null, docClient)
                }
            }.bind(this));
        }
        else
            callback(null, docClient);

    }
    catch (error) {
        callback(error);
    }
}

module.exports = DynamoDBHelper;