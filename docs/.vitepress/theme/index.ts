import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import PageActions from './PageActions.vue'
import './custom.css'

// The default theme, with the LLM actions (copy or view the page as Markdown, the whole
// documentation) above the content of every documentation page.
export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { 'doc-before': () => h(PageActions) }),
}
