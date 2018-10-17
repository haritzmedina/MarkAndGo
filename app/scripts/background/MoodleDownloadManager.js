const _ = require('lodash')
const URLUtils = require('../utils/URLUtils')
const ChromeStorage = require('../utils/ChromeStorage')

class MoodleDownloadManager {
  constructor () {
    this.files = {}
  }

  init () {
    chrome.downloads.onCreated.addListener((downloadItem) => {
      // Get required data to mark on moodle
      let hashParams = URLUtils.extractHashParamsFromUrl(downloadItem.url, ':')
      let studentId = hashParams['studentId']
      if (_.isString(studentId)) { // File is downloaded from moodle
        // Save file metadata and data to mark on moodle
        this.files[downloadItem.id] = {
          url: URLUtils.retrieveMainUrl(downloadItem.url),
          studentId: studentId
        }
      }
    })

    chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
      if (this.files[downloadItem.id]) { // Only for files download from moodle
        ChromeStorage.getData('fileFormats', ChromeStorage.sync, (err, fileExtensions) => {
          if (err) {
            suggest() // Suggest default
          } else {
            let fileExtensionArray = JSON.parse(fileExtensions.data).split(',')
            let originalFilenameExtension = _.last(downloadItem.filename.split('.'))
            let matchExtension = _.find(fileExtensionArray, (ext) => { return ext === originalFilenameExtension })
            if (_.isString(matchExtension)) {
              suggest({filename: downloadItem.filename + '.txt'})
            } else {
              suggest()
            }
          }
        })
        // Async suggestion
        return true
      } else {
        return false
      }
    })

    chrome.downloads.onChanged.addListener((downloadItem) => {
      if (this.files[downloadItem.id] && downloadItem.filename && downloadItem.filename.current) {
        // Save download file path
        if (downloadItem.filename.current.startsWith('/')) { // Unix-based filesystem
          this.files[downloadItem.id]['localPath'] = encodeURI('file://' + downloadItem.filename.current)
        } else { // Windows-based filesystem
          this.files[downloadItem.id]['localPath'] = encodeURI('file:///' + _.replace(downloadItem.filename.current, /\\/g, '/'))
        }
      }
    })

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'annotationFile') {
        if (request.cmd === 'fileMetadata') {
          if (request.data.filepath) {
            let file = _.find(this.files, (file) => {
              if (file.localPath === request.data.filepath) {
                return file
              }
            })
            sendResponse({file: file})
          }
        } else if (request.cmd === 'setPlainTextFileExtension') {
          // TODO
          ChromeStorage.setData('fileFormats', {data: JSON.stringify(request.data.fileExtensions)}, ChromeStorage.sync, () => {
            sendResponse({err: null})
          })
        } else if (request.cmd === 'getPlainTextFileExtension') {
          // TODO
          ChromeStorage.getData('fileFormats', ChromeStorage.sync, (err, fileExtensions) => {
            if (err) {
              sendResponse({err: err})
            } else {
              if (fileExtensions) {
                let parsedFileExtensions = JSON.parse(fileExtensions.data)
                sendResponse({fileExtensions: parsedFileExtensions || ''})
              } else {
                sendResponse({fileExtensions: ''})
              }
            }
          })
        }
      }
    })
  }
}

module.exports = MoodleDownloadManager
