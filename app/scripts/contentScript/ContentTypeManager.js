const _ = require('lodash')
const Events = require('./Events')
const URLUtils = require('../utils/URLUtils')
const LanguageUtils = require('../utils/LanguageUtils')
const Alerts = require('../utils/Alerts')
const CryptoUtils = require('../utils/CryptoUtils')

const URL_CHANGE_INTERVAL_IN_SECONDS = 1

class ContentTypeManager {
  constructor () {
    this.pdfFingerprint = null
    this.documentURL = null
    this.urlChangeInterval = null
    this.urlParam = null
    this.documentType = ContentTypeManager.documentTypes.html // By default document type is html
    this.localFile = false
    this.fileMetadata = {}
  }

  init (callback) {
    if (document.querySelector('embed[type="application/pdf"]')) {
      window.location = chrome.extension.getURL('content/pdfjs/web/viewer.html') + '?file=' + encodeURIComponent(window.location.href)
    } else if (this.isPlainTextFile()) {
      window.location = chrome.extension.getURL('content/plainTextFileViewer/index.html') + '?file=' + encodeURIComponent(window.location.href)
    } else {
      // Load publication metadata
      this.tryToLoadDoi()
      this.tryToLoadPublicationPDF()
      this.tryToLoadURLParam()
      // TODO this.tryToLoadLocalFIleURL() from file metadata
      // If current web is pdf viewer.html, set document type as pdf
      if (window.location.pathname === '/content/pdfjs/web/viewer.html') {
        this.waitUntilPDFViewerLoad(() => {
          // Save document type as pdf
          this.documentType = ContentTypeManager.documentTypes.pdf
          // Save pdf fingerprint
          this.pdfFingerprint = window.PDFViewerApplication.pdfDocument.pdfInfo.fingerprint
          // Get document URL
          if (this.urlParam) {
            this.documentURL = this.urlParam
            if (_.isFunction(callback)) {
              callback()
            }
          } else {
            // Is a local file
            if (window.PDFViewerApplication.url.startsWith('file:///')) {
              this.localFile = true
              // Check in moodle download manager if the file exists
              chrome.runtime.sendMessage({scope: 'annotationFile', cmd: 'fileMetadata', data: {filepath: URLUtils.retrieveMainUrl(window.PDFViewerApplication.url)}}, (fileMetadata) => {
                if (_.isEmpty(fileMetadata)) {
                  // Warn user document is not from moodle
                  Alerts.warningAlert({
                    text: 'Try to download the file again from moodle and if the error continues check <a href="https://github.com/haritzmedina/MarkAndGo/wiki/Most-common-errors-in-Mark&Go#file-is-not-from-moodle">this</a>.',
                    title: 'This file is not downloaded from moodle'})
                  this.documentURL = window.PDFViewerApplication.url
                } else {
                  this.fileMetadata = fileMetadata.file
                  this.documentURL = fileMetadata.file.url
                  this.getContextAndItemIdInLocalFile()
                }
                if (_.isFunction(callback)) {
                  callback()
                }
              })
            } else { // Is an online resource
              // Support in ajax websites web url change, web url can change dynamically, but locals never do
              this.initSupportWebURLChange()
              this.documentURL = window.PDFViewerApplication.url
              if (_.isFunction(callback)) {
                callback()
              }
            }
          }
        })
      } else {
        this.documentType = ContentTypeManager.documentTypes.html
        if (this.urlParam) {
          this.documentURL = this.urlParam
        } else {
          if (window.location.href.startsWith('file:///') || window.location.pathname === '/content/plainTextFileViewer/index.html') {
            let url = window.location.href
            if (window.location.pathname === '/content/plainTextFileViewer/index.html') {
              url = (new URL(document.location)).searchParams.get('file')
            }
            this.localFile = true
            // Check in moodle download manager if the file exists
            chrome.runtime.sendMessage({scope: 'annotationFile', cmd: 'fileMetadata', data: {filepath: URLUtils.retrieveMainUrl(url)}}, (fileMetadata) => {
              if (_.isEmpty(fileMetadata)) {
                // Warn user document is not from moodle
                Alerts.warningAlert({
                  text: 'Try to download the file again from moodle and if the error continues check <a href="https://github.com/haritzmedina/MarkAndGo/wiki/Most-common-errors-in-Mark&Go#file-is-not-from-moodle">this</a>.',
                  title: 'This file is not downloaded from moodle'})
                this.documentURL = URLUtils.retrieveMainUrl(url)
              } else {
                this.fileMetadata = fileMetadata.file
                this.documentURL = fileMetadata.file.url
                // Calculate fingerprint for plain text files
                this.tryToLoadPlainTextFingerprint()
                this.getContextAndItemIdInLocalFile()
              }
              if (_.isFunction(callback)) {
                callback()
              }
            })
          } else {
            // Support in ajax websites web url change, web url can change dynamically, but locals never do
            this.initSupportWebURLChange()
            this.documentURL = URLUtils.retrieveMainUrl(window.location.href)
            if (_.isFunction(callback)) {
              callback()
            }
          }
        }
      }
    }
  }

