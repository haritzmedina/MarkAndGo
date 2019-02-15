const Events = require('../../contentScript/Events')
const AnnotationUtils = require('../../utils/AnnotationUtils')
const Alerts = require('../../utils/Alerts')
const LanguageUtils = require('../../utils/LanguageUtils')
const Mark = require('./Mark')
const _ = require('lodash')
const Rubric = require('../../model/Rubric')

const RETRIEVE_PREVIOUS_ASSIGNMENT_INTERVAL_IN_SECONDS = 60
const RETRIEVE_ANNOTATIONS_FOR_ASSIGNMENT_INTERVAL_IN_SECONDS = 10

class AssessmentManager {
  constructor (config) {
    this.config = config
    this.cmid = this.config.cmid
    this.marks = {}
    this.previousAssignments = []
    this.intervals = {}
  }

  init () {
    // Retrieve all the annotations for this assignment
    this.updateAnnotationForAssignment(() => {
      // Interval to update periodically annotations for assignment
      this.intervals.retrievePreviousAssignment = window.setInterval(() => {
        this.updateAnnotationForAssignment()
      }, RETRIEVE_ANNOTATIONS_FOR_ASSIGNMENT_INTERVAL_IN_SECONDS * 1000)
    })
    // Load previous assignments
    this.retrievePreviousAssignments(() => {
      this.intervals.retrievePreviousAssignment = window.setInterval(() => {
        this.retrievePreviousAssignments()
      }, RETRIEVE_PREVIOUS_ASSIGNMENT_INTERVAL_IN_SECONDS * 1000)
    })
    // Init event handlers
    this.initEvents()
  }

  destroy () {
    if (this.intervals.retrievePreviousAssignment) {
      clearInterval(this.intervals.retrievePreviousAssignment)
    }
  }

