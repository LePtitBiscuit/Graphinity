// The pages of the site, in reading order. Shared by the VitePress configuration (navigation) and
// docs/scripts/llms.ts (llms.txt, llms-full.txt): a page that is not here is not published for LLMs.
import type { DefaultTheme } from 'vitepress'

export const sidebar: DefaultTheme.Sidebar = [
  {
    text: 'Introduction',
    items: [
      { text: 'What is Graphinity?', link: '/guide/what-is-graphinity' },
      { text: 'Installation', link: '/guide/installation' },
      { text: 'Quick start', link: '/guide/quick-start' },
      { text: 'Live demo', link: '/guide/demo' },
    ],
  },
  {
    text: 'Concepts',
    items: [
      { text: 'Universes', link: '/concepts/universes' },
      { text: 'Nodes', link: '/concepts/nodes' },
      { text: 'Connections', link: '/concepts/connections' },
      { text: 'Sub-universes and navigation', link: '/concepts/sub-universes' },
      { text: 'Groups and tags', link: '/concepts/groups-and-tags' },
      { text: 'File structure', link: '/concepts/file-structure' },
      { text: 'Automatic layout', link: '/concepts/layout' },
    ],
  },
  {
    text: 'Configuration',
    items: [
      { text: 'Overview', link: '/config/' },
      { text: 'Universe', link: '/config/universe' },
      { text: 'Node', link: '/config/node' },
      { text: 'Connection', link: '/config/connection' },
      { text: 'Group', link: '/config/group' },
      { text: 'Tags', link: '/config/tags' },
      { text: 'Icons', link: '/config/icons' },
      { text: 'Colors and styles', link: '/config/colors-and-styles' },
      { text: 'Validation and limits', link: '/config/validation' },
      { text: 'Complete examples', link: '/config/examples' },
    ],
  },
  {
    text: 'CLI',
    items: [
      { text: 'Overview', link: '/cli/' },
      { text: 'init', link: '/cli/init' },
      { text: 'dev', link: '/cli/dev' },
      { text: 'validate', link: '/cli/validate' },
      { text: 'build', link: '/cli/build' },
      { text: 'Common errors', link: '/cli/errors' },
    ],
  },
  {
    text: 'Guides',
    items: [
      { text: 'Create a simple diagram', link: '/guides/simple-diagram' },
      { text: 'Add connections', link: '/guides/connections' },
      { text: 'Nest universes', link: '/guides/nested-universes' },
      { text: 'Use service logos', link: '/guides/service-logos' },
      { text: 'Group, tag and style', link: '/guides/styling' },
      { text: 'Preview locally', link: '/guides/local-preview' },
      { text: 'Build and host a static site', link: '/guides/static-hosting' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'How the engine works', link: '/reference/engine' },
      { text: 'Viewer', link: '/reference/viewer' },
      { text: 'Programmatic API', link: '/reference/api' },
      { text: 'Limitations', link: '/reference/limitations' },
      { text: 'Documentation for LLMs', link: '/reference/llms' },
    ],
  },
  {
    text: 'Project',
    items: [
      { text: 'Contributing', link: '/project/contributing' },
      { text: 'Building and releasing', link: '/project/releasing' },
      { text: 'License', link: '/project/license' },
    ],
  },
]
