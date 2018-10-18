const MoodleClient = require('./MoodleClient')
const _ = require('lodash')

class MoodleClientManager {
  constructor (moodleEndPoint) {
    if (_.isNull(moodleEndPoint)) {
      console.error('Moodle client manager requires a moodle endpoint')
    } else {
      this.moodleEndpoint = moodleEndPoint
    }
  }

  init (callback) {
    // Retrieve token from moodle
    chrome.runtime.sendMessage({scope: 'moodle', cmd: 'getTokenForEndpoint', data: {endpoint: this.moodleEndpoint}}, (result) => {
      if (result.err) {
        callback(new Error('Unable to retrieve valid token'))
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