  updateAnnotationForAssignment (callback) {
    // Retrieve all the annotations for this assignment
    this.retrieveAnnotationsForAssignment((err, assignmentAnnotations) => {
      if (err) {
        // TODO Unable to retrieve annotations for this assignment
      } else {
        // Retrieve current marks
        let marksArray = this.getMarksFromAnnotations(assignmentAnnotations)
        let marks = {}
        // Retrieve criterias from rubric
        _.forEach(window.abwa.rubricManager.rubric.criterias, (criteria) => {
          marks[criteria.name] = new Mark({criteria: criteria})
        })
        // Retrieve marks for each criteria
        _.forEach(marksArray, (mark) => {
          marks[mark.criteria.name] = mark
        })
        this.marks = marks
        // Remark used marks in marking mode
        this.reloadMarksChosen()
        console.debug('Updated annotations for assignment')
        // Callback
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  initEvents () {
    document.addEventListener(Events.annotationCreated, (event) => {
      // Add event to the marks list
      if (event.detail.annotation) {
        let annotation = event.detail.annotation
        // Get criteria for annotation
        let criteriaName = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:isCriteriaOf:')
        if (!_.isArray(this.marks[criteriaName].annotations)) {
          this.marks[criteriaName].annotations = []
        }
        this.marks[criteriaName].annotations.push(annotation)
      }
    })
    document.addEventListener(Events.annotationDeleted, (event) => {
      if (event.detail.annotation) {
        let annotation = event.detail.annotation
        // Get criteria for annotation
        let criteriaName = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:isCriteriaOf:')
        if (!_.isArray(this.marks[criteriaName].annotations)) {
          this.marks[criteriaName].annotations.remove(annotation)
        }
      }
    })
    // Event for tag manager reloaded
    document.addEventListener(Events.mark, (event) => {
      // TODO Get level for this mark
      let criteriaName = event.detail.criteriaName
      let markName = event.detail.levelName
      let level
      if (criteriaName && markName) {
        // Retrieve criteria from rubric
        let criteria = _.find(window.abwa.rubricManager.rubric.criterias, (criteria) => { return criteria.name === criteriaName })
        level = _.find(criteria.levels, (level) => { return level.name === markName })
        this.mark(level)
      } else {
        // TODO Unable to retrieve criteria or level
      }
      // Update all annotations for current document/tag
      /* let oldTagList = ['exam:isCriteriaOf:' + event.details.criteriaName]
      let newTagList = [
        'exam:isCriteriaOf:' + event.details.criteriaName,
        'exam:mark:' + event.details.levelName,
        'exam:cmid:' + window.abwa.contentTypeManager.fileMetadata.cmid
      ]
      window.abwa.contentAnnotator.updateTagsForAllAnnotationsWithTag(
        oldTagList, newTagList,
        (err, annotations) => {
          if (err) {

          } else {
            //
            console.debug('All annotations with criteria ' + tagGroup.config.name + ' has mark ' + event.target.dataset.mark)
            // Reload all annotations
            window.abwa.contentAnnotator.updateAllAnnotations((err, annotations) => {
              if (err) {
                console.error('Unexpected error when updating annotations')
              } else {
                window.abwa.contentAnnotator.redrawAnnotations()
              }
            })
            // If no annotations are found, create one for in page level with selected tags
            if (annotations.length === 0) {
              Alerts.confirmAlert({
                title: chrome.i18n.getMessage('noEvidencesFoundForMarkingTitle'),
                text: chrome.i18n.getMessage('noEvidencesFoundForMarkingText', event.target.dataset.mark),
                alertType: Alerts.alertType.warning,
                callback: (err) => {
                  if (err) {
                    // Manage error
                    window.alert('Unable to create alert for: noEvidencesFoundForMarking. Reload the page, and if the error continues please contact administrator.')
                  } else {
                    const TextAnnotator = require('./contentAnnotators/TextAnnotator')
                    window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(TextAnnotator.constructAnnotation(null, newTagList), (err, annotation) => {
                      if (err) {
                        Alerts.errorAlert({text: err.message})
                      } else {
                        annotations.push(annotation)
                        // Send event of mark
                        LanguageUtils.dispatchCustomEvent(Events.mark, {criteria: tagGroup.config.name, mark: event.target.dataset.mark, annotations: annotations})
                      }
                    })
                  }
                }
              })
            } else {
              // Send event of mark
              LanguageUtils.dispatchCustomEvent(Events.mark, {criteria: tagGroup.config.name, mark: event.target.dataset.mark, annotations: annotations})
            }
          }
        }) */
    })
  }

  retrievePreviousAssignments (callback) {
    // Get student id
    let studentId = window.abwa.contentTypeManager.fileMetadata.studentId
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      tag: 'exam:metadata',
      group: window.abwa.groupSelector.currentGroup.id
    }, (err, annotations) => {
      if (err) {
        // Nothing to do
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        let previousAssignments = []
        for (let i = 0; i < annotations.length; i++) {
          let rubric = Rubric.fromAnnotation(annotations[i])
          // If current assignment is previous assignment, don't add
          if (window.abwa.contentTypeManager.fileMetadata.cmid !== rubric.cmid) {
            let previousAssignment = {name: rubric.name}
            let teacherUrl = rubric.getUrlToStudentAssignmentForTeacher(studentId)
            let studentUrl = rubric.getUrlToStudentAssignmentForStudent(studentId)
            // If it is unable to retrieve the URL, don't add
            if (!_.isNull(teacherUrl) && !_.isNull(studentUrl)) {
              previousAssignment.teacherUrl = teacherUrl
              previousAssignment.studentUrl = studentUrl
              previousAssignments.push(previousAssignment)
            }
          }
        }
        this.previousAssignments = previousAssignments
        console.debug('Updated previous assignments')
        if (_.isFunction(callback)) {
          callback(err)
        }
      }
    })
  }

  updateAnnotationsInHypothesis (annotations, callback) {
    let promises = []
    for (let i = 0; i < annotations.length; i++) {
      let annotation = annotations[i]
      promises.push(new Promise((resolve, reject) => {
        window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(annotation.id, annotation, (err, annotation) => {
          if (err) {
            reject(new Error('Unable to update annotation ' + annotation.id))
          } else {
            resolve(annotation)
          }
        })
      }))
    }
    let resultAnnotations = []
    Promise.all(promises).then((result) => {
      // All annotations updated
      resultAnnotations = result
    }).finally((result) => {
      if (_.isFunction(callback)) {
        callback(null, resultAnnotations)
      }
    })
  }

  getMarksFromAnnotations (annotations) {
    let marksForAnno = []
    for (let i = 0; i < annotations.length; i++) {
      let annotation = annotations[i]
      let criteriaName = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:isCriteriaOf:')
      let markName = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:mark:')
      if (criteriaName) {
        // Retrieve criteria from rubric
        let criteria = _.find(window.abwa.rubricManager.rubric.criterias, (criteria) => { return criteria.name === criteriaName })
        let level = _.find(criteria.levels, (level) => { return level.name === markName })
        marksForAnno.push({level: level || null, criteria: criteria, annotation: annotation})
      }
    }
    let unparsedMarks = _.mapValues(_.groupBy(marksForAnno, (mark) => {
      return mark.criteria.name
    }), (marksForGroup) => {
      return {
        criteria: marksForGroup[0].criteria,
        level: marksForGroup[0].level,
        annotations: _.map(marksForGroup, markForGroup => markForGroup.annotation)
      }
    })
    let parsedMarks = _.mapValues(unparsedMarks, (values) => {
      return _.assign(new Mark({}), values)
    })
    return parsedMarks
  }

  retrieveAnnotationsForAssignment (callback) {
    if (window.abwa.rubricManager.rubric.cmid && window.abwa.groupSelector.currentGroup.id) {
      window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
        tags: 'exam:cmid:' + this.cmid,
        group: window.abwa.groupSelector.currentGroup.id,
        wildcard_uri: window.abwa.rubricManager.rubric.moodleEndpoint + '*'
      }, (err, annotations) => {
        if (err) {

        } else {
          callback(null, annotations)
        }
      })
    }
  }

