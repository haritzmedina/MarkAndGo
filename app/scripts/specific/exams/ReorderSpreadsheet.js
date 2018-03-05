const $ = require('jquery')
const _ = require('lodash')

class ReorderSpreadsheet {
  init (callback) {
    window.abwa.specific.primaryStudySheetManager.getGSheetData((err, data) => {
      let container = window.abwa.tagManager.tagsContainer.annotate
      if (err) {
        container.dataset.examHidden = 'false' // Remove this tag after reordered tags
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        }
      } else {
        // Get total index
        let criterias = _.without(_.map(data.data[0].rowData[0].values, (values) => { return values.formattedValue }), undefined)
        let totalIndex = _.findIndex(criterias, (criteria) => { return criteria.toLowerCase() === 'total' })
        if (totalIndex > 0) {
          criterias = criterias.slice(1, totalIndex) // maintain elements until total
        } else {
          criterias = criterias.slice(1) // total not found, maintain all except first one
        }
        for (let i = criterias.length - 1; i >= 0; i--) {
          let criteria = criterias[i]
          let tagGroup = _.find(container.querySelectorAll('.tagGroup'), (elem) => { return elem.children[0].title === criteria })
          let elem = $(tagGroup).detach()
          $(container).prepend(elem)
          container.dataset.examHidden = 'false' // Remove this tag after reordered tags
        }
        if (_.isFunction(callback)) {
          callback()
        }
      }
    }, false)
  }
}

module.exports = ReorderSpreadsheet
