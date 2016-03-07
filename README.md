# aws-lambda-deployer

[![npm](https://img.shields.io/npm/v/aws-lambda-deployer.svg)](https://www.npmjs.com/package/aws-lambda-deployer) [![Dependencies](https://img.shields.io/david/zentrick/aws-lambda-deployer.svg)](https://david-dm.org/zentrick/aws-lambda-deployer) [![Build Status](https://img.shields.io/travis/zentrick/aws-lambda-deployer.svg)](https://travis-ci.org/zentrick/aws-lambda-deployer) [![Coverage Status](https://img.shields.io/coveralls/zentrick/aws-lambda-deployer.svg)](https://coveralls.io/r/zentrick/aws-lambda-deployer) [![JavaScript Standard Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/feross/standard)

Facilitates deploying multiple Node.js-based AWS Lambda functions to multiple
environments.

For each of your functions, this module runs `npm install --production`
(using npm 2), creates a zip file, and deploys it to one or more environments.
Environments are currently identified by prefixing the function name with the
environment name.

## Usage

```js
import AwsLambdaDeployer from 'aws-lambda-deployer'

const functionNames = ['lambda-one', 'lambda-two']
const options = {
  environments: [],
  prefix: '',
  region: 'us-east-1',
  handler: 'index.handler',
  role: null,
  functionDirTemplate: '<%= functionName %>',
  metaPathTemplate: '<%= functionDir %>/meta.json',
  descriptionTemplate: 'Deployed on <%= new Date().toUTCString() %>',
  concurrency: 3
}
const deployer = new AwsLambdaDeployer(functionNames, options)
deployer.run()
  .then(() => console.info('Deployment completed'))
  .catch((error) => console.info('Deployment failed:', error))
```

For each function that you wish to deploy, you need to provide a directory
containing at least the following files:

* `index.js` (can be overridden using the `handler` option)
* `package.json`
* `meta.json`

The `meta.json` file configures the function's `timeout` (in seconds) and
`memorySize` (in megabytes):

```json
{
  "timeout": 3,
  "memorySize": 256
}
```

You can also use `memory` as an alias for `memorySize`.

To provide your access key ID and secret access key for AWS, use any of the
[standard mechanisms](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html).
It is not possible to pass your credentials to a deployer directly.

## API

### new AwsLambdaDeployer(functionNames, options)

Creates a new deployer.

### deployer.run()

Performs deployment. Installs, zips, and uploads each function. Returns a
promise that gets fulfilled when all functions have been deployed.

## Options

The default values for all options are shown in the example above.

Note that all options currently apply to all functions, meaning you cannot (yet)
override them on a per-function basis.

### environments

An array of environment names. For example, `['dev', 'prod']`.

The environment names are used to construct the name of the function on AWS
Lambda, by prefixing the original function name with the environment name
followed by a hyphen. For example, for `function-one`, the Lambda function in
the `dev` environment would be named `dev-function-one`.

### prefix

The string value with which to prefix each function name.

You'll most likely want to use this option to identify the app or service
encompassing your Lambdas. Combined with `environments`, it lets you assign
Lambda names such as `myapp-dev-lambda-one`. In this example, `prefix` would be
`myapp-` (including the hyphen).

### region

The AWS region in which the functions should be deployed.

### handler

The entry point of the functions. The default value `index.handler` means that
each function's `index.js` module exports a `handler` function.

### role

The ARN of the role under which to run the functions.

### functionDirTemplate

By default, this module assumes that the current working directory contains a
subdirectory per function. You can override this by passing in a template string
containing the `functionName`.

### metaPathTemplate

Similar to the path to the function directory, this option configures the path
to each function's `meta.json` file. You can use the parameters `functionName`
and `functionDir`.

### descriptionTemplate

By default, each function's description will be updated with the time of
deployment. You can use the `descriptionTemplate` option to have the description
include a version string, for example.

### concurrency

The number of functions to package or deploy simultaneously.

## Events

Rather than just awaiting the promise, you'll probably want to track progress.
A deployer exposes a number of events for this purpose. Here's a boilerplate
implementation of a verbose logger:

```js
deployer.on('willPackageFunctions', ({functionNames}) =>
  console.info('Packaging', functionNames.length, 'function(s) ...'))
deployer.on('didPackageFunctions', ({functionNames}) =>
  console.info('Packaged', functionNames.length, 'function(s)'))
deployer.on('willPackageFunction', ({functionName, functionDir, zipFilePath, metaFilePath}) =>
  console.info('Packaging function', functionName, '...'))
deployer.on('didPackageFunction', ({functionName, functionDir, zipFilePath, metaFilePath}) =>
  console.info('Packaged function', functionName))
deployer.on('willInstallFunction', ({functionName, functionDir, zipFilePath, metaFilePath}) =>
  console.info('Installing function', functionName, 'to', functionDir, '...'))
deployer.on('didInstallFunction', ({functionName, functionDir, zipFilePath, metaFilePath}) =>
  console.info('Installed function', functionName))
deployer.on('willZipFunction', ({functionName, functionDir, zipFilePath, metaFilePath}) =>
  console.info('Zipping function', functionName, 'to', zipFilePath, '...'))
deployer.on('didZipFunction', ({functionName, functionDir, zipFilePath, metaFilePath}) =>
  console.info('Zipped function', functionName))
deployer.on('willDeployToEnvironments', ({environmentNames}) =>
  console.info('Deploying to', environmentNames.length, 'environment(s) ...'))
deployer.on('didDeployToEnvironments', ({environmentNames}) =>
  console.info('Deployed to', environmentNames.length, 'environment(s)'))
deployer.on('willDeployFunctions', ({environmentName, functionNames}) =>
  console.info('Deploying', functionNames.length, 'function(s) to environment', environmentName, '...'))
deployer.on('didDeployFunctions', ({environmentName, functionNames}) =>
  console.info('Deployed', functionNames.length, 'function(s) to environment', environmentName))
deployer.on('willDeployFunction', ({environmentName, functionName, remoteFunctionName, zipFilePath, zipFileSize}) =>
  console.info('Deploying function', functionName, 'to environment', environmentName, 'as', remoteFunctionName + ': uploading', zipFileSize, 'bytes ...'))
deployer.on('didDeployFunction', ({environmentName, functionName, remoteFunctionName, zipFilePath, zipFileSize}) =>
  console.info('Deployed function', functionName, 'to environment', environmentName, 'as', remoteFunctionName))
```

## Maintainer

- [Tim De Pauw](https://github.com/timdp)

## License

MIT
