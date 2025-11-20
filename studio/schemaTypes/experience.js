export default {
  name: 'experience',
  title: 'Experience',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Job Title',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'organization',
      title: 'Organization',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'location',
      title: 'Location',
      type: 'string'
    },
    {
      name: 'date',
      title: 'Date Range',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          {title: 'Experience', value: 'experience'},
          {title: 'Education', value: 'education'}
        ]
      },
      validation: Rule => Rule.required()
    },
    {
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [{type: 'string'}]
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
      subtitle: 'organization'
    }
  }
}
