const _ = require('lodash')

class MoodleDownloadManager {
  constructor () {
    this.files = {}
  }

  init () {
    chrome.downloads.onCreated.addListener((downloadItem) => {
      this.files[downloadItem.id] = {
        url: downloadItem.url
        // TODO Get required data to push on moodle
      }
    })

    chrome.downloads.onChanged.addListener((downloadItem) => {
      if (this.files[downloadItem.id] && downloadItem.filename && downloadItem.filename.current) {
        // Save download file path
        this.files[downloadItem.id]['localPath'] = encodeURIComponent('file://' + downloadItem.filename.current)
      }
    })

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'annotationFile') {
        if (request.cmd === 'fileMetadata') {
          if (request.data.filename) {
            let file = _.find(this.files, (file) => {
              if (file.localPath === request.data.filename) {
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
