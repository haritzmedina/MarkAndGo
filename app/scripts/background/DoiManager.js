const _ = require('lodash')
const Config = require('../Config')

class DoiManager {
  constructor () {
    this.dropbox = {'urls': ['*://www.dropbox.com/s/*?raw=1*']}
  }

  init () {
    // Request to dropbox
    chrome.webRequest.onHeadersReceived.addListener((responseDetails) => {
      let redirectUrl = _.find(responseDetails.responseHeaders, (header) => { return header.name.toLowerCase() === 'location' }).value
      let index = _.findIndex(responseDetails.responseHeaders, (header) => { return header.name.toLowerCase() === 'location' })
      redirectUrl += '#url::' + responseDetails.url.split('#')[0] // Get only the url of the document
      let annotationId = this.extractAnnotationId(responseDetails.url)
      if (annotationId) {
        redirectUrl += '&' + Config.exams.urlParamName + ':' + annotationId
      }
      responseDetails.responseHeaders[index].value = redirectUrl
      return {responseHeaders: responseDetails.responseHeaders}
    }, this.dropbox, ['responseHeaders', 'blocking'])
  }

  extractAnnotationId (url) {
    if (url.includes('#')) {
      let parts = url.split('#')[1].split(':')
      if (parts[0] === Config.exams.urlParamName) {
        return parts[1] || null
      }
    } else {
      return null
    }
  }
}

module.exports = DoiManager
