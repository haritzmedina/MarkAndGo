const html2canvas = require('html2canvas')
const FileSaver = require('file-saver')
const $ = require('jquery')

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
}

module.exports = Screenshots
