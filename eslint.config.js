import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'server/public/**'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,vue}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  },
  {
    files: ['server/**/*.js', 'shared/**/*.js', '*.js', 'web/vite.config.js', 'web/uno.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['web/src/**/*.{js,vue}'],
    languageOptions: { globals: globals.browser },
    rules: {
      // 彈窗一律用 Vue 元件（NoticeDialog），不用會阻擋瀏覽器的 alert / confirm / prompt
      'no-alert': 'error',
      // 不使用 jQuery，DOM 與資料一律由 Vue 處理
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'jquery', message: '不使用 jQuery，請改用 Vue 資料綁定與 axios。' }] },
      ],
      'no-restricted-globals': [
        'error',
        { name: '$', message: '不使用 jQuery。' },
        { name: 'jQuery', message: '不使用 jQuery。' },
      ],
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // 排版交給 Prettier，關掉會衝突的規則
  prettier,
];
