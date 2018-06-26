const Events = require('../../contentScript/Events')
const Config = require('../../Config')
const CommonHypersheetManager = require('./CommonHypersheetManager')
const swal = require('sweetalert2')
const _ = require('lodash')

class CreateAnnotationManager {
  constructor () {
    this.events = {}
    this.tags = {
      isCodeOf: Config.exams.namespace + ':' + Config.exams.tags.grouped.relation + ':',
      facet: Config.exams.namespace + ':' + Config.exams.tags.grouped.group + ':',
      code: Config.exams.namespace + ':' + Config.exams.tags.grouped.subgroup + ':',
      validated: Config.exams.namespace + ':' + Config.exams.tags.statics.validated
    }
  }

  init (callback) {
    // Create event for annotation create
    this.events.annotationCreate = {element: document, event: Events.annotationCreated, handler: this.createAnnotationCreateEventHandler()}
    this.events.annotationCreate.element.addEventListener(this.events.annotationCreate.event, this.events.annotationCreate.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createAnnotationCreateEventHandler () {
    return (event) => {
      // Add to google sheet the current annotation
      this.addClassificationToHypersheet(event.detail.annotation, (err) => {
        if (err) {
          // TODO Show user an error number
          console.error(err)
          swal({
            type: 'error',
            title: 'Oops...',
            text: 'Unable to update hypersheet. Ensure you have permission to update it and try it again.'
          })
        } else {
          // Nothing to do
          console.debug('Correctly updated google sheet with created annotation')
        }
      })
    }
  }

  addClassificationToHypersheet (annotation, callback) {
    // TODO Check if it should be removed the current value because a new evidence was added, but i don't think so...
    // Retrieve annotation facet (non-inductive)
    let facetTag = _.find(annotation.tags, (tag) => {
      return tag.includes(this.tags.isCodeOf)
    })
    // Check if annotated element is inductive tag
    try {
      if (window.abwa.tagManager.model.currentTags[facetTag.replace('exam:isCriteriaOf:', '')].tags[0].name === facetTag.replace('exam:isCriteriaOf:', '')) {
        this.addClassificationToHypersheetInductive(facetTag.replace('exam:isCriteriaOf:', ''), annotation, (err) => {
          if (err) {
            callback(err)
          } else {
            callback(null)
          }
        })
      }
    } catch (e) {
      callback(new Error('Annotation is not for mapping study'))
    }
  }

  addClassificationToHypersheetInductive (facetName, currentAnnotation, callback) {
    CommonHypersheetManager.getAllAnnotations((err, allAnnotations) => {
      if (err) {
        // Error while updating hypersheet
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Retrieve annotations with same facet
        let facetAnnotations = _.filter(_.filter(allAnnotations, (annotation) => {
          return _.find(annotation.tags, (tag) => {
            return _.includes(tag, facetName)
          })
        }), (iterAnnotation) => { // Filter current annotation if is retrieved in allAnnotations
          return !_.isEqual(iterAnnotation.id, currentAnnotation.id)
        })
        facetAnnotations.push(currentAnnotation)
        CommonHypersheetManager.updateClassificationInductive(facetAnnotations, facetName, (err) => {
          if (err) {
            if (_.isFunction(callback)) {
              callback(err)
            }
          } else {
            if (_.isFunction(callback)) {
              callback(null)
            }
          }
        })
      }
    })
  }

  destroy (callback) {
    // Remove the event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

module.exports = CreateAnnotationManager
