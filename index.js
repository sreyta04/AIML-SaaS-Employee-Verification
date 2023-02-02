const request = require('request');

// Declare shared modules
const tokenManager = require('./shared-modules/token-manager/token-manager.js');
const DynamoDBHelper = require('./shared-modules/dynamodb-helper/dynamodb-helper.js');

// Configure Environment
const configModule = require('./shared-modules/config-helper/config');
var configuration = configModule.configure(process.env.NODE_ENV);

const EMPLOYEE_SALARY_PAYMENT = 'EmployeeSalaryPayment';
const EMPLOYEE_PAY_RECORD_PAY_COMPONENT = 'EmployeePayRecordPayComponent';

let payrollSchema = {
    TableName : configuration.table.payroll,
    KeySchema: [
        { AttributeName: "TenantId", KeyType: "HASH"},  //Partition key
        { AttributeName: "EntityItemId", KeyType: "RANGE" }  //Sort key
    ],
    AttributeDefinitions: [
        { AttributeName: "TenantId", AttributeType: "S" },
        { AttributeName: "EntityItemId", AttributeType: "S" }
    ]
}

/**
 * Param input(employee obj), return status code 202
 * AIML-SaaS-Bank-Upload
 * Step1: Retrieve value from employees & employee pay records
 * Step2: Insert/Update valude to dynamodb
 */
exports.handler = (event) => {
    new Promise (async (resolve, reject) => {
        try {
            tokenManager.getCredentialsFromToken(event, async function (credentials) {
                if(credentials.claim === undefined){
                    throw("Credentials could not be retrieved. Something went wrong with your request.");
                }else {
                    let result = {};
                    let input = event.body;
                    let payrollId = event.params.payroll_id;
                    let operation = input.Operation;
                    let employeeNetSalary = 0;
                    let dynamoHelper = new DynamoDBHelper(payrollSchema, credentials, configuration);

                    // Retrieve employee from Employment Module
                    let employeeUrl = configuration.service_url + "/employment-svc/v1/employers/"+ event.params.employer_id + "/employees/"+ input.EmployeeId;
                    let employee = await sendRequest(event, employeeUrl, 'GET');
                    console.log('employee: ', employee)

                    if(operation && operation == "GENERATE"){
                        // Step1: Retrieve value from employee info & employee pay records
                        event.query = {"EmployeeId": employee.EntityItemId, "LOGICAL_OPERATOR": "AND", "UseAs": "LAST_AMOUNT_TO_BE_PAID"};
                        let employeePayRecordPayComponents = await dynamoHelper.aimlSvcGetItemsV2(event, [], EMPLOYEE_PAY_RECORD_PAY_COMPONENT, {"PayrollId": payrollId})
                        if(employeePayRecordPayComponents && employeePayRecordPayComponents.length > 0){
                            employeeNetSalary = employeePayRecordPayComponents[0].PayComponent.Value;
                        }
                        event.body = {
                            "EmployeeBankAccount": employee.BankInfo.Bank,
                            "PayrollId": payrollId,
                            "EmployeeId": employee.EntityItemId,
                            "EmployeeCode": employee.EmployeeId,
                            "EmployeeName": employee.BasicPersonalData.ConcatenatedName,
                            "AccountNumber": employee.BankInfo.AccountNumber,
                            "Amount": employeeNetSalary,
                            "Status": "Pending"
                        }
                        // Step2: Insert/Update valude to dynamodb
                        event.query = {"EmployeeId": employee.EntityItemId};
                        let listEmployeeSalaryPayments = await dynamoHelper.aimlSvcGetItemsV2(event, [], EMPLOYEE_SALARY_PAYMENT, {"PayrollId": payrollId});
                        if(listEmployeeSalaryPayments && listEmployeeSalaryPayments.length > 0){
                            // Update a EmployeeSalaryPayment
                            result = await dynamoHelper.aimlSvcUpdateItemV2(event, listEmployeeSalaryPayments[0].EntityItemId);
                        }else {
                            // Create a new EmployeeSalaryPayment
                            result = await dynamoHelper.aimlSvcCreateItemV2(event, EMPLOYEE_SALARY_PAYMENT);
                        }
                    }else {
                        throw (`Operation (${operation}) not found.`)
                    }
                    resolve(result)
                }
            })
        } catch(err){
            reject(err)
        }
    }).then(function(res) {
        console.log('Lambda Response: ', res)
    }).catch(function(err){
        console.log('Lambda error: ', err)
    })
}


/**
 * To send request
 * @param {*} event 
 * @param {*} url 
 * @param {*} method 
 * @param {*} data 
 * @param {*} id 
 * @returns 
 */
function sendRequest(event, url, method, data = {}, id = ''){
    return new Promise((resolve, reject) => {
        let newUrl = id == '' ? url : url + '/' + id
        request({
            url: newUrl,
            method: method,
            json: true,
            headers: {
                "Authorization": event.headers.Authorization,
            },
            body: data
        }, function (error, response, body) {
            if(error && response.statusCode !== 200){
                reject(error)
            }else {
                resolve(body)
            }
        })
    })
}