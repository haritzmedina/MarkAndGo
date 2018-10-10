const AnnotationGuide = require('./AnnotationGuide')
const jsYaml = require('js-yaml')
const _ = require('lodash')

class Rubric extends AnnotationGuide {
  constructor ({moodleEndpoint, assignmentId, assignmentName}) {
    super({name: assignmentName})
    this.moodleEndpoint = moodleEndpoint
    this.assignmentId = assignmentId
    this.criterias = this.guideElements
  }

  toAnnotations () {
    let annotations = []
    // Create annotation for current element
    annotations.push(this.toAnnotation())
    // Create annotations for all criterias
    for (let i = 0; i < this.criterias.length; i++) {
      annotations = annotations.concat(this.criterias[i].toAnnotations())
    }
    return annotations
  }

  toAnnotation () {
    return {
      group: this.hypothesisGroup.id,
      permissions: {
        read: ['group:' + this.hypothesisGroup.id]
      },
      references: [],
      tags: ['exam:metadata'],
      target: [],
      text: 'moodleEndpoint: ' + this.moodleEndpoint + '\nassignmentId: ' + this.assignmentId,
      uri: this.hypothesisGroup.links.html
    }
  }

  static fromAnnotations (annotations) {
    let rubricAnnotation = _.remove(annotations, (annotation) => {
      return _.some(annotation.tags, (tag) => { return tag === 'exam:metadata' })
    })
    let rubric = Rubric.fromAnnotation(rubricAnnotation[0])
    // TODO Complete the rubric from the annotations
    /*
    // For the rest of annotations, get criterias and levels
    let criteriasAnnotations = _.remove(annotations, (annotation) => {
      return _.some(annotation.tags, (tag) => {
        return tag.includes('exam:criteria:')
      })
    })
    let levelsAnnotations = _.remove(annotations, (annotation) => {
      return _.some(annotation.tags, (tag) => {
        return tag.includes('exam:mark:')
      })
    })
    for (let i = 0; i < criteriasAnnotations.length; i++) {

    }
    */
    return rubric
  }

  static fromAnnotation (annotation) {
    let config = jsYaml.load(annotation.text)
    config.assignmentName = window.abwa.groupSelector.currentGroup.name
    config.hypothesisGroup = window.abwa.groupSelector.currentGroup
    return new Rubric(config)
  }
}

module.exports = Rubric
