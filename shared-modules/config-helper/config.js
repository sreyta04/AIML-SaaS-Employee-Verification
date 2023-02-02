/**
 * Notes
 * Uncomment the line just below (`process.env["NODE_CONFIG_DIR"] = __dirname + "/config/";`) 
 * if running the app directly on localhost.
 * Leave the line commented if running the app in a container because the environment variable `NODE_CONFIG_DIR` 
 * is set in the Dockerfile.
 */

process.env["NODE_CONFIG_DIR"] = __dirname + "/config/";
const config = require('../../node_modules/config');
var envConfig = config.get('Config.envConfig');
const winston = require('../../node_modules/winston');
const logoUrl = 'https://aiml-saas-storage-public.s3.ap-southeast-1.amazonaws.com/AIML-Logo.png';

/**
 * Set Configuration of Application, and Environment
 * @param environment
 * @returns The configuration
 */
module.exports.configure = function(environment) {
    // winston.debug('Currently running in ' + environment);
    var config = {};
    if(environment == null || environment == undefined || environment == 'undefined'){
        var environment = process.env.NODE_ENV;
        if(process.env.NODE_ENV == undefined){
            environment = "local";
        }
    }
        switch(environment) {
        case "production":
            if( process.env.AIML_AWS_REGION == undefined || 
                process.env.SERVICE_URL == undefined || 
                process.env.SNS_ROLE_ARN == undefined || 
                process.env.AWS_ACCOUNT_ID == undefined)
            {
                var error = "Production Environment Variables Not Properly Configured. \nPlease ensure AIML_AWS_REGION, SERVCE_URL, SNS_ROLE_ARN, AWS_ACCOUNT_ID environment Variables are set."
                throw error;
                break;
            }
            else {
                // winston.debug('Currently running in', + environment);
                var port = envConfig.port;
                var name = envConfig.name;
                config = {
                    environment: environment,
                    aws_region: process.env.AIML_AWS_REGION,
                    cognito_region: process.env.AIML_AWS_REGION,
                    aws_account: process.env.AWS_ACCOUNT_ID,
                    domain: process.env.SERVICE_URL,
                    service_url: envConfig.protocol + process.env.SERVICE_URL,
                    name: name,
                    table: {
                        user: envConfig.table.user,
                        tenant: envConfig.table.tenant,
                        acm: envConfig.table.acm,
                        outsourcing: envConfig.table.outsourcing,
                        systemResource: envConfig.table.systemResource,
                        employment: envConfig.table.employment,
                        payroll: envConfig.table.payroll,
                        directory: envConfig.table.directory,
                        recruitment: envConfig.table.recruitment,
                        reportsAnalytics: envConfig.table.reportsAnalytics,
                        leave: envConfig.table.leave,
                        workSchedule: envConfig.table.workSchedule,
                        workflow: envConfig.table.workflow,
                        scheduledJobs: envConfig.table.scheduledJobs,
                        otherServices: envConfig.table.otherServices
                    },
                    userRole: envConfig.userRole,
                    role: {
                        sns: process.env.SNS_ROLE_ARN
                    },
                    tier: envConfig.tier,
                    port: port,
                    loglevel: envConfig.log.level,
                    url: {
                        tenant: envConfig.protocol + process.env.SERVICE_URL + '/tenant',
                        user: envConfig.protocol + process.env.SERVICE_URL + '/user',
                        reg: envConfig.protocol + process.env.SERVICE_URL + '/reg',
                        auth: envConfig.protocol + process.env.SERVICE_URL + '/auth',
                        sys: envConfig.protocol + process.env.SERVICE_URL + '/sys',
                        acm: envConfig.protocol + process.env.SERVICE_URL + '/acm-svc',
                        outsourcing: envConfig.protocol + process.env.SERVICE_URL + '/outsourcing-svc',
                        systemResource: envConfig.protocol + process.env.SERVICE_URL + '/srm-svc',
                        employment: envConfig.protocol + process.env.SERVICE_URL + '/employment-svc',
                        payroll: envConfig.protocol + process.env.SERVICE_URL + '/payroll-svc',
                        reportsAnalytics: envConfig.protocol + process.env.SERVICE_URL + '/ra-svc',
                        leave: envConfig.protocol + process.env.SERVICE_URL + '/leave-svc',
                        workflow: envConfig.protocol + process.env.SERVICE_URL + '/workflow-svc',
                        workSchedule: envConfig.protocol + process.env.SERVICE_URL + '/schedule-svc',
                        directory: envConfig.protocol + process.env.SERVICE_URL + '/directory-svc',
                        recruitment: envConfig.protocol + process.env.SERVICE_URL + '/recruitment-svc',
                        scheduledJobs: envConfig.protocol + process.env.SERVICE_URL + '/scheduled-jobs',
                        login: envConfig.loginUrl
                    },
                    asset: logoUrl,
                    others: envConfig.others
                }
                return config;
                break;
            }
        case "staging":

            if( process.env.AIML_AWS_REGION == undefined || 
                process.env.SERVICE_URL == undefined || 
                process.env.SNS_ROLE_ARN == undefined || 
                process.env.AWS_ACCOUNT_ID == undefined)
            {
                var error = "Staging Environment Variables Not Properly Configured. \nPlease ensure AIML_AWS_REGION, SERVCE_URL, SNS_ROLE_ARN, AWS_ACCOUNT_ID environment Variables are set."
                throw error;
                break;
            }
            else {
                // winston.debug('Currently running in', + environment);
                var port = envConfig.port;
                var name = envConfig.name;
                config = {
                    environment: environment,
                    aws_region: process.env.AIML_AWS_REGION,
                    cognito_region: process.env.AIML_AWS_REGION,
                    aws_account: process.env.AWS_ACCOUNT_ID,
                    domain: process.env.SERVICE_URL,
                    service_url: envConfig.protocol + process.env.SERVICE_URL,
                    name: name,
                    table: {
                        user: envConfig.table.user,
                        tenant: envConfig.table.tenant,
                        acm: envConfig.table.acm,
                        outsourcing: envConfig.table.outsourcing,
                        systemResource: envConfig.table.systemResource,
                        employment: envConfig.table.employment,
                        payroll: envConfig.table.payroll,
                        directory: envConfig.table.directory,
                        recruitment: envConfig.table.recruitment,
                        reportsAnalytics: envConfig.table.reportsAnalytics,
                        leave: envConfig.table.leave,
                        workSchedule: envConfig.table.workSchedule,
                        workflow: envConfig.table.workflow,
                        scheduledJobs: envConfig.table.scheduledJobs,
                        otherServices: envConfig.table.otherServices
                    },
                    userRole: envConfig.userRole,
                    role: {
                        sns: process.env.SNS_ROLE_ARN
                    },
                    tier: envConfig.tier,
                    port: port,
                    loglevel: envConfig.log.level,
                    url: {
                        tenant: envConfig.protocol + process.env.SERVICE_URL + '/tenant',
                        user: envConfig.protocol + process.env.SERVICE_URL + '/user',
                        reg: envConfig.protocol + process.env.SERVICE_URL + '/reg',
                        auth: envConfig.protocol + process.env.SERVICE_URL + '/auth',
                        sys: envConfig.protocol + process.env.SERVICE_URL + '/sys',
                        acm: envConfig.protocol + process.env.SERVICE_URL + '/acm-svc',
                        outsourcing: envConfig.protocol + process.env.SERVICE_URL + '/outsourcing-svc',
                        systemResource: envConfig.protocol + process.env.SERVICE_URL + '/srm-svc',
                        employment: envConfig.protocol + process.env.SERVICE_URL + '/employment-svc',
                        payroll: envConfig.protocol + process.env.SERVICE_URL + '/payroll-svc',
                        reportsAnalytics: envConfig.protocol + process.env.SERVICE_URL + '/ra-svc',
                        leave: envConfig.protocol + process.env.SERVICE_URL + '/leave-svc',
                        workflow: envConfig.protocol + process.env.SERVICE_URL + '/workflow-svc',
                        workSchedule: envConfig.protocol + process.env.SERVICE_URL + '/schedule-svc',
                        directory: envConfig.protocol + process.env.SERVICE_URL + '/directory-svc',
                        recruitment: envConfig.protocol + process.env.SERVICE_URL + '/recruitment-svc',
                        scheduledJobs: envConfig.protocol + process.env.SERVICE_URL + '/scheduled-jobs',
                        login: envConfig.loginUrl
                    },
                    asset: logoUrl,
                    others: envConfig.others
                }
                return config;
                break;
            }
        case "development":
            if( process.env.AIML_AWS_REGION == undefined || 
                process.env.SERVICE_URL == undefined || 
                process.env.SNS_ROLE_ARN == undefined || 
                process.env.AWS_ACCOUNT_ID == undefined)
            {
                var error = "Development Environment Variables Not Properly Configured. \nPlease ensure AIML_AWS_REGION, SERVCE_URL, SNS_ROLE_ARN, AWS_ACCOUNT_ID environment Variables are set."
                throw error;
                break;
            }
            else {
                // winston.debug('Currently running in', + environment);
                var port = envConfig.port;
                var name = envConfig.name;
                config = {
                    environment: environment,
                    aws_region: process.env.AIML_AWS_REGION,
                    cognito_region: process.env.AIML_AWS_REGION,
                    aws_account: process.env.AWS_ACCOUNT_ID,
                    domain: process.env.SERVICE_URL,
                    service_url: envConfig.protocol + process.env.SERVICE_URL,
                    name: name,
                    table: {
                        user: envConfig.table.user,
                        tenant: envConfig.table.tenant,
                        acm: envConfig.table.acm,
                        outsourcing: envConfig.table.outsourcing,
                        systemResource: envConfig.table.systemResource,
                        employment: envConfig.table.employment,
                        payroll: envConfig.table.payroll,
                        directory: envConfig.table.directory,
                        recruitment: envConfig.table.recruitment,
                        reportsAnalytics: envConfig.table.reportsAnalytics,
                        leave: envConfig.table.leave,
                        workSchedule: envConfig.table.workSchedule,
                        workflow: envConfig.table.workflow,
                        scheduledJobs: envConfig.table.scheduledJobs,
                        otherServices: envConfig.table.otherServices
                    },
                    userRole: envConfig.userRole,
                    role: {
                        sns: process.env.SNS_ROLE_ARN
                    },
                    tier: envConfig.tier,
                    port: port,
                    loglevel: envConfig.log.level,
                    url: {
                        tenant: envConfig.protocol + process.env.SERVICE_URL + '/tenant',
                        user: envConfig.protocol + process.env.SERVICE_URL + '/user',
                        reg: envConfig.protocol + process.env.SERVICE_URL + '/reg',
                        auth: envConfig.protocol + process.env.SERVICE_URL + '/auth',
                        sys: envConfig.protocol + process.env.SERVICE_URL + '/sys',
                        acm: envConfig.protocol + process.env.SERVICE_URL + '/acm-svc',
                        outsourcing: envConfig.protocol + process.env.SERVICE_URL + '/outsourcing-svc',
                        systemResource: envConfig.protocol + process.env.SERVICE_URL + '/srm-svc',
                        employment: envConfig.protocol + process.env.SERVICE_URL + '/employment-svc',
                        payroll: envConfig.protocol + process.env.SERVICE_URL + '/payroll-svc',
                        reportsAnalytics: envConfig.protocol + process.env.SERVICE_URL + '/ra-svc',
                        leave: envConfig.protocol + process.env.SERVICE_URL + '/leave-svc',
                        workflow: envConfig.protocol + process.env.SERVICE_URL + '/workflow-svc',
                        workSchedule: envConfig.protocol + process.env.SERVICE_URL + '/schedule-svc',
                        directory: envConfig.protocol + process.env.SERVICE_URL + '/directory-svc',
                        recruitment: envConfig.protocol + process.env.SERVICE_URL + '/recruitment-svc',
                        scheduledJobs: envConfig.protocol + process.env.SERVICE_URL + '/scheduled-jobs',
                        login: envConfig.loginUrl
                    },
                    asset: logoUrl,
                    others: envConfig.others
                }
                return config;
                break;
            }
        case "local":
            // console.log("Local env. settings.");
            var port = envConfig.port;
            var name = envConfig.name;
            var table = envConfig.table;

            config = {
                environment: environment,
                aws_region: envConfig.region,
                cognito_region: envConfig.region,
                aws_account: envConfig.aws_account,
                domain: envConfig.domain,
                service_url: envConfig.protocol + envConfig.domain,
                name: name,
                table: {
                    user: envConfig.table.user,
                    tenant: envConfig.table.tenant,
                    acm: envConfig.table.acm,
                    outsourcing: envConfig.table.outsourcing,
                    systemResource: envConfig.table.systemResource,
                    employment: envConfig.table.employment,
                    payroll: envConfig.table.payroll,
                    directory: envConfig.table.directory,
                    recruitment: envConfig.table.recruitment,
                    otherServices: envConfig.table.otherServices
                },
                userRole: envConfig.userRole,
                role: {
                    sns: process.env.SNS_ROLE_ARN
                },
                tier: envConfig.tier,
                port: port,
                loglevel: envConfig.log.level,
                url: {
                    tenant: envConfig.protocol + envConfig.domain + ':' + port.tenant + '/tenant',
                    user: envConfig.protocol + envConfig.domain + ':' + port.user +  '/user',
                    reg: envConfig.protocol + envConfig.domain + ':' + port.reg + '/reg',
                    auth: envConfig.protocol + envConfig.domain + ':' + port.auth + '/auth',
                    sys: envConfig.protocol + envConfig.domain + ':' + port.sys + '/sys',
                    login: envConfig.loginUrl
                },
                asset: logoUrl,
                others: envConfig.others
            }

                return config;
                break;

        default:
            var error = 'No Environment Configured. \n Option 1: Please configure Environment Variable. \n Option 2: Manually override environment in config function.';
            throw error;
    }

}