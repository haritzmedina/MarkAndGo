const MappingStudy = require('../../model/MappingStudy')
const Facet = require('../../model/Facet')
const Code = require('../../model/Code')
const jsYaml = require('js-yaml')
const _ = require('lodash')
const Config = require('../../Config')

class MappingStudyManager {
  constructor () {
    this.mappingStudy = null
    this.tags = {
      spreadsheet: Config.exams.namespace + ':' + Config.exams.tags.statics.spreadsheet,
      isCodeOf: Config.exams.namespace + ':' + Config.exams.tags.grouped.relation + ':',
      facet: Config.exams.namespace + ':' + Config.exams.tags.grouped.group + ':',
      code: Config.exams.namespace + ':' + Config.exams.tags.grouped.subgroup + ':',
      validated: Config.exams.namespace + ':' + Config.exams.tags.statics.validated,
      multivalued: Config.exams.namespace + ':' + Config.exams.tags.statics.multivalued,
      inductive: Config.exams.namespace + ':' + Config.exams.tags.statics.inductive
    }
  }

  init (callback) {
    this.mappingStudy = new MappingStudy()
    // Load mapping study hypothesis group
    this.mappingStudy.hypothesisGroup = window.abwa.groupSelector.currentGroup
    // Load mapping study model from group annotations
    let groupAnnotations = window.abwa.tagManager.model.groupAnnotations
    this.mappingStudy.facets = this.getFacets(groupAnnotations)
    //
    this.mappingStudy.name = window.abwa.groupSelector.currentGroup.name
    // Load mapping study spreadsheet hypothesis relation data
    this.loadMappingStudyMetadata((err) => {
      if (err) {
        callback(err)
      } else {
        callback()
      }
    })
  }

  loadMappingStudyMetadata (callback) {
    // Retrieve the sheet id
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.groupSelector.currentGroup.url,
      tag: this.tags.spreadsheet
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (annotations.length > 0) {
          let annotation = annotations[0]
          let params = jsYaml.load(annotation.text)
          this.mappingStudy.spreadsheetId = params.spreadsheetId
          this.mappingStudy.sheetId = params.sheetId
          if (_.isFunction(callback)) {
            callback(null, params)
          }
        } else {
          // Should alert user
          callback(new Error('Annotation which relates hypothesis group with google spreadsheet is not found.'))
        }
      }
    })
  }

  getFacets (groupAnnotations) {
    let facetAnnotations = _.filter(groupAnnotations, (annotation) => {
      return _.find(annotation.tags, (tag) => {
        return tag.includes(this.tags.facet)
      })
    })
    let facets = []
    for (let i = 0; i < facetAnnotations.length; i++) {
      let facet = new Facet()
      let facetTags = facetAnnotations[i].tags
      let facetNameTag = _.find(facetTags, (tag) => {
        return tag.includes(this.tags.facet)
      })
      // Retrieve the name of the facet
      if (_.isString(facetNameTag)) {
        facet.name = facetNameTag.replace(this.tags.facet, '')
      }
      // Retrieve if multivalued
      if (_.find(facetTags, (tag) => { return tag.includes(this.tags.multivalued) })) {
        facet.multivalued = true
      }
      // Retrieve if inductive
      if (_.find(facetTags, (tag) => { return tag.includes(this.tags.inductive) })) {
        facet.inductive = true
      } else { // If not inductive, retrieve its codes
        facet.codes = this.getCodes(groupAnnotations, facet.name)
      }
      facets.push(facet)
    }
    return facets
  }

  getCodes (groupAnnotations, facetName) {
    // Get annotations codes for facet name
    let codeAnnotations = _.filter(groupAnnotations, (annotation) => {
      return _.find(annotation.tags, (tag) => {
        return tag.includes(this.tags.isCodeOf + facetName)
      })
    })
    let codes = []
    for (let i = 0; i < codeAnnotations.length; i++) {
      let code = new Code()
      let codeTag = _.find(codeAnnotations[i].tags, (tag) => { return tag.includes(this.tags.code) })
      if (_.isString(codeTag)) {
        code.name = codeTag.replace(this.tags.code, '')
        code.facet = facetName
        codes.push(code)
      }
    }
    return codes
  }

  destroy () {
    // Nothing to destroy in this class
  }
}

module.exports = MappingStudyManager
