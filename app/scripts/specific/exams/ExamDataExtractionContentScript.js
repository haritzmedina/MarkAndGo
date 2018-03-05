const _ = require('lodash')
const jsYaml = require('js-yaml')
const BackToSpreadsheetLink = require('./BackToSpreadsheetLink')
const PrimaryStudySheetManager = require('./PrimaryStudySheetManager')
const MappingStudyManager = require('./MappingStudyManager')
const CreateAnnotationManager = require('./CreateAnnotationManager')
const DeleteAnnotationManager = require('./DeleteAnnotationManager')
const StudentsNavigationRing = require('./StudentsNavigationRing')
const ValidateAnnotationManager = require('./ValidateAnnotationManager')
const ReorderSpreadsheet = require('./ReorderSpreadsheet')
const Config = require('../../Config')

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
        if (isTeacher) { // Load posibility to updated the spreadsheet
          window.abwa.specific = window.abwa.specific || {}
          // Retrieve mapping study manager
          window.abwa.specific.mappingStudyManager = new MappingStudyManager()
          window.abwa.specific.mappingStudyManager.init(() => {
            // Retrieve primary study sheet
            window.abwa.specific.primaryStudySheetManager = new PrimaryStudySheetManager()
            window.abwa.specific.primaryStudySheetManager.init(() => {
              // Change order of elements in tag manager
              window.abwa.specific.reorderSpreadsheet = new ReorderSpreadsheet()
              window.abwa.specific.reorderSpreadsheet.init(() => {
                // Create link to back to spreadsheet
                window.abwa.specific.backToSpreadsheetLink = new BackToSpreadsheetLink()
                window.abwa.specific.backToSpreadsheetLink.init()
                // Create navigation ring
                window.abwa.specific.navigationRing = new StudentsNavigationRing()
                window.abwa.specific.navigationRing.init()
                // Create annotation handler
                window.abwa.specific.createAnnotationManager = new CreateAnnotationManager()
                window.abwa.specific.createAnnotationManager.init()
                // Delete annotation handler
                window.abwa.specific.deleteAnnotationManager = new DeleteAnnotationManager()
                window.abwa.specific.deleteAnnotationManager.init()
                // Validation handler
                window.abwa.specific.validateAnnotationManager = new ValidateAnnotationManager()
                window.abwa.specific.validateAnnotationManager.init()
                if (_.isFunction(callback)) {
                  callback()
                }
              })
            })
          })
        } else { // Change to checker mode
          window.abwa.modeManager.programmaticallyChangeToIndexMode()
          window.abwa.modeManager.programmaticallyDisableModeSelector()
          window.abwa.sidebar.openSidebar()
          if (_.isFunction(callback)) {
            callback()
          }
        }
        // Enable screenshot functionality
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
        if (window.abwa.specific.validateAnnotationManager) {
          window.abwa.specific.validateAnnotationManager.destroy()
        }
      }
    } catch (e) {
      // TODO Show user need to reload the page?
    }
  }
}

module.exports = ExamDataExtractionContentScript
