// eslint.config.mjs
import antfu from '@antfu/eslint-config'
import tsdoc from 'eslint-plugin-tsdoc'

export default antfu()
  .prepend({
    ignores: [
      'web/**',
      'docs/**',
    ],
  })
  .append({
    plugins: {
      tsdoc,
    },

    rules: {
      'tsdoc/syntax': 'off',
      'no-cond-assign': 'off',
      'yml/plain-scalar': 'off',
      'yml/quotes': 'off',
      'unicorn/prefer-number-properties': 'off',
      'perfectionist/sort-named-imports': 'off',
    },
  })
