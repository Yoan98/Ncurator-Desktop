import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      '@typescript-eslint/explicit-function-return-type': 0,
      'prettier/prettier': 0,
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-empty-function': 0,
      'react-hooks/set-state-in-effect': 0,
      'react/prop-types': 0
    }
  },
  {
    files: [
      'src/main/services/ai/**/*.{ts,tsx}',
      'src/main/services/storage/domains/ChatStore.ts',
      'src/main/services/storage/domains/DocumentsStore.ts',
      'src/main/services/storage/domains/LlmConfigStore.ts',
      'src/preload/index.ts',
      'src/shared/types.ts',
      'src/main/utils/serialization.ts',
      'src/renderer/src/utils/serialization.ts',
      'src/renderer/src/pages/ChatPage.tsx'
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error'
    }
  },
  eslintConfigPrettier
)
