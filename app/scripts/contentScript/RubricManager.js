const Rubric = require('../model/Rubric')
const _ = require('lodash')

class RubricManager {
  constructor (config) {
    this.config = config
  }

  init (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.groupSelector.currentGroup.links.html,
      order: 'desc'
    }, (err, annotations) => {
      if (err) {
        window.alert('Unable to retrieve document annotations') // TODO Swal
      } else {
        this.rubric = Rubric.fromAnnotations(annotations)
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  destroy () {
    console.debug('Destroyed rubric manager')
  }
}

module.exports = RubricManager
