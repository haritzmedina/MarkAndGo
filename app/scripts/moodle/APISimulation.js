const axios = require('axios')
const _ = require('lodash')

class APISimulation {
  static getRubric (cmids, callback) {
    // TODO Verify that cmids is not an array
    // TODO Go to task main page
    let taskMainPageUrl = window.mag.moodleContentScript.moodleEndpoint + 'mod/assign/view.php?id=' + cmids
    axios.get(taskMainPageUrl)
      .then((response) => {
        let parser = new window.DOMParser()
        let docPreferences = parser.parseFromString(response.data, 'text/html')
        let rubricURLElement = docPreferences.querySelector('a[href*="grade/grading/manage.php?"]')
        if (rubricURLElement) {
          // TODO Go to rubric page
          let rubricURL = rubricURLElement.href
          axios.get(rubricURL)
            .then((response) => {
              let parser = new window.DOMParser()
              let docPreferences = parser.parseFromString(response.data, 'text/html')
              let rubricTable = docPreferences.querySelector('#rubric-criteria')
              // TODO Get each criterion
              let rubricCriteria = APISimulation.getRubricCriteriaFromRubricTable(rubricTable)
              let assignmentId = APISimulation.getAssignmentId(docPreferences)
              let assignmentName = APISimulation.getAssignmentName(docPreferences)
              // For each criterion
              let formattedRubric = APISimulation.constructGetRubricResponse({rubricCriteria, cmid: cmids, assignmentId, assignmentName})
              callback(null, formattedRubric)
            })
        } else {
          // TODO Unable to retrieve rubric url
        }
      })
    // TODO Get table of rubrics
  }

  static getAssignmentName () {
    // TODO Get assignment name
    return null
  }

  static getRubricCriteriaFromRubricTable (rubricTable) {
    let criterionElements = rubricTable.querySelectorAll('.criterion')
    let criterias = []
    for (let i = 0; i < criterionElements.length; i++) {
      let criterionElement = criterionElements[i]
      let criteria = {}
      // Get id
      criteria.id = parseInt(_.last(criterionElement.id.split('-')))
      criteria.sortorder = i + 1
      criteria.description = criterionElement.querySelector('.description').innerText
      criteria.descriptionformat = 1 // The one by default is 1
      let levelElements = criterionElement.querySelectorAll('.level')
      let levels = []
      for (let j = 0; j < levelElements.length; j++) {
        let levelElement = levelElements[j]
        let level = {}
        // Get level id
        level.id = parseInt(_.last(levelElement.id.split('-')))
        // Get score
        level.score = parseInt(levelElement.querySelector('.scorevalue').innerText)
        // Get descriptor
        level.definition = levelElement.querySelector('.definition').innerText
        // Get defintion format
        level.definitionformat = 1 // Default format of level definition
        // Add to levels
        levels.push(level)
      }
      criteria.levels = levels
      criterias.push(criteria)
    }
    return criterias
  }

  static getAssignmentId (document) {
    let deleteformElement = document.querySelector('a[href*="deleteform"]')
    if (deleteformElement) {
      let url = new URL(deleteformElement.href)
      return url.searchParams.get('deleteform')
    } else {
      return null
    }
  }

  static constructGetRubricResponse ({cmid, rubricCriteria, assignmentId, assignmentName = ''}) {
    return {
      'areas': [
        {
          'cmid': cmid,
          'activemethod': 'rubric',
          'definitions': [
            {
              'id': assignmentId,
              'method': 'rubric',
              'name': assignmentName,
              'rubric': {
                'rubric_criteria': rubricCriteria
              }
            }
          ]
        }
      ],
      'warnings': []
    }
  }
}

module.exports = APISimulation
