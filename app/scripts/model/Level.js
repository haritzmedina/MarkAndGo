const GuideElement = require('./GuideElement')

class Level extends GuideElement {
  constructor ({name, description, color, criteria, levelId}) {
    super({name, parentElement: criteria})
    this.color = color
    this.criteria = this.parentElement
    this.levelId = levelId
    this.description = description
  }

  toAnnotations () {
    return [this.toAnnotation()]
  }

  toAnnotation () {
    let rubric = this.getAncestor()
    return {
      group: rubric.hypothesisGroup.id,
      permissions: {
        read: ['group:' + rubric.hypothesisGroup.id]
      },
      references: [],
      tags: ['exam:isCriteriaOf:' + this.criteria.name, 'exam:mark:' + this.name],
      target: [],
      text: 'levelId: ' + this.levelId + '\ncriteriaId: ' + this.criteria.criteriaId + '\ndescription: ' + this.description,
      uri: rubric.hypothesisGroup.links.html
    }
  }

  fromAnnotations () {

  }
}

module.exports = Level