  isPlainTextFile () {
    let extension = window.location.href.split('.').pop().split(/#|\?/g)[0]
    return 'xml,xsl,xslt,xquery,xsql,'.split(',').includes(extension)
  }

  destroy (callback) {
    if (this.documentType === ContentTypeManager.documentTypes.pdf) {
      // Reload to original pdf website
      window.location.href = this.documentURL
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
    clearInterval(this.urlChangeInterval)
  }

  getContextAndItemIdInLocalFile () {
    this.fileMetadata.contextId = LanguageUtils.getStringBetween(this.fileMetadata.url, 'pluginfile.php/', '/assignsubmission_file')
    this.fileMetadata.itemId = LanguageUtils.getStringBetween(this.fileMetadata.url, 'submission_files/', '/')
  }

  waitUntilPDFViewerLoad (callback) {
    let interval = setInterval(() => {
      if (_.isObject(window.PDFViewerApplication.pdfDocument)) {
        clearInterval(interval)
        if (_.isFunction(callback)) {
          callback(window.PDFViewerApplication)
        }
      }
    }, 500)
  }

  tryToLoadDoi () {
    // Try to load doi from hash param
    let decodedUri = decodeURIComponent(window.location.href)
    let params = URLUtils.extractHashParamsFromUrl(decodedUri)
    if (!_.isEmpty(params) && !_.isEmpty(params.doi)) {
      this.doi = params.doi
    }
    // Try to load doi from page metadata
    if (_.isEmpty(this.doi)) {
      try {
        this.doi = document.querySelector('meta[name="citation_doi"]').content
      } catch (e) {
        console.log('Doi not found for this document')
      }
    }
    // TODO Try to load doi from chrome tab storage
  }

  tryToLoadURLParam () {
    let decodedUri = decodeURIComponent(window.location.href)
    let params = URLUtils.extractHashParamsFromUrl(decodedUri, '::')
    if (!_.isEmpty(params) && !_.isEmpty(params.url)) {
      this.urlParam = params.url
    }
  }

  tryToLoadPublicationPDF () {
    try {
      this.citationPdf = document.querySelector('meta[name="citation_pdf_url"]').content
    } catch (e) {
      console.log('citation pdf url not found')
    }
  }

  getDocumentRootElement () {
    if (this.documentType === ContentTypeManager.documentTypes.pdf) {
      return document.querySelector('#viewer')
    } else if (this.documentType === ContentTypeManager.documentTypes.html) {
      return document.body
    }
  }

  getDocumentURIToSearchInHypothesis () {
    if (this.documentType === ContentTypeManager.documentTypes.pdf) {
      return 'urn:x-pdf:' + this.pdfFingerprint
    } else if (this.documentFingerprint) {
      return 'urn:x-txt:' + this.documentFingerprint
    } else {
      return this.documentURL
    }
  }

  getDocumentURIToSaveInHypothesis () {
    return this.documentURL
  }

  initSupportWebURLChange () {
    this.urlChangeInterval = setInterval(() => {
      let newUrl = URLUtils.retrieveMainUrl(window.location.href)
      if (newUrl !== this.documentURL) {
        console.debug('Document URL updated from %s to %s', this.documentURL, newUrl)
        this.documentURL = newUrl
        // Dispatch event
        LanguageUtils.dispatchCustomEvent(Events.updatedDocumentURL, {url: this.documentURL})
      }
    }, URL_CHANGE_INTERVAL_IN_SECONDS * 1000)
  }

  tryToLoadPlainTextFingerprint () {
    let fileTextContentElement = document.querySelector('body > pre')
    if (fileTextContentElement) {
      let fileTextContent = fileTextContentElement.innerText
      this.documentFingerprint = CryptoUtils.hash(fileTextContent)
    }
  }
}

ContentTypeManager.documentTypes = {
  html: {
    name: 'html',
    selectors: ['FragmentSelector', 'RangeSelector', 'TextPositionSelector', 'TextQuoteSelector']
  },
  pdf: {
    name: 'pdf',
    selectors: ['FragmentSelector', 'TextPositionSelector', 'TextQuoteSelector']
  }
}

module.exports = ContentTypeManager
