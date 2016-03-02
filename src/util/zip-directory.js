'use strict'

import archiver from 'archiver'
import fs from 'fs'

export default (dir, zipFile) => new Promise((resolve, reject) => {
  const out = fs.createWriteStream(zipFile)
  out.once('close', resolve)
  out.once('error', reject)
  const archive = archiver('zip')
  archive.once('error', reject)
  archive.pipe(out)
  archive.directory(dir, '')
  archive.finalize()
})
