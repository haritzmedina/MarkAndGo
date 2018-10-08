const MoodleClient = require('./MoodleClient')
const _ = require('lodash')

class MoodleClientManager {
  constructor (moodleEndPoint) {
    this.moodleEndpoint = moodleEndPoint
  }

  init (callback) {
    // Retrieve token from moodle
    chrome.runtime.sendMessage({scope: 'moodle', cmd: 'getTokenForEndpoint', data: {endpoint: this.moodleEndpoint}}, (result) => {
      if (result.err) {
        // TODO Swal err
        console.error(result.err)
      } else {
        this.token = result.token
        this.moodleClient = new MoodleClient(this.moodleEndpoint, this.token)
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }
}

module.exports = MoodleClientManager
