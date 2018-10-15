const Events = require('../../contentScript/Events')
const MoodleClientManager = require('../../moodle/MoodleClientManager')
const _ = require('lodash')

class MoodleGradingManager {
  constructor () {
    this.moodleClientManager = null
    this.events = {}
  }

  init (callback) {
    this.moodleClientManager = new MoodleClientManager(window.abwa.rubricManager.rubric.moodleEndpoint)
    this.moodleClientManager.init(() => {
      // Create event for marking
      this.events.marking = {
        element: document,
        event: Events.mark,
        handler: this.markAnnotationCreateEventHandler()
      }
      this.events.marking.element.addEventListener(this.events.marking.event, this.events.marking.handler, false)
      // Create event for comment update
      this.events.comment = {
        element: document,
        event: Events.comment,
        handler: this.markAnnotationCreateEventHandler()
      }
      this.events.comment.element.addEventListener(this.events.comment.event, this.events.comment.handler, false)
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  markAnnotationCreateEventHandler () {
    return () => {
      // Get student id
      let studentId = window.abwa.contentTypeManager.fileMetadata.studentId
      // Get assignmentId from rubric
      let assignmentId = window.abwa.rubricManager.rubric.assignmentId
      // Get all annotations for user id
      window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
        tags: 'exam:studentId:' + studentId,
        group: window.abwa.groupSelector.currentGroup.id
      }, (err, annotations) => {
        if (err) {

        } else {
          let marks = _.map(annotations, (annotation) => {
            let criteriaName = _.find(annotation.tags, (tag) => {
              return tag.includes('exam:isCriteriaOf:')
            }).replace('exam:isCriteriaOf:', '')
            let levelName = _.find(annotation.tags, (tag) => {
              return tag.includes('exam:mark:')
            })
            if (levelName) {
              levelName = levelName.replace('exam:mark:', '')
            } else {
              levelName = null
            }
            let url = annotation.uri + '#mag:' + annotation.id
            let text = annotation.text
            return {criteriaName, levelName, text, url}
          })
          // Get for each criteria name and mark its corresponding criterionId and level from window.abwa.rubric
          let criterionAndLevels = this.getCriterionAndLevel(marks)
          // Compose moodle data
          let moodleGradingData = this.composeMoodleGradingData({
            criterionAndLevels,
            userId: studentId,
            assignmentId: assignmentId
          })
          // Update student grading in moodle
          this.moodleClientManager.moodleClient.updateStudentGradeWithRubric(moodleGradingData, (err) => {
            if (err) {
              // TODO Swal
              console.error('Error when grading')
            } else {
              // TODO Swal
              console.log('Updated')
            }
          })
        }
      })
    }
  }

  getCriterionAndLevel (marks) {
    let rubric = window.abwa.rubricManager.rubric
    let criterionAndLevel = []
    for (let i = 0; i < marks.length; i++) {
      let mark = marks[i]
      let criteria = _.find(rubric.criterias, (criteria) => {
        return criteria.name === mark.criteriaName
      })
      let level = _.find(criteria.levels, (level) => {
        return level.name === mark.levelName
      })
      if (_.isUndefined(level)) {
        level = {levelId: -1}
      }
      let remark = mark.text
      criterionAndLevel.push({criterionId: criteria.criteriaId, levelid: level.levelId, remark})
    }
    let resultingMarks = {}
    // TODO Append links if shared
    // Merge remarks with same criterionId and append remark
    _.forEach(criterionAndLevel, (crit) => {
      let remark = _.has(resultingMarks[crit.criterionId], 'remark') ? resultingMarks[crit.criterionId]['remark'] + '\n\n' + crit.remark : crit.remark
      let levelid = crit.levelid
      resultingMarks[crit.criterionId] = {remark: remark, levelid: levelid}
    })
    // Convert merge object to an array
    return _.map(resultingMarks, (mark, key) => { return {criterionId: key, levelid: mark.levelid, remark: mark.remark} })
  }

  composeMoodleGradingData ({criterionAndLevels, userId, assignmentId}) {
    let rubric = {criteria: []}
    for (let i = 0; i < criterionAndLevels.length; i++) {
      let criterionAndLevel = criterionAndLevels[i]
      if (criterionAndLevel.levelid > -1) { // If it is -1, the student is not grade for this criteria
        rubric.criteria.push({
          'criterionid': criterionAndLevel.criterionId,
          'fillings': [
            {
              'criterionid': '0',
              'levelid': criterionAndLevel.levelid,
              'remark': criterionAndLevel.remark
            }
          ]
        })
      }
    }
    return {
      'userid': userId + '',
      'assignmentid': assignmentId,
      'attemptnumber': '0',
      'addattempt': 1,
      'workflowstate': '',
      'applytoall': 1,
      'grade': '0',
      'advancedgradingdata': { rubric: rubric }
    }
  }

  destroy (callback) {
    // Remove the event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

module.exports = MoodleGradingManager
