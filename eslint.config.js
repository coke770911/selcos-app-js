import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';

/** 用註解壓掉型別檢查的指令，強型別規則不允許 */
const TS_DIRECTIVE = /@ts-(ignore|nocheck|expect-error)\b/;

/** @type {import('eslint').ESLint.Plugin} */
const typingPlugin = {
  rules: {
    'no-ts-directive': {
      meta: {
        type: 'problem',
        docs: { description: '禁止用 @ts-ignore／@ts-nocheck／@ts-expect-error 壓掉型別錯誤' },
        messages: { banned: '不可用 {{directive}} 壓掉型別錯誤，請修正型別。' },
        schema: [],
      },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              const match = TS_DIRECTIVE.exec(comment.value);
              if (match && comment.loc) {
                context.report({
                  loc: comment.loc,
                  messageId: 'banned',
                  data: { directive: match[0] },
                });
              }
            }
          },
        };
      },
    },
  },
};

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
    plugins: { typing: typingPlugin },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // 強型別：比較用 ===／!==，型別轉換要明確，不可壓掉型別檢查
      eqeqeq: ['error', 'always'],
      'no-implicit-coercion': 'error',
      'typing/no-ts-directive': 'error',
    },
  },
  // 排版交給 Prettier，關掉會衝突的規則
  prettier,
];
