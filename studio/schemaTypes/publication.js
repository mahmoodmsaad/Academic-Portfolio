export default {
  name: 'publication',
  title: 'Publication',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Paper Title',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'authors',
      title: 'Authors',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'journal',
      title: 'Journal/Conference',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'year',
      title: 'Year',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Published', value: 'Published'},
          {title: 'Under Review', value: 'Under Review'},
          {title: 'Submitted', value: 'Submitted'},
          {title: 'In Preparation', value: 'In Preparation'}
        ]
      }
    },
    {
      name: 'link',
      title: 'Link (DOI or URL)',
      type: 'url'
    },
    {
      name: 'order',
      title: 'Display Order',
      type: 'number'
    }
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'year'
    }
  }
}
