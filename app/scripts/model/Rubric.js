const AnnotationGuide = require('./AnnotationGuide')

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
}

module.exports = Rubric
