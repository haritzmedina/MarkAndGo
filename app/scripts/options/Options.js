const URLUtils = require('../utils/URLUtils')

class Options {
  init () {
    // Load configuration
    chrome.runtime.sendMessage({scope: 'annotationFile', cmd: 'getPlainTextFileExtension'}, (fileExtensions) => {
      document.querySelector('#fileFormats').value = fileExtensions.fileExtensions
    })

    chrome.runtime.sendMessage({scope: 'moodle', cmd: 'getMoodleCustomEndpoint'}, (endpoint) => {
      document.querySelector('#moodleEndpoint').value = endpoint.endpoint
    })

    document.querySelector('#fileFormats').addEventListener('change', () => {
      this.updateFileFormats()
    })

    document.querySelector('#moodleEndpoint').addEventListener('change', () => {
      this.updateMoodleEndpoint()
    })

    window.addEventListener('beforeunload', () => {
      this.updateMoodleEndpoint()
      this.updateFileFormats()
    })
  }

  updateFileFormats () {
    let value = document.querySelector('#fileFormats').value
    chrome.runtime.sendMessage({
      scope: 'annotationFile',
      cmd: 'setPlainTextFileExtension',
      data: {fileExtensions: value}
    }, (fileMetadata) => {
      console.debug(fileMetadata)
    })
  }

  updateMoodleEndpoint () {
    let value = document.querySelector('#moodleEndpoint').value
    let isValidUrl = URLUtils.isUrl(value)
    if (!isValidUrl) {
      isValidUrl = URLUtils.isUrl(value + '/')
      if (isValidUrl) {
        document.querySelector('#moodleEndpoint').value = value + '/'
      }
    }
    if (isValidUrl) {
      chrome.runtime.sendMessage({
        scope: 'moodle',
        cmd: 'setMoodleCustomEndpoint',
        data: {endpoint: value}
      }, (endpoint) => {
        console.debug('Endpoint updated to ' + endpoint.endpoint)
      })
    } else {
      window.alert('URL is malformed') // TODO i18n
    }
  }
}

module.exports = Options