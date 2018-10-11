const _ = require('lodash')
const jsYaml = require('js-yaml')
const StudentLogging = require('./StudentLogging')
const Screenshots = require('./Screenshots')
const Config = require('../../Config')
const BackToWorkspace = require('./BackToWorkspace')
const MoodleGradingManager = require('./MoodleGradingManager')

class ExamDataExtractionContentScript {
  constructor () {
    this.backToSpreadsheetLink = null
    this.spreadsheetId = null
  }

  init (callback) {
    // Enable different functionality if current user is the teacher or student
    this.currentUserIsTeacher((err, isTeacher) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (isTeacher) { // Open modes
          window.abwa.specific = window.abwa.specific || {}

          window.abwa.specific.moodleGradingManager = new MoodleGradingManager()
          window.abwa.specific.moodleGradingManager.init()

          window.abwa.specific.backToWorkspace = new BackToWorkspace()
          window.abwa.specific.backToWorkspace.init()
        } else { // Change to checker mode
          window.abwa.specific = window.abwa.specific || {}
          // Log student reviewed the exam
          window.abwa.specific.studentLogging = new StudentLogging()
          window.abwa.specific.studentLogging.init()
          if (_.isFunction(callback)) {
            callback()
          }
        }
        // Enable screenshot functionality
        window.abwa.specific.screenshots = new Screenshots()
        window.abwa.specific.screenshots.init()
      }
    })
  }

  currentUserIsTeacher (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.groupSelector.currentGroup.url,
      order: 'desc',
      tags: Config.exams.namespace + ':' + Config.exams.tags.statics.teacher
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (annotations.length > 0) {
          let params = jsYaml.load(annotations[0].text)
          callback(null, params.teacherId === window.abwa.groupSelector.user.userid) // Return if current user is teacher
        } else {
          if (_.isFunction(callback)) {
            callback(null)
          }
        }
      }
    })
  }

  destroy () {
    // TODO Destroy managers
    try {
      if (window.abwa.specific) {
        if (window.abwa.specific.mappingStudyManager) {
          window.abwa.specific.mappingStudyManager.destroy()
        }
        if (window.abwa.specific.primaryStudySheetManager) {
          window.abwa.specific.primaryStudySheetManager.destroy()
        }
        if (window.abwa.specific.backToSpreadsheetLink) {
          window.abwa.specific.backToSpreadsheetLink.destroy()
        }
        if (window.abwa.specific.createAnnotationManager) {
          window.abwa.specific.createAnnotationManager.destroy()
        }
        if (window.abwa.specific.deleteAnnotationManager) {
          window.abwa.specific.deleteAnnotationManager.destroy()
        }
        if (window.abwa.specific.studentLogging) {
          window.abwa.specific.studentLogging.destroy()
        }
        if (window.abwa.specific.screenshots) {
          window.abwa.specific.screenshots.destroy()
        }
        if (window.abwa.specific.navigationRing) {
          window.abwa.specific.navigationRing.destroy()
        }
      }
    } catch (e) {
      // TODO Show user need to reload the page?
    }
  }
}

module.exports = ExamDataExtractionContentScript
