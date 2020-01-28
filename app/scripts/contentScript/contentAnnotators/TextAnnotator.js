const ContentAnnotator = require('./ContentAnnotator')
const ModeManager = require('../ModeManager')
const ContentTypeManager = require('../ContentTypeManager')
const Tag = require('../Tag')
const TagGroup = require('../TagGroup')
const Events = require('../Events')
const RolesManager = require('../RolesManager')
const DOMTextUtils = require('../../utils/DOMTextUtils')
const PDFTextUtils = require('../../utils/PDFTextUtils')
const AnnotationUtils = require('../../utils/AnnotationUtils')
const LanguageUtils = require('../../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const _ = require('lodash')
require('components-jqueryui')
const Alerts = require('../../utils/Alerts')
const Awesomplete = require('awesomplete')
const linkifyUrls = require('linkify-urls')

const ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS = 3
const ANNOTATIONS_UPDATE_INTERVAL_IN_SECONDS = 60

class TextAnnotator extends ContentAnnotator {
  constructor (config) {
    super()
    this.events = {}
    this.config = config
    this.observerInterval = null
    this.reloadInterval = null
    this.currentAnnotations = null
    this.allAnnotations = null
    this.currentUserProfile = null
    this.highlightClassName = 'highlightedAnnotation'
    this.noUsefulHighlightClassName = 'noUsefulHighlightedAnnotation'
    this.lastAnnotation = null
  }

  init (callback) {
    console.debug('Initializing TextAnnotator')
    this.initEvents(() => {
      // Retrieve current user profile
      this.currentUserProfile = window.abwa.groupSelector.user
      this.loadAnnotations(() => {
        this.initAnnotatorByAnnotation(() => {
          // Check if something is selected after loading annotations and display sidebar
          if (document.getSelection().toString().length !== 0) {
            if ($(document.getSelection().anchorNode).parents('#abwaSidebarWrapper').toArray().length === 0) {
              this.openSidebar()
            }
          }
          this.initAnnotationsObserver(() => {
            console.debug('Initialized TextAnnotator')
            if (_.isFunction(callback)) {
              callback()
            }
          })
        })
      })
    })
  }

  initEvents (callback) {
    this.initSelectionEvents(() => {
      this.initAnnotateEvent(() => {
        this.initModeChangeEvent(() => {
          this.initReloadAnnotationsEvent(() => {
            this.initDocumentURLChangeEvent(() => {
              // Reload annotations periodically
              if (_.isFunction(callback)) {
                callback()
              }
            })
          })
        })
      })
    })
  }

  initDocumentURLChangeEvent (callback) {
    this.events.documentURLChangeEvent = {element: document, event: Events.updatedDocumentURL, handler: this.createDocumentURLChangeEventHandler()}
    this.events.documentURLChangeEvent.element.addEventListener(this.events.documentURLChangeEvent.event, this.events.documentURLChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createDocumentURLChangeEventHandler (callback) {
    return () => {
      this.loadAnnotations(() => {
        console.debug('annotations updated')
      })
    }
  }

  initReloadAnnotationsEvent (callback) {
    this.reloadInterval = setInterval(() => {
      this.updateAllAnnotations(() => {
        console.debug('annotations updated')
      })
    }, ANNOTATIONS_UPDATE_INTERVAL_IN_SECONDS * 1000)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  initModeChangeEvent (callback) {
    this.events.modeChangeEvent = {element: document, event: Events.modeChanged, handler: this.createInitModeChangeEventHandler()}
    this.events.modeChangeEvent.element.addEventListener(this.events.modeChangeEvent.event, this.events.modeChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createInitModeChangeEventHandler () {
    return () => {
      // If is mark or view disable the sidebar closing
      if (window.abwa.modeManager.mode === ModeManager.modes.mark || window.abwa.modeManager.mode === ModeManager.modes.view) {
        this.disableSelectionEvent()
      } else {
        this.activateSelectionEvent()
      }
    }
  }

  initAnnotateEvent (callback) {
    this.events.annotateEvent = {element: document, event: Events.annotate, handler: this.createAnnotationEventHandler()}
    this.events.annotateEvent.element.addEventListener(this.events.annotateEvent.event, this.events.annotateEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createAnnotationEventHandler () {
    return (event) => {
      let selectors = []
      // If selection is empty, return null
      if (document.getSelection().toString().length === 0) {
        Alerts.infoAlert({text: chrome.i18n.getMessage('CurrentSelectionEmpty')})
        return
      }
      // If selection is child of sidebar, return null
      if ($(document.getSelection().anchorNode).parents('#annotatorSidebarWrapper').toArray().length !== 0) {
        Alerts.infoAlert({text: chrome.i18n.getMessage('CurrentSelectionNotAnnotable')})
        return
      }
      let range = document.getSelection().getRangeAt(0)
      // Create FragmentSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'FragmentSelector' }) !== -1) {
        let fragmentSelector = null
        if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
          fragmentSelector = PDFTextUtils.getFragmentSelector(range)
        } else {
          fragmentSelector = DOMTextUtils.getFragmentSelector(range)
        }
        if (fragmentSelector) {
          selectors.push(fragmentSelector)
        }
      }
      // Create RangeSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'RangeSelector' }) !== -1) {
        let rangeSelector = DOMTextUtils.getRangeSelector(range)
        if (rangeSelector) {
          selectors.push(rangeSelector)
        }
      }
      // Create TextPositionSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'TextPositionSelector' }) !== -1) {
        let rootElement = window.abwa.contentTypeManager.getDocumentRootElement()
        let textPositionSelector = DOMTextUtils.getTextPositionSelector(range, rootElement)
        if (textPositionSelector) {
          selectors.push(textPositionSelector)
        }
      }
      // Create TextQuoteSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'TextQuoteSelector' }) !== -1) {
        let textQuoteSelector = DOMTextUtils.getTextQuoteSelector(range)
        if (textQuoteSelector) {
          selectors.push(textQuoteSelector)
        }
      }
      // Construct the annotation to send to hypothesis
      let annotation = TextAnnotator.constructAnnotation(selectors, event.detail.tags)
      window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(annotation, (err, annotation) => {
        if (err) {
          window.alert('Unexpected error, unable to create annotation')
        } else {
          // Add to annotations
          this.currentAnnotations.push(annotation)
          LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
          LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
          // Send event annotation is created
          LanguageUtils.dispatchCustomEvent(Events.annotationCreated, {annotation: annotation})
          console.debug('Created annotation with ID: ' + annotation.id)
          this.highlightAnnotation(annotation, () => {
            window.getSelection().removeAllRanges()
          })
        }
      })
    }
  }

  static constructAnnotation (selectors, tags) {
    // Check if selectors exist, if then create a target for annotation, in other case the annotation will be a page annotation
    let target = []
    if (_.isObject(selectors)) {
      target.push({
        selector: selectors
      })
    }
    let data = {
      group: window.abwa.groupSelector.currentGroup.id,
      permissions: {
        read: ['group:' + window.abwa.groupSelector.currentGroup.id]
      },
      references: [],
      tags: tags,
      target: target,
      text: '',
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
    }
    // For pdf files it is also send the relationship between pdf fingerprint and web url
    if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
      let pdfFingerprint = window.abwa.contentTypeManager.pdfFingerprint
      data.document = {
        documentFingerprint: pdfFingerprint,
        link: [{
          href: 'urn:x-pdf:' + pdfFingerprint
        }, {
          href: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
        }]
      }
    }
    // If doi is available, add it to the annotation
    if (!_.isEmpty(window.abwa.contentTypeManager.doi)) {
      data.document = data.document || {}
      let doi = window.abwa.contentTypeManager.doi
      data.document.dc = { identifier: [doi] }
      data.document.highwire = { doi: [doi] }
      data.document.link = data.document.link || []
      data.document.link.push({href: 'doi:' + doi})
    }
    if (!_.isEmpty(window.abwa.contentTypeManager.documentFingerprint)) {
      data.document = {
        documentFingerprint: window.abwa.contentTypeManager.documentFingerprint,
        link: [{
          href: 'urn:x-txt:' + window.abwa.contentTypeManager.documentFingerprint
        }, {
          href: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
        }]
      }
    }
    // If citation pdf is found
    if (!_.isEmpty(window.abwa.contentTypeManager.citationPdf)) {
      let pdfUrl = window.abwa.contentTypeManager.doi
      data.document.link = data.document.link || []
      data.document.link.push({href: pdfUrl, type: 'application/pdf'})
    }
    return data
  }

  initSelectionEvents (callback) {
    if (_.isEmpty(window.abwa.annotationBasedInitializer.initAnnotation)) {
      // Create selection event
      this.activateSelectionEvent(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  activateSelectionEvent (callback) {
    this.events.mouseUpOnDocumentHandler = {element: document, event: 'mouseup', handler: this.mouseUpOnDocumentHandlerConstructor()}
    this.events.mouseUpOnDocumentHandler.element.addEventListener(this.events.mouseUpOnDocumentHandler.event, this.events.mouseUpOnDocumentHandler.handler)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  disableSelectionEvent (callback) {
    this.events.mouseUpOnDocumentHandler.element.removeEventListener(
      this.events.mouseUpOnDocumentHandler.event,
      this.events.mouseUpOnDocumentHandler.handler)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  /**
   * Initializes annotations observer, to ensure dynamic web pages maintain highlights on the screen
   * @param callback Callback when initialization finishes
   */
  initAnnotationsObserver (callback) {
    this.observerInterval = setInterval(() => {
      console.debug('Observer interval')
      // If a swal is displayed, do not execute highlighting observer
      if (document.querySelector('.swal2-container') === null) { // TODO Look for a better solution...
        if (this.currentAnnotations) {
          for (let i = 0; i < this.currentAnnotations.length; i++) {
            let annotation = this.currentAnnotations[i]
            // Search if annotation exist
            let element = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
            // If annotation doesn't exist, try to find it
            if (!_.isElement(element)) {
              Promise.resolve().then(() => { this.highlightAnnotation(annotation) })
            }
          }
        }
      }
    }, ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS * 1000)
    // TODO Improve the way to highlight to avoid this interval (when search in PDFs it is highlighted empty element instead of element)
    this.cleanInterval = setInterval(() => {
      let highlightedElements = document.querySelectorAll('.highlightedAnnotation')
      highlightedElements.forEach((element) => {
        if (element.innerText === '') {
          $(element).remove()
        }
      })
    }, ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS * 1000)
    // Callback
    if (_.isFunction(callback)) {
      callback()
    }
  }

  loadAnnotations (callback) {
    this.updateAllAnnotations((err) => {
      if (err) {
        // TODO Show user no able to load all annotations
        console.error('Unable to load annotations')
      } else {
        // Current annotations will be
        this.currentAnnotations = this.retrieveCurrentAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        // Highlight annotations in the DOM
        this.redrawAnnotations()
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  updateAllAnnotations (callback) {
    // Retrieve annotations for current url and group
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(),
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(),
      group: window.abwa.groupSelector.currentGroup.id,
      tags: ['exam:cmid:' + window.abwa.contentTypeManager.fileMetadata.cmid],
      order: 'asc'
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Get reply annotations
        this.replyAnnotations = _.remove(annotations, (annotation) => {
          return annotation.references && annotation.references.length > 0
        })
        // Search tagged annotations
        let filteringTags = window.abwa.tagManager.getFilteringTagList()
        this.allAnnotations = _.filter(annotations, (annotation) => {
          let tags = annotation.tags
          return !(tags.length > 0 && _.find(filteringTags, tags[0])) || (tags.length > 1 && _.find(filteringTags, tags[1]))
        })
        this.redrawAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
        if (_.isFunction(callback)) {
          callback(null, this.allAnnotations)
        }
      }
    })
  }

  retrieveCurrentAnnotations () {
    return this.allAnnotations
  }

  highlightAnnotations (annotations, callback) {
    let promises = []
    annotations.forEach(annotation => {
      promises.push(new Promise((resolve) => {
        this.highlightAnnotation(annotation, resolve)
      }))
    })
    Promise.all(promises).then(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  highlightAnnotation (annotation, callback) {
    // Get annotation color for an annotation
    let tagInstance = window.abwa.tagManager.findAnnotationTagInstance(annotation)
    if (tagInstance) {
      let color = tagInstance.getColor()
      // Retrieve highlight class name
      let classNameToHighlight = this.retrieveHighlightClassName(annotation)
      try {
        // Highlight elements
        let highlightedElements = DOMTextUtils.highlightContent(
          annotation.target[0].selector, classNameToHighlight, annotation.id)
        // Highlight in same color as button
        highlightedElements.forEach(highlightedElement => {
          // If need to highlight, set the color corresponding to, in other case, maintain its original color
          $(highlightedElement).css('background-color', color)
          // Set purpose color
          highlightedElement.dataset.color = color
          let group = null
          if (LanguageUtils.isInstanceOf(tagInstance, TagGroup)) {
            group = tagInstance
            // Set message
            highlightedElement.title = 'Rubric competence: ' + group.config.name + '\nMark is pending, go to marking mode.'
          } else if (LanguageUtils.isInstanceOf(tagInstance, Tag)) {
            group = tagInstance.group
            // Get highest mark
            let highestMark = _.last(group.tags).name
            highlightedElement.title = 'Rubric competence: ' + group.config.name + '\nMark: ' + tagInstance.name + ' of ' + highestMark
          }
          if (!_.isEmpty(annotation.text)) {
            highlightedElement.title += '\nFeedback: ' + annotation.text
          }
        })
        // Create context menu event for highlighted elements
        this.createContextMenuForAnnotation(annotation)
        // Create double click event handler
        this.createDoubleClickEventHandler(annotation)
      } catch (e) {
        // TODO Handle error (maybe send in callback the error ¿?)
        if (_.isFunction(callback)) {
          callback(new Error('Element not found'))
        }
      } finally {
        if (_.isFunction(callback)) {
          callback()
        }
      }
    } else {
      let color = 'rgba(0, 0, 0, 0.5)' // Neutral color for elements to remove
      try {
        // Highlight elements
        let highlightedElements = DOMTextUtils.highlightContent(
          annotation.target[0].selector, this.noUsefulHighlightClassName, annotation.id)
        highlightedElements.forEach(highlightedElement => {
          // If need to highlight, set the color corresponding to, in other case, maintain its original color
          $(highlightedElement).css('background-color', color)
          // Add title
          let criteriaName = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:isCriteriaOf:')
          let levelName = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:mark:')
          let criteriaLevelText = ''
          if (_.isString(levelName)) {
            criteriaLevelText = 'This annotation pertains to the criteria ' + criteriaName + ' with level ' + levelName + ' which is not in your rubric.\n'
          } else {
            criteriaLevelText = 'This annotation pertains to the criteria ' + criteriaName + ' which is not in your rubric.\n'
          }
          highlightedElement.title = criteriaLevelText +
            'Please consider re-marking this assignment (if the criteria exists) or deleting this annotation.'
          // Create context menu event for highlighted elements
          this.createContextMenuForNonUsefulAnnotation(annotation)
        })
      } finally {

      }
    }
  }

  createDoubleClickEventHandler (annotation) {
    let highlights = document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')
    for (let i = 0; i < highlights.length; i++) {
      let highlight = highlights[i]
      highlight.addEventListener('dblclick', () => {
        if (window.abwa.roleManager.role === RolesManager.roles.teacher) {
          let replies = this.getRepliesForAnnotation(annotation)
          if (replies.length > 0) {
            this.replyAnnotationHandler(annotation)
          } else {
            this.commentAnnotationHandler(annotation)
          }
        } else if (window.abwa.roleManager.role === RolesManager.roles.student) {
          this.replyAnnotationHandler(annotation)
        }
      })
    }
  }

  createContextMenuForAnnotation (annotation) {
    $.contextMenu({
      selector: '[data-annotation-id="' + annotation.id + '"]',
      build: () => {
        // Create items for context menu
        let items = {}
        // If current user is the same as author, allow to remove annotation or add a comment
        if (window.abwa.roleManager.role === RolesManager.roles.teacher) {
          //  If a reply already exist show reply, otherwise show comment
          let replies = this.getRepliesForAnnotation(annotation)
          if (replies.length > 0) {
            items['reply'] = {name: 'Reply'}
          } else {
            items['comment'] = {name: 'Comment'}
          }
          items['delete'] = {name: 'Delete annotation'}
        } else if (window.abwa.roleManager.role === RolesManager.roles.student) {
          items['reply'] = {name: 'Reply'}
        }
        return {
          callback: (key) => {
            if (key === 'delete') {
              this.deleteAnnotationHandler(annotation)
            } else if (key === 'comment') {
              this.commentAnnotationHandler(annotation)
            } else if (key === 'reply') {
              this.replyAnnotationHandler(annotation)
            }
          },
          items: items
        }
      }
    })
  }

  createContextMenuForNonUsefulAnnotation (annotation) {
    $.contextMenu({
      selector: '[data-annotation-id="' + annotation.id + '"]',
      build: () => {
        // Create items for context menu
        let items = {}
        // If current user is the same as author, allow to remove annotation or add a comment
        if (window.abwa.roleManager.role === RolesManager.roles.teacher) {
          items['delete'] = {name: 'Delete annotation'}
        }
        return {
          callback: (key) => {
            if (key === 'delete') {
              this.deleteAnnotationHandler(annotation)
            }
          },
          items: items
        }
      }
    })
  }

  replyAnnotationHandler (annotation) {
    // Get annotations replying current annotation
    let repliesData = this.createRepliesData(annotation)
    let inputValue = ''
    if (_.last(repliesData.replies) && _.last(repliesData.replies).user === window.abwa.groupSelector.user.userid) {
      inputValue = _.last(repliesData.replies).text
    }

    Alerts.inputTextAlert({
      input: 'textarea',
      inputPlaceholder: inputValue || 'Type your reply here...',
      inputValue: inputValue || '',
      html: repliesData.htmlText,
      callback: (err, result) => {
        if (err) {

        } else {
          if (_.isEmpty(inputValue)) {
            // The comment you are writing is new
            let replyAnnotationData = TextAnnotator.constructAnnotation()
            // Add text
            replyAnnotationData.text = result
            // Add its reference (the annotation that replies to
            replyAnnotationData.references = [annotation.id]
            window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(replyAnnotationData, (err, replyAnnotation) => {
              if (err) {
                // Show error when creating annotation
                Alerts.errorAlert({text: 'There was an error when replying, please try again. Make sure you are logged in Hypothes.is.'})
              } else {
                // Dispatch event of new reply is created
                LanguageUtils.dispatchCustomEvent(Events.reply, {
                  replyType: 'new',
                  annotation: annotation,
                  replyAnnotation: replyAnnotation
                })
                // Add reply to reply list
                this.replyAnnotations.push(replyAnnotation)
              }
            })
          } else {
            // The comment you are writing is a modification of the latest one
            window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(_.last(repliesData.replies).id, {

            }, (err, replyAnnotation) => {
              if (err) {
                // Show error when updating annotation
                Alerts.errorAlert({text: 'There was an error when editing your reply, please try again. Make sure you are logged in Hypothes.is.'})
              } else {
                // TODO Remove the comment and create the new one in moodle
                LanguageUtils.dispatchCustomEvent(Events.reply, {
                  replyType: 'update',
                  annotation: annotation,
                  replyAnnotation: replyAnnotation,
                  originalText: inputValue
                })
              }
            })
          }
          console.log(result)
        }
      }
    })
  }

  createRepliesData (annotation) {
    let htmlText = ''
    // Add feedback comment text
    htmlText += this.createReplyLog(annotation)
    htmlText += '<hr/>'
    // get replies for this annotation
    let replies = this.getRepliesForAnnotation(annotation)
    // What and who
    for (let i = 0; i < replies.length - 1; i++) {
      let reply = replies[i]
      htmlText += this.createReplyLog(reply)
      if (replies.length - 2 > i) {
        htmlText += '<hr/>'
      }
    }
    // If last reply is from current user, don't show it in reply chain, it will be shown as comment to be edited
    let lastReply = _.last(replies)
    if (lastReply) {
      if (lastReply.user !== window.abwa.groupSelector.user.userid) {
        htmlText += '<hr/>'
        htmlText += this.createReplyLog(lastReply)
      }
    }
    return {htmlText: htmlText, replies: replies}
  }

  getRepliesForAnnotation (annotation) {
    let replies = _.filter(this.replyAnnotations, (replyAnnotation) => {
      return AnnotationUtils.isReplyOf(annotation, replyAnnotation)
    })
    replies = _.orderBy(replies, 'updated')
    return replies
  }

  createReplyLog (reply) {
    let htmlText = ''
    // Add user name
    if (reply.user === window.abwa.groupSelector.user.userid) {
      htmlText += '<span class="reply_user">You: </span>'
    } else {
      let username = reply.user.split('acct:')[1].split('@hypothes.is')[0]
      htmlText += '<span class="reply_user">' + username + ': </span>'
    }
    let urlizedReplyText = linkifyUrls(reply.text, {
      attributes: {
        target: '_blank'
      }
    })
    // Add comment
    htmlText += '<span class="reply_text">' + urlizedReplyText + '</span>'
    return htmlText
  }

  deleteAnnotationHandler (annotation) {
    // Delete annotation
    window.abwa.hypothesisClientManager.hypothesisClient.deleteAnnotation(annotation.id, (err, result) => {
      if (err) {
        // Unable to delete this annotation
        console.error('Error while trying to delete annotation %s', annotation.id)
      } else {
        if (!result.deleted) {
          // Alert user error happened
          Alerts.errorAlert({text: chrome.i18n.getMessage('errorDeletingHypothesisAnnotation')})
        } else {
          // Remove annotation from data model
          _.remove(this.currentAnnotations, (currentAnnotation) => {
            return currentAnnotation.id === annotation.id
          })
          LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
          _.remove(this.allAnnotations, (currentAnnotation) => {
            return currentAnnotation.id === annotation.id
          })
          LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
          // Dispatch deleted annotation event
          LanguageUtils.dispatchCustomEvent(Events.annotationDeleted, {annotation: annotation})
          // Unhighlight annotation highlight elements
          DOMTextUtils.unHighlightElements([...document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')])
          console.debug('Deleted annotation ' + annotation.id)
        }
      }
    })
  }

  commentAnnotationHandler (annotation) {
    // Close sidebar if opened
    let isSidebarOpened = window.abwa.sidebar.isOpened()
    this.closeSidebar()
    // Inputs
    let comment
    // Get annotation criteria
    let criteriaName = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:isCriteriaOf:')
    // Get previous assignments
    let previousAssignments = this.retrievePreviousAssignments()
    let previousAssignmentsUI = this.createPreviousAssignmentsUI(previousAssignments)
    Alerts.multipleInputAlert({
      title: criteriaName,
      html: previousAssignmentsUI.outerHTML + '<textarea data-minchars="1" data-multiple id="comment" rows="6" autofocus>' + annotation.text + '</textarea>',
      onBeforeOpen: (swalMod) => {
        // Add event listeners for append buttons
        let previousAssignmentAppendElements = document.querySelectorAll('.previousAssignmentAppendButton')
        previousAssignmentAppendElements.forEach((previousAssignmentAppendElement) => {
          previousAssignmentAppendElement.addEventListener('click', () => {
            // Append url to comment
            let commentTextarea = document.querySelector('#comment')
            commentTextarea.value = commentTextarea.value + previousAssignmentAppendElement.dataset.studentUrl
          })
        })
        // Load datalist with previously used texts
        this.retrievePreviouslyUsedComments(criteriaName).then((previousComments) => {
          let awesomeplete = new Awesomplete(document.querySelector('#comment'), {
            list: previousComments,
            minChars: 0
          })
          // On double click on comment, open the awesomeplete
          document.querySelector('#comment').addEventListener('dblclick', () => {
            awesomeplete.evaluate()
            awesomeplete.open()
          })
        })
      },
      // position: Alerts.position.bottom, // TODO Must be check if it is better to show in bottom or not
      preConfirm: () => {
        comment = document.querySelector('#comment').value
      },
      callback: (err, result) => {
        if (!_.isUndefined(comment)) { // It was pressed OK button instead of cancel, so update the annotation
          if (err) {
            window.alert('Unable to load alert. Is this an annotable document?')
          } else {
            // Update annotation
            annotation.text = comment || ''
            window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(
              annotation.id,
              annotation,
              (err, annotation) => {
                if (err) {
                  // Show error message
                  Alerts.errorAlert({text: chrome.i18n.getMessage('errorUpdatingAnnotationComment')})
                } else {
                  // Update current annotations
                  let currentIndex = _.findIndex(this.currentAnnotations, (currentAnnotation) => { return annotation.id === currentAnnotation.id })
                  this.currentAnnotations.splice(currentIndex, 1, annotation)
                  // Update all annotations
                  let allIndex = _.findIndex(this.allAnnotations, (currentAnnotation) => { return annotation.id === currentAnnotation.id })
                  this.allAnnotations.splice(allIndex, 1, annotation)
                  // Dispatch updated annotations events
                  LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
                  LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
                  LanguageUtils.dispatchCustomEvent(Events.comment, {annotation: annotation})
                  // Redraw annotations
                  DOMTextUtils.unHighlightElements([...document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')])
                  this.highlightAnnotation(annotation)
                }
              })
            if (isSidebarOpened) {
              this.openSidebar()
            }
          }
        }
      }
    })
  }

  createPreviousAssignmentsUI (previousAssignments) {
    let previousAssignmentsContainer = document.createElement('div')
    previousAssignmentsContainer.className = 'previousAssignmentsContainer'
    for (let i = 0; i < previousAssignments.length; i++) {
      let previousAssignment = previousAssignments[i]
      // Create previous assignment element container
      let previousAssignmentElement = document.createElement('span')
      previousAssignmentElement.className = 'previousAssignmentContainer'
      // Create previous assignment link
      let previousAssignmentLinkElement = document.createElement('a')
      previousAssignmentLinkElement.href = previousAssignment.teacherUrl
      previousAssignmentLinkElement.target = '_blank'
      previousAssignmentLinkElement.innerText = previousAssignment.name
      previousAssignmentLinkElement.className = 'previousAssignmentLink'
      previousAssignmentElement.appendChild(previousAssignmentLinkElement)
      // Create previous assignment append img
      let previousAssignmentAppendElement = document.createElement('img')
      previousAssignmentAppendElement.src = chrome.extension.getURL('images/append.png')
      previousAssignmentAppendElement.title = 'Append the assignment URL'
      previousAssignmentAppendElement.className = 'previousAssignmentAppendButton'
      previousAssignmentAppendElement.dataset.studentUrl = previousAssignment.studentUrl
      previousAssignmentElement.appendChild(previousAssignmentAppendElement)
      previousAssignmentsContainer.appendChild(previousAssignmentElement)
    }
    return previousAssignmentsContainer
  }

  retrievePreviousAssignments () {
    return window.abwa.specific.assessmentManager.previousAssignments
  }

  async retrievePreviouslyUsedComments (criteria) {
    return new Promise((resolve, reject) => {
      window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotationsSequential({
        tag: 'exam:isCriteriaOf:' + criteria,
        wildcard_uri: (new URL(window.abwa.contentTypeManager.fileMetadata.url)).origin + '/*'
      }, (err, annotations) => {
        if (err) {
          reject(err)
        } else {
          // Get texts from annotations and send them in callback
          resolve(_.uniq(_.reject(_.map(annotations, (annotation) => {
            // Remove other students moodle urls
            let text = annotation.text
            let regex = /\b(?:https?:\/\/)?[^/:]+\/.*?mod\/assign\/view.php\?id=[0-9]+/g
            return text.replace(regex, '')
          }), _.isEmpty)))
        }
      })
      return true
    })
  }

  retrieveHighlightClassName () {
    return this.highlightClassName // TODO Depending on the status of the application
  }

  mouseUpOnDocumentHandlerConstructor () {
    return (event) => {
      // Check if something is selected
      if (document.getSelection().toString().length !== 0) {
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0 &&
          $(event.target).parents('.swal2-container').toArray().length === 0) {
          this.openSidebar()
        }
      } else {
        console.debug('Current selection is empty')
        // If selection is child of sidebar, return null
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0) {
          console.debug('Current selection is not child of the annotator sidebar')
          this.closeSidebar()
        }
      }
    }
  }

  goToFirstAnnotationOfTag (tag) {
    // TODO Retrieve first annotation for tag
    let annotation = _.find(this.currentAnnotations, (annotation) => {
      return annotation.tags.includes(tag)
    })
    if (annotation) {
      this.goToAnnotation(annotation)
    }
  }

  goToAnnotationOfTag (tag) {
    let annotations = _.filter(this.currentAnnotations, (annotation) => {
      return annotation.tags.includes(tag)
    })
    if (annotations.length > 0) {
      let index = _.indexOf(annotations, this.lastAnnotation)
      if (index === -1 || index === annotations.length - 1) {
        this.goToAnnotation(annotations[0])
        this.lastAnnotation = annotations[0]
      } else {
        this.goToAnnotation(annotations[index + 1])
        this.lastAnnotation = annotations[index + 1]
      }
    }
  }

  goToAnnotation (annotation) {
    // If document is pdf, the DOM is dynamic, we must scroll to annotation using PDF.js FindController
    if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
      let queryTextSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
      if (queryTextSelector && queryTextSelector.exact) {
        window.PDFViewerApplication.findController.executeCommand('find', {query: queryTextSelector.exact, phraseSearch: true})
        // Timeout to remove highlight used by PDF.js
        setTimeout(() => {
          let pdfjsHighlights = document.querySelectorAll('.highlight')
          for (let i = 0; pdfjsHighlights.length > i; i++) {
            if (_.isElement(pdfjsHighlights[i])) {
              pdfjsHighlights[i].classList.remove('highlight')
            }
          }
        }, 1000)
        // Redraw annotations
        this.redrawAnnotations()
      }
    } else { // Else, try to find the annotation by data-annotation-id element attribute
      let firstElementToScroll = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
      if (!_.isElement(firstElementToScroll) && !_.isNumber(this.initializationTimeout)) {
        this.initializationTimeout = setTimeout(() => {
          console.debug('Trying to scroll to init annotation in 2 seconds')
          this.initAnnotatorByAnnotation()
        }, 2000)
      } else {
        firstElementToScroll.scrollIntoView({behavior: 'smooth', block: 'center'})
      }
    }
  }

  closeSidebar () {
    super.closeSidebar()
  }

  openSidebar () {
    super.openSidebar()
  }

  destroy () {
    // Remove observer interval
    clearInterval(this.observerInterval)
    // Clean interval
    clearInterval(this.cleanInterval)
    // Remove reload interval
    clearInterval(this.reloadInterval)
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    // Unhighlight all annotations
    this.unHighlightAllAnnotations()
  }

  unHighlightAllAnnotations () {
    // Remove created annotations
    let highlightedElements = _.flatten(_.map(
      this.allAnnotations,
      (annotation) => { return [...document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')] })
    )
    DOMTextUtils.unHighlightElements(highlightedElements)
  }

  initAnnotatorByAnnotation (callback) {
    // Check if init annotation exists
    if (window.abwa.annotationBasedInitializer.initAnnotation) {
      let initAnnotation = window.abwa.annotationBasedInitializer.initAnnotation
      // Go to annotation
      this.goToAnnotation(initAnnotation)
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }

  /**
   * Giving a list of old tags it changes all the annotations for the current document to the new tags
   * @param annotations
   * @param newTags
   * @param callback Error, Result
   */
  updateTagsForAnnotations (annotations, newTags, callback) {
    let promises = []
    for (let i = 0; i < annotations.length; i++) {
      let oldTagAnnotation = annotations[i]
      promises.push(new Promise((resolve, reject) => {
        oldTagAnnotation.tags = newTags
        window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(oldTagAnnotation.id, oldTagAnnotation, (err, annotation) => {
          if (err) {
            reject(new Error('Unable to update annotation ' + oldTagAnnotation.id))
          } else {
            resolve(annotation)
          }
        })
      }))
    }
    let resultAnnotations = []
    Promise.all(promises).then((result) => {
      // All annotations updated
      resultAnnotations = result
    }).finally((result) => {
      if (_.isFunction(callback)) {
        callback(null, resultAnnotations)
      }
    })
  }

  redrawAnnotations () {
    // Unhighlight all annotations
    this.unHighlightAllAnnotations()
    // Highlight all annotations
    this.highlightAnnotations(this.allAnnotations)
  }
}

module.exports = TextAnnotator
