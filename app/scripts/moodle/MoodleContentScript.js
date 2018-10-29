const MoodleClientManager = require('./MoodleClientManager')
const MoodleFunctions = require('./MoodleFunctions')
const _ = require('lodash')
const Rubric = require('../model/Rubric')
const Criteria = require('../model/Criteria')
const Level = require('../model/Level')
const HypothesisClientManager = require('../hypothesis/HypothesisClientManager')
const Alerts = require('../utils/Alerts')
const LanguageUtils = require('../utils/LanguageUtils')
const CircularJSON = require('circular-json-es6')
const MoodleScraping = require('./MoodleScraping')

class MoodleContentScript {
  constructor () {
    this.assignmentId = null
    this.moodleEndpoint = null
    this.assignmentName = null
    this.hypothesisClientManager = null
  }

  init (callback) {
    this.showToolIsConfiguring()
    // Create hypothesis client
    this.initHypothesisClient(() => {
      MoodleScraping.scrapAssignmentData((err, assignmentData) => {
        if (err) {

        } else {
          this.cmid = assignmentData.cmid
          this.moodleEndpoint = assignmentData.moodleEndpoint
          this.assignmentName = assignmentData.assignmentName
          // Create moodle client
          this.moodleClientManager = new MoodleClientManager(this.moodleEndpoint)
          this.moodleClientManager.init((err) => {
            if (err) {
              // Unable to init moodle client manager
              Alerts.errorAlert({text: 'Unable to retrieve rubric from moodle, have you the required permissions to get the rubric via API?'})
              callback(err)
            } else {
              let promises = []
              // Get rubric
              promises.push(new Promise((resolve, reject) => {
                this.getRubric(assignmentData.cmid, assignmentData.courseId, (err, rubric) => {
                  if (err) {
                    reject(err)
                  } else {
                    resolve(rubric)
                  }
                })
              }))
              // Get students
              promises.push(new Promise((resolve, reject) => {
                this.getStudents(assignmentData.courseId, (err, rubric) => {
                  if (err) {
                    reject(err)
                  } else {
                    resolve(rubric)
                  }
                })
              }))
              Promise.all(promises).catch((rejects) => {
                Alerts.errorAlert({
                  title: 'Something went wrong',
                  text: rejects[0].message
                })
              }).then((resolves) => {
                let rubric = null
                let students = null
                if (LanguageUtils.isInstanceOf(resolves[0], Rubric)) {
                  rubric = resolves[0]
                  students = resolves[1]
                } else {
                  rubric = resolves[1]
                  students = resolves[0]
                }
                // Send task to background
                chrome.runtime.sendMessage({scope: 'task', cmd: 'createHighlighters', data: {rubric: CircularJSON.stringifyStrict(rubric), students: students, courseId: assignmentData.courseId}}, (result) => {
                  if (result.err) {
                    Alerts.errorAlert({
                      title: 'Something went wrong',
                      text: 'Error when sending createHighlighters to the background. Please try it again.'
                    })
                  } else {
                    let minutes = result.minutes
                    Alerts.infoAlert({
                      title: 'Configuration started',
                      text: 'We are configuring everything to start marking students exams using Mark&Go.' +
                        `This can take around <b>${minutes} minute(s)</b>.` +
                        'You can close this window, we will notify you when it is finished.'
                    })
                    // Show message
                    callback(null)
                  }
                })
              }).catch((rejects) => {
                Alerts.errorAlert({
                  title: 'Something went wrong',
                  text: rejects.message + '.\n' + chrome.i18n.getMessage('ContactAdministrator')
                })
              })
            }
          })
        }
      })
    })
  }

  getRubric (cmid, courseId, callback) {
    if (_.isFunction(callback)) {
      this.moodleClientManager.getRubric(cmid, (err, rubrics) => {
        if (err) {
          callback(new Error('Unable to get rubric from moodle. Check if you have the permission: ' + MoodleFunctions.getRubric.wsFunc))
        } else {
          this.constructRubricsModel({
            moodleRubrics: rubrics,
            courseId: courseId,
            callback: callback
          })
        }
      })
    }
  }

  getStudents (courseId, callback) {
    this.moodleClientManager.getStudents(courseId, (err, students) => {
      if (err) {
        callback(new Error('Unable to get students from moodle. Check if you have the permission: ' + MoodleFunctions.getStudents.wsFunc))
      } else {
        callback(null, students)
      }
    })
  }

  showToolIsConfiguring () {
    Alerts.loadingAlert({
      title: 'Configuring the tool, please be patient', // TODO i18n
      text: 'If the tool takes too much time, please reload the page and try again.'
    })
  }

  initHypothesisClient (callback) {
    this.hypothesisClientManager = new HypothesisClientManager()
    this.hypothesisClientManager.init(() => {
      this.hypothesisClientManager.logInHypothesis((err, hypothesisToken) => {
        if (_.isFunction(callback)) {
          if (err) {
            callback(err)
          } else {
            callback(null)
          }
        }
      })
    })
  }

  constructRubricsModel ({moodleRubrics, courseId, callback}) {
    let rubric = new Rubric({
      moodleEndpoint: this.moodleEndpoint,
      assignmentName: this.assignmentName,
      courseId: courseId
    })
    // Ensure a rubric is retrieved
    if (moodleRubrics.areas[0].activemethod === 'rubric') {
      let rubricCriteria = _.get(moodleRubrics, 'areas[0].definitions[0].rubric.rubric_criteria')
      let rubricAssignmentId = _.get(moodleRubrics, 'areas[0].definitions[0].id')
      let rubricCmid = _.get(moodleRubrics, 'areas[0].cmid')
      if (!_.isUndefined(rubricCriteria) && !_.isUndefined(rubricAssignmentId) && !_.isUndefined(rubricCmid)) {
        // Set assignment id
        rubric.assignmentId = moodleRubrics.areas[0].definitions[0].id
        rubric.cmid = moodleRubrics.areas[0].cmid
        // Generate rubric model
        for (let i = 0; i < rubricCriteria.length; i++) {
          let moodleCriteria = rubricCriteria[i]
          let criteria = new Criteria({name: moodleCriteria.description, criteriaId: moodleCriteria.id, rubric: rubric})
          for (let j = 0; j < moodleCriteria.levels.length; j++) {
            let moodleLevel = moodleCriteria.levels[j]
            let level = new Level({name: moodleLevel.score, levelId: moodleLevel.id, description: moodleLevel.definition, criteria: criteria})
            criteria.levels.push(level)
          }
          rubric.criterias.push(criteria)
        }
        callback(null, rubric)
      } else {
        // Message user assignment has not a rubric associated
        Alerts.errorAlert({text: 'This assignment has not a rubric.'}) // TODO i18n
        if (_.isFunction(callback)) {
          callback()
        }
      }
    } else {
      // Message user assignment has not a rubric associated
      Alerts.errorAlert({text: 'This assignment has not a rubric.'}) // TODO i18n
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }
}

module.exports = MoodleContentScript
