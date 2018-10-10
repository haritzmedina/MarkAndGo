const GuideElement = require('./GuideElement')

class Criteria extends GuideElement {
  constructor ({name, color, criteriaId, rubric}) {
    super({name, color, parentElement: rubric})
    this.criteriaId = criteriaId
    this.levels = this.childElements
    this.rubric = this.parentElement
  }

  toAnnotations () {
    let annotations = []
    // Create its annotations
    annotations.push(this.toAnnotation())
    // Create its children annotations
    for (let i = 0; i < this.levels.length; i++) {
      annotations = annotations.concat(this.levels[i].toAnnotations())
    }
    return annotations
  }

  toAnnotation () {
    let rubric = this.getAncestor()
    return {
      group: rubric.hypothesisGroup.id,
      permissions: {
        read: ['group:' + rubric.hypothesisGroup.id]
      },
      references: [],
      tags: ['exam:criteria:' + this.name],
      target: [],
      text: 'criteriaId: ' + this.criteriaId,
      uri: rubric.hypothesisGroup.links.html
    }
  }

  fromAnnotations (annotations) {

  }

  fromAnnotation () {

  }
}

module.exports = Criteria
