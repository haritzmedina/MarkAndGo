const MoodleClientManager = require('./MoodleClientManager')
const _ = require('lodash')
const Rubric = require('../model/Rubric')
const Criteria = require('../model/Criteria')
const Level = require('../model/Level')
const HypothesisClientManager = require('../hypothesis/HypothesisClientManager')
const ChromeStorage = require('../utils/ChromeStorage')
const Alerts = require('../utils/Alerts')
const jsYaml = require('js-yaml')

const selectedGroupNamespace = 'hypothesis.currentGroup'

class MoodleContentScript {
  constructor () {
    this.assignmentId = null
    this.moodleEndpoint = null
    this.assignmentName = null
    this.hypothesisClientManager = null
    this.moodleVersion = null
  }

  init (callback) {
    this.showToolIsConfiguring()
    this.initHypothesisClient(() => {
      // It will retrieve
      this.scrapAssignmentData((err, assignmentData) => {
        if (err) {

        } else {
          // Retrieve moodle client
          this.moodleClientManager = new MoodleClientManager(this.moodleEndpoint)
          this.moodleClientManager.init((err) => {
            if (err) {
              // Unable to init moodle client manager
              Alerts.errorAlert({text: 'Unable to retrieve rubric from moodle, have you the required permissions to get the rubric via API?'})
              callback(err)
            } else {
              this.moodleClientManager.moodleClient.getRubric(this.assignmentId, (err, rubrics) => {
                if (err) {

                } else {
                  console.log(rubrics)
                  this.constructRubricsModel({
                    moodleRubrics: rubrics,
                    callback: (err, rubric) => {
                      if (_.isFunction(callback)) {
                        if (err) {
                          // TODO Show error to user
                          callback(err)
                        } else {
                          // Create hypothesis group with annotations
                          this.generateHypothesisGroup({
                            rubric,
                            callback: (err) => {
                              if (_.isFunction(callback)) {
                                if (err) {
                                  // TODO Show error to user
                                  callback(err)
                                } else {
                                  callback(null)
                                }
                              }
                            }
                          })
                        }
                      }
                    }
                  })
                }
              })
            }
          })
        }
      })
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

  scrapAssignmentData (callback) {
    // Get assignment id and moodle endpoint
    if (window.location.href.includes('grade/grading/')) {
      let assignmentElement = document.querySelector('a[href*="mod/assign"]')
      let assignmentURL = assignmentElement.href
      this.assignmentName = assignmentElement.innerText
      this.assignmentId = (new URL(assignmentURL)).searchParams.get('id')
      this.moodleEndpoint = _.split(window.location.href, 'grade/grading/')[0]
      // Callback with data
      if (_.isFunction(callback)) {
        callback(null, {assignmentName: this.assignmentName, assignmentId: this.assignmentId})
      }
    } else if (window.location.href.includes('mod/assign/view')) {
      this.assignmentId = (new URL(window.location)).searchParams.get('id')
      this.moodleEndpoint = _.split(window.location.href, 'mod/assign/view')[0]
      let assignmentElement = null
      // Get assignment name
      // Try moodle 3.5 in assignment main page
      let assignmentElementContainer = document.querySelector('ol.breadcrumb')
      if (assignmentElementContainer) {
        assignmentElement = assignmentElementContainer.querySelector('a[href*="mod/assign"]')
        this.assignmentName = assignmentElement.innerText
      }
      if (!_.isElement(assignmentElement)) {
        // Try moodle 3.1 in assignment main page
        let assignmentElementContainer = document.querySelector('ul.breadcrumb')
        if (assignmentElementContainer) {
          assignmentElement = assignmentElementContainer.querySelector('a[href*="mod/assign"]')
          this.assignmentName = assignmentElement.innerText
        }
        if (!_.isElement(assignmentElement)) {
          // Try moodle 3.5 in student grader page (action=grader)
          let assignmentElementContainer = document.querySelector('[data-region="assignment-info"]')
          if (assignmentElementContainer) {
            assignmentElement = assignmentElementContainer.querySelector('a[href*="mod/assign"]')
            this.assignmentName = assignmentElement.innerText.split(':')[1].substring(1)
          }
        }
      }
      if (this.assignmentName) {
        callback(null, {assignmentName: this.assignmentName, assignmentId: this.assignmentId})
      } else {
        Alerts.errorAlert({text: chrome.i18n.getMessage('MoodleWrongAssignmentPage')})
        callback(new Error())
      }
    } else {

    }
  }

  constructRubricsModel ({moodleRubrics, callback}) {
    let rubric = new Rubric({
      moodleEndpoint: this.moodleEndpoint,
      assignmentName: this.assignmentName
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

  generateHypothesisGroup ({rubric, callback}) {
    if (_.isFunction(callback)) {
      // Create hypothesis group
      this.hypothesisClientManager.hypothesisClient.getUserProfile((err, userProfile) => {
        if (_.isFunction(callback)) {
          if (err) {
            console.error(err)
            callback(err)
          } else {
            let group = _.find(userProfile.groups, (group) => {
              return group.name === rubric.name.substr(0, 25)
            })
            if (_.isEmpty(group)) {
              this.createHypothesisGroup(rubric.name, (err, group) => {
                if (err) {
                  Alerts.errorAlert({text: chrome.i18n.getMessage('ErrorConfiguringHighlighter') + '<br/>' + chrome.i18n.getMessage('ContactAdministrator')})
                  callback(err)
                } else {
                  // Generate group annotations
                  rubric.hypothesisGroup = group
                  let annotations = rubric.toAnnotations()
                  console.log(annotations)
                  this.createTeacherAnnotation({teacherId: userProfile.userid, hypothesisGroup: group}, (err) => {
                    if (err) {
                      Alerts.errorAlert({text: chrome.i18n.getMessage('ErrorRelatingMoodleAndTool') + '<br/>' + chrome.i18n.getMessage('ContactAdministrator')})
                      callback(err)
                    } else {
                      // Create annotations in hypothesis
                      this.hypothesisClientManager.hypothesisClient.createNewAnnotations(annotations, (err, createdAnnotations) => {
                        if (err) {
                          Alerts.errorAlert({text: chrome.i18n.getMessage('ErrorConfiguringHighlighter') + '<br/>' + chrome.i18n.getMessage('ContactAdministrator')})
                        } else {
                          // Save as current group the generated one
                          ChromeStorage.setData(selectedGroupNamespace, {data: JSON.stringify(rubric.hypothesisGroup)}, ChromeStorage.local)
                          Alerts.successAlert({
                            title: 'Correctly configured',
                            text: chrome.i18n.getMessage('ShareHypothesisGroup') + '<br/><a href="' + rubric.hypothesisGroup.links.html + '" target="_blank">' + rubric.hypothesisGroup.links.html + '</a>'
                          })
                          console.debug('Group created')
                          callback(null)
                        }
                      })
                    }
                  })
                }
              })
            } else {
              this.hypothesisClientManager.hypothesisClient.searchAnnotations({
                group: group.id,
                tag: 'exam:teacher'
              }, (err, annotations) => {
                if (err) {

                } else {
                  let teacher = _.find(annotations, (annotation) => {
                    let data = jsYaml.load(annotation.text)
                    return data.teacherId === userProfile.userid
                  })
                  if (!_.isUndefined(teacher)) {
                    // Is already a teacher
                    console.debug('Group already exists, need to update')
                    Alerts.infoAlert({
                      text: chrome.i18n.getMessage('ShareHypothesisGroup') + '<br/><a href="' + group.url + '" target="_blank">' + group.url + '</a>',
                      title: 'The group ' + group.name + ' already exists'
                    })
                    callback(null)
                  } else {
                    // Is not a teacher yet, ask to join
                    Alerts.confirmAlert({
                      title: 'You are not a teacher yet',
                      text: 'Would you like to join as a teacher to start marking?',
                      callback: () => {
                        // TODO Check if this user is teacher
                        // Find the complete information of the group, currently we only have the short version from userProfile
                        this.hypothesisClientManager.hypothesisClient.getListOfGroups({}, (err, listOfGroups) => {
                          if (err) {
                            Alerts.errorAlert({text: 'Something went wrong when adding you as a teacher.'}) // TODO i18n
                          } else {
                            group = _.find(listOfGroups, (groupOfList) => {
                              return group.id === groupOfList.id
                            })
                            this.hypothesisClientManager.hypothesisClient.createNewAnnotation(this.generateTeacherAnnotation(userProfile.userid, group), () => {
                              if (err) {
                                Alerts.errorAlert({text: 'Something went wrong when adding you as a teacher.'}) // TODO i18n
                              } else {
                                rubric.hypothesisGroup = group // Set hypothesis group in rubric
                                Alerts.successAlert({
                                  title: 'Correctly configured',
                                  text: chrome.i18n.getMessage('ShareHypothesisGroup') + '<br/><a href="' + rubric.hypothesisGroup.links.html + '" target="_blank">' + rubric.hypothesisGroup.links.html + '</a>'
                                })
                              }
                            })
                          }
                        })
                      }
                    })
                  }
                }
              })
              // TODO Handle group update
              // TODO Handle multiple teachers
            }
          }
        }
      })
    }
  }

  createHypothesisGroup (name, callback) {
    this.hypothesisClientManager.hypothesisClient.createNewGroup({
      name: name, description: 'A Mark&Go generated group to mark the assignment in moodle called ' + name}, (err, group) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (_.isFunction(callback)) {
          callback(null, group)
        }
      }
    })
  }

  createTeacherAnnotation ({teacherId, hypothesisGroup}, callback) {
    let teacherAnnotation = this.generateTeacherAnnotation(teacherId, hypothesisGroup)
    this.hypothesisClientManager.hypothesisClient.createNewAnnotation(teacherAnnotation, (err, annotation) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        console.debug('Created teacher annotation: ')
        console.debug(annotation)
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  generateTeacherAnnotation (teacherId, hypothesisGroup) {
    return {
      group: hypothesisGroup.id,
      permissions: {
        read: ['group:' + hypothesisGroup.id]
      },
      references: [],
      tags: ['exam:teacher'],
      target: [],
      text: 'teacherId: ' + teacherId,
      uri: hypothesisGroup.links.html // Group url
    }
  }
}

module.exports = MoodleContentScript
