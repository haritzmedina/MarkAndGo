const _ = require('lodash')
const MoodleContentScript = require('./moodle/MoodleContentScript')

window.addEventListener('load', () => {
  console.debug('Loaded moodle content script')
  // When page is loaded, popup button should be always deactivated
  chrome.runtime.sendMessage({scope: 'extension', cmd: 'deactivatePopup'}, (result) => {
    console.log('Deactivated popup')
  })
  // When popup button is clicked
  chrome.extension.onMessage.addListener((msg, sender, sendResponse) => {
    if (_.isEmpty(window.hag)) {
      if (msg.action === 'initContentScript') {
        window.hag = {}
        window.hag.moodleContentScript = new MoodleContentScript()
        window.hag.moodleContentScript.init(() => {
          // Disable the button of popup
          chrome.runtime.sendMessage({scope: 'extension', cmd: 'deactivatePopup'}, (result) => {
            console.log('Deactivated popup')
          })
          window.hag = null
        })
      }
    }
  })
})
