const HyperSheetColors = require('./HyperSheetColors')
const _ = require('lodash')
const Config = require('../../Config')
const TagManager = require('../../contentScript/TagManager')

class CommonHypersheetManager {
  static updateClassificationInductive (facetAnnotations, facetName, callback) {
    if (facetAnnotations.length === 0) { // If no annotations for this facet, clean cell value
      // TODO Clear cell
      CommonHypersheetManager.cleanMonovaluedFacetInGSheet(facetName, (err, result) => {
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          if (_.isFunction(callback)) {
            callback(null, result)
          }
        }
      })
    } else {
      // Check if more than one user has classified the facet
      let uniqueUsers = _.uniq(_.map(facetAnnotations, (facetAnnotation) => { return facetAnnotation.user }))
      // If more than one yellow, in other case white
      let color = uniqueUsers.length > 1 ? HyperSheetColors.yellow : HyperSheetColors.white
      CommonHypersheetManager.updateInductiveFacetInGSheet(facetName, facetAnnotations[0], color, (err, result) => {
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          if (_.isFunction(callback)) {
            callback(null, result)
          }
        }
      })
    }
  }

  /**
   *
   * @param {String} facetName
   * @param annotation
   * @param {Object} backgroundColor
   * @param {Function} callback
   */
  static updateInductiveFacetInGSheet (facetName, annotation, backgroundColor, callback) {
    // Retrieve link for primary study
    window.abwa.specific.primaryStudySheetManager.getPrimaryStudyLink((err, primaryStudyLink) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Get link for cell
        let link = CommonHypersheetManager.getAnnotationUrl(annotation, primaryStudyLink)
        // Retrieve row and cell
        let row = window.abwa.specific.primaryStudySheetManager.primaryStudyRow // It is already updated by getPrimaryStudyLink
        let sheetData = window.abwa.specific.primaryStudySheetManager.sheetData
        let column = _.findIndex(sheetData.data[0].rowData[0].values, (cell) => {
          return cell.formattedValue === facetName
        })
        // Retrieve value for the cell (text annotated)
        let value = CommonHypersheetManager.getAnnotationValue(annotation)
        if (row > 0 && column > 0 && _.isString(link)) {
          window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.updateCell({
            row: row,
            column: column,
            value: value,
            link: link,
            backgroundColor: backgroundColor,
            spreadsheetId: window.abwa.specific.mappingStudyManager.mappingStudy.spreadsheetId,
            sheetId: window.abwa.specific.mappingStudyManager.mappingStudy.sheetId
          }, (err, result) => {
            if (err) {
              if (_.isFunction(callback)) {
                callback(err)
              }
            } else {
              if (_.isFunction(callback)) {
                callback(null, result)
              }
            }
          })
        } else {
          if (_.isFunction(callback)) {
            if (row > 0 && column > 0) {
              callback(new Error('Column or row is not found in hypersheet'))
            } else {
              callback(new Error('Unable to create the link to the annotation'))
            }
          }
        }
      }
    })
  }

  static updateClassificationMonovaluedNoEvidences (facetName, mark, callback) {
    CommonHypersheetManager.updateMonovaluedFacetInGSheet(facetName, mark, null, HyperSheetColors.yellow, (err, result) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (_.isFunction(callback)) {
          callback(null, result)
        }
      }
    })
  }

  static updateClassificationMonovalued (facetAnnotations, facetName, callback) {
    if (facetAnnotations.length === 0) { // If no annotations for this facet, no evidences found, but value must be added to sheet
      callback(new Error('No annotations for this facet, no evidences, this is not the method for no evidences, check: updateClassificationMonovaluedNoEvidences'))
    } else {
      // Order by date
      let orderedFacetAnnotations = _.reverse(_.sortBy(facetAnnotations, (annotation) => { return new Date(annotation.updated) }))
      // If newest annotation is validation, validate, else, remove all validations from facetAnnotations array
      if (_.find(orderedFacetAnnotations[0].tags, (tag) => { return tag === this.tags.validated })) {
        // Get the annotation who is referenced by validation
        let validatedAnnotation = _.find(facetAnnotations, (annotation) => { return annotation.id === orderedFacetAnnotations[0].references[0] })
        let codeNameTag = _.find(validatedAnnotation, (tag) => { return tag.includes(CommonHypersheetManager.tags.code) })
        let codeName = codeNameTag.replace(CommonHypersheetManager.tags.code, '')
        CommonHypersheetManager.updateMonovaluedFacetInGSheet(facetName, codeName, validatedAnnotation, HyperSheetColors.green, (err, result) => {
          if (err) {
            if (_.isFunction(callback)) {
              callback(err)
            }
          } else {
            if (_.isFunction(callback)) {
              callback(null, result)
            }
          }
        })
      } else {
        facetAnnotations = _.filter(facetAnnotations, (annotation) => {
          return _.find(annotation.tags, (tag) => { return tag !== this.tags.validated })
        })
        // Retrieve oldest annotation's code
        let codeNameTag = _.find(facetAnnotations[0].tags, (tag) => { return tag.includes(CommonHypersheetManager.tags.code) })
        if (!_.isString(codeNameTag)) {
          if (_.isFunction(callback)) {
            callback(new Error('Error while updating hypersheet. Oldest annotation hasn\'t code tag'))
          }
        } else {
          let codeName = codeNameTag.replace(CommonHypersheetManager.tags.code, '')
          if (facetAnnotations.length > 1) { // Other annotations are with same facet
            // Retrieve all used codes to classify the current facet
            let uniqueCodes = _.uniq(_.map(facetAnnotations, (facetAnnotation) => {
              return _.find(facetAnnotation.tags, (tag) => {
                return tag.includes(CommonHypersheetManager.tags.code)
              })
            }))
            if (uniqueCodes.length > 1) { // More than one is used, red background
              // Set in red background and maintain the oldest one annotation code
              CommonHypersheetManager.updateMonovaluedFacetInGSheet(facetName, codeName, facetAnnotations[0], HyperSheetColors.red, (err, result) => {
                if (err) {
                  if (_.isFunction(callback)) {
                    callback(err)
                  }
                } else {
                  if (_.isFunction(callback)) {
                    callback(null, result)
                  }
                }
              })
            } else {
              // Retrieve users who use the code in facet
              let uniqueUsers = _.uniq(_.map(facetAnnotations, (facetAnnotation) => { return facetAnnotation.user }))
              if (uniqueUsers.length > 1) { // More than one reviewer has classified using same facet and code
                // Set in yellow background
                CommonHypersheetManager.updateMonovaluedFacetInGSheet(facetName, codeName, facetAnnotations[0], HyperSheetColors.yellow, (err, result) => {
                  if (err) {
                    if (_.isFunction(callback)) {
                      callback(err)
                    }
                  } else {
                    if (_.isFunction(callback)) {
                      callback(null, result)
                    }
                  }
                })
              } else {
                // Is the same user with the same code, set in white background with the unique code
                CommonHypersheetManager.updateMonovaluedFacetInGSheet(facetName, codeName, facetAnnotations[0], HyperSheetColors.white, (err, result) => {
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
            }
          } else { // No other annotation is found with same facet
            CommonHypersheetManager.updateMonovaluedFacetInGSheet(facetName, codeName, facetAnnotations[0], HyperSheetColors.white, (err, result) => {
              if (err) {
                if (_.isFunction(callback)) {
                  callback(err)
                }
              } else {
                if (_.isFunction(callback)) {
                  callback(null, result)
                }
              }
            })
          }
        }
      }
    }
  }

  static cleanMonovaluedFacetInGSheet (facetName, callback) {
    window.abwa.specific.primaryStudySheetManager.getGSheetData((err, sheetData) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        window.abwa.specific.primaryStudySheetManager.retrievePrimaryStudyRow((err, row) => {
          if (err) {
            callback(err)
          } else {
            let column = _.findIndex(sheetData.data[0].rowData[0].values, (cell) => {
              return cell.formattedValue === facetName
            })
            if (row !== 0 && column !== 0) {
              let request = window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.createRequestUpdateCell({
                row: row,
                column: column,
                value: '',
                backgroundColor: HyperSheetColors.white,
                sheetId: window.abwa.specific.mappingStudyManager.mappingStudy.sheetId
              })
              window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.batchUpdate({
                spreadsheetId: window.abwa.specific.mappingStudyManager.mappingStudy.spreadsheetId,
                requests: [request]
              }, (err, result) => {
                if (err) {
                  if (_.isFunction(callback)) {
                    callback(err)
                  }
                } else {
                  if (_.isFunction(callback)) {
                    callback(null, result)
                  }
                }
              })
            }
          }
        }, true)
      }
    })
  }

  static updateMonovaluedFacetInGSheet (facetName, codeName, currentAnnotation, color, callback) {
    // Retrieve link for primary study
    window.abwa.specific.primaryStudySheetManager.getPrimaryStudyLink((err, primaryStudyLink) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Get link for cell
        let link = window.abwa.contentTypeManager.documentURL
        if (currentAnnotation !== null) {
          link = CommonHypersheetManager.getAnnotationUrl(currentAnnotation, primaryStudyLink)
        }
        // Retrieve row and cell
        let row = window.abwa.specific.primaryStudySheetManager.primaryStudyRow // It is already updated by getPrimaryStudyLink call
        let sheetData = window.abwa.specific.primaryStudySheetManager.sheetData
        let column = _.findIndex(sheetData.data[0].rowData[0].values, (cell) => {
          return cell.formattedValue === facetName
        })
        if (row !== 0 && column !== 0 && _.isString(link)) {
          // Create request to send to google sheet api
          let request = window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.createRequestUpdateCell({
            row: row,
            column: column,
            value: codeName,
            link: link,
            backgroundColor: color,
            sheetId: window.abwa.specific.mappingStudyManager.mappingStudy.sheetId
          })
          window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.batchUpdate({
            spreadsheetId: window.abwa.specific.mappingStudyManager.mappingStudy.spreadsheetId,
            requests: [request]
          }, (err, result) => {
            if (err) {
              if (_.isFunction(callback)) {
                callback(err)
              }
            } else {
              if (_.isFunction(callback)) {
                callback(null, result)
              }
            }
          })
        }
      }
    })
  }

  static getAllAnnotations (callback) {
    // Retrieve annotations for current url and group
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(),
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(),
      group: window.abwa.groupSelector.currentGroup.id,
      order: 'asc'
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Search tagged annotations
        let tagList = window.abwa.tagManager.getTagsList()
        let taggedAnnotations = []
        for (let i = 0; i < annotations.length; i++) {
          // Check if annotation contains a tag of current group
          let tag = TagManager.retrieveTagForAnnotation(annotations[i], tagList)
          if (tag) {
            taggedAnnotations.push(annotations[i])
          } else {
            // If has validated tag
            if (_.find(annotations[i].tags, (tag) => { return tag === this.tags.validated })) {
              taggedAnnotations.push(annotations[i])
            }
          }
        }
        if (_.isFunction(callback)) {
          callback(null, taggedAnnotations)
        }
      }
    })
  }

  static getAnnotationUrl (annotation, primaryStudyURL) {
    if (primaryStudyURL) {
      return primaryStudyURL + '#' + Config.exams.urlParamName + ':' + annotation.id
    } else {
      if (window.abwa.contentTypeManager.doi) {
        return 'https://doi.org/' + window.abwa.contentTypeManager.doi + '#' + Config.exams.urlParamName + ':' + annotation.id
      } else {
        return annotation.uri + '#' + Config.exams.urlParamName + ':' + annotation.id
      }
    }
  }

  static getAnnotationValue (annotation) {
    let selector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
    if (_.has(selector, 'exact')) {
      return selector.exact
    } else {
      return null
    }
  }
}

CommonHypersheetManager.tags = {
  isCodeOf: Config.exams.namespace + ':' + Config.exams.tags.grouped.relation + ':',
  facet: Config.exams.namespace + ':' + Config.exams.tags.grouped.group + ':',
  code: Config.exams.namespace + ':' + Config.exams.tags.grouped.subgroup + ':',
  validated: Config.exams.namespace + ':' + Config.exams.tags.statics.validated
}

module.exports = CommonHypersheetManager
