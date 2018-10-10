const _ = require('lodash')
const URLUtils = require('../utils/URLUtils')

class MoodleDownloadManager {
  constructor () {
    this.files = {}
  }

  init () {
    chrome.downloads.onCreated.addListener((downloadItem) => {
      // Get required data to mark on moodle
      let hashParams = URLUtils.extractHashParamsFromUrl(downloadItem.url, ':')
      let studentId = hashParams['studentId']
      // Save file metadata and data to mark on moodle
      this.files[downloadItem.id] = {
        url: URLUtils.retrieveMainUrl(downloadItem.url),
        studentId: studentId
      }
    })

    chrome.downloads.onChanged.addListener((downloadItem) => {
      if (this.files[downloadItem.id] && downloadItem.filename && downloadItem.filename.current) {
        // Save download file path
        this.files[downloadItem.id]['localPath'] = encodeURI('file://' + downloadItem.filename.current)
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
        }
      }
    })
  }
}

module.exports = MoodleDownloadManager
