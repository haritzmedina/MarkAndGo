const $ = require('jquery')

class ReorderSpreadsheet {
  init () {
    window.abwa.specific.primaryStudySheetManager.getGSheetData((err, data) => {
      if (err) {

      } else {
        let criterias = _.without(_.map(data.data[0].rowData[0].values, (values) => { return values.formattedValue }), undefined, 'total').slice(1,-1)
        let container = window.abwa.tagManager.tagsContainer.annotate
        for (let i = criterias.length - 1; i >= 0; i--) {
          let criteria = criterias[i]
          let tagGroup = _.find(container.querySelectorAll('.tagGroup'), (elem) => { return elem.children[0].title === criteria })
          let elem = $(tagGroup).detach()
          $(container).prepend(elem)
          $(container).show()
        }
      }
      console.log(data)
    })
  }
}

module.exports = ReorderSpreadsheet
