const Config = {
  purposeReading: {
    contentAnnotator: 'text',
    namespace: 'purpose',
    sidebar: {
    },
    location: true,
    tags: {}
  },
  slrDataExtraction: {
    contentAnnotator: 'text', // Type of content annotator
    namespace: 'slr', // Namespace for the annotations
    sidebar: {},
    location: true, // Location mode
    tags: { // Defined tags for the domain
      grouped: { // Grouped annotations
        group: 'facet',
        subgroup: 'code',
        relation: 'isCodeOf'
      },
      statics: { // Other static tags used in the domain
        multivalued: 'multivalued',
        inductive: 'inductive',
        validated: 'validated',
        spreadsheet: 'spreadsheet'
      }
    }
  },
  exams: {
    contentAnnotator: 'text',
    namespace: 'exam',
    sidebar: {},
    location: true,
    pattern: '',
    tags: { // Defined tags for the domain
      grouped: { // Grouped annotations
        group: 'criteria',
        subgroup: 'mark',
        relation: 'isCriteriaOf'
      },
      statics: { // Other static tags used in the domain
        inductive: 'inductive',
        validated: 'validated',
        spreadsheet: 'spreadsheet',
        documentNames: 'documentNames'
      }
    }
  }
}

module.exports = Config