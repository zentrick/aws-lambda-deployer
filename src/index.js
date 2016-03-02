'use strict'

import Promise from 'bluebird'
import awsLambda from 'node-aws-lambda'
import fsp from 'fs-promise'
import mkdirp_ from 'mkdirp'
import temp from 'temp'
import pify from 'pify'
import template from 'lodash.template'
import spawn from './util/spawn'
import zipDirectory from './util/zip-directory'
import {EventEmitter} from 'events'
import path from 'path'

const mkdirp = pify(mkdirp_)
const tempMkdir = pify(temp.mkdir).bind(temp)
const tempCleanup = pify(temp.cleanup).bind(temp)
const lambdaDeploy = pify(awsLambda.deploy).bind(awsLambda)

const npm = path.resolve(__dirname, '../node_modules/.bin/npm')

export default class AwsLambdaDeployer extends EventEmitter {
  constructor (functionNames, options = {}) {
    super()
    this._functionNames = functionNames
    this._options = Object.assign({
      environments: [],
      region: 'us-east-1',
      handler: 'index.handler',
      role: null,
      prefix: '',
      concurrency: 3,
      functionDirTemplate: '<%= functionName %>',
      metaPathTemplate: '<%= functionName %>/meta.json',
      descriptionTemplate: 'Deployed on <%= new Date().toUTCString() %>'
    }, options)
    this._functionDirTemplate = template(this._options.functionDirTemplate)
    this._metaPathTemplate = template(this._options.metaPathTemplate)
    this._descriptionTemplate = template(this._options.descriptionTemplate)
    this._metaByFunctionName = {}
    this._sizeByZip = {}
  }

  run () {
    temp.track()
    return tempMkdir('deploy')
      .then((tempDir) => { this._tempDir = tempDir })
      .then(() => this._createPackages())
      .then(() => this._deployPackages())
      .then(() => tempCleanup())
  }

  _createPackages () {
    const eventData = {functionNames: this._functionNames}
    this.emit('willPackageFunctions', eventData)
    return Promise.map(this._functionNames, (func) => this._createPackage(func), {concurrency: this._options.concurrency})
      .then(() => this.emit('didPackageFunctions', eventData))
  }

  _createPackage (functionName) {
    const functionDir = this._functionDirTemplate({functionName})
    const zipFilePath = this._toZipPath(functionName)
    const metaFilePath = this._metaPathTemplate({functionName})
    const eventData = {functionName, functionDir, zipFilePath, metaFilePath}
    this.emit('willPackageFunction', eventData)
    this.emit('willReadFunctionMetaFile', eventData)
    return fsp.readJson(metaFilePath)
      .then((meta) => { this._metaByFunctionName[functionName] = meta })
      .then(() => this.emit('didReadFunctionMetaFile', eventData))
      .then(() => this.emit('willInstallFunction', eventData))
      .then(() => spawn(npm, ['install', '--production'], {cwd: functionDir}))
      .then(() => this.emit('didInstallFunction', eventData))
      .then(() => this.emit('willZipFunction', eventData))
      .then(() => mkdirp(path.dirname(zipFilePath)))
      .then(() => zipDirectory(functionDir, zipFilePath))
      .then(() => fsp.stat(zipFilePath))
      .then((stats) => { this._sizeByZip[zipFilePath] = stats.size })
      .then(() => this.emit('didZipFunction', eventData))
      .then(() => this.emit('didPackageFunction', eventData))
  }

  _deployPackages () {
    const environmentNames = (Array.isArray(this._options.environments) && this._options.environments.length > 0)
      ? this._options.environments : [null]
    const eventData = {environmentNames}
    this.emit('willDeployToEnvironments', eventData)
    return Promise.each(environmentNames, (environmentName) => {
      const eventData = {environmentName, functionNames: this._functionNames}
      this.emit('willDeployFunctions', eventData)
      return Promise.map(this._functionNames, (functionName) => this._deployPackage(functionName, environmentName), {concurrency: this._options.concurrency})
        .then(() => this.emit('didDeployFunctions', eventData))
    }).then(() => this.emit('didDeployToEnvironments', eventData))
  }

  _deployPackage (functionName, environmentName) {
    const zipFilePath = this._toZipPath(functionName)
    const remoteFunctionName = this._options.prefix + ((environmentName != null) ? `${environmentName}-` : '') + functionName
    const functionMeta = this._metaByFunctionName[functionName]
    const eventData = {environmentName, functionName, remoteFunctionName, zipFilePath, zipFileSize: this._sizeByZip[zipFilePath]}
    this.emit('willDeployFunction', eventData)
    const config = {
      region: this._options.region,
      handler: this._options.handler,
      role: this._options.role,
      functionName: remoteFunctionName,
      description: this._descriptionTemplate({functionName}),
      timeout: functionMeta.timeout,
      memorySize: functionMeta.memorySize || functionMeta.memory,
      runtime: 'nodejs'
    }
    return lambdaDeploy(zipFilePath, config)
      .then(() => this.emit('didDeployFunction', eventData))
  }

  _toZipPath (functionName) {
    return `${this._tempDir}/${functionName}.zip`
  }
}
