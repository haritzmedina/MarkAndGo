const _ = require('lodash')

class MoodleGradingAugmentation {
  init () {
    let gradingTable = document.querySelector('.gradingtable')
    let tableBody = gradingTable.querySelector('tbody')
    let rows = tableBody.querySelectorAll(':scope > tr')
    // In moodle 3.1 are added some empty rows which are hidden
    rows = _.filter(rows, (row) => {
      return !row.classList.contains('emptyrow')
    })
    _.forEach(rows, (row) => {
      // Get student id
      let studentId = (new URL(row.querySelector('a[href*="/user/view.php"').href)).searchParams.get('id')
      // Get student files
      let submittedFilesElements = row.querySelectorAll('a[href*="assignsubmission_file/submission_files"')
      // Change URLs of files elements
      _.forEach(submittedFilesElements, (submittedFileElement) => {
        submittedFileElement.href = submittedFileElement.href + '#studentId:' + studentId
      })
    })
  }

  destroy () {

  }
}

module.exports = MoodleGradingAugmentation
