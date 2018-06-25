const _ = require('lodash')
const $ = require('jquery')
const jsYaml = require('js-yaml')
const ModeManager = require('./ModeManager')
const RolesManager = require('./RolesManager')
const LanguageUtils = require('../utils/LanguageUtils')
const ColorUtils = require('../utils/ColorUtils')
const Events = require('./Events')

class Tag {
  constructor (config, group = null) {
    this.group = group
    this.name = config.name
    this.namespace = config.namespace
    this.tags = config.tags || [config.namespace + ':' + config.name]
    if (config.options && config.options.color) {
      if (!ColorUtils.hasAlpha(config.options.color)) {
        this.color = ColorUtils.setAlphaToColor(config.options.color, 0.5) // Set a 0.5 alpha to all colors without alpha
      } else {
        this.color = config.options.color
      }
    } else {
      this.color = ColorUtils.getHashColor(this.name)
    }
    this.options = config.options
  }

  getColor () {
    return this.color
  }
}

class TagGroup {
  constructor (config, tags) {
    this.config = config
    this.tags = tags || []
    this.config.color = this.config.color || 'rgba(150,150,150,0.5)'
  }

  getColor () {
    return ColorUtils.setAlphaToColor(this.config.color, 0.5)
  }
}

class TagManager {
  constructor (namespace, config) {
    this.model = {
      documentAnnotations: [],
      groupAnnotations: [],
      namespace: namespace,
      config: config
    }
    this.currentTags = []
    this.currentIndexTags = []
    this.events = {}
  }

