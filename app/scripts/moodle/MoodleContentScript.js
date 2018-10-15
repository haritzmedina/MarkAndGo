const MoodleClientManager = require('./MoodleClientManager')
const _ = require('lodash')
const Rubric = require('../model/Rubric')
const Criteria = require('../model/Criteria')
const Level = require('../model/Level')
const HypothesisClientManager = require('../hypothesis/HypothesisClientManager')
const swal = require('sweetalert2')
const ChromeStorage = require('../utils/ChromeStorage')

const selectedGroupNamespace = 'hypothesis.currentGroup'

class MoodleContentScript {
  constructor () {
    this.assignmentId = null
    this.moodleEndpoint = null
    this.assignmentName = null
    this.hypothesisClientManager = null
  }

  init (callback) {
    this.showToolIsConfiguring()
    this.initHypothesisClient(() => {
      // Retrieve assignment information and moodle endpoint
      if (window.location.href.includes('mod/assign/view')) {
        this.assignmentId = (new URL(window.location)).searchParams.get('id')
        this.moodleEndpoint = _.split(window.location.href, 'mod/assign/view')[0]
        let assignmentElement = document.querySelector('.breadcrumb')
        if (_.isElement(assignmentElement)) {
          assignmentElement = assignmentElement.querySelector('a[href*="mod/assign"]')
          this.assignmentName = assignmentElement.innerText
        } else {
          assignmentElement = document.querySelector('[data-region="assignment-info"]')
          if (_.isElement(assignmentElement)) {
            this.assignmentName = assignmentElement.querySelector('[href*="mod/assign"]').innerText.split(':')[1].trim()
          } else {
            swal('Oops!', // TODO i18n
              'There was a problem when retrieving task information from moodle. Make sure that you are in the main page of the assignment. <br/>' +
              'If the error continues, please <a href="https://github.com/haritzmedina/markandgo/issues" target="_blank">contact administrator</a>.',
              'error') // Show to the user the error
          }
        }
      } else if (window.location.href.includes('grade/grading/')) {
        let assignmentElement = document.querySelector('a[href*="mod/assign"]')
        let assignmentURL = assignmentElement.href
        this.assignmentName = assignmentElement.innerText
        this.assignmentId = (new URL(assignmentURL)).searchParams.get('id')
        this.moodleEndpoint = _.split(window.location.href, 'grade/grading/')[0]
      } else {
        swal('Oops!',
          'This is not moodle rubrics or assignment webpage', // TODO i18n
          'error') // Notify error to user
        console.error('This is not moodle rubrics or assignment webpage')
        if (_.isFunction(callback)) {
          callback()
        }
      }

      // Retrieve moodle client
      this.moodleClientManager = new MoodleClientManager(this.moodleEndpoint)
      this.moodleClientManager.init((err) => {
        if (err) {
          // TODO Unable to init moodle client manager
          // TODO Swal
        } else {
          this.moodleClientManager.moodleClient.getRubric(this.assignmentId, (err, rubrics) => {
            if (err) {

            } else {
              console.log(rubrics)
              this.constructRubricsModel({moodleRubrics: rubrics,
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
                              swal('Correctly configured', // TODO i18n
                                chrome.i18n.getMessage('ShareHypothesisGroup') + '<br/><a href="' + rubric.hypothesisGroup.links.html + '" target="_blank">' + rubric.hypothesisGroup.links.html + '</a>',
                                'success')
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
    })
  }

  showToolIsConfiguring () {
    swal({
      position: 'top-end',
      title: 'Configuring the tool, please be patient', // TODO i18n
      text: 'If the tool takes too much time, please reload the page and try again.',
      showConfirmButton: false,
      onOpen: () => {
        swal.showLoading()
      }
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
        // TODO Swal
        console.error('This assignment has not a rubric defined')
        if (_.isFunction(callback)) {
          callback()
        }
      }
    } else {
      // TODO Swal
      console.error('This assignment has not a rubric defined')
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
                  swal('Oops!', // TODO i18n
                    'There was a problem while creating the hypothes.is group. Please reload the page and try it again. <br/>' +
                    'If the error continues, please contact administrator.',
                    'error') // Show to the user the error
                  callback(err)
                } else {
                  // Generate group annotations
                  rubric.hypothesisGroup = group
                  let annotations = rubric.toAnnotations()
                  console.log(annotations)
                  this.createTeacherAnnotation({teacherId: userProfile.userid, hypothesisGroup: group}, (err) => {
                    if (err) {
                      swal('Oops!', // TODO i18n
                        'There was a problem while relating the tool with moodle. Please reload the page and try it again. <br/>' +
                        'If error continues, please contact administrator.',
                        'error') // Show to the user the error
                      callback(err)
                    } else {
                      // Create annotations in hypothesis
                      this.hypothesisClientManager.hypothesisClient.createNewAnnotations(annotations, (err, createdAnnotations) => {
                        if (err) {
                          swal('Oops!', // TODO i18n
                            'There was a problem while creating the highlighter. Please reload the page and try it again. <br/>' +
                            'If the error continues, please contact the administrator.',
                            'error') // Show to the user the error
                        } else {
                          // Save as current group the generated one
                          ChromeStorage.setData(selectedGroupNamespace, {data: JSON.stringify(rubric.hypothesisGroup)}, ChromeStorage.local)
                          swal('Correctly configured', // TODO i18n
                            chrome.i18n.getMessage('ShareHypothesisGroup') + '<br/><a href="' + rubric.hypothesisGroup.links.html + '" target="_blank">' + rubric.hypothesisGroup.links.html + '</a>',
                            'success')
                          console.log('Group created')
                          callback(null)
                        }
                      })
                    }
                  })
                }
              })
            } else {
              // TODO Handle group update
              console.debug('Group already exists, need to update')
              swal('The group ' + group.name + ' already exists', // TODO i18n
                chrome.i18n.getMessage('ShareHypothesisGroup') + '<br/><a href="' + group.url + '" target="_blank">' + group.url + '</a>',
                'info')
              callback(null)
            }
          }
        }
      })
    }
  }

  createHypothesisGroup (name, callback) {
    this.hypothesisClientManager.hypothesisClient.createNewGroup({
      name: name, description: 'A Mark&Go generated group to mark the assignment in moodle called' + name}, (err, group) => {
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
