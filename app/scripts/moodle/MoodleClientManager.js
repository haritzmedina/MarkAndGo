const MoodleClient = require('./MoodleClient')
const _ = require('lodash')
const MoodleFunctions = require('./MoodleFunctions')
const APISimulation = require('./APISimulation')

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
        this.tokens = result.tokens
        this.moodleClient = new MoodleClient(this.moodleEndpoint)
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  getRubric (cmids, callback) {
    if (_.isFunction(callback)) {
      // TODO Check if API simulation is enabled
      let apiSimulation = true
      if (apiSimulation) {
        APISimulation.getRubric(cmids, callback)
      } else {
        let token = this.getTokenFor(MoodleFunctions.getRubric.wsFunc)
        if (_.isString(token)) {
          this.moodleClient.updateToken(token)
          this.moodleClient.getRubric(cmids, callback)
        } else {
          callback(new Error('NoPermissions'))
        }
      }
    }
  }

  updateStudentGradeWithRubric (data, callback) {
    if (_.isFunction(callback)) {
      let token = this.getTokenFor(MoodleFunctions.updateStudentsGradeWithRubric.wsFunc)
      if (_.isString(token)) {
        this.moodleClient.updateToken(token)
        this.moodleClient.updateStudentGradeWithRubric(data, callback)
      } else {
        callback(new Error('NoPermissions'))
      }
    }
  }

  getStudents (courseId, callback) {
    if (_.isFunction(callback)) {
      let token = this.getTokenFor(MoodleFunctions.updateStudentsGradeWithRubric.wsFunc)
      if (_.isString(token)) {
        this.moodleClient.updateToken(token)
        this.moodleClient.getStudents(courseId, callback)
      } else {
        callback(new Error('NoPermissions'))
      }
    }
  }

  getTokenFor (wsFunction) {
    let tokenWrapper = _.find(this.tokens, (token) => {
      return _.find(token.tests, (test) => {
        return test.service === wsFunction && test.enabled
      })
    })
    if (tokenWrapper) {
      return tokenWrapper.token
    } else {
      return null
    }
  }
}

module.exports = MoodleClientManager