  init (callback) {
    this.initTagsStructure(() => {
      this.initEventHandlers(() => {
        this.initAllTags(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }

  getGroupAnnotations (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.groupSelector.currentGroup.url,
      order: 'desc'
    }, (err, annotations) => {
      if (err) {
        window.alert('Unable to retrieve document annotations') // TODO Swal
      } else {
        // Retrieve tags which has the namespace
        annotations = _.filter(annotations, (annotation) => {
          return this.hasANamespace(annotation, this.model.namespace)
        })
        // Remove slr:spreadsheet annotation ONLY for SLR case
        annotations = _.filter(annotations, (annotation) => {
          return !this.hasATag(annotation, 'slr:spreadsheet')
        })
        // Remove tags which are not group or subgroup
        if (_.isFunction(callback)) {
          callback(annotations)
        }
      }
    })
  }

  initTagsStructure (callback) {
    let tagWrapperUrl = chrome.extension.getURL('pages/sidebar/tagWrapper.html')
    $.get(tagWrapperUrl, (html) => {
      $('#abwaSidebarContainer').append($.parseHTML(html))
      this.tagsContainer = {evidencing: document.querySelector('#tagsEvidencing'), marking: document.querySelector('#tagsMarking'), viewing: document.querySelector('#tagsViewing')}
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  getTagsList () {
    if (this.currentTags.length > 0) {
      if (LanguageUtils.isInstanceOf(this.currentTags[0], Tag)) {
        return this.currentTags
      } else if (LanguageUtils.isInstanceOf(this.currentTags[0], TagGroup)) {
        let tags = []
        for (let i = 0; i < this.currentTags.length; i++) {
          tags = tags.concat(this.currentTags[i].tags)
        }
        return tags
      }
    } else {
      return [] // No tags for current group
    }
  }

  static retrieveTagForAnnotation (annotation, tagList) {
    for (let i = 0; i < tagList.length; i++) {
      let difference = _.differenceWith(
        tagList[i].tags,
        annotation.tags,
        (tag1, tag2) => {
          return tag1.toLowerCase() === tag2.toLowerCase()
        })
      if (difference.length === 0) {
        return tagList[i]
      }
    }
  }

  initAllTags (callback) {
    this.getGroupAnnotations((annotations) => {
      // Add to model
      this.model.groupAnnotations = annotations
      // Create tags based on annotations
      this.currentTags = this.createTagsBasedOnAnnotations()
      // Populate tags containers for the modes<
      this.createTagsButtonsForEvidencing()
      this.createTagsButtonsForMarking()
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  hasANamespace (annotation, namespace) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return _.startsWith(annotationTag.toLowerCase(), (namespace + ':').toLowerCase())
    }) !== -1
  }

  hasATag (annotation, tag) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return _.startsWith(annotationTag.toLowerCase(), tag.toLowerCase())
    }) !== -1
  }

  createTagsBasedOnAnnotations () {
    let tagGroupsAnnotations = {}
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let groupTag = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.group))
      if (groupTag) {
        tagGroupsAnnotations[groupTag] = new TagGroup({name: groupTag, namespace: this.model.namespace, group: this.model.config.grouped.group})
      }
    }
    let groups = _.sortBy(_.keys(tagGroupsAnnotations))
    let colorList = ColorUtils.getDifferentColors(groups.length)
    let colors = {}
    for (let i = 0; i < groups.length; i++) {
      colors[groups[i]] = colorList[i]
      tagGroupsAnnotations[groups[i]].config.color = colorList[i]
    }
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let tagAnnotation = this.model.groupAnnotations[i]
      let tagName = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.subgroup))
      let groupBelongedTo = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.relation))
      if (tagName && groupBelongedTo) {
        if (_.isArray(tagGroupsAnnotations[groupBelongedTo].tags)) {
          // Load options from annotation text body
          let options = jsYaml.load(tagAnnotation.text)
          tagGroupsAnnotations[groupBelongedTo].tags.push(new Tag({
            name: tagName,
            namespace: this.model.namespace,
            options: options || {},
            tags: [
              this.model.namespace + ':' + this.model.config.grouped.relation + ':' + groupBelongedTo,
              this.model.namespace + ':' + this.model.config.grouped.subgroup + ':' + tagName]
          }, tagGroupsAnnotations[groupBelongedTo]))
          this.model.currentTags = tagGroupsAnnotations
        }
      }
    }
    // Reorder the codes by name
    tagGroupsAnnotations = _.map(tagGroupsAnnotations, (tagGroup) => { tagGroup.tags = _.sortBy(tagGroup.tags, 'name'); return tagGroup })
    // Set color for each code
    tagGroupsAnnotations = _.map(tagGroupsAnnotations, (tagGroup) => {
      if (tagGroup.tags.length > 0) {
        tagGroup.tags = _.map(tagGroup.tags, (tag, index) => {
          let color = ColorUtils.setAlphaToColor(colors[tagGroup.config.name], 0.2 + index / tagGroup.tags.length * 0.8)
          tag.options.color = color
          tag.color = color
          return tag
        })
      }
      return tagGroup
    })
    // For groups without sub elements
    let emptyGroups = _.filter(tagGroupsAnnotations, (group) => { return group.tags.length === 0 })
    for (let j = 0; j < emptyGroups.length; j++) {
      let options = {color: ColorUtils.setAlphaToColor(colors[emptyGroups[j].config.name], 0.5)}
      let index = _.findIndex(tagGroupsAnnotations, (tagGroup) => { return tagGroup.config.name === emptyGroups[j].config.name })
      if (index >= 0) {
        tagGroupsAnnotations[index].tags.push(new Tag({
          name: emptyGroups[j].config.name,
          namespace: emptyGroups[j].namespace,
          options: options,
          tags: [emptyGroups[j].config.namespace + ':' + emptyGroups[j].config.group + ':' + emptyGroups[j].config.name]
        }))
      }
    }
    // Hash to array
    return _.sortBy(tagGroupsAnnotations, 'config.name')
  }

  destroy () {
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    // Remove tags wrapper
    $('#tagsWrapper').remove()
  }

  retrieveTagNameByPrefix (annotationTags, prefix) {
    for (let i = 0; i < annotationTags.length; i++) {
      if (_.startsWith(annotationTags[i].toLowerCase(), prefix.toLowerCase())) {
        return _.replace(annotationTags[i], prefix + ':', '')
      }
    }
    return null
  }

  createTagsButtonsForEvidencing (callback) {
    let arrayOfTagGroups = _.values(this.model.currentTags)
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let button = this.createButton({
        name: tagGroup.config.name,
        color: ColorUtils.setAlphaToColor(tagGroup.config.color, 0.5),
        handler: (event) => {
          LanguageUtils.dispatchCustomEvent(Events.annotate, {tags: [
            this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name]})
        }})
      this.tagsContainer.evidencing.append(button)
    }
  }

  createTagsButtonsForMarking (callback) {
    let arrayOfTagGroups = _.values(this.model.currentTags)
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let panel = this.createGroupedButtons({
        name: tagGroup.config.name,
        color: tagGroup.config.color,
        elements: tagGroup.tags,
        groupHandler: (event) => {
          // TODO Go to annotation with that group tag
        },
        buttonHandler: (event) => {
          // TODO Update all annotations for current document/tag
        }
      })
      this.tagsContainer.marking.append(panel)
    }
  }

  createButton ({name, color = 'white', handler}) {
    let tagButtonTemplate = document.querySelector('#tagButtonTemplate')
    let tagButton = $(tagButtonTemplate.content.firstElementChild).clone().get(0)
    tagButton.innerText = name
    tagButton.title = name
    tagButton.setAttribute('role', 'annotation')
    if (color) {
      $(tagButton).css('background-color', color)
    }
    // Set handler for button
    tagButton.addEventListener('click', handler)
    return tagButton
  }

  createGroupedButtons ({name, color = 'white', elements, groupHandler, buttonHandler}) {
    if (elements.length > 0) { // Only create group containers for groups which have elements
      // Create the container
      let tagGroupTemplate = document.querySelector('#tagGroupTemplate')
      let tagGroup = $(tagGroupTemplate.content.firstElementChild).clone().get(0)
      let tagButtonContainer = $(tagGroup).find('.tagButtonContainer')
      let groupNameSpan = tagGroup.querySelector('.groupName')
      groupNameSpan.innerText = name
      groupNameSpan.title = name
      // Create buttons and add to the container
      for (let i = 0; i < elements.length; i++) {
        let element = elements[i]
        let button = this.createButton({
          name: element.name,
          color: ColorUtils.setAlphaToColor(element.color, 0.5),
          handler: buttonHandler})
        tagButtonContainer.append(button)
      }
      return tagGroup
    }
  }

  initEventHandlers (callback) {
    // For mode change
    this.events.modeChange = {
      element: document,
      event: Events.modeChanged,
      handler: (event) => { this.modeChangeHandler(event) }
    }
    this.events.modeChange.element.addEventListener(this.events.modeChange.event, this.events.modeChange.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  modeChangeHandler (event) {
    if (event.detail.mode === ModeManager.modes.evidencing) {
      this.showEvidencingTagsContainer()
    } else if (event.detail.mode === ModeManager.modes.mark) {
      this.showMarkingTagsContainer()
    } else if (event.detail.mode === ModeManager.modes.view) {
      this.showViewingTagsContainer()
    }
  }

  showEvidencingTagsContainer () {
    $(this.tagsContainer.viewing).attr('aria-hidden', 'true')
    $(this.tagsContainer.marking).attr('aria-hidden', 'true')
    $(this.tagsContainer.evidencing).attr('aria-hidden', 'false')
  }

  showMarkingTagsContainer () {
    $(this.tagsContainer.viewing).attr('aria-hidden', 'true')
    $(this.tagsContainer.marking).attr('aria-hidden', 'false')
    $(this.tagsContainer.evidencing).attr('aria-hidden', 'true')
  }

  showViewingTagsContainer () {
    $(this.tagsContainer.viewing).attr('aria-hidden', 'false')
    $(this.tagsContainer.marking).attr('aria-hidden', 'true')
    $(this.tagsContainer.evidencing).attr('aria-hidden', 'true')
  }

  /**
   * Given a no grouped tag container reorder giving a specific order for that
   * @param order
   * @param container
   */
  reorderNoGroupedTagContainer (order, container) {
    // Reorder marking container
    for (let i = order.length - 1; i >= 0; i--) {
      let criteria = order[i]
      let tagButton = _.find(container.querySelectorAll('.tagButton'), (elem) => { return elem.title === criteria })
      let elem = $(tagButton).detach()
      $(container).prepend(elem)
    }
  }

  /**
   * Given a grouped tag container reorder the groups giving a specific order
   * @param order
   * @param container
   */
  reorderGroupedTagContainer (order, container) {
    // Reorder marking container
    for (let i = order.length - 1; i >= 0; i--) {
      let criteria = order[i]
      let tagGroup = _.find(container.querySelectorAll('.tagGroup'), (elem) => { return elem.children[0].title === criteria })
      let elem = $(tagGroup).detach()
      $(container).prepend(elem)
    }
  }

  getFilteringTagList () {
    return _.map(this.currentTags, (tagGroup) => {
      return this.getTagFromGroup(tagGroup)
    })
  }

  getTagFromGroup (tagGroup) {
    return this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name
  }

  findAnnotationTagInstance (annotation) {
    let tags = annotation.tags
    let criteriaTag = _.find(tags, (tag) => {
      return tag.includes('exam:isCriteriaOf:')
    }).replace('exam:isCriteriaOf:')
    let groupTag = _.find(window.abwa.tagManager.currentTags, (tagGroupInstance) => {
      return criteriaTag.includes(tagGroupInstance.config.name)
    })
    if (tags.length > 1) {
      let markTag = _.find(tags, (tag) => {
        return tag.includes('exam:mark:')
      }).replace('exam:mark:')
      let tag = _.find(groupTag.tags, (tagInstance) => {
        return markTag.includes(tagInstance.name)
      })
      return tag
    } else {
      return groupTag
    }
  }
}

module.exports = TagManager
