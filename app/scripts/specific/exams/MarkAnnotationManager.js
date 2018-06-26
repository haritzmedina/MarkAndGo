const Events = require('../../contentScript/Events')
const Config = require('../../Config')
const CommonHypersheetManager = require('./CommonHypersheetManager')
const _ = require('lodash')
const swal = require('sweetalert2')

class MarkAnnotationManager {
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
    // Create event for marking
    this.events.marking = {
      element: document,
      event: Events.mark,
      handler: this.markAnnotationCreateEventHandler()
    }
    this.events.marking.element.addEventListener(this.events.marking.event, this.events.marking.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  markAnnotationCreateEventHandler (callback) {
    return (event) => {
      if (event.detail.annotations.length > 0) {
        CommonHypersheetManager.updateClassificationMonovalued(event.detail.annotations, event.detail.criteria, (err, result) => {
          if (err) {
            if (_.isFunction(callback)) {
              callback(err)
            }
          } else {
            swal({ // TODO i18n
              position: 'top-end',
              type: 'success',
              title: 'Correctly marked',
              showConfirmButton: false,
              timer: 1500
            })
            if (_.isFunction(callback)) {
              callback(null, result)
            }
          }
        })
      } else {
        CommonHypersheetManager.updateClassificationMonovaluedNoEvidences(event.detail.criteria, event.detail.mark, (err, result) => {
          if (err) {
            if (_.isFunction(callback)) {
              callback(err)
            }
          } else {
            swal({ // TODO i18n
              position: 'top-end',
              type: 'success',
              title: 'Correctly marked',
              showConfirmButton: false,
              timer: 1500
            })
            if (_.isFunction(callback)) {
              callback(null, result)
            }
          }
        })
      }
    }
  }
}

module.exports = MarkAnnotationManager
