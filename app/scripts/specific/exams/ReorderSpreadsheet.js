const _ = require('lodash')
const RolesManager = require('../../contentScript/RolesManager')
const ModeManager = require('../../contentScript/ModeManager')

class ReorderSpreadsheet {
  init (callback) {
    if (window.abwa.roleManager.role === RolesManager.roles.teacher) {
      window.abwa.specific.primaryStudySheetManager.getGSheetData((err, data) => {
        // Get both containers
        if (err) {
          this.showCorrespondingTagContainer()
          if (err) {
            if (_.isFunction(callback)) {
              callback(err)
            }
          }
        } else {
          // Get buttons containers
          let evidencingContainer = window.abwa.tagManager.tagsContainer.evidencing
          let markingContainer = window.abwa.tagManager.tagsContainer.marking
          // Get criterias to order
          let criterias = this.getOrderingCriteriasArray(data)
          // Reorder evidencing container
          window.abwa.tagManager.reorderNoGroupedTagContainer(criterias, evidencingContainer)
          // Reorder marking container
          window.abwa.tagManager.reorderGroupedTagContainer(criterias, markingContainer)
          this.showCorrespondingTagContainer()
          if (_.isFunction(callback)) {
            callback()
          }
        }
      }, false)
    } else if (window.abwa.roleManager.role === RolesManager.roles.student) {
      window.abwa.specific.primaryStudySheetManager.getGSheetData((err, data) => {
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          let viewingContainer = window.abwa.tagManager.tagsContainer.viewing
          let criterias = this.getOrderingCriteriasArray(data)
          window.abwa.tagManager.reorderGroupedTagContainer(criterias, viewingContainer)
        }
      })
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  showCorrespondingTagContainer () {
    if (window.abwa.modeManager.mode === ModeManager.modes.evidencing) {
      window.abwa.tagManager.showEvidencingTagsContainer()
    } else {
      window.abwa.tagManager.showMarkingTagsContainer()
    }
  }

  /**
   * Given an spreadsheet retrieve the ordering criterias
   * @param data
   * @returns {*}
   */
  getOrderingCriteriasArray (data) {
    let criterias = _.without(_.map(data.data[0].rowData[0].values, (values) => { return values.formattedValue }), undefined)
    let totalIndex = _.findIndex(criterias, (criteria) => { return criteria.toLowerCase() === 'total' })
    if (totalIndex > 0) {
      criterias = criterias.slice(1, totalIndex) // maintain elements until total
    } else {
      criterias = criterias.slice(1) // total not found, maintain all except first one
    }
    return criterias
  }
}

module.exports = ReorderSpreadsheet
