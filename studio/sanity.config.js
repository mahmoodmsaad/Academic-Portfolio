import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'Academic Portfolio',

  projectId: 'svudrtoe',
  dataset: 'production',

  plugins: [structureTool(), visionTool()],

  schema: {
    types: schemaTypes,
  },

  // Allow CORS from your production domain
  cors: {
    origins: [
      'http://localhost:3002',
      'http://localhost:5173',
      'https://mah-mood.live',
      'https://*.amplifyapp.com'
    ]
  },

  // API configuration
  api: {
    projectId: 'svudrtoe',
    dataset: 'production',
  }
})
