const $ = require('jquery')

class BackToWorkspace {
  init () {
    // Create back to workspace button
    this.linkToWorkspace = document.createElement('a')
    if (window.abwa.rubricManager.rubric) {
      let rubric = window.abwa.rubricManager.rubric
      let studentId = window.abwa.contentTypeManager.fileMetadata.studentId
      this.linkToWorkspace.href = rubric.moodleEndpoint + 'mod/assign/view.php?id=' + rubric.cmid + '&rownum=0&action=grader&userid=' + studentId
      this.linkToWorkspace.target = '_blank'
      this.linkToWorkspace.innerText = chrome.i18n.getMessage('backToWorkspace')
      $('#groupBody').append(this.linkToWorkspace)
    }
  }
}

module.exports = BackToWorkspace
