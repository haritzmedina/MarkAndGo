const GuideElement = require('./GuideElement')
const jsYaml = require('js-yaml')
const _ = require('lodash')

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

  static fromAnnotation (annotation, criteria = {}) {
    let markTag = _.find(annotation.tags, (tag) => {
      return tag.includes('exam:mark:')
    })
    if (_.isString(markTag)) {
      let name = markTag.replace('exam:mark:', '')
      let config = jsYaml.load(annotation.text)
      if (_.isObject(config)) {
        let description = config.description
        let levelId = config.levelId
        return new Level({name, description, criteria, levelId})
      } else {
        console.error('Unable to retrieve mark configuration from annotation')
      }
    } else {
      console.error('Unable to retrieve mark from annotation')
    }
  }
}

module.exports = Level