  mark (level) {
    // Update marks
    this.updateAnnotationForAssignment(() => {
      let criteria = level.criteria
      // Get mark with annotations
      let mark = this.marks[criteria.name]
      // Get new tag list
      let newTagList = [
        'exam:isCriteriaOf:' + criteria.name,
        'exam:mark:' + level.name,
        'exam:cmid:' + this.cmid
      ]
      // Get annotations
      let annotations = mark.annotations
      if (annotations.length === 0) {
        // Ask user
        Alerts.confirmAlert({
          title: chrome.i18n.getMessage('noEvidencesFoundForMarkingTitle', criteria.name),
          text: chrome.i18n.getMessage('noEvidencesFoundForMarkingText', level.name),
          alertType: Alerts.alertType.warning,
          callback: (err) => {
            if (err) {
              // Manage error
              window.alert('Unable to create alert for: noEvidencesFoundForMarking. Reload the page, and if the error continues please contact administrator.')
            } else {
              const TextAnnotator = require('../../contentScript/contentAnnotators/TextAnnotator')
              window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(TextAnnotator.constructAnnotation(null, newTagList), (err, annotation) => {
                if (err) {
                  Alerts.errorAlert({text: err.message})
                } else {
                  mark.annotations = [annotation]
                  this.updateAnnotationsInHypothesis(annotations, () => {
                    window.abwa.contentAnnotator.updateAllAnnotations()
                  })
                  // TODO Update moodle
                  this.updateMoodle()
                }
              })
            }
          }
        })
      } else {
        // Update all annotations with new tags
        _.forEach(annotations, (annotation) => {
          annotation.tags = newTagList
        })
        this.updateAnnotationsInHypothesis(annotations, () => {
          window.abwa.contentAnnotator.updateAllAnnotations()
        })
        // TODO Update moodle
        this.updateMoodle()
      }
      this.marks[criteria.name].level = level
      this.reloadMarksChosen()
    })
  }

  updateMoodle (callback) {
    window.abwa.specific.moodleGradingManager.updateMoodleFromMarks(this.marks, callback)
  }

  reloadMarksChosen () {
    // Uncheck all the tags
    let tagButtons = document.querySelector('#tagsMarking').querySelectorAll('.tagButton')
    for (let i = 0; i < tagButtons.length; i++) {
      let tagButton = tagButtons[i]
      tagButton.dataset.chosen = 'false'
    }
    // Mark as chosen annotated tags
    let marks = _.filter(_.values(this.marks), _.isObject)
    for (let i = 0; i < marks.length; i++) {
      let level = marks[i].level
      if (!_.isNull(level)) {
        let tagButton = window.abwa.tagManager.tagsContainer.marking
          .querySelector('.tagGroup[data-criteria="' + level.criteria.name + '"]')
          .querySelector('.tagButton[data-mark="' + level.name + '"]')
        tagButton.dataset.chosen = 'true'
      }
    }
  }
}

module.exports = AssessmentManager
