const _ = require('lodash')
const $ = require('jquery')

class StudentsNavigationRing {
  constructor () {
    this.container = null
  }

  init (callback) {
    window.abwa.specific.primaryStudySheetManager.getGSheetData((err, sheetData) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        window.abwa.specific.primaryStudySheetManager.retrievePrimaryStudyRow((err, primaryStudyRow) => {
          if (err) {
            if (_.isFunction(callback)) {
              callback(err)
            }
          } else {
            let navigationRingWrapperUrl = chrome.extension.getURL('pages/specific/exam/navigationRing.html')
            $.get(navigationRingWrapperUrl, (html) => {
              $('#groupSelectorContainer').after($.parseHTML(html))
              let previousHyperlink = _.get(sheetData.data[0].rowData[primaryStudyRow - 1], 'values[0].hyperlink')
              let nextHyperlink = _.get(sheetData.data[0].rowData[primaryStudyRow + 1], 'values[0].hyperlink')
              let previousImageLink = chrome.extension.getURL('/images/arrowLeft.svg')
              let nextImageLink = chrome.extension.getURL('/images/arrowRight.svg')
              this.container = document.querySelector('#studentNavigationRingBody')
              // Previous link
              let previousImage = this.container.querySelector('#studentNavigationRingPrevious img')
              previousImage.src = previousImageLink
              let previousLink = this.container.querySelector('#studentNavigationRingPrevious')
              if (_.isUndefined(previousHyperlink)) {
                previousLink.setAttribute('aria-disabled', 'true')
              } else {
                previousLink.href = previousHyperlink
                previousImage.title = 'Go to: ' + _.get(sheetData.data[0].rowData[primaryStudyRow - 1], 'values[0].formattedValue')
              }
              // Next link
              let nextLink = this.container.querySelector('#studentNavigationRingNext')
              let nextImage = this.container.querySelector('#studentNavigationRingNext img')
              nextImage.src = nextImageLink
              if (_.isUndefined(nextHyperlink)) {
                nextLink.setAttribute('aria-disabled', 'true')
              } else {
                nextLink.href = nextHyperlink
                nextImage.title = 'Go to: ' + _.get(sheetData.data[0].rowData[primaryStudyRow + 1], 'values[0].formattedValue')
              }
            })
          }
        }, false)
      }
    }, false)
  }

  destroy (callback) {

  }
}

module.exports = StudentsNavigationRing
