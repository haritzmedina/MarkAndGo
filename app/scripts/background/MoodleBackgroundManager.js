const axios = require('axios')
const _ = require('lodash')
const ChromeStorage = require('../utils/ChromeStorage')

const MoodleClient = require('../moodle/MoodleClient')

class MoodleBackgroundManager {
  init () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'moodle') {
        if (request.cmd === 'getTokenForEndpoint') {
          if (_.isString(request.data.endpoint)) {
            let endpoint = request.data.endpoint
            this.getTokens(endpoint, (err, tokens) => {
              if (err) {

              } else {
                this.testTokens({endpoint, tokens}, (err, token) => {
                  if (err) {
                    sendResponse({err: err})
                  } else {
                    // Return token in response
                    sendResponse({token: token})
                  }
                })
              }
            })
          }
        } else if (request.cmd === 'setMoodleCustomEndpoint') {
          let endpoint = request.data.endpoint
          ChromeStorage.setData('moodleCustomEndpoint', {data: JSON.stringify(endpoint)}, ChromeStorage.sync, (err, data) => {
            if (err) {
              sendResponse({err: err})
            } else {
              sendResponse({endpoint: endpoint})
            }
          })
        } else if (request.cmd === 'getMoodleCustomEndpoint') {
          ChromeStorage.getData('moodleCustomEndpoint', ChromeStorage.sync, (err, endpoint) => {
            if (err) {
              sendResponse({err: err})
            } else {
              if (endpoint) {
                let parsedEndpoint = JSON.parse(endpoint.data)
                sendResponse({endpoint: parsedEndpoint || ''})
              } else {
                sendResponse({endpoint: ''})
              }
            }
          })
        }
      }
    })
  }

  getTokens (endpoint, callback) {
    // Open preferences page
    axios.get(endpoint + 'user/preferences.php')
      .then((response) => {
        let parser = new window.DOMParser()
        let docPreferences = parser.parseFromString(response.data, 'text/html')
        let tokenLinkElement = docPreferences.querySelector('a[href*="managetoken.php"]')
        if (_.isElement(tokenLinkElement)) {
          let manageToken = tokenLinkElement.href
          // Open managetokens page
          axios.get(manageToken)
            .then((response) => {
              // Retrieve all tokens
              let docManageToken = parser.parseFromString(response.data, 'text/html')
              let tokenElements = docManageToken.querySelectorAll('.c0:not([scope="col"])')
              if (!_.isEmpty(tokenElements)) {
                let tokens = _.map(tokenElements, (tokenElement) => {
                  console.log(tokenElement.innerText)
                  return tokenElement.innerText
                })
                callback(null, tokens)
              } else {
                callback(new Error('Unable to retrieve tokens from DOM'))
              }
            })
        } else {
          callback(new Error('Unable to open managetoken.php. Are you subscribed to any service?'))
        }
      })
  }

  testTokens ({endpoint, tokens}, callback) {
    if (_.isFunction(callback)) {
      // Test all tokens
      if (_.isString(endpoint) && !_.isEmpty(tokens)) {
        let promises = []
        for (let i = 0; i < tokens.length; i++) {
          let token = tokens[i]
          promises.push(new Promise((resolve) => {
            let moodleClient = new MoodleClient(endpoint, token)
            moodleClient.getRubric('0', (err, result) => {
              if (err || result.exception === 'webservice_access_exception') {
                resolve({token: token, enabled: false, service: 'core_grading_get_definitions'})
              } else {
                moodleClient.updateStudentGradeWithRubric({}, (err, result) => {
                  if (err || result.exception === 'webservice_access_exception') {
                    resolve({token: token, enabled: false, service: 'mod_assign_save_grade'})
                  } else {
                    resolve({token: token, enabled: true})
                  }
                })
              }
            })
          }))
        }
        Promise.all(promises).then((resolves) => {
          let resolve = _.find(resolves, (resolve) => {
            return resolve.enabled
          })
          if (_.isObject(resolve)) {
            callback(null, resolve.token)
          } else {
            callback(new Error('None of the tokens have the required permissions'))
          }
        })
      }
    } else {
      console.error('No callback defined')
    }
  }
}

module.exports = MoodleBackgroundManager
