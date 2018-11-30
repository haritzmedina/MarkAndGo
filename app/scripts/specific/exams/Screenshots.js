const html2canvas = require('html2canvas')
window.html2canvas = require('html2canvas')
const FileSaver = require('file-saver')
const $ = require('jquery')
const _ = require('lodash')
const JsPDF = require('jspdf')

class Screenshots {
  constructor () {
    this.container = null
    this.imageElement = null
  }

  init () {
    // TODO Create a button to screenshot
    let screenshotsWrapperURL = chrome.extension.getURL('pages/specific/exam/screenshots.html')
    $.get(screenshotsWrapperURL, (html) => {
      $('#modeWrapper').after($.parseHTML(html))
      let imageURL = chrome.extension.getURL('/images/screenshot.png')
      this.container = document.querySelector('#screenshotsBody')
      this.imageElement = this.container.querySelector('#screenshotButton')
      this.imageElement.src = imageURL
      this.imageElement.title = 'Take a screenshot'
      this.imageElement.addEventListener('click', () => {
        this.takeScreenshot()
      })
    })
  }

  takeScreenshot (callback) {
    let promise = null
    if (window.location.href.includes('drive.google.com')) {
      promise = new Promise((resolve) => {
        let element = document.querySelector('.a-b-r-La')
        if (document.querySelector('.a-b-r-La')) {
          html2canvas(element).then((canvas) => {
            resolve(canvas)
          })
        } else {
          html2canvas(document.body).then((canvas) => {
            resolve(canvas)
          })
        }
      })
    } else if (window.location.pathname === '/content/pdfjs/web/viewer.html') {
      // Create promises array
      let promisesData = [...Array(window.PDFViewerApplication.pagesCount).keys()].map((index) => { return {i: index} })

      let takePDFPageScreenshot = (d, chaindata) => {
        return new Promise((resolve, reject) => {
          // Go to page
          window.PDFViewerApplication.page = d.i + 1
          // Redraw annotations
          window.abwa.contentAnnotator.redrawAnnotations()
          setTimeout(() => {
            html2canvas(document.querySelector('.page[data-page-number="' + (d.i + 1) + '"]')).then((canvas) => {
              chaindata.push(canvas)
              resolve(chaindata)
            })
          }, 1000)
        })
      }

      let promiseChain = promisesData.reduce(
        (chain, d) => chain.then((chaindata) => {
          return takePDFPageScreenshot(d, chaindata)
        }), Promise.resolve([])
      )
      promiseChain.then((canvases) => {
        let pdf = new JsPDF('p', 'pt', 'a4')
        window.abwa.tagManager.showViewingTagsContainer()
        html2canvas(document.querySelector('#tagsViewing')).then((rubric) => {
          pdf.addImage(rubric.toDataURL(), 'png', 0, 0)
          window.abwa.tagManager.showEvidencingTagsContainer()
          for (let i = 0; i < canvases.length; i++) {
            pdf.addPage()
            pdf.addImage(canvases[i].toDataURL(), 'png', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight())
          }
          pdf.save()
        })
      })
    } else {
      promise = new Promise((resolve) => {
        html2canvas(document.body).then((canvas) => {
          resolve(canvas)
        })
      })
    }
    promise.then((canvas) => {
      canvas.toBlob((blob) => {
        FileSaver.saveAs(blob, 'exam.png')
      })
    })
  }

  destroy (callback) {
    $('#screenshots').remove()
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

module.exports = Screenshots
