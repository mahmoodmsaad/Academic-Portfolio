export default {
  name: 'socialLink',
  title: 'Social Link',
  type: 'document',
  fields: [
    {
      name: 'platform',
      title: 'Platform',
      type: 'string',
      options: {
        list: [
          {title: 'LinkedIn', value: 'LinkedIn'},
          {title: 'GitHub', value: 'GitHub'},
          {title: 'Email', value: 'Email'},
          {title: 'Twitter', value: 'Twitter'},
          {title: 'ResearchGate', value: 'ResearchGate'},
          {title: 'Google Scholar', value: 'Google Scholar'},
          {title: 'ORCID', value: 'ORCID'}
        ]
      },
      validation: Rule => Rule.required()
    },
    {
      name: 'url',
      title: 'URL',
      type: 'url',
      validation: Rule => Rule.required()
    },
    {
      name: 'icon',
      title: 'Icon Name',
      type: 'string',
      options: {
        list: [
          {title: 'LinkedIn', value: 'linkedin'},
          {title: 'GitHub', value: 'github'},
          {title: 'Email', value: 'email'},
          {title: 'Twitter', value: 'twitter'}
        ]
      }
    }
  ],
  preview: {
    select: {
      title: 'platform',
      subtitle: 'url'
    }
  }
}
